import type { PointMassState, RigidBodyBoxState, SimulationState, Vector3, Quaternion, IntegratorName } from "./types";
import { vecAdd, vecScale, quatFromAngularVelocity, quatMultiply, quatNormalize } from "./types";

export type Derivative = {
  pointAccelerations: Vector3[];
  rigidLinearAccelerations: Vector3[];
  rigidAngularAccelerations: Vector3[]; // simple model: zero unless provided
};

export type DynamicsContext = {
  computeDerivative: (state: SimulationState) => Derivative;
  dt: number;
};

function advanceOrientation(orientation: Quaternion, angularVelocity: Vector3, dt: number): Quaternion {
  // q_dot = 0.5 * omega_quat * q
  const omegaQuat: Quaternion = quatFromAngularVelocity([angularVelocity[0] * 0.5 * dt, angularVelocity[1] * 0.5 * dt, angularVelocity[2] * 0.5 * dt]);
  const dq = quatMultiply(omegaQuat, orientation);
  const qNext: Quaternion = [orientation[0] + dq[0], orientation[1] + dq[1], orientation[2] + dq[2], orientation[3] + dq[3]];
  return quatNormalize(qNext);
}

function cloneState(state: SimulationState): SimulationState {
  return {
    time: state.time,
    stepIndex: state.stepIndex,
    pointMasses: state.pointMasses.map(p => ({ id: p.id, mass: p.mass, position: [...p.position], velocity: [...p.velocity] })),
    rigidBodies: state.rigidBodies.map(r => ({
      id: r.id,
      mass: r.mass,
      size: [...r.size],
      position: [...r.position],
      velocity: [...r.velocity],
      orientation: [...r.orientation],
      angularVelocity: [...r.angularVelocity],
    })),
  };
}

export function integrateEuler(ctx: DynamicsContext, current: SimulationState): SimulationState {
  const derivative = ctx.computeDerivative(current);
  const next = cloneState(current);
  const dt = ctx.dt;

  next.time += dt;
  next.stepIndex += 1;

  // point masses
  for (let i = 0; i < next.pointMasses.length; i++) {
    const p = next.pointMasses[i];
    const a = derivative.pointAccelerations[i];
    p.position = vecAdd(p.position, vecScale(p.velocity, dt));
    p.velocity = vecAdd(p.velocity, vecScale(a, dt));
  }

  for (let i = 0; i < next.rigidBodies.length; i++) {
    const r = next.rigidBodies[i];
    const aL = derivative.rigidLinearAccelerations[i];
    const aA = derivative.rigidAngularAccelerations[i];
    r.position = vecAdd(r.position, vecScale(r.velocity, dt));
    r.velocity = vecAdd(r.velocity, vecScale(aL, dt));
    r.angularVelocity = vecAdd(r.angularVelocity, vecScale(aA, dt));
    r.orientation = advanceOrientation(r.orientation, r.angularVelocity, dt);
  }

  return next;
}

export function integrateSemiImplicitEuler(ctx: DynamicsContext, current: SimulationState): SimulationState {
  const derivative = ctx.computeDerivative(current);
  const next = cloneState(current);
  const dt = ctx.dt;

  next.time += dt;
  next.stepIndex += 1;

  for (let i = 0; i < next.pointMasses.length; i++) {
    const p = next.pointMasses[i];
    const a = derivative.pointAccelerations[i];
    p.velocity = vecAdd(p.velocity, vecScale(a, dt));
    p.position = vecAdd(p.position, vecScale(p.velocity, dt));
  }

  for (let i = 0; i < next.rigidBodies.length; i++) {
    const r = next.rigidBodies[i];
    const aL = derivative.rigidLinearAccelerations[i];
    const aA = derivative.rigidAngularAccelerations[i];
    r.velocity = vecAdd(r.velocity, vecScale(aL, dt));
    r.position = vecAdd(r.position, vecScale(r.velocity, dt));
    r.angularVelocity = vecAdd(r.angularVelocity, vecScale(aA, dt));
    r.orientation = advanceOrientation(r.orientation, r.angularVelocity, dt);
  }

  return next;
}

