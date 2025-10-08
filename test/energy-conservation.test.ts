import { describe, it, expect } from "vitest";
import { PhysicsEngine } from "../workers/physics/engine";
import type { SimulationConfig } from "../workers/physics/types";

function kineticEnergy(m: number, v: [number, number, number]) {
  const speed2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  return 0.5 * m * speed2;
}

function potentialEnergy(m: number, y: number, g: number) {
  return m * g * y;
}

describe("Projectile energy conservation (no drag)", () => {
  it("conserves total mechanical energy within numerical tolerance (RK4)", () => {
    const g = 9.81;
    const m = 1;
    const config: SimulationConfig = {
      dt: 1 / 600, // small step
      integrator: "rk4",
      snapshotIntervalMs: 1000,
      forces: { gravity: { g, direction: [0, -1, 0] } },
      pointMasses: [
        {
          id: "proj",
          mass: m,
          position: [0, 0, 0],
          velocity: [5, 8, 0],
        },
      ],
    };

    const engine = new PhysicsEngine(config);
    const initial = engine.getState();
    const p0 = initial.pointMasses[0];
    const E0 = kineticEnergy(p0.mass, p0.velocity) + potentialEnergy(p0.mass, p0.position[1], g);

    // simulate for 5 seconds
    const steps = Math.round(5 / config.dt);
    for (let i = 0; i < steps; i++) {
      engine.step();
    }

    const final = engine.getState();
    const pf = final.pointMasses[0];
    const Ef = kineticEnergy(pf.mass, pf.velocity) + potentialEnergy(pf.mass, pf.position[1], g);

    const relError = Math.abs(Ef - E0) / Math.max(1, Math.abs(E0));
    expect(relError).toBeLessThan(1e-3);
  });
});


