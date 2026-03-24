import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import sharp from 'sharp';
import type {
  ImageFrameLike,
  NFTImageFormat,
  NFTOrientation,
  NFTTargetDescriptor,
  NFTTargetManifest,
  NFTTargetRating,
  NFTTrackingProfile
} from '@aetherar/tracking';
import { extractNFTFeatureDescriptor } from '@aetherar/tracking';

const CLI_VERSION = '0.1.0';

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const MIME_BY_FORMAT: Record<NFTImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp'
};

export interface CompileNFTOptions {
  cwd?: string;
  name?: string;
  outFile?: string;
  physicalWidthMm?: number;
}

export interface CompiledNFTArtifact {
  manifest: NFTTargetManifest;
  outputPath: string;
}

interface ImageMetadata {
  format: NFTImageFormat;
  width: number;
  height: number;
}

export async function compileNFTTargets(
  inputs: readonly string[],
  options: CompileNFTOptions = {}
): Promise<CompiledNFTArtifact> {
  if (inputs.length === 0) {
    throw new Error('At least one image path or directory is required.');
  }

  const cwd = options.cwd ?? process.cwd();
  const imagePaths = await collectImagePaths(inputs, cwd);
  if (imagePaths.length === 0) {
    throw new Error('No supported images found. Supported formats: png, jpg, jpeg, gif, webp.');
  }

  const ids = new Set<string>();
  const targets: NFTTargetDescriptor[] = [];

  for (const filePath of imagePaths) {
    const buffer = await readFile(filePath);
    const metadata = readImageMetadata(buffer);
    const decodedFrame = await decodeImageFrame(filePath);
    const relativePath = relative(cwd, filePath) || basename(filePath);
    const id = createUniqueTargetId(filePath, ids);
    const aspectRatio = Number((metadata.width / Math.max(1, metadata.height)).toFixed(4));
    const entropy = calculateEntropy(buffer);
    const bytesPerPixel = Number((buffer.length / Math.max(1, metadata.width * metadata.height)).toFixed(4));
    const { rating, profile, score, recommendedScale, recommendedDetectionFPS, warnings } =
      calculateTrackingHeuristics({
        width: metadata.width,
        height: metadata.height,
        entropy,
        bytesPerPixel,
        sizeBytes: buffer.length
      });

    targets.push({
      id,
      width: metadata.width,
      height: metadata.height,
      aspectRatio,
      orientation: determineOrientation(metadata.width, metadata.height),
      physicalWidthMm: options.physicalWidthMm,
      source: {
        filename: basename(filePath),
        relativePath,
        format: metadata.format,
        mimeType: MIME_BY_FORMAT[metadata.format],
        sizeBytes: buffer.length,
        sha256: createHash('sha256').update(buffer).digest('hex')
      },
      quality: {
        entropy,
        bytesPerPixel,
        rating,
        warnings: Object.freeze(warnings)
      },
      trackingHint: {
        profile,
        score,
        recommendedScale,
        recommendedDetectionFPS
      },
      featureDescriptor: extractNFTFeatureDescriptor(decodedFrame),
      metadata: Object.freeze({
        sourcePath: relativePath
      })
    });
  }

  const manifestName = options.name ?? createDefaultManifestName(imagePaths);
  const outputPath = resolve(cwd, options.outFile ?? `${manifestName}.aether.nft.json`);
  const manifest: NFTTargetManifest = Object.freeze({
    kind: 'aetherar.nft-manifest',
    schemaVersion: '1.0',
    name: manifestName,
    generatedAt: new Date().toISOString(),
    compiler: {
      name: '@aetherar/cli',
      version: CLI_VERSION,
      mode: 'natural-feature-target' as const
    },
    targets: Object.freeze(targets)
  });

  return {
    manifest,
    outputPath
  };
}

export async function writeCompiledNFTArtifact({
  manifest,
  outputPath
}: CompiledNFTArtifact): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function createDefaultManifestName(imagePaths: readonly string[]): string {
  if (imagePaths.length === 1) {
    return `${slugify(basename(imagePaths[0], extname(imagePaths[0])))}-target`;
  }

  return 'aetherar-targets';
}

async function decodeImageFrame(filePath: string): Promise<ImageFrameLike> {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    width: info.width,
    height: info.height,
    data,
    channels: 4
  };
}

async function collectImagePaths(inputs: readonly string[], cwd: string): Promise<string[]> {
  const collected = new Set<string>();

  for (const input of inputs) {
    const absolutePath = resolve(cwd, input);
    await visitInput(absolutePath, collected);
  }

  return Array.from(collected).sort((left, right) => left.localeCompare(right));
}

async function visitInput(inputPath: string, collected: Set<string>): Promise<void> {
  const inputStat = await stat(inputPath);

  if (inputStat.isDirectory()) {
    const entries = await readdir(inputPath, { withFileTypes: true });
    for (const entry of entries) {
      await visitInput(resolve(inputPath, entry.name), collected);
    }
    return;
  }

  const extension = extname(inputPath).toLowerCase();
  if (inputStat.isFile() && SUPPORTED_EXTENSIONS.has(extension)) {
    collected.add(inputPath);
  }
}

function createUniqueTargetId(filePath: string, existing: Set<string>): string {
  const baseId = slugify(basename(filePath, extname(filePath)));
  let candidate = baseId;
  let counter = 2;

  while (existing.has(candidate)) {
    candidate = `${baseId}-${counter}`;
    counter += 1;
  }

  existing.add(candidate);
  return candidate;
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'target';
}

function determineOrientation(width: number, height: number): NFTOrientation {
  if (width === height) {
    return 'square';
  }

  return width > height ? 'landscape' : 'portrait';
}

