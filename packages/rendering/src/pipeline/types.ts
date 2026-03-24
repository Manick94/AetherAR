export interface RenderConfig {
  pipeline: 'forward' | 'deferred' | 'hybrid';
  antialiasing: 'msaa' | 'fxaa' | 'taa';
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';
  maxLights: number;
  occlusionCulling: boolean;
}

export interface RenderFrameContext {
  deltaMs: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface Renderer {
  configure(config: Partial<RenderConfig>): void;
  render(frame: RenderFrameContext): void;
  dispose(): void;
}
