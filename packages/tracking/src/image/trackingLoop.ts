import { createTargetStore, type ImageTarget } from './targetStore';
import type { ImageTrackerConfig, TrackingSnapshot, TrackingTick } from './types';

export interface ImageTrackingLoop {
  start(): void;
  stop(): void;
  onTick(handler: (tick: TrackingTick) => void): () => void;
  addTarget(target: ImageTarget): void;
  removeTarget(targetId: string): void;
  snapshot(): TrackingSnapshot;
}

const DEFAULT_CONFIG: ImageTrackerConfig = {
  maxConcurrentTargets: 1000,
  detectionFPS: 30,
  featureDatabase: 'memory',
  matchingStrategy: 'cascade',
  temporalConsistency: true
};

export function createImageTrackingLoop(
  partialConfig: Partial<ImageTrackerConfig> = {}
): ImageTrackingLoop {
  const config: ImageTrackerConfig = { ...DEFAULT_CONFIG, ...partialConfig };

  const handlers = new Set<(tick: TrackingTick) => void>();
  const frameBudgetMs = 1000 / Math.max(1, config.detectionFPS);
  const targetStore = createTargetStore(config.maxConcurrentTargets);

  let frameId = 0;
  let active = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let lastTimestamp = 0;

  const tick = (): void => {
    if (!active) return;

    const started = performance.now();
    frameId += 1;

    const payload: TrackingTick = {
      frameId,
      deltaMs: lastTimestamp === 0 ? frameBudgetMs : started - lastTimestamp,
      timestamp: started,
      activeTargets: targetStore.size()
    };

    lastTimestamp = started;
    handlers.forEach((handler) => handler(payload));

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
    },
    removeTarget(targetId) {
      targetStore.remove(targetId);
    },
    snapshot() {
      return {
        frameId,
        timestamp: performance.now(),
        targets: targetStore.list()
      };
    },
    onTick(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }
  };
}