function calculateEntropy(buffer: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  const stride = Math.max(1, Math.floor(buffer.length / 65536));
  let sampleCount = 0;

  for (let index = 0; index < buffer.length; index += stride) {
    histogram[buffer[index]] += 1;
    sampleCount += 1;
  }

  let entropy = 0;
  for (const count of histogram) {
    if (count === 0 || sampleCount === 0) {
      continue;
    }

    const probability = count / sampleCount;
    entropy -= probability * Math.log2(probability);
  }

  return Number(entropy.toFixed(3));
}

function calculateTrackingHeuristics({
  width,
  height,
  entropy,
  bytesPerPixel,
  sizeBytes
}: {
  width: number;
  height: number;
  entropy: number;
  bytesPerPixel: number;
  sizeBytes: number;
}): {
  rating: NFTTargetRating;
  profile: NFTTrackingProfile;
  score: number;
  recommendedScale: number;
  recommendedDetectionFPS: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);
  const aspectRatio = maxDimension / Math.max(1, minDimension);

  if (minDimension < 480) {
    warnings.push('Minimum dimension is below 480px; target lock may be unstable on mobile.');
  }

  if (entropy < 4.6) {
    warnings.push('Image entropy is low; add more contrast or visual detail for stronger tracking.');
  }

  if (bytesPerPixel < 0.08) {
    warnings.push('Source is heavily compressed; use a less compressed image for better feature retention.');
  }

  if (aspectRatio > 2.2) {
    warnings.push('Aspect ratio is extreme; a more balanced composition usually tracks better.');
  }

  const rawScore =
    32 +
    Math.min(24, Math.max(0, (minDimension - 320) / 24)) +
    Math.min(22, Math.max(0, (entropy - 4) * 8)) +
    Math.min(14, Math.max(0, (bytesPerPixel - 0.06) * 90)) +
    Math.min(8, Math.max(0, (sizeBytes - 40_000) / 35_000)) -
    (aspectRatio > 2.2 ? 10 : 0);

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const rating: NFTTargetRating =
    score >= 86 ? 'excellent' : score >= 72 ? 'high' : score >= 55 ? 'medium' : 'low';
  const profile: NFTTrackingProfile =
    score >= 80 ? 'precision' : score >= 58 ? 'balanced' : 'fast';
  const recommendedScale = Number((Math.max(0.35, Math.min(1, 1400 / maxDimension))).toFixed(3));
  const recommendedDetectionFPS = profile === 'precision' ? 30 : profile === 'balanced' ? 24 : 18;

  return {
    rating,
    profile,
    score,
    recommendedScale,
    recommendedDetectionFPS,
    warnings
  };
}

function readImageMetadata(buffer: Uint8Array): ImageMetadata {
  return readPngMetadata(buffer) ?? readJpegMetadata(buffer) ?? readGifMetadata(buffer) ?? readWebpMetadata(buffer) ?? unsupportedFormatError();
}

function unsupportedFormatError(): never {
  throw new Error('Unsupported or invalid image. Supported formats: png, jpg, jpeg, gif, webp.');
}

function readPngMetadata(buffer: Uint8Array): ImageMetadata | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buffer.length < 24 || !signature.every((value, index) => buffer[index] === value)) {
    return null;
  }

  return {
    format: 'png',
    width: readUInt32BE(buffer, 16),
    height: readUInt32BE(buffer, 20)
  };
}

function readJpegMetadata(buffer: Uint8Array): ImageMetadata | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let marker = buffer[offset + 1];
    while (marker === 0xff) {
      offset += 1;
      marker = buffer[offset + 1];
    }

    if (marker === 0xd9) {
      break;
    }

    if (marker >= 0xd0 && marker <= 0xd7) {
      offset += 2;
      continue;
    }

    const segmentLength = readUInt16BE(buffer, offset + 2);
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        format: 'jpeg',
        height: readUInt16BE(buffer, offset + 5),
        width: readUInt16BE(buffer, offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function readGifMetadata(buffer: Uint8Array): ImageMetadata | null {
  const header = String.fromCharCode(...buffer.slice(0, 6));
  if (buffer.length < 10 || (header !== 'GIF87a' && header !== 'GIF89a')) {
    return null;
  }

  return {
    format: 'gif',
    width: readUInt16LE(buffer, 6),
    height: readUInt16LE(buffer, 8)
  };
}

function readWebpMetadata(buffer: Uint8Array): ImageMetadata | null {
  if (
    buffer.length < 30 ||
    toAscii(buffer.slice(0, 4)) !== 'RIFF' ||
    toAscii(buffer.slice(8, 12)) !== 'WEBP'
  ) {
    return null;
  }

  const chunkType = toAscii(buffer.slice(12, 16));

  if (chunkType === 'VP8X') {
    return {
      format: 'webp',
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1
    };
  }

  if (chunkType === 'VP8L') {
    const packed = readUInt32LE(buffer, 21);
    return {
      format: 'webp',
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1
    };
  }

  if (chunkType === 'VP8 ') {
    return {
      format: 'webp',
      width: readUInt16LE(buffer, 26) & 0x3fff,
      height: readUInt16LE(buffer, 28) & 0x3fff
    };
  }

  return null;
}

function toAscii(buffer: Uint8Array): string {
  return String.fromCharCode(...buffer);
}

function readUInt16BE(buffer: Uint8Array, offset: number): number {
  return (buffer[offset] << 8) | buffer[offset + 1];
}

function readUInt16LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function readUInt24LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function readUInt32LE(buffer: Uint8Array, offset: number): number {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  ) >>> 0;
}

function readUInt32BE(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  ) >>> 0;
}
