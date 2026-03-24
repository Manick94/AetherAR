import type { RuntimeBus } from './runtimeBus';

export interface FrameClock {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface FrameClockOptions {
  targetFPS: number;
  bus: RuntimeBus;
  now?: () => number;
}

export function createFrameClock({
  targetFPS,
  bus,
  now = () => performance.now()
}: FrameClockOptions): FrameClock {
  const frameBudgetMs = 1000 / Math.max(1, targetFPS);
  let frameId = 0;
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let previousTs = 0;

  const tick = (): void => {
    if (!running) {
      return;
    }

    const timestamp = now();
    const deltaMs = previousTs === 0 ? frameBudgetMs : timestamp - previousTs;
    previousTs = timestamp;
    frameId += 1;

    bus.emit('tick', {
      frameId,
      deltaMs,
      timestamp
    });

    const elapsedMs = now() - timestamp;
    const nextDelay = Math.max(0, frameBudgetMs - elapsedMs);
    timeoutId = setTimeout(tick, nextDelay);
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      previousTs = 0;
      tick();
    },
    stop() {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    },
    isRunning() {
      return running;
    }
  };
}
