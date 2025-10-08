"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SceneConfig } from "@/components/simulation/SimulationCanvas";

const SimulationCanvas = dynamic(() => import("@/components/simulation/SimulationCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[80vh] grid place-items-center text-sm text-neutral-500">
      Loading 3D scene...
    </div>
  ),
});

export default function SimDemoPage() {
  // Simple projectile motion demo: position updated on interval
  const g = useMemo(() => 9.81, []);
  const velocityRef = useRef<[number, number, number]>([2, 5, 0]);
  const positionRef = useRef<[number, number, number]>([0, 0.5, 0]);

  const [config, setConfig] = useState<SceneConfig>(() => ({
    objects: [
      {
        id: "proj",
        type: "pointMass",
        position: positionRef.current,
        radius: 0.15,
        color: "#ff5533",
        trail: { enabled: true, maxPoints: 300, color: "#ffaa77" },
      },
      {
        id: "ground",
        type: "rigidBox",
        position: [0, -0.55, 0],
        size: [10, 0.1, 10],
        color: "#3a3a3a",
      },
      {
        id: "vel",
        type: "vectorArrow",
        origin: positionRef.current,
        vector: velocityRef.current,
        color: "#22cc88",
        scale: 0.3,
      },
    ],
  }));
  const projIndexRef = useRef<number>(0);
  const velIndexRef = useRef<number>(2);

  // Integrate simple projectile motion with rAF
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastCommit = last;
    const step = (now: number) => {
      const rawDt = (now - last) / 1000;
      last = now;
      const dt = Math.min(1 / 30, Math.max(1 / 240, rawDt));

      const v = velocityRef.current;
      const p = positionRef.current;

      const newV: [number, number, number] = [v[0], v[1] - g * dt, v[2]];
      const newP: [number, number, number] = [p[0] + newV[0] * dt, p[1] + newV[1] * dt, p[2] + newV[2] * dt];

      if (newP[1] < 0.15) {
        newP[1] = 0.15;
        newV[1] = -newV[1] * 0.6;
        newV[0] *= 0.98;
        newV[2] *= 0.98;
      }

      velocityRef.current = newV;
      positionRef.current = newP;

      if (now - lastCommit > 50) {
        lastCommit = now;
        startTransition(() => {
          setConfig(prev => {
            const nextObjects = prev.objects.slice();
            const pi = projIndexRef.current;
            const vi = velIndexRef.current;
            const proj = nextObjects[pi];
            const vel = nextObjects[vi];
            if (proj && proj.type === "pointMass") {
              nextObjects[pi] = { ...proj, position: [...newP] } as typeof proj;
            }
            if (vel && vel.type === "vectorArrow") {
              nextObjects[vi] = { ...vel, origin: [...newP], vector: [...newV] } as typeof vel;
            }
            return { objects: nextObjects };
          });
        });
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [g]);

  return (
    <div className="w-full h-[80vh]">
      <SimulationCanvas
        sceneConfig={config}
        showHelpers
        onInit={(api) => {
          // eslint-disable-next-line no-console
          console.log("onInit invoked", api);
        }}
      />
    </div>
  );
}


