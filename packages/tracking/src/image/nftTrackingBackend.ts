import type { ImageTargetObservationUpdate } from './types.js';
import {
  createNFTTargetMatcher,
  type NFTTargetMatch,
  type NFTTargetMatcher,
  type NFTTargetMatcherOptions
} from './nftMatcher.js';
import type { ImageFrameLike } from './featureDescriptor.js';
import type { NFTTargetManifest } from './nftManifest.js';
import type { ImageTrackingLoop } from './trackingLoop.js';

export interface NFTTrackingBackendOptions extends NFTTargetMatcherOptions {
  smoothing?: number;
  maxMissedFrames?: number;
}

export interface NFTTrackingBackendFrame {
  frameId: number;
  timestamp: number;
  matches: readonly NFTTargetMatch[];
  observations: Readonly<Record<string, ImageTargetObservationUpdate | null>>;
  activeTargetIds: readonly string[];
}

export interface NFTTrackingBackend {
  processFrame(frame: ImageFrameLike, timestamp?: number): NFTTrackingBackendFrame;
  reset(): void;
  getMatcher(): NFTTargetMatcher;
}

interface TrackedState {
  misses: number;
  observation: ImageTargetObservationUpdate;
}

const DEFAULT_SMOOTHING = 0.35;
const DEFAULT_MAX_MISSED_FRAMES = 2;

export function createNFTTrackingBackend(
  manifest: NFTTargetManifest,
  options: NFTTrackingBackendOptions = {}
): NFTTrackingBackend {
  const matcher = createNFTTargetMatcher(manifest, options);
  const smoothing = options.smoothing ?? DEFAULT_SMOOTHING;
  const maxMissedFrames = options.maxMissedFrames ?? DEFAULT_MAX_MISSED_FRAMES;
  const state = new Map<string, TrackedState>();
  let frameId = 0;

  return {
    processFrame(frame, timestamp = performance.now()) {
      frameId += 1;
      const matchResult = matcher.match(frame);
      const observationEntries = new Map<string, ImageTargetObservationUpdate | null>();
      const matchedTargets = new Set(matchResult.matches.map((match) => match.targetId));

      for (const match of matchResult.matches) {
        const previous = state.get(match.targetId)?.observation;
        const observation = smoothObservation(previous, match, smoothing);

        observationEntries.set(match.targetId, observation);
        state.set(match.targetId, {
          misses: 0,
          observation
        });
      }

      for (const target of matcher.getTargets()) {
        if (matchedTargets.has(target.id)) {
          continue;
        }

        const previous = state.get(target.id);
        if (!previous) {
          continue;
        }

        const misses = previous.misses + 1;
        if (misses > maxMissedFrames) {
          state.delete(target.id);
          observationEntries.set(target.id, null);
          continue;
        }

        state.set(target.id, {
          misses,
          observation: {
            ...previous.observation,
            state: 'lost',
            confidence: 0,
            pose: previous.observation.pose
          }
        });
        observationEntries.set(target.id, {
          ...previous.observation,
          state: 'lost',
          confidence: 0,
          pose: previous.observation.pose
        });
      }

      return {
        frameId,
        timestamp,
        matches: matchResult.matches,
        observations: Object.freeze(Object.fromEntries(observationEntries)),
        activeTargetIds: Object.freeze(matchResult.matches.map((match) => match.targetId))
      };
    },
    reset() {
      state.clear();
      frameId = 0;
    },
    getMatcher() {
      return matcher;
    }
  };
}

export function applyBackendFrameToTrackingLoop(
  loop: ImageTrackingLoop,
  frame: NFTTrackingBackendFrame
): void {
  for (const [targetId, observation] of Object.entries(frame.observations)) {
    loop.updateObservation(targetId, observation);
  }
}

function smoothObservation(
  previous: ImageTargetObservationUpdate | undefined,
  match: NFTTargetMatch,
  smoothing: number
): ImageTargetObservationUpdate {
  if (!previous?.pose) {
    return {
      state: 'tracked',
      confidence: match.confidence,
      pose: match.pose
    };
  }

  return {
    state: 'tracked',
    confidence: Number(lerp(previous.confidence ?? match.confidence, match.confidence, 1 - smoothing).toFixed(4)),
    pose: {
      position: {
        x: lerp(previous.pose.position?.x ?? match.pose.position.x, match.pose.position.x, 1 - smoothing),
        y: lerp(previous.pose.position?.y ?? match.pose.position.y, match.pose.position.y, 1 - smoothing),
        z: lerp(previous.pose.position?.z ?? match.pose.position.z, match.pose.position.z, 1 - smoothing)
      },
      rotation: {
        x: lerp(previous.pose.rotation?.x ?? match.pose.rotation.x, match.pose.rotation.x, 1 - smoothing),
        y: lerp(previous.pose.rotation?.y ?? match.pose.rotation.y, match.pose.rotation.y, 1 - smoothing),
        z: lerp(previous.pose.rotation?.z ?? match.pose.rotation.z, match.pose.rotation.z, 1 - smoothing)
      },
      scale: Number(lerp(previous.pose.scale ?? match.pose.scale, match.pose.scale, 1 - smoothing).toFixed(4))
    }
  };
}

function lerp(start: number, end: number, amount: number): number {
  return Number((start + (end - start) * amount).toFixed(4));
}
