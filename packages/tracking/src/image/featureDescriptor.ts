export interface ImageFrameLike {
  width: number;
  height: number;
  data: ArrayLike<number>;
  channels?: 1 | 3 | 4;
}

export interface GrayscaleFrame {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface FrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedFrameBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NFTFeatureDescriptor {
  version: '1.0';
  gridSize: number;
  hashGridSize: number;
  luminanceGrid: readonly number[];
  gradientHistogram: readonly number[];
  binaryHash: string;
  contrast: number;
  edgeDensity: number;
  meanLuminance: number;
}

export interface NFTDescriptorExtractionOptions {
  gridSize?: number;
  hashGridSize?: number;
}

export interface NFTDescriptorComparison {
  score: number;
  luminanceCorrelation: number;
  gradientSimilarity: number;
  hashSimilarity: number;
  contrastSimilarity: number;
  edgeSimilarity: number;
}

const DEFAULT_GRID_SIZE = 18;
const DEFAULT_HASH_GRID_SIZE = 8;

const POPCOUNT_BY_NIBBLE = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function createGrayscaleFrame(input: ImageFrameLike): GrayscaleFrame {
  const { width, height } = input;
  const totalPixels = width * height;
  if (totalPixels <= 0) {
    throw new Error('Frame dimensions must be positive.');
  }

  const inferredChannels = inferChannelCount(input, totalPixels);
  const grayscale = new Uint8Array(totalPixels);

  if (inferredChannels === 1) {
    for (let index = 0; index < totalPixels; index += 1) {
      grayscale[index] = clampByte(input.data[index] ?? 0);
    }
    return { width, height, data: grayscale };
  }

  const channelStride = inferredChannels;

  for (let index = 0; index < totalPixels; index += 1) {
    const baseIndex = index * channelStride;
    const red = Number(input.data[baseIndex] ?? 0);
    const green = Number(input.data[baseIndex + 1] ?? red);
    const blue = Number(input.data[baseIndex + 2] ?? red);
    grayscale[index] = clampByte(Math.round(red * 0.299 + green * 0.587 + blue * 0.114));
  }

  return { width, height, data: grayscale };
}

export function cropGrayscaleFrame(frame: GrayscaleFrame, bounds: FrameBounds): GrayscaleFrame {
  const x = clampInteger(Math.round(bounds.x), 0, frame.width - 1);
  const y = clampInteger(Math.round(bounds.y), 0, frame.height - 1);
  const width = clampInteger(Math.round(bounds.width), 1, frame.width - x);
  const height = clampInteger(Math.round(bounds.height), 1, frame.height - y);
  const cropped = new Uint8Array(width * height);

  for (let row = 0; row < height; row += 1) {
    const sourceStart = (y + row) * frame.width + x;
    cropped.set(frame.data.subarray(sourceStart, sourceStart + width), row * width);
  }

  return {
    width,
    height,
    data: cropped
  };
}

export function normalizeBounds(bounds: FrameBounds, frame: Pick<GrayscaleFrame, 'width' | 'height'>): NormalizedFrameBounds {
  return {
    x: bounds.x / frame.width,
    y: bounds.y / frame.height,
    width: bounds.width / frame.width,
    height: bounds.height / frame.height
  };
}

export function extractNFTFeatureDescriptor(
  input: ImageFrameLike | GrayscaleFrame,
  options: NFTDescriptorExtractionOptions = {}
): NFTFeatureDescriptor {
  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const hashGridSize = options.hashGridSize ?? DEFAULT_HASH_GRID_SIZE;
  const grayscale = isGrayscaleFrame(input) ? input : createGrayscaleFrame(input);
  const resized = resizeGrayscaleFrame(grayscale, gridSize, gridSize);

  const luminanceGrid = Array.from(resized.data);
  const mean = computeAverage(luminanceGrid);
  const contrast = computeContrast(luminanceGrid, mean);
  const gradient = computeGradientHistogram(resized);
  const binaryHash = createBinaryHash(resized, hashGridSize, mean);

  return Object.freeze({
    version: '1.0',
    gridSize,
    hashGridSize,
    luminanceGrid: Object.freeze(luminanceGrid),
    gradientHistogram: Object.freeze(gradient.histogram),
    binaryHash,
    contrast,
    edgeDensity: gradient.edgeDensity,
    meanLuminance: Number((mean / 255).toFixed(4))
  });
}

export function compareNFTFeatureDescriptors(
  left: NFTFeatureDescriptor,
  right: NFTFeatureDescriptor
): NFTDescriptorComparison {
  if (left.gridSize !== right.gridSize) {
    throw new Error('Cannot compare descriptors with different grid sizes.');
  }

  const luminanceCorrelation = computeNormalizedCorrelation(left.luminanceGrid, right.luminanceGrid);
  const gradientSimilarity = histogramIntersection(left.gradientHistogram, right.gradientHistogram);
  const hashSimilarity = compareBinaryHashes(left.binaryHash, right.binaryHash);
  const contrastSimilarity = compareScalars(left.contrast, right.contrast);
  const edgeSimilarity = compareScalars(left.edgeDensity, right.edgeDensity);

  const rawScore =
    luminanceCorrelation * 0.5 +
    gradientSimilarity * 0.22 +
    hashSimilarity * 0.18 +
    contrastSimilarity * 0.05 +
    edgeSimilarity * 0.05;

  return {
    score: Number(rawScore.toFixed(4)),
    luminanceCorrelation,
    gradientSimilarity,
    hashSimilarity,
    contrastSimilarity,
    edgeSimilarity
  };
}

function isGrayscaleFrame(input: ImageFrameLike | GrayscaleFrame): input is GrayscaleFrame {
  return 'channels' in input === false && input.data instanceof Uint8Array;
}

function inferChannelCount(input: ImageFrameLike, totalPixels: number): 1 | 3 | 4 {
  if (input.channels) {
    return input.channels;
  }

  const length = input.data.length;
  if (length === totalPixels) {
    return 1;
  }

  if (length === totalPixels * 3) {
    return 3;
  }

  return 4;
}

function resizeGrayscaleFrame(frame: GrayscaleFrame, width: number, height: number): GrayscaleFrame {
  const resized = new Uint8Array(width * height);

  for (let targetY = 0; targetY < height; targetY += 1) {
    const sourceY = ((targetY + 0.5) * frame.height) / height - 0.5;
    const y0 = clampInteger(Math.floor(sourceY), 0, frame.height - 1);
    const y1 = clampInteger(y0 + 1, 0, frame.height - 1);
    const ty = clampNumber(sourceY - y0, 0, 1);

    for (let targetX = 0; targetX < width; targetX += 1) {
      const sourceX = ((targetX + 0.5) * frame.width) / width - 0.5;
      const x0 = clampInteger(Math.floor(sourceX), 0, frame.width - 1);
      const x1 = clampInteger(x0 + 1, 0, frame.width - 1);
      const tx = clampNumber(sourceX - x0, 0, 1);

      const topLeft = frame.data[y0 * frame.width + x0];
      const topRight = frame.data[y0 * frame.width + x1];
      const bottomLeft = frame.data[y1 * frame.width + x0];
      const bottomRight = frame.data[y1 * frame.width + x1];

      const top = topLeft + (topRight - topLeft) * tx;
      const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
      resized[targetY * width + targetX] = clampByte(Math.round(top + (bottom - top) * ty));
    }
  }

  return { width, height, data: resized };
}

function computeAverage(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }

