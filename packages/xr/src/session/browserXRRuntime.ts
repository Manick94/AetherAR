import type { XRRuntime, XRRuntimeStatus, XRSessionConfig, XRSessionState } from './types';

const CAPABILITY_FEATURE_MAP: Record<string, string> = {
  'hit-test': 'hit-test',
  anchors: 'anchors',
  'light-estimation': 'light-estimation',
  'dom-overlay': 'dom-overlay'
};

export class BrowserXRRuntime implements XRRuntime {
  private session: XRSession | null = null;

  private state: XRSessionState = 'idle';

  constructor(private readonly sessionMode: XRSessionMode = 'immersive-ar') {}

  public async isSupported(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('xr' in navigator)) {
      return false;
    }

    return navigator.xr.isSessionSupported(this.sessionMode);
  }

  public async start(config: XRSessionConfig): Promise<void> {
    if (this.session) {
      return;
    }

    if (!(await this.isSupported())) {
      throw new Error(`WebXR mode '${this.sessionMode}' is not supported in this browser.`);
    }

    this.state = 'starting';

    const requiredFeatures = config.required.map((item) => CAPABILITY_FEATURE_MAP[item]);
    const optionalFeatures = (config.optional ?? []).map((item) => CAPABILITY_FEATURE_MAP[item]);

    const session = await navigator.xr.requestSession(this.sessionMode, {
      requiredFeatures,
      optionalFeatures,
      domOverlay: config.domOverlayRoot ? { root: config.domOverlayRoot } : undefined
    });

    session.addEventListener('end', () => {
      this.session = null;
      this.state = 'idle';
    });

    this.session = session;
    this.state = 'running';
  }

  public async stop(): Promise<void> {
    if (!this.session) {
      return;
    }

    this.state = 'stopping';
    const activeSession = this.session;
    this.session = null;
    await activeSession.end();
    this.state = 'idle';
  }

  public isActive(): boolean {
    return this.session !== null;
  }

  public getStatus(): XRRuntimeStatus {
    return {
      supported: typeof navigator !== 'undefined' && 'xr' in navigator,
      active: this.session !== null,
      state: this.state,
      sessionMode: this.sessionMode
    };
  }
}
