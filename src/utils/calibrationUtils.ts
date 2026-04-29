/**
 * Light Calibration and Color Validation Utilities
 * Implements robust color validation and quality assessment
 * Based on meta-classificador-tecidos implementation
 */

import {
  RgbColor,
  RgbColor8Bit,
  LabColor,
  rgb8BitToNormalized,
  normalizedToRgb8Bit,
  rgbToLab,
  calculateDeltaE2000,
  isValidLabColor,
} from './colorSpaceConversion';

export interface CalibrationValidationResult {
  isValid: boolean;
  qualityScore: number; // 0-100
  issues: string[];
  metrics: {
    averageLuminance: number;
    standardDeviation: number;
    rgbBalance: number;
    lightVariation: number;
    samplesUsed: number;
    samplesTotal: number;
  };
}

export interface ColorQualityMetrics {
  luminanceScore: number; // 0-100
  stabilityScore: number; // 0-100
  correctionScore: number; // 0-100
  overallScore: number; // 0-100
}

export interface CalibratedColorData {
  referenceRgb8Bit: RgbColor8Bit;
  referenceRgbNormalized: RgbColor;
  referenceLabColor: LabColor;
  referenceHex: string;
  luminance: number;
  qualityScore: number;
  timestamp: number;
}

/**
 * Calculate luminance of a color using standard formula
 * L = 0.299*R + 0.587*G + 0.114*B
 */
export function calculateLuminance(rgb: RgbColor): number {
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/**
 * Calculate simple mean of RGB colors
 */
function calculateSimpleColorMean(colors: RgbColor[]): RgbColor {
  if (colors.length === 0) return { r: 0.5, g: 0.5, b: 0.5 };
  if (colors.length === 1) return colors[0];

  let sumR = 0,
    sumG = 0,
    sumB = 0;
  for (const color of colors) {
    sumR += color.r;
    sumG += color.g;
    sumB += color.b;
  }

  return {
    r: sumR / colors.length,
    g: sumG / colors.length,
    b: sumB / colors.length,
  };
}

/**
 * Calculate color distance (Euclidean distance in RGB space)
 */
function calculateColorDistance(color1: RgbColor, color2: RgbColor): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Remove color outliers using Interquartile Range (IQR) method
 */
export function removeColorOutliers(colors: RgbColor[]): RgbColor[] {
  if (colors.length <= 3) return [...colors];

  const mean = calculateSimpleColorMean(colors);
  const distances = colors.map((c) => calculateColorDistance(c, mean)).sort((a, b) => a - b);

  const q3Index = Math.floor((3 * distances.length) / 4);
  const q3 = distances[Math.min(q3Index, distances.length - 1)];
  const threshold = q3 * 1.5;

  const cleaned = colors.filter((c) => calculateColorDistance(c, mean) <= threshold);

  console.log(
    `[CalibrationUtils] Removed ${colors.length - cleaned.length}/${colors.length} outliers`,
  );

  return cleaned.length > 0 ? cleaned : colors;
}

/**
 * Calculate robust weighted mean of RGB colors (resistant to outliers)
 */
export function calculateRobustColorMean(colors: RgbColor[]): RgbColor {
  if (colors.length === 0) return { r: 0.5, g: 0.5, b: 0.5 };
  if (colors.length === 1) return colors[0];

  const initialMean = calculateSimpleColorMean(colors);

  let totalWeight = 0;
  let weightedSumR = 0,
    weightedSumG = 0,
    weightedSumB = 0;

  for (const color of colors) {
    const distance = calculateColorDistance(color, initialMean);
    const weight = 1 / (1 + distance * 5); // Tuning factor: 5

    weightedSumR += color.r * weight;
    weightedSumG += color.g * weight;
    weightedSumB += color.b * weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    return {
      r: weightedSumR / totalWeight,
      g: weightedSumG / totalWeight,
      b: weightedSumB / totalWeight,
    };
  }

  return initialMean;
}

/**
 * Calculate color standard deviation
 */
export function calculateColorStandardDeviation(colors: RgbColor[], mean: RgbColor): number {
  if (colors.length <= 1) return 0;

  let sumSquaredDifferences = 0;
  for (const color of colors) {
    const distance = calculateColorDistance(color, mean);
    sumSquaredDifferences += distance * distance;
  }

  return Math.sqrt(sumSquaredDifferences / colors.length);
}

/**
 * Calculate RGB balance (how equal R, G, B channels are)
 * Returns value between 0 and 1, where 1 = perfect balance
 */
export function calculateRgbBalance(rgb: RgbColor): number {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);

  if (max === 0) return 0;

  // Balance score: 1 - (max-min)/max, normalized
  const diff = max - min;
  return 1 - diff / max;
}

