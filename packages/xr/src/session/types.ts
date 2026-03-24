export type XRCapability = 'hit-test' | 'anchors' | 'light-estimation' | 'dom-overlay';

export interface XRSessionConfig {
  required: XRCapability[];
  optional?: XRCapability[];
}

export interface XRRuntime {
  isSupported(): Promise<boolean>;
  start(config: XRSessionConfig): Promise<void>;
  stop(): Promise<void>;
}
