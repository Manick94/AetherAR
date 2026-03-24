import type { ImageTargetPose } from './types.js';
import {
  compareNFTFeatureDescriptors,
  cropGrayscaleFrame,
  createGrayscaleFrame,
  extractNFTFeatureDescriptor,
  normalizeBounds,
  type FrameBounds,
  type GrayscaleFrame,
  type ImageFrameLike,
  type NFTDescriptorComparison,
  type NormalizedFrameBounds
} from './featureDescriptor.js';
import type { NFTTargetDescriptor, NFTTargetManifest } from './nftManifest.js';

export interface NFTTargetMatch {
  targetId: string;
  target: NFTTargetDescriptor;
  confidence: number;
  descriptorScore: number;
  boundingBox: NormalizedFrameBounds;
  pose: ImageTargetPose;
  breakdown: NFTDescriptorComparison;
}

export interface NFTFrameMatchResult {
  matches: readonly NFTTargetMatch[];
  bestMatch?: NFTTargetMatch;
}

export interface NFTTargetMatcherOptions {
  minConfidence?: number;
  scanScales?: readonly number[];
  scanSteps?: number;
  centerBias?: number;
  maxMatches?: number;
}

export interface NFTTargetMatcher {
  match(frame: ImageFrameLike): NFTFrameMatchResult;
  matchTarget(frame: ImageFrameLike, targetId: string): NFTTargetMatch | undefined;
  getTargets(): readonly NFTTargetDescriptor[];
}

const DEFAULT_SCAN_SCALES = Object.freeze([0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.28]);
const REFINEMENT_SCALE_FACTORS = Object.freeze([0.72, 0.84, 0.94, 1, 1.08]);
const REFINEMENT_POSITION_FACTORS = Object.freeze([-0.12, 0, 0.12]);

export function createNFTTargetMatcher(
  manifest: NFTTargetManifest,
  options: NFTTargetMatcherOptions = {}
): NFTTargetMatcher {
  const minConfidence = options.minConfidence ?? 0.73;
  const scanScales = options.scanScales ?? DEFAULT_SCAN_SCALES;
  const scanSteps = options.scanSteps ?? 4;
  const centerBias = options.centerBias ?? 0.04;
  const maxMatches = options.maxMatches ?? 3;

  const indexedTargets = manifest.targets.filter((target) => target.featureDescriptor);

  const matchTarget = (frame: ImageFrameLike, targetId: string): NFTTargetMatch | undefined => {
    const grayscale = createGrayscaleFrame(frame);
    const target = indexedTargets.find((item) => item.id === targetId);
    if (!target) {
      return undefined;
    }

    return findBestTargetMatch(grayscale, target, {
      minConfidence,
      scanScales,
      scanSteps,
      centerBias
    });
  };

  return {
    match(frame) {
      const grayscale = createGrayscaleFrame(frame);
      const matches = indexedTargets
        .map((target) =>
          findBestTargetMatch(grayscale, target, {
            minConfidence,
            scanScales,
            scanSteps,
            centerBias
          })
        )
        .filter((match): match is NFTTargetMatch => Boolean(match))
        .sort((left, right) => right.confidence - left.confidence)
        .slice(0, maxMatches);

      return {
        matches: Object.freeze(matches),
        bestMatch: matches[0]
      };
    },
    matchTarget,
    getTargets() {
      return indexedTargets;
    }
  };
}

function findBestTargetMatch(
  grayscale: GrayscaleFrame,
  target: NFTTargetDescriptor,
  options: Required<Pick<NFTTargetMatcherOptions, 'minConfidence' | 'scanScales' | 'scanSteps' | 'centerBias'>>
): NFTTargetMatch | undefined {
  if (!target.featureDescriptor) {
    return undefined;
  }

  const candidateWindows = createCandidateWindows(grayscale.width, grayscale.height, target.aspectRatio, options.scanScales, options.scanSteps);
  let bestMatch: NFTTargetMatch | undefined;

  for (const window of candidateWindows) {
    const match = scoreCandidateWindow(grayscale, target, window, options);
    if (match.confidence === 0) {
      continue;
    }

    if (!bestMatch || match.confidence > bestMatch.confidence) {
      bestMatch = match;
    }
  }

  if (!bestMatch) {
    return undefined;
  }

  const refinedMatch = refineBestTargetMatch(grayscale, target, bestMatch, options);
  return refinedMatch.confidence >= bestMatch.confidence ? refinedMatch : bestMatch;
}

function effectiveThreshold(target: NFTTargetDescriptor, baseThreshold: number): number {
  const qualityPenalty = target.quality.rating === 'low' ? 0.04 : target.quality.rating === 'medium' ? 0.02 : 0;
  const profilePenalty = target.trackingHint.profile === 'fast' ? -0.02 : 0;
  return clampNumber(baseThreshold + qualityPenalty + profilePenalty, 0.55, 0.95);
}

