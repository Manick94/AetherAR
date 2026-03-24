import type { AetherPlugin } from '../plugin/types';
import { createFrameClock, type FrameClock } from './frameClock';
import { RuntimeBus } from './runtimeBus';
import type { AetherEngineOptions, EngineState, RuntimeContext } from './types';

const PERFORMANCE_FPS: Record<AetherEngineOptions['performance'], number> = {
  quality: 60,
  balanced: 45,
  performance: 30
};

export class AetherEngine {
  private readonly plugins = new Map<string, AetherPlugin>();

  private state: EngineState = 'idle';

  private readonly bus = new RuntimeBus();

  private readonly runtimeContext: RuntimeContext = {
    startedAt: Date.now(),
    now: () => performance.now(),
    bus: this.bus
  };

  private readonly frameClock: FrameClock;

  constructor(private readonly options: AetherEngineOptions) {
    this.frameClock = createFrameClock({
      targetFPS: PERFORMANCE_FPS[options.performance],
      bus: this.bus,
      now: this.runtimeContext.now
    });

    this.bus.on('tick', () => {
      void this.dispatchFrame();
    });
  }

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

  public getRuntimeContext(): Readonly<RuntimeContext> {
    return this.runtimeContext;
  }

  public async initialize(): Promise<void> {
    this.assertState(['idle']);
    this.transition('initializing');

    for (const plugin of this.plugins.values()) {
      await plugin.setup?.(this.runtimeContext);
    }

    this.transition('ready');
  }

  public async start(): Promise<void> {
    this.assertState(['ready', 'stopped']);

    for (const plugin of this.plugins.values()) {
      await plugin.onStart?.(this.runtimeContext);
    }

    this.transition('running');
    this.frameClock.start();
  }

  public async stop(): Promise<void> {
    this.assertState(['running']);
    this.frameClock.stop();

    for (const plugin of this.plugins.values()) {
      await plugin.onStop?.(this.runtimeContext);
    }

    this.transition('stopped');
  }

  private transition(next: EngineState): void {
    const previous = this.state;
    this.state = next;
    this.bus.emit('stateChanged', {
      previous,
      next,
      timestamp: this.runtimeContext.now()
    });
  }

  private async dispatchFrame(): Promise<void> {
    if (this.state !== 'running') {
      return;
    }

    for (const plugin of this.plugins.values()) {
      await plugin.onFrame?.(this.runtimeContext);
    }
  }

  private assertState(allowed: EngineState[]): void {
    if (!allowed.includes(this.state)) {
      throw new Error(`Invalid engine state transition from '${this.state}'`);
    }
  }
}
