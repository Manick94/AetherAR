import type { ImageTarget } from './targetStore.js';
import type { NFTFeatureDescriptor } from './featureDescriptor.js';

export type NFTImageFormat = 'png' | 'jpeg' | 'gif' | 'webp';

export type NFTOrientation = 'portrait' | 'landscape' | 'square';

export type NFTTrackingProfile = 'fast' | 'balanced' | 'precision';

export type NFTTargetRating = 'low' | 'medium' | 'high' | 'excellent';

export interface NFTTargetSource {
  filename: string;
  relativePath: string;
  format: NFTImageFormat;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}

export interface NFTTargetQuality {
  entropy: number;
  bytesPerPixel: number;
  rating: NFTTargetRating;
  warnings: readonly string[];
}

export interface NFTTargetTrackingHint {
  profile: NFTTrackingProfile;
  score: number;
  recommendedScale: number;
  recommendedDetectionFPS: number;
}

export interface NFTTargetDescriptor {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: NFTOrientation;
  physicalWidthMm?: number;
  source: NFTTargetSource;
  quality: NFTTargetQuality;
  trackingHint: NFTTargetTrackingHint;
  featureDescriptor?: NFTFeatureDescriptor;
  metadata?: Readonly<Record<string, string>>;
}

export interface NFTManifestCompiler {
  name: string;
  version: string;
  mode: 'natural-feature-target';
}

export interface NFTTargetManifest {
  kind: 'aetherar.nft-manifest';
  schemaVersion: '1.0';
  name: string;
  generatedAt: string;
  compiler: NFTManifestCompiler;
  targets: readonly NFTTargetDescriptor[];
}

export function findNFTTarget(
  manifest: NFTTargetManifest,
  targetId: string
): NFTTargetDescriptor | undefined {
  return manifest.targets.find((target) => target.id === targetId);
}

export function createImageTargetsFromNFTManifest(
  manifest: NFTTargetManifest
): readonly ImageTarget[] {
  return Object.freeze(
    manifest.targets.map((target) =>
      Object.freeze({
        id: target.id,
        width: target.width,
        height: target.height,
        metadata: Object.freeze({
          ...(target.metadata ?? {}),
          nftManifest: manifest.name,
          nftProfile: target.trackingHint.profile,
          nftRating: target.quality.rating,
          nftSha256: target.source.sha256
        })
      })
    )
  );
}
