import type {
  ForcesConfig,
  GravityForceConfig,
  LinearDragForceConfig,
  PointMassState,
  Vector3,
} from "./types";
import { vecAdd, vecScale } from "./types";

export function gravityAcceleration(
  mass: number,
  _position: Vector3,
  _velocity: Vector3,
  config?: GravityForceConfig
): Vector3 {
  if (!config) return [0, 0, 0];
  const direction = config.direction ?? [0, -1, 0];
  const gVec = vecScale(direction, config.g);
  // a = F/m = (m*g)/m = g
  return gVec;
}

export function linearDragAcceleration(
  mass: number,
  _position: Vector3,
  velocity: Vector3,
  config?: LinearDragForceConfig
): Vector3 {
  if (!config) return [0, 0, 0];
  if (mass <= 0) return [0, 0, 0];
  // F = - b * v  => a = F/m
  const scale = -config.coefficient / mass;
  return vecScale(velocity, scale);
}

export function sumAccelerationsForPointMass(
  point: PointMassState,
  forces?: ForcesConfig
): Vector3 {
  const aG = gravityAcceleration(point.mass, point.position, point.velocity, forces?.gravity);
  const aD = linearDragAcceleration(point.mass, point.position, point.velocity, forces?.linearDrag);
  return vecAdd(aG, aD);
}


