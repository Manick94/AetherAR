import type { ImageTarget } from './targetStore.js';

export interface ImageTrackerConfig {
  maxConcurrentTargets: number;
  detectionFPS: number;
  featureDatabase: 'memory' | 'indexeddb' | 'custom';
  matchingStrategy: 'brute-force' | 'flann' | 'cascade';
  temporalConsistency: boolean;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface ImageTargetPose {
  position: Vector3Like;
  rotation: Vector3Like;
  scale: number;
}

export type ImageTargetTrackingState = 'idle' | 'tracked' | 'lost';

export interface ImageTargetObservation {
  state: ImageTargetTrackingState;
  confidence: number;
  pose: ImageTargetPose;
  lastUpdatedAt: number;
}

export interface ImageTargetObservationUpdate {
  state?: ImageTargetTrackingState;
  confidence?: number;
  pose?: {
    position?: Partial<Vector3Like>;
    rotation?: Partial<Vector3Like>;
    scale?: number;
  };
}

export interface TrackedImageTarget extends ImageTarget {
  observation: ImageTargetObservation;
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
  targets: readonly TrackedImageTarget[];
  activeTargetIds: readonly string[];
}
