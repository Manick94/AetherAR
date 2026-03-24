import { createTargetStore, type ImageTarget } from './targetStore.js';
import type {
  ImageTargetObservation,
  ImageTargetObservationUpdate,
  ImageTargetPose,
  ImageTrackerConfig,
  TrackingSnapshot,
  TrackingTick,
  Vector3Like
} from './types.js';

export interface ImageTrackingLoop {
  start(): void;
  stop(): void;
  onTick(handler: (tick: TrackingTick) => void): () => void;
  onSnapshot(handler: (snapshot: TrackingSnapshot) => void): () => void;
  addTarget(target: ImageTarget): void;
  removeTarget(targetId: string): void;
  updateObservation(targetId: string, observation: ImageTargetObservationUpdate | null): void;
  snapshot(): TrackingSnapshot;
}

const DEFAULT_CONFIG: ImageTrackerConfig = {
  maxConcurrentTargets: 1000,
  detectionFPS: 30,
  featureDatabase: 'memory',
  matchingStrategy: 'cascade',
  temporalConsistency: true
};

function createVector3Like(): Vector3Like {
  return { x: 0, y: 0, z: 0 };
}

function createDefaultPose(): ImageTargetPose {
  return {
    position: createVector3Like(),
    rotation: createVector3Like(),
    scale: 1
  };
}

function createIdleObservation(timestamp: number): ImageTargetObservation {
  return {
    state: 'idle',
    confidence: 0,
    pose: createDefaultPose(),
    lastUpdatedAt: timestamp
  };
}

function clampConfidence(confidence: number): number {
  return Math.max(0, Math.min(1, confidence));
}

function mergeObservation(
  current: ImageTargetObservation,
  next: ImageTargetObservationUpdate | null,
  timestamp: number
): ImageTargetObservation {
  if (next === null) {
    return {
      ...current,
      state: 'lost',
      confidence: 0,
      lastUpdatedAt: timestamp
    };
  }

  return {
    state: next.state ?? current.state,
    confidence: clampConfidence(next.confidence ?? current.confidence),
    pose: {
      position: {
        x: next.pose?.position?.x ?? current.pose.position.x,
        y: next.pose?.position?.y ?? current.pose.position.y,
        z: next.pose?.position?.z ?? current.pose.position.z
      },
      rotation: {
        x: next.pose?.rotation?.x ?? current.pose.rotation.x,
        y: next.pose?.rotation?.y ?? current.pose.rotation.y,
        z: next.pose?.rotation?.z ?? current.pose.rotation.z
      },
      scale: next.pose?.scale ?? current.pose.scale
    },
    lastUpdatedAt: timestamp
  };
}

export function createImageTrackingLoop(
  partialConfig: Partial<ImageTrackerConfig> = {}
): ImageTrackingLoop {
  const config: ImageTrackerConfig = { ...DEFAULT_CONFIG, ...partialConfig };

  const handlers = new Set<(tick: TrackingTick) => void>();
  const snapshotHandlers = new Set<(snapshot: TrackingSnapshot) => void>();
  const frameBudgetMs = 1000 / Math.max(1, config.detectionFPS);
  const targetStore = createTargetStore(config.maxConcurrentTargets);
  const observations = new Map<string, ImageTargetObservation>();

  let frameId = 0;
  let active = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastTimestamp = 0;

  const buildSnapshot = (timestamp: number): TrackingSnapshot => {
    const targets = targetStore.list().map((target) =>
      Object.freeze({
        ...target,
        observation: observations.get(target.id) ?? createIdleObservation(timestamp)
      })
    );

    const activeTargetIds = targets
      .filter((target) => target.observation.state === 'tracked')
      .map((target) => target.id);

    return Object.freeze({
      frameId,
      timestamp,
      targets: Object.freeze(targets),
      activeTargetIds: Object.freeze(activeTargetIds)
    });
  };

  const countTrackedTargets = (): number =>
    Array.from(observations.values()).filter((observation) => observation.state === 'tracked').length;

  const tick = (): void => {
    if (!active) return;

    const started = performance.now();
    frameId += 1;

    const payload: TrackingTick = {
      frameId,
      deltaMs: lastTimestamp === 0 ? frameBudgetMs : started - lastTimestamp,
      timestamp: started,
      activeTargets: countTrackedTargets()
    };

    lastTimestamp = started;
    handlers.forEach((handler) => handler(payload));
    const snapshot = buildSnapshot(started);
    snapshotHandlers.forEach((handler) => handler(snapshot));

    const elapsedMs = performance.now() - started;
    const nextDelay = Math.max(0, frameBudgetMs - elapsedMs);
    timeoutId = setTimeout(tick, nextDelay);
  };

  return {
    start() {
      if (active) return;
      active = true;
      lastTimestamp = 0;
      tick();
    },
    stop() {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    },
    addTarget(target) {
      targetStore.add(target);
      observations.set(target.id, createIdleObservation(performance.now()));
    },
    removeTarget(targetId) {
      targetStore.remove(targetId);
      observations.delete(targetId);
    },
    updateObservation(targetId, observation) {
      const target = targetStore.get(targetId);
      if (!target) {
        throw new Error(`Unknown image target: ${targetId}`);
      }

      const timestamp = performance.now();
      const current = observations.get(targetId) ?? createIdleObservation(timestamp);
      observations.set(targetId, mergeObservation(current, observation, timestamp));
    },
    snapshot() {
      return buildSnapshot(performance.now());
    },
    onTick(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    onSnapshot(handler) {
      snapshotHandlers.add(handler);
      return () => {
        snapshotHandlers.delete(handler);
      };
    }
  };
}