/**
 * Calculate light variation from multiple samples
 */
export function calculateLightVariation(luminances: number[]): number {
  if (luminances.length <= 1) return 0;

  const mean = luminances.reduce((a, b) => a + b, 0) / luminances.length;
  const squaredDiffs = luminances.map((l) => Math.pow(l - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / luminances.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (as percentage)
  return mean > 0 ? (stdDev / mean) * 100 : 0;
}

/**
 * Apply color correction using white reference
 * This compensates for lighting variations
 */
export function applyColorCorrection(rawColor: RgbColor, whiteReference: RgbColor): RgbColor {
  if (whiteReference.r < 0.01 || whiteReference.g < 0.01 || whiteReference.b < 0.01) {
    console.warn('[CalibrationUtils] White reference too dark - minimal correction applied');
    return rawColor;
  }

  let correctedR = Math.min(1, rawColor.r / whiteReference.r);
  let correctedG = Math.min(1, rawColor.g / whiteReference.g);
  let correctedB = Math.min(1, rawColor.b / whiteReference.b);

  const corrected: RgbColor = { r: correctedR, g: correctedG, b: correctedB };

  // Prevent over-correction with blending
  const correctionMagnitude = calculateColorDistance(rawColor, corrected);
  if (correctionMagnitude > 0.4) {
    const blendFactor = 0.4 / correctionMagnitude;
    return {
      r: rawColor.r + (corrected.r - rawColor.r) * blendFactor,
      g: rawColor.g + (corrected.g - rawColor.g) * blendFactor,
      b: rawColor.b + (corrected.b - rawColor.b) * blendFactor,
    };
  }

  return corrected;
}

/**
 * Validate light calibration with comprehensive checks
 */
export function validateLightCalibration(
  calibrationColor: RgbColor,
  samples: RgbColor[],
  luminanceValues: number[],
  standardDeviation: number,
  minLuminance: number = 0.05,
  maxLuminance: number = 0.98,
  maxLightVariation: number = 0.08,
): CalibrationValidationResult {
  const issues: string[] = [];
  const metrics = {
    averageLuminance: 0,
    standardDeviation: standardDeviation,
    rgbBalance: 0,
    lightVariation: 0,
    samplesUsed: samples.length,
    samplesTotal: samples.length,
  };

  // Luminance validation
  const averageLuminance = calculateLuminance(calibrationColor);
  metrics.averageLuminance = averageLuminance;

  if (averageLuminance < minLuminance) {
    issues.push(`Luminância muito baixa (${(averageLuminance * 100).toFixed(1)}%)`);
  } else if (averageLuminance > maxLuminance) {
    issues.push(`Luminância muito alta (${(averageLuminance * 100).toFixed(1)}%)`);
  }

  // RGB balance validation
  const rgbBalance = calculateRgbBalance(calibrationColor);
  metrics.rgbBalance = rgbBalance;

  if (rgbBalance < 0.85) {
    const imbalance = ((1 - rgbBalance) * 100).toFixed(1);
    issues.push(`Desequilíbrio RGB: ${imbalance}% (canais não balanceados)`);
  }

  // Light variation validation
  const lightVariation = calculateLightVariation(luminanceValues);
  metrics.lightVariation = lightVariation;

  if (lightVariation > maxLightVariation * 100) {
    issues.push(
      `Variação de luz muito alta: ${lightVariation.toFixed(1)}% (iluminação instável)`,
    );
  }

  // Stability validation
  if (standardDeviation > 0.15) {
    issues.push(
      `Baixa estabilidade: desvio padrão ${standardDeviation.toFixed(3)} (movimento detectado)`,
    );
  }

  // Calculate quality score
  let qualityScore = 100;

  // Luminance score (30%)
  if (averageLuminance >= minLuminance && averageLuminance <= maxLuminance) {
    qualityScore *= 1.0; // Perfect
  } else if (
    averageLuminance >= minLuminance * 0.8 &&
    averageLuminance <= maxLuminance * 1.2
  ) {
    qualityScore *= 0.7; // Acceptable
  } else {
    qualityScore *= 0.3; // Poor
  }

  // RGB balance score (30%)
  qualityScore *= Math.max(0.3, rgbBalance);

  // Stability score (30%)
  const stabilityScore = Math.max(0.3, 1 - standardDeviation * 2);
  qualityScore *= stabilityScore;

  // Light variation score (10%)
  const variationScore = Math.max(0.3, 1 - lightVariation / 100);
  qualityScore *= variationScore;

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const isValid = issues.length === 0 && qualityScore >= 40;

  return {
    isValid,
    qualityScore,
    issues,
    metrics,
  };
}

/**
 * Calculate quality metrics for captured color sample
 */
export function calculateColorQualityMetrics(
  cleanSamples: RgbColor[],
  capturedColor: RgbColor,
  correctedColor: RgbColor,
): ColorQualityMetrics {
  // Luminance score: check if in good range (20-90% of max)
  const luminance = calculateLuminance(capturedColor);
  const luminanceScore = Math.min(100, (luminance / 0.5) * 100); // Peak at 0.5

  // Stability score: based on standard deviation
  const mean = calculateSimpleColorMean(cleanSamples);
  const stdDev = calculateColorStandardDeviation(cleanSamples, mean);
  const stabilityScore = Math.max(0, 100 - stdDev * 200);

  // Correction score: how much correction was needed
  const correctionAmount = calculateColorDistance(capturedColor, correctedColor);
  const correctionScore = Math.max(50, 100 - correctionAmount * 100);

  // Overall score
  const overallScore = (luminanceScore * 0.3 + stabilityScore * 0.4 + correctionScore * 0.3);

  return {
    luminanceScore: Math.max(0, Math.min(100, luminanceScore)),
    stabilityScore: Math.max(0, Math.min(100, stabilityScore)),
    correctionScore: Math.max(0, Math.min(100, correctionScore)),
    overallScore: Math.max(0, Math.min(100, overallScore)),
  };
}

/**
 * Evaluate if a color matches a reference within delta E tolerance
 */
export function evaluateColorMatch(
  fabricColor: RgbColor,
  referenceColor: RgbColor,
  deltaEThreshold: number = 2.0,
): {
  matches: boolean;
  deltaE: number;
  deltaL: number;
  deltaA: number;
  deltaB: number;
} {
  const fabricLab = rgbToLab(fabricColor);
  const referenceLab = rgbToLab(referenceColor);

  if (!isValidLabColor(fabricLab) || !isValidLabColor(referenceLab)) {
    console.warn('[CalibrationUtils] Invalid LAB colors for evaluation');
    return {
      matches: false,
      deltaE: Infinity,
      deltaL: Infinity,
      deltaA: Infinity,
      deltaB: Infinity,
    };
  }

  const deltaE = calculateDeltaE2000(referenceLab, fabricLab);
  const deltaL = fabricLab.L - referenceLab.L;
  const deltaA = fabricLab.a - referenceLab.a;
  const deltaB = fabricLab.b - referenceLab.b;

  return {
    matches: deltaE <= deltaEThreshold,
    deltaE,
    deltaL,
    deltaA,
    deltaB,
  };
}

/**
 * Create calibrated color data object
 */
export function createCalibratedColorData(
  rgbColor: RgbColor,
  qualityScore: number,
): CalibratedColorData {
  const rgb8Bit = normalizedToRgb8Bit(rgbColor);
  const labColor = rgbToLab(rgbColor);
  const luminance = calculateLuminance(rgbColor);

  let hex = '#FFFFFF';
  try {
    const toHex = (n: number) => {
      const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    hex = `#${toHex(rgb8Bit.r)}${toHex(rgb8Bit.g)}${toHex(rgb8Bit.b)}`;
  } catch (e) {
    console.error('[CalibrationUtils] Error creating hex color:', e);
  }

  return {
    referenceRgb8Bit: rgb8Bit,
    referenceRgbNormalized: rgbColor,
    referenceLabColor: labColor,
    referenceHex: hex,
    luminance,
    qualityScore,
    timestamp: Date.now(),
  };
}
