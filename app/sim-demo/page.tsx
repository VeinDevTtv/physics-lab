"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SimulationCanvas, { SceneConfig } from "@/components/simulation/SimulationCanvas";

export default function SimDemoPage() {
  // Simple projectile motion demo: position updated on interval
  const g = useMemo(() => 9.81, []);
  const dt = 1 / 60; // 60 Hz update
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

  // Integrate simple projectile motion
  useEffect(() => {
    const handle = setInterval(() => {
      const v = velocityRef.current;
      const p = positionRef.current;

      // Integrate
      const newV: [number, number, number] = [v[0], v[1] - g * dt, v[2]];
      const newP: [number, number, number] = [p[0] + newV[0] * dt, p[1] + newV[1] * dt, p[2] + newV[2] * dt];

      // Simple ground collision
      if (newP[1] < 0.15) {
        newP[1] = 0.15;
        newV[1] = -newV[1] * 0.6; // damped bounce
        newV[0] *= 0.98;
        newV[2] *= 0.98;
      }

      velocityRef.current = newV;
      positionRef.current = newP;

      setConfig(prev => ({
        objects: prev.objects.map(o => {
          if (o.type === "pointMass" && o.id === "proj") {
            return { ...o, position: newP };
          }
          if (o.type === "vectorArrow" && o.id === "vel") {
            return { ...o, origin: newP, vector: newV };
          }
          return o;
        }),
      }));
    }, dt * 1000);

    return () => clearInterval(handle);
  }, [dt, g]);

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


