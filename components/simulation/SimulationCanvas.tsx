"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, AdaptiveDpr, Preload } from "@react-three/drei";
import * as THREE from "three";
import { memo, useEffect, useMemo, useRef, useState } from "react";

// ---- Types ----
export type Vector3 = [number, number, number];

export type PointMass = {
  id: string;
  type: "pointMass";
  position: Vector3;
  radius?: number;
  color?: string;
  trail?: {
    enabled: boolean;
    maxPoints?: number;
    color?: string;
  };
};

export type RigidBox = {
  id: string;
  type: "rigidBox";
  position: Vector3;
  size: Vector3; // width, height, depth
  rotation?: Vector3; // Euler radians
  color?: string;
};

export type VectorArrow = {
  id: string;
  type: "vectorArrow";
  origin: Vector3;
  vector: Vector3; // direction and magnitude
  color?: string;
  scale?: number; // multiplies vector length
};

export type SceneObject = PointMass | RigidBox | VectorArrow;

export type SceneConfig = {
  objects: SceneObject[];
};

type InitApi = {
  syncState: (updater: (prev: SceneConfig) => SceneConfig) => void;
  applyAction: (action: { type: string; payload?: unknown }) => void;
};

export type SimulationCanvasProps = {
  sceneConfig: SceneConfig;
  onInit?: (api: InitApi) => void;
  showHelpers?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

// ---- Helpers ----
function addVectors(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function lengthOf(v: Vector3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

// ---- Renderers ----
const PointMassMesh = memo(function PointMassMesh({ obj }: { obj: PointMass }) {
  const trailRef = useRef<THREE.Line | null>(null);
  const positionsRef = useRef<Float32Array | null>(null);
  const writeIndexRef = useRef(0);

  const radius = obj.radius ?? 0.2;
  const color = obj.color ?? "#ff5533";

  // Initialize trail geometry buffer
  const trailGeo = useMemo(() => {
    if (!obj.trail?.enabled) return null;
    const maxPoints = obj.trail.maxPoints ?? 200;
    const positions = new Float32Array(maxPoints * 3);
    positionsRef.current = positions;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [obj.trail?.enabled, obj.trail?.maxPoints]);

  // Append to trail when position changes (no extra timers)
  useEffect(() => {
    if (!trailRef.current || !trailGeo || !positionsRef.current) return;
    const line = trailRef.current;
    const geometry = trailGeo;
    const positions = positionsRef.current;
    const current = new THREE.Vector3(...obj.position);
    const idx = writeIndexRef.current % (positions.length / 3);
    positions[idx * 3 + 0] = current.x;
    positions[idx * 3 + 1] = current.y;
    positions[idx * 3 + 2] = current.z;
    writeIndexRef.current++;
    (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    geometry.setDrawRange(0, Math.min(writeIndexRef.current, positions.length / 3));
    line.geometry = geometry;
  }, [obj.position, trailGeo]);

  return (
    <group position={obj.position as unknown as [number, number, number]}>
      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {obj.trail?.enabled && trailGeo ? (
        <line ref={trailRef}>
          {/* Simple polyline trail */}
          <primitive object={trailGeo} attach="geometry" />
          <lineBasicMaterial color={obj.trail.color ?? "#ffaa77"} linewidth={1} />
        </line>
      ) : null}
    </group>
  );
});

const RigidBoxMesh = memo(function RigidBoxMesh({ obj }: { obj: RigidBox }) {
  const color = obj.color ?? "#44aaff";
  return (
    <mesh
      position={obj.position as unknown as [number, number, number]}
      rotation={obj.rotation as unknown as [number, number, number]}
    >
      <boxGeometry args={obj.size as unknown as [number, number, number]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
});

const VectorArrows = memo(function VectorArrows({ arrows }: { arrows: VectorArrow[] }) {
  const color = arrows[0]?.color ?? "#22cc88";
  const arrowCount = arrows.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const cylinderRef = useRef<THREE.InstancedMesh | null>(null);
  const coneRef = useRef<THREE.InstancedMesh | null>(null);

  useEffect(() => {
    if (!cylinderRef.current || !coneRef.current) return;
    const cyl = cylinderRef.current;
    const con = coneRef.current;

    for (let i = 0; i < arrowCount; i++) {
      const a = arrows[i];
      const scale = a.scale ?? 1;
      const start = new THREE.Vector3(...a.origin);
      const vec = new THREE.Vector3(...a.vector).multiplyScalar(scale);
      const end = start.clone().add(vec);

      const len = Math.max(0.0001, vec.length());
      const shaftLen = len * 0.8;
      const headLen = len * 0.2;

      // Shaft: cylinder oriented along vector
      const mid = start.clone().add(vec.clone().setLength(shaftLen / 2));
      dir.copy(vec).normalize();
      dummy.position.copy(mid);
      // Orient Z-up cylinder to match dir using quaternion from up axis
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      dummy.quaternion.copy(quat);
      dummy.scale.set(0.05, shaftLen, 0.05);
      dummy.updateMatrix();
      cyl.setMatrixAt(i, dummy.matrix);

      // Head: cone at end
      dummy.position.copy(end);
      dummy.quaternion.copy(quat);
      dummy.scale.set(0.12, headLen, 0.12);
      dummy.updateMatrix();
      con.setMatrixAt(i, dummy.matrix);
    }

    cyl.instanceMatrix.needsUpdate = true;
    con.instanceMatrix.needsUpdate = true;
  }, [arrows, arrowCount, dir]);

  return (
    <group>
      <instancedMesh ref={cylinderRef} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, arrowCount]}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial color={color} />
      </instancedMesh>
      <instancedMesh ref={coneRef} args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, arrowCount]}>
        <coneGeometry args={[1, 1, 12]} />
        <meshStandardMaterial color={color} />
      </instancedMesh>
    </group>
  );
});

// ---- Scene switcher ----
function SceneObjects({ config }: { config: SceneConfig }) {
  const pointMasses = useMemo(() => config.objects.filter(o => o.type === "pointMass") as PointMass[], [config]);
  const boxes = useMemo(() => config.objects.filter(o => o.type === "rigidBox") as RigidBox[], [config]);
  const arrows = useMemo(() => config.objects.filter(o => o.type === "vectorArrow") as VectorArrow[], [config]);

  return (
    <group>
      {pointMasses.map(pm => (
        <PointMassMesh key={pm.id} obj={pm} />
      ))}
      {boxes.map(b => (
        <RigidBoxMesh key={b.id} obj={b} />
      ))}
      {arrows.length > 0 ? <VectorArrows arrows={arrows} /> : null}
    </group>
  );
}

// ---- Main component ----
export default function SimulationCanvas({ sceneConfig, onInit, showHelpers, className, style }: SimulationCanvasProps) {
  const [config, setConfig] = useState<SceneConfig>(sceneConfig);

  useEffect(() => {
    setConfig(sceneConfig);
  }, [sceneConfig]);

  useEffect(() => {
    if (!onInit) return;
    const api: InitApi = {
      syncState: (updater) => {
        setConfig(prev => updater(prev));
      },
      applyAction: (_action) => {
        // Placeholder for future physics/commands wiring
        // eslint-disable-next-line no-console
        console.log("applyAction called", _action);
      },
    };
    // eslint-disable-next-line no-console
    console.log("SimulationCanvas onInit");
    onInit(api);
  }, [onInit]);

  return (
    <div className={className} style={style}>
      <Canvas
        camera={{ position: [4, 3, 6], fov: 50 }}
        dpr={[1, 2]}
        shadows={false}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      >
        {/* Lights */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />

        {/* Optional helpers */}
        {showHelpers ? (
          <group>
            <gridHelper args={[20, 20, 0x444444, 0x222222]} />
            <axesHelper args={[3]} />
          </group>
        ) : null}

        {/* Scene objects */}
        <SceneObjects config={config} />

        {/* Controls */}
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
        <AdaptiveDpr pixelated />
        <Preload all />
      </Canvas>
    </div>
  );
}


