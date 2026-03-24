import type { RenderFrameContext, Renderer } from './types';

export interface RenderLoopStats {
  frames: number;
  averageFrameMs: number;
  effectiveFPS: number;
}

export interface AdaptiveRenderLoop {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  setTargetFPS(nextFPS: number): void;
  getTargetFPS(): number;
  getStats(): RenderLoopStats;
}

export interface AdaptiveRenderLoopOptions {
  renderer: Renderer;
  viewport: {
    width: () => number;
    height: () => number;
  };
  targetFPS?: number;
}

export function createAdaptiveRenderLoop({
  renderer,
  viewport,
  targetFPS = 60
}: AdaptiveRenderLoopOptions): AdaptiveRenderLoop {
  let running = false;
  let rafId: number | undefined;
  let previousTs = 0;
  let targetFrameBudgetMs = 1000 / Math.max(1, targetFPS);

  const stats = {
    frames: 0,
    totalFrameTimeMs: 0
  };

  const frame = (timestamp: number): void => {
    if (!running) {
      return;
    }

    const deltaMs = previousTs === 0 ? targetFrameBudgetMs : timestamp - previousTs;

    if (deltaMs >= targetFrameBudgetMs || previousTs === 0) {
      const context: RenderFrameContext = {
        deltaMs,
        viewportWidth: viewport.width(),
        viewportHeight: viewport.height()
      };

      previousTs = timestamp;
      stats.frames += 1;
      stats.totalFrameTimeMs += deltaMs;
      renderer.render(context);
    }

    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      previousTs = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
    },
    isRunning() {
      return running;
    },
    setTargetFPS(nextFPS: number) {
      targetFrameBudgetMs = 1000 / Math.max(1, nextFPS);
    },
    getTargetFPS() {
      return Math.round(1000 / targetFrameBudgetMs);
    },
    getStats() {
      const averageFrameMs = stats.frames === 0 ? 0 : stats.totalFrameTimeMs / stats.frames;
      return {
        frames: stats.frames,
        averageFrameMs: Number(averageFrameMs.toFixed(2)),
        effectiveFPS: averageFrameMs === 0 ? 0 : Number((1000 / averageFrameMs).toFixed(2))
      };
    }
  };
}