export function integrateRK4(ctx: DynamicsContext, current: SimulationState): SimulationState {
  // For our model accelerations depend on state (position/velocity), particularly drag and springs.
  const dt = ctx.dt;
  const halfDt = dt * 0.5;

  const k1 = ctx.computeDerivative(current);

  const s2 = cloneState(current);
  for (let i = 0; i < s2.pointMasses.length; i++) {
    s2.pointMasses[i].position = vecAdd(s2.pointMasses[i].position, vecScale(s2.pointMasses[i].velocity, halfDt));
    s2.pointMasses[i].velocity = vecAdd(s2.pointMasses[i].velocity, vecScale(k1.pointAccelerations[i], halfDt));
  }
  for (let i = 0; i < s2.rigidBodies.length; i++) {
    s2.rigidBodies[i].position = vecAdd(s2.rigidBodies[i].position, vecScale(s2.rigidBodies[i].velocity, halfDt));
    s2.rigidBodies[i].velocity = vecAdd(s2.rigidBodies[i].velocity, vecScale(k1.rigidLinearAccelerations[i], halfDt));
    s2.rigidBodies[i].angularVelocity = vecAdd(s2.rigidBodies[i].angularVelocity, vecScale(k1.rigidAngularAccelerations[i], halfDt));
    s2.rigidBodies[i].orientation = advanceOrientation(s2.rigidBodies[i].orientation, s2.rigidBodies[i].angularVelocity, halfDt);
  }
  const k2 = ctx.computeDerivative(s2);

  const s3 = cloneState(current);
  for (let i = 0; i < s3.pointMasses.length; i++) {
    s3.pointMasses[i].position = vecAdd(s3.pointMasses[i].position, vecScale(s3.pointMasses[i].velocity, halfDt));
    s3.pointMasses[i].velocity = vecAdd(s3.pointMasses[i].velocity, vecScale(k2.pointAccelerations[i], halfDt));
  }
  for (let i = 0; i < s3.rigidBodies.length; i++) {
    s3.rigidBodies[i].position = vecAdd(s3.rigidBodies[i].position, vecScale(s3.rigidBodies[i].velocity, halfDt));
    s3.rigidBodies[i].velocity = vecAdd(s3.rigidBodies[i].velocity, vecScale(k2.rigidLinearAccelerations[i], halfDt));
    s3.rigidBodies[i].angularVelocity = vecAdd(s3.rigidBodies[i].angularVelocity, vecScale(k2.rigidAngularAccelerations[i], halfDt));
    s3.rigidBodies[i].orientation = advanceOrientation(s3.rigidBodies[i].orientation, s3.rigidBodies[i].angularVelocity, halfDt);
  }
  const k3 = ctx.computeDerivative(s3);

  const s4 = cloneState(current);
  for (let i = 0; i < s4.pointMasses.length; i++) {
    s4.pointMasses[i].position = vecAdd(s4.pointMasses[i].position, vecScale(s4.pointMasses[i].velocity, dt));
    s4.pointMasses[i].velocity = vecAdd(s4.pointMasses[i].velocity, vecScale(k3.pointAccelerations[i], dt));
  }
  for (let i = 0; i < s4.rigidBodies.length; i++) {
    s4.rigidBodies[i].position = vecAdd(s4.rigidBodies[i].position, vecScale(s4.rigidBodies[i].velocity, dt));
    s4.rigidBodies[i].velocity = vecAdd(s4.rigidBodies[i].velocity, vecScale(k3.rigidLinearAccelerations[i], dt));
    s4.rigidBodies[i].angularVelocity = vecAdd(s4.rigidBodies[i].angularVelocity, vecScale(k3.rigidAngularAccelerations[i], dt));
    s4.rigidBodies[i].orientation = advanceOrientation(s4.rigidBodies[i].orientation, s4.rigidBodies[i].angularVelocity, dt);
  }
  const k4 = ctx.computeDerivative(s4);

  const next = cloneState(current);
  next.time += dt;
  next.stepIndex += 1;
  for (let i = 0; i < next.pointMasses.length; i++) {
    const vDelta = vecScale(
      [
        k1.pointAccelerations[i][0] + 2 * k2.pointAccelerations[i][0] + 2 * k3.pointAccelerations[i][0] + k4.pointAccelerations[i][0],
        k1.pointAccelerations[i][1] + 2 * k2.pointAccelerations[i][1] + 2 * k3.pointAccelerations[i][1] + k4.pointAccelerations[i][1],
        k1.pointAccelerations[i][2] + 2 * k2.pointAccelerations[i][2] + 2 * k3.pointAccelerations[i][2] + k4.pointAccelerations[i][2],
      ],
      dt / 6
    );
    next.pointMasses[i].velocity = vecAdd(next.pointMasses[i].velocity, vDelta);
    next.pointMasses[i].position = vecAdd(next.pointMasses[i].position, vecScale(next.pointMasses[i].velocity, dt));
  }
  for (let i = 0; i < next.rigidBodies.length; i++) {
    const aL = [
      k1.rigidLinearAccelerations[i][0] + 2 * k2.rigidLinearAccelerations[i][0] + 2 * k3.rigidLinearAccelerations[i][0] + k4.rigidLinearAccelerations[i][0],
      k1.rigidLinearAccelerations[i][1] + 2 * k2.rigidLinearAccelerations[i][1] + 2 * k3.rigidLinearAccelerations[i][1] + k4.rigidLinearAccelerations[i][1],
      k1.rigidLinearAccelerations[i][2] + 2 * k2.rigidLinearAccelerations[i][2] + 2 * k3.rigidLinearAccelerations[i][2] + k4.rigidLinearAccelerations[i][2],
    ] as Vector3;
    const aA = [
      k1.rigidAngularAccelerations[i][0] + 2 * k2.rigidAngularAccelerations[i][0] + 2 * k3.rigidAngularAccelerations[i][0] + k4.rigidAngularAccelerations[i][0],
      k1.rigidAngularAccelerations[i][1] + 2 * k2.rigidAngularAccelerations[i][1] + 2 * k3.rigidAngularAccelerations[i][1] + k4.rigidAngularAccelerations[i][1],
      k1.rigidAngularAccelerations[i][2] + 2 * k2.rigidAngularAccelerations[i][2] + 2 * k3.rigidAngularAccelerations[i][2] + k4.rigidAngularAccelerations[i][2],
    ] as Vector3;
    next.rigidBodies[i].velocity = vecAdd(next.rigidBodies[i].velocity, vecScale(aL, dt / 6));
    next.rigidBodies[i].angularVelocity = vecAdd(next.rigidBodies[i].angularVelocity, vecScale(aA, dt / 6));
    next.rigidBodies[i].position = vecAdd(next.rigidBodies[i].position, vecScale(next.rigidBodies[i].velocity, dt));
    next.rigidBodies[i].orientation = advanceOrientation(next.rigidBodies[i].orientation, next.rigidBodies[i].angularVelocity, dt);
  }

  return next;
}

export function pickIntegrator(name: IntegratorName) {
  switch (name) {
    case "euler":
      return integrateEuler;
    case "semi":
      return integrateSemiImplicitEuler;
    case "rk4":
    default:
      return integrateRK4;
  }
}