  return total / Math.max(1, values.length);
}

function computeContrast(values: readonly number[], mean: number): number {
  let total = 0;
  for (const value of values) {
    const delta = value - mean;
    total += delta * delta;
  }

  return Number((Math.sqrt(total / Math.max(1, values.length)) / 255).toFixed(4));
}

function computeGradientHistogram(frame: GrayscaleFrame): {
  histogram: number[];
  edgeDensity: number;
} {
  const histogram = new Array<number>(8).fill(0);
  let totalMagnitude = 0;
  let edgePixels = 0;

  for (let y = 1; y < frame.height - 1; y += 1) {
    for (let x = 1; x < frame.width - 1; x += 1) {
      const gx =
        -frame.data[(y - 1) * frame.width + (x - 1)] -
        2 * frame.data[y * frame.width + (x - 1)] -
        frame.data[(y + 1) * frame.width + (x - 1)] +
        frame.data[(y - 1) * frame.width + (x + 1)] +
        2 * frame.data[y * frame.width + (x + 1)] +
        frame.data[(y + 1) * frame.width + (x + 1)];

      const gy =
        -frame.data[(y - 1) * frame.width + (x - 1)] -
        2 * frame.data[(y - 1) * frame.width + x] -
        frame.data[(y - 1) * frame.width + (x + 1)] +
        frame.data[(y + 1) * frame.width + (x - 1)] +
        2 * frame.data[(y + 1) * frame.width + x] +
        frame.data[(y + 1) * frame.width + (x + 1)];

      const magnitude = Math.sqrt(gx * gx + gy * gy) / 1020;
      const normalizedMagnitude = clampNumber(magnitude, 0, 1);
      const orientation = (Math.atan2(gy, gx) + Math.PI) / (2 * Math.PI);
      const bin = Math.min(7, Math.floor(orientation * histogram.length));

      histogram[bin] += normalizedMagnitude;
      totalMagnitude += normalizedMagnitude;

      if (normalizedMagnitude > 0.18) {
        edgePixels += 1;
      }
    }
  }

  if (totalMagnitude > 0) {
    for (let index = 0; index < histogram.length; index += 1) {
      histogram[index] = Number((histogram[index] / totalMagnitude).toFixed(4));
    }
  }

  const sampledPixels = Math.max(1, (frame.width - 2) * (frame.height - 2));

  return {
    histogram,
    edgeDensity: Number((edgePixels / sampledPixels).toFixed(4))
  };
}

