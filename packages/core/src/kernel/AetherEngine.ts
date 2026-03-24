import type { AetherPlugin } from '../plugin/types';
import type { AetherEngineOptions, EngineState, RuntimeContext } from './types';

export class AetherEngine {
  private readonly plugins = new Map<string, AetherPlugin>();

  private state: EngineState = 'idle';

  private readonly runtimeContext: RuntimeContext = {
    startedAt: Date.now(),
    now: () => performance.now()
  };

  constructor(private readonly options: AetherEngineOptions) {}

  public registerPlugin(plugin: AetherPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }

    this.plugins.set(plugin.name, plugin);
  }

  public getState(): EngineState {
    return this.state;
  }

  public getOptions(): Readonly<AetherEngineOptions> {
    return this.options;
  }

  public async initialize(): Promise<void> {
    this.assertState(['idle']);
    this.state = 'initializing';

    for (const plugin of this.plugins.values()) {
      await plugin.setup?.(this.runtimeContext);
    }

    this.state = 'ready';
  }

  public async start(): Promise<void> {
    this.assertState(['ready', 'stopped']);

    for (const plugin of this.plugins.values()) {
      await plugin.onStart?.(this.runtimeContext);
    }

    this.state = 'running';
  }

  public async stop(): Promise<void> {
    this.assertState(['running']);

    for (const plugin of this.plugins.values()) {
      await plugin.onStop?.(this.runtimeContext);
    }

    this.state = 'stopped';
  }

  private assertState(allowed: EngineState[]): void {
    if (!allowed.includes(this.state)) {
      throw new Error(`Invalid engine state transition from '${this.state}'`);
    }
  }
}
