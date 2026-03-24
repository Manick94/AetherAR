export interface ImageTrackerConfig {
  maxConcurrentTargets: number;
  detectionFPS: number;
  featureDatabase: 'memory' | 'indexeddb' | 'custom';
  matchingStrategy: 'brute-force' | 'flann' | 'cascade';
  temporalConsistency: boolean;
}

export interface TrackingTick {
  frameId: number;
  deltaMs: number;
  timestamp: number;
}
