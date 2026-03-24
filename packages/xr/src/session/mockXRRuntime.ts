import type { XRRuntime, XRRuntimeStatus, XRSessionConfig, XRSessionState } from './types';

export class MockXRRuntime implements XRRuntime {
  private active = false;

  private state: XRSessionState = 'idle';

  public async isSupported(): Promise<boolean> {
    return typeof navigator !== 'undefined' && 'xr' in navigator;
  }

  public async start(_config: XRSessionConfig): Promise<void> {
    this.state = 'starting';
    this.active = true;
    this.state = 'running';
  }

  public async stop(): Promise<void> {
    this.state = 'stopping';
    this.active = false;
    this.state = 'idle';
  }

  public isActive(): boolean {
    return this.active;
  }

  public getStatus(): XRRuntimeStatus {
    return {
      supported: typeof navigator !== 'undefined' && 'xr' in navigator,
      active: this.active,
      state: this.state,
      sessionMode: 'immersive-ar'
    };
  }
}
