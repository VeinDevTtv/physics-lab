// Basic vector and quaternion types
export type Vector3 = [number, number, number];
export type Quaternion = [number, number, number, number];

// Simulation object definitions
export type PointMassConfig = {
  id: string;
  mass: number; // kilograms
  position: Vector3; // meters
  velocity: Vector3; // meters/second
  radius?: number;
  color?: string;
};

export type RigidBodyBoxConfig = {
  id: string;
  mass: number; // kilograms
  size: Vector3; // width, height, depth (meters)
  position: Vector3; // meters
  velocity: Vector3; // meters/second
  orientation: Quaternion; // unit quaternion [x,y,z,w]
  angularVelocity: Vector3; // radians/second in world frame (simple model)
  color?: string;
};

export type SpringConfig = {
  id: string;
  aId: string; // object id (point-mass only for now)
  bId: string; // object id (point-mass only for now)
  restLength: number; // meters
  stiffness: number; // N/m
  damping?: number; // Ns/m (dashpot term along spring axis)
};

export type JointConfig = {
  id: string;
  type: "fixed" | "hinge"; // placeholder for future expansion
  aId: string;
  bId: string;
};

export type GravityForceConfig = {
  g: number; // 9.81
  direction?: Vector3; // default [0, -1, 0]
};

export type LinearDragForceConfig = {
  coefficient: number; // b in F = -b * v (kg/s)
};

export type ForcesConfig = {
  gravity?: GravityForceConfig;
  linearDrag?: LinearDragForceConfig;
};

export type IntegratorName = "euler" | "semi" | "rk4";

export type SimulationConfig = {
  dt: number; // fixed time step in seconds
  integrator: IntegratorName;
  snapshotIntervalMs?: number; // how often to emit snapshot from the worker
  forces?: ForcesConfig;
  pointMasses?: PointMassConfig[];
  rigidBodies?: RigidBodyBoxConfig[];
  springs?: SpringConfig[];
  joints?: JointConfig[];
};

// Runtime state mirrors config and adds derived properties
export type PointMassState = {
  id: string;
  mass: number;
  position: Vector3;
  velocity: Vector3;
};

export type RigidBodyBoxState = {
  id: string;
  mass: number;
  size: Vector3;
  position: Vector3;
  velocity: Vector3;
  orientation: Quaternion;
  angularVelocity: Vector3;
};

export type SimulationState = {
  time: number; // seconds
  stepIndex: number; // integer steps executed
  pointMasses: PointMassState[];
  rigidBodies: RigidBodyBoxState[];
};

export type SnapshotMessage = {
  type: "snapshot";
  payload: SimulationState;
};

export type ControlMessage =
  | { type: "started" }
  | { type: "paused" }
  | { type: "initialized" };

export type WorkerMessage = SnapshotMessage | ControlMessage;

export type Impulse = {
  objectId: string;
  impulse: Vector3; // N*s
};

// Utility helpers
export function vecAdd(a: Vector3, b: Vector3): Vector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vecSub(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecScale(a: Vector3, s: number): Vector3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function vecDot(a: Vector3, b: Vector3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecLength(a: Vector3): number {
  return Math.sqrt(vecDot(a, a));
}

export function vecNormalize(a: Vector3): Vector3 {
  const len = vecLength(a);
  if (len === 0) return [0, 0, 0];
  return vecScale(a, 1 / len);
}

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatNormalize(q: Quaternion): Quaternion {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len === 0) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function quatFromAngularVelocity(omega: Vector3): Quaternion {
  // small-angle approximation: q = [wx, wy, wz, 0]
  return [omega[0], omega[1], omega[2], 0];
}


