export type EnginePerformanceMode = 'quality' | 'balanced' | 'performance';

export interface AetherEngineOptions {
  performance: EnginePerformanceMode;
  debug?: boolean;
}

export type EngineState = 'idle' | 'initializing' | 'ready' | 'running' | 'stopped';

export interface RuntimeContext {
  readonly startedAt: number;
  readonly now: () => number;
}
