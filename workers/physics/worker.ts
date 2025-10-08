import { expose } from "comlink";
import type { SimulationConfig, WorkerMessage, Vector3 } from "./types";
import { PhysicsEngine } from "./engine";

declare const self: DedicatedWorkerGlobalScope;

let engine: PhysicsEngine | null = null;
let running = false;
let tickHandle: number | null = null;
let snapshotIntervalMs = 50;
let lastSnapshotTime = 0;

function postSnapshot() {
  if (!engine) return;
  const state = engine.getState();
  const message: WorkerMessage = { type: "snapshot", payload: state };
  // eslint-disable-next-line no-restricted-globals
  self.postMessage(message);
}

function loopTick() {
  if (!engine || !running) return;
  // Execute exactly one fixed step per tick; the caller controls tick frequency by setInterval
  engine.step();
  const now = performance.now();
  if (now - lastSnapshotTime >= snapshotIntervalMs) {
    lastSnapshotTime = now;
    postSnapshot();
  }
}

const api = {
  init(config: SimulationConfig) {
    engine = new PhysicsEngine(config);
    snapshotIntervalMs = config.snapshotIntervalMs ?? 50;
    lastSnapshotTime = performance.now();
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ type: "initialized" } as WorkerMessage);
  },
  start() {
    if (!engine || running) return;
    running = true;
    // Aim to run steps at 1/dt Hz if possible
    const dt = engine.getDt();
    const targetMs = dt ? Math.max(1, Math.round(dt * 1000)) : 8;
    tickHandle = self.setInterval(loopTick, targetMs);
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ type: "started" } as WorkerMessage);
  },
  pause() {
    running = false;
    if (tickHandle !== null) {
      self.clearInterval(tickHandle);
      tickHandle = null;
    }
    // eslint-disable-next-line no-restricted-globals
    self.postMessage({ type: "paused" } as WorkerMessage);
  },
  step() {
    if (!engine) return;
    engine.step();
    postSnapshot();
  },
  applyImpulse(objectId: string, impulseVec: Vector3) {
    if (!engine) return;
    engine.applyImpulse(objectId, impulseVec);
  },
};

expose(api);

export type PhysicsWorkerApi = typeof api;


