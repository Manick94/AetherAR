export type XRCapability = 'hit-test' | 'anchors' | 'light-estimation' | 'dom-overlay';

export interface XRSessionConfig {
  required: XRCapability[];
  optional?: XRCapability[];
  domOverlayRoot?: Element;
}

export type XRSessionState = 'idle' | 'starting' | 'running' | 'stopping';

export interface XRRuntimeStatus {
  supported: boolean;
  active: boolean;
  state: XRSessionState;
  sessionMode: XRSessionMode;
}

export interface XRRuntime {
  isSupported(): Promise<boolean>;
  start(config: XRSessionConfig): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  getStatus(): XRRuntimeStatus;
}