function createCandidateWindows(
  frameWidth: number,
  frameHeight: number,
  aspectRatio: number,
  scanScales: readonly number[],
  scanSteps: number
): FrameBounds[] {
  const windows: FrameBounds[] = [];
  const stepCount = Math.max(1, scanSteps);

  for (const scale of scanScales) {
    let width = frameWidth * scale;
    let height = width / Math.max(0.01, aspectRatio);

    if (height > frameHeight * scale) {
      height = frameHeight * scale;
      width = height * aspectRatio;
    }

    if (width < 24 || height < 24 || width > frameWidth || height > frameHeight) {
      continue;
    }

    const maxX = frameWidth - width;
    const maxY = frameHeight - height;
    const columnCount = stepCount + (scale < 0.55 ? 1 : 0);
    const rowCount = Math.max(1, Math.round(columnCount * (frameHeight / frameWidth)));

    for (let row = 0; row < rowCount; row += 1) {
      const y = rowCount === 1 ? maxY / 2 : (maxY * row) / (rowCount - 1);

      for (let column = 0; column < columnCount; column += 1) {
        const x = columnCount === 1 ? maxX / 2 : (maxX * column) / (columnCount - 1);

        windows.push({
          x,
          y,
          width,
          height
        });
      }
    }
  }

  return windows;
}

function refineBestTargetMatch(
  grayscale: GrayscaleFrame,
  target: NFTTargetDescriptor,
  seedMatch: NFTTargetMatch,
  options: Required<Pick<NFTTargetMatcherOptions, 'minConfidence' | 'scanScales' | 'scanSteps' | 'centerBias'>>
): NFTTargetMatch {
  let bestMatch = seedMatch;
  const baseBounds = denormalizeBounds(seedMatch.boundingBox, grayscale.width, grayscale.height);

  for (const scaleFactor of REFINEMENT_SCALE_FACTORS) {
    const width = clampNumber(baseBounds.width * scaleFactor, 24, grayscale.width);
    const height = clampNumber(baseBounds.height * scaleFactor, 24, grayscale.height);

    for (const offsetY of REFINEMENT_POSITION_FACTORS) {
      for (const offsetX of REFINEMENT_POSITION_FACTORS) {
        const candidate: FrameBounds = {
          x: clampNumber(baseBounds.x + baseBounds.width * offsetX, 0, grayscale.width - width),
          y: clampNumber(baseBounds.y + baseBounds.height * offsetY, 0, grayscale.height - height),
          width,
          height
        };

        const match = scoreCandidateWindow(grayscale, target, candidate, options);
        if (match.confidence === 0) {
          continue;
        }

        if (match.confidence > bestMatch.confidence) {
          bestMatch = match;
        }
      }
    }
  }

  return bestMatch;
}

function scoreCandidateWindow(
  grayscale: GrayscaleFrame,
  target: NFTTargetDescriptor,
  window: FrameBounds,
  options: Required<Pick<NFTTargetMatcherOptions, 'minConfidence' | 'scanScales' | 'scanSteps' | 'centerBias'>>
): NFTTargetMatch {
  const cropped = cropGrayscaleFrame(grayscale, window);
  const descriptor = extractNFTFeatureDescriptor(cropped, {
    gridSize: target.featureDescriptor!.gridSize,
    hashGridSize: target.featureDescriptor!.hashGridSize
  });
  const breakdown = compareNFTFeatureDescriptors(descriptor, target.featureDescriptor!);
  const centerBonus = computeCenterBonus(window, grayscale.width, grayscale.height) * options.centerBias;
  const qualityBonus = target.quality.rating === 'excellent' ? 0.015 : target.quality.rating === 'high' ? 0.008 : 0;
  const sizePenalty = Number((Math.min(0.07, (window.width * window.height) / (grayscale.width * grayscale.height) * 0.12)).toFixed(4));
  const confidence = Number(Math.min(1, Math.max(0, breakdown.score + centerBonus + qualityBonus - sizePenalty)).toFixed(4));

  return {
    targetId: target.id,
    target,
    confidence: confidence >= effectiveThreshold(target, options.minConfidence) ? confidence : 0,
    descriptorScore: breakdown.score,
    boundingBox: normalizeBounds(window, grayscale),
    pose: createPoseFromBounds(window, grayscale.width, grayscale.height),
    breakdown
  };
}

function denormalizeBounds(
  bounds: { x: number; y: number; width: number; height: number },
  frameWidth: number,
  frameHeight: number
): FrameBounds {
  return {
    x: bounds.x * frameWidth,
    y: bounds.y * frameHeight,
    width: bounds.width * frameWidth,
    height: bounds.height * frameHeight
  };
}

function createPoseFromBounds(bounds: FrameBounds, frameWidth: number, frameHeight: number): ImageTargetPose {
  const normalizedWidth = bounds.width / frameWidth;
  const normalizedHeight = bounds.height / frameHeight;
  const centerX = (bounds.x + bounds.width / 2) / frameWidth;
  const centerY = (bounds.y + bounds.height / 2) / frameHeight;
  const scale = clampNumber((normalizedWidth + normalizedHeight) / 2, 0.25, 1.3);

  return {
    position: {
      x: Number((((centerX - 0.5) * 2)).toFixed(4)),
      y: Number((((0.5 - centerY) * 2)).toFixed(4)),
      z: Number((-2.2 + scale * 1.25).toFixed(4))
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0
    },
    scale: Number((scale * 1.35).toFixed(4))
  };
}

function computeCenterBonus(bounds: FrameBounds, frameWidth: number, frameHeight: number): number {
  const centerX = (bounds.x + bounds.width / 2) / frameWidth;
  const centerY = (bounds.y + bounds.height / 2) / frameHeight;
  const distance = Math.sqrt((centerX - 0.5) ** 2 + (centerY - 0.5) ** 2);
  return 1 - clampNumber(distance / 0.7071, 0, 1);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
