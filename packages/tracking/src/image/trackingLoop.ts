import type { ImageTrackerConfig, TrackingTick } from './types';

export interface ImageTrackingLoop {
  start(): void;
  stop(): void;
  onTick(handler: (tick: TrackingTick) => void): () => void;
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
  let frameId = 0;
  let active = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const tick = (): void => {
    if (!active) return;

    const started = performance.now();
    frameId += 1;

    const payload: TrackingTick = {
      frameId,
      deltaMs: frameBudgetMs,
      timestamp: started
    };

    handlers.forEach((handler) => handler(payload));

    const elapsedMs = performance.now() - started;
    const nextDelay = Math.max(0, frameBudgetMs - elapsedMs);
    timeoutId = setTimeout(tick, nextDelay);
  };

  return {
    start() {
      if (active) return;
      active = true;
      tick();
    },
    stop() {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    },
    onTick(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    }
  };
}
