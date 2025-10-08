import type {
  ForcesConfig,
  IntegratorName,
  PointMassConfig,
  PointMassState,
  RigidBodyBoxConfig,
  RigidBodyBoxState,
  SimulationConfig,
  SimulationState,
  SpringConfig,
  Vector3,
} from "./types";
import { vecAdd, vecScale, vecSub, vecLength, vecNormalize } from "./types";
import { sumAccelerationsForPointMass } from "./forces";
import { pickIntegrator, type DynamicsContext, type Derivative } from "./integrators";

export class PhysicsEngine {
  private dt: number;
  private integratorName: IntegratorName;
  private forces?: ForcesConfig;
  private pointMassIndexById: Map<string, number> = new Map();
  private springs: SpringConfig[] = [];
  private state: SimulationState;

  constructor(config: SimulationConfig) {
    this.dt = config.dt;
    this.integratorName = config.integrator;
    this.forces = config.forces;
    const pointMasses: PointMassState[] = (config.pointMasses ?? []).map((pm, idx) => {
      this.pointMassIndexById.set(pm.id, idx);
      return { id: pm.id, mass: pm.mass, position: [...pm.position], velocity: [...pm.velocity] };
    });
    const rigidBodies: RigidBodyBoxState[] = (config.rigidBodies ?? []).map(rb => ({
      id: rb.id,
      mass: rb.mass,
      size: [...rb.size],
      position: [...rb.position],
      velocity: [...rb.velocity],
      orientation: [...rb.orientation],
      angularVelocity: [...rb.angularVelocity],
    }));
    this.springs = config.springs ?? [];
    this.state = {
      time: 0,
      stepIndex: 0,
      pointMasses,
      rigidBodies,
    };
  }

  public getState(): SimulationState {
    // Return a deep copy to maintain determinism
    return JSON.parse(JSON.stringify(this.state)) as SimulationState;
  }

  public getDt(): number {
    return this.dt;
  }

  public applyImpulse(objectId: string, impulse: Vector3) {
    const pmIndex = this.pointMassIndexById.get(objectId);
    if (pmIndex !== undefined) {
      const p = this.state.pointMasses[pmIndex];
      p.velocity = vecAdd(p.velocity, vecScale(impulse, 1 / p.mass));
      return;
    }
    const rb = this.state.rigidBodies.find(r => r.id === objectId);
    if (rb) {
      rb.velocity = vecAdd(rb.velocity, vecScale(impulse, 1 / rb.mass));
    }
  }

  public step() {
    const computeDerivative = (st: SimulationState): Derivative => {
      // point mass forces
      const pointAccelerations: Vector3[] = st.pointMasses.map(pm => sumAccelerationsForPointMass(pm, this.forces));

      // add spring forces for point masses
      for (const spring of this.springs) {
        const ia = this.pointMassIndexById.get(spring.aId);
        const ib = this.pointMassIndexById.get(spring.bId);
        if (ia === undefined || ib === undefined) continue;
        const a = st.pointMasses[ia];
        const b = st.pointMasses[ib];
        const delta = vecSub(b.position, a.position);
        const distance = vecLength(delta);
        const direction = distance > 0 ? vecScale(delta, 1 / distance) : [0, 0, 0];
        const extension = distance - spring.restLength;
        const relativeVel = vecSub(b.velocity, a.velocity);
        const dampingAlong = (spring.damping ?? 0) * (relativeVel[0] * direction[0] + relativeVel[1] * direction[1] + relativeVel[2] * direction[2]);
        const forceMagnitude = -spring.stiffness * extension - dampingAlong;
        const forceVec = vecScale(direction, forceMagnitude);
        // Apply equal and opposite forces
        pointAccelerations[ia] = vecAdd(pointAccelerations[ia], vecScale(forceVec, 1 / a.mass));
        pointAccelerations[ib] = vecAdd(pointAccelerations[ib], vecScale(vecScale(forceVec, -1), 1 / b.mass));
      }

      // rigid bodies: simple example — only gravity and linear drag on COM (no torques)
      const rigidLinearAccelerations: Vector3[] = st.rigidBodies.map(rb => {
        const gAcc = this.forces?.gravity ? vecScale((this.forces.gravity.direction ?? [0, -1, 0]) as Vector3, this.forces.gravity.g) : [0, 0, 0];
        const dragAcc = this.forces?.linearDrag ? vecScale(rb.velocity, -this.forces.linearDrag.coefficient / rb.mass) : ([0, 0, 0] as Vector3);
        return vecAdd(gAcc, dragAcc);
      });
      const rigidAngularAccelerations: Vector3[] = st.rigidBodies.map(_rb => [0, 0, 0]);

      return { pointAccelerations, rigidLinearAccelerations, rigidAngularAccelerations };
    };

    const ctx: DynamicsContext = {
      dt: this.dt,
      computeDerivative,
    };
    const integrate = pickIntegrator(this.integratorName);
    this.state = integrate(ctx, this.state);
  }
}


