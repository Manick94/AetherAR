import type { XRRuntime, XRSessionConfig } from './types';

export class MockXRRuntime implements XRRuntime {
  private active = false;

  public async isSupported(): Promise<boolean> {
    return typeof navigator !== 'undefined' && 'xr' in navigator;
  }

  public async start(_config: XRSessionConfig): Promise<void> {
    this.active = true;
  }

  public async stop(): Promise<void> {
    this.active = false;
  }

  public isActive(): boolean {
    return this.active;
  }
}
