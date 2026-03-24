import type { RenderFrameContext, Renderer } from './types';

export interface RenderLoop {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export interface RenderLoopOptions {
  renderer: Renderer;
  viewport: {
    width: () => number;
    height: () => number;
  };
}

export function createRenderLoop({ renderer, viewport }: RenderLoopOptions): RenderLoop {
  let running = false;
  let rafId: number | undefined;
  let previousTs = 0;

  const frame = (timestamp: number): void => {
    if (!running) {
      return;
    }

    const context: RenderFrameContext = {
      deltaMs: previousTs === 0 ? 16.67 : timestamp - previousTs,
      viewportWidth: viewport.width(),
      viewportHeight: viewport.height()
    };

    previousTs = timestamp;
    renderer.render(context);
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
    }
  };
}