function createBinaryHash(frame: GrayscaleFrame, hashGridSize: number, mean: number): string {
  const cells: number[] = [];
  const cellWidth = frame.width / hashGridSize;
  const cellHeight = frame.height / hashGridSize;

  for (let gridY = 0; gridY < hashGridSize; gridY += 1) {
    for (let gridX = 0; gridX < hashGridSize; gridX += 1) {
      const startX = Math.floor(gridX * cellWidth);
      const endX = Math.floor((gridX + 1) * cellWidth);
      const startY = Math.floor(gridY * cellHeight);
      const endY = Math.floor((gridY + 1) * cellHeight);

      let total = 0;
      let count = 0;

      for (let y = startY; y < Math.max(startY + 1, endY); y += 1) {
        for (let x = startX; x < Math.max(startX + 1, endX); x += 1) {
          total += frame.data[y * frame.width + x];
          count += 1;
        }
      }

      cells.push(total / Math.max(1, count) >= mean ? 1 : 0);
    }
  }

  let hash = '';
  for (let index = 0; index < cells.length; index += 4) {
    const nibble =
      (cells[index] ?? 0) * 8 +
      (cells[index + 1] ?? 0) * 4 +
      (cells[index + 2] ?? 0) * 2 +
      (cells[index + 3] ?? 0);
    hash += nibble.toString(16);
  }

  return hash;
}

function computeNormalizedCorrelation(left: readonly number[], right: readonly number[]): number {
  const leftMean = computeAverage(left);
  const rightMean = computeAverage(right);

  let numerator = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] - leftMean;
    const rightValue = right[index] - rightMean;
    numerator += leftValue * rightValue;
    leftEnergy += leftValue * leftValue;
    rightEnergy += rightValue * rightValue;
  }

  if (leftEnergy === 0 || rightEnergy === 0) {
    return 0;
  }

  const correlation = numerator / Math.sqrt(leftEnergy * rightEnergy);
  return Number((((correlation + 1) / 2) || 0).toFixed(4));
}

function histogramIntersection(left: readonly number[], right: readonly number[]): number {
  let total = 0;

  for (let index = 0; index < left.length; index += 1) {
    total += Math.min(left[index] ?? 0, right[index] ?? 0);
  }

  return Number(total.toFixed(4));
}

function compareBinaryHashes(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  let differingBits = 0;
  let totalBits = 0;

  for (let index = 0; index < length; index += 1) {
    const leftNibble = Number.parseInt(left[index], 16);
    const rightNibble = Number.parseInt(right[index], 16);

    if (Number.isNaN(leftNibble) || Number.isNaN(rightNibble)) {
      continue;
    }

    differingBits += POPCOUNT_BY_NIBBLE[leftNibble ^ rightNibble];
    totalBits += 4;
  }

  if (totalBits === 0) {
    return 0;
  }

  return Number((1 - differingBits / totalBits).toFixed(4));
}

function compareScalars(left: number, right: number): number {
  const highest = Math.max(Math.abs(left), Math.abs(right), 0.0001);
  return Number((1 - Math.min(1, Math.abs(left - right) / highest)).toFixed(4));
}

function clampByte(value: number): number {
  return clampInteger(value, 0, 255);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
