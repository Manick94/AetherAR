import type { RenderConfig, RenderFrameContext, Renderer } from './types';

const DEFAULT_RENDER_CONFIG: RenderConfig = {
  pipeline: 'forward',
  antialiasing: 'fxaa',
  shadowQuality: 'medium',
  maxLights: 8,
  occlusionCulling: true
};

export class NoopRenderer implements Renderer {
  private config: RenderConfig = DEFAULT_RENDER_CONFIG;

  public configure(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public render(_frame: RenderFrameContext): void {
    // phase-3 placeholder: swap in WebGL/Three renderer implementation.
  }

  public dispose(): void {
    // no-op for placeholder implementation.
  }

  public getConfig(): Readonly<RenderConfig> {
    return this.config;
  }
}
