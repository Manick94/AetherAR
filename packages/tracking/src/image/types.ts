import type { ImageTarget } from './targetStore';

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
  activeTargets: number;
}

export interface TrackingSnapshot {
  frameId: number;
  timestamp: number;
  targets: readonly ImageTarget[];
}
