/**
 * Colorimetric Standards and Configuration
 * Defines CIE standards, illuminants, and color profiles for textile analysis
 */

/**
 * CIE D65 Illuminant (Standard Daylight)
 * Official CIE reference values for daylight illumination
 * Color temperature: 6504K
 */
export const CIE_D65_ILLUMINANT = {
  name: 'D65 - Standard Daylight',
  colorTemperature: 6504, // Kelvin
  x: 95.047,
  y: 100.0,
  z: 108.883,
  description: 'CIE standard illuminant representing average daylight',
} as const;

/**
 * CIE A Illuminant (Incandescent Light)
 * Represents tungsten incandescent light
 * Color temperature: 2856K
 */
export const CIE_A_ILLUMINANT = {
  name: 'A - Incandescent Tungsten',
  colorTemperature: 2856,
  x: 109.85,
  y: 100.0,
  z: 35.58,
  description: 'CIE standard illuminant for incandescent light',
} as const;

/**
 * CIE F2 Illuminant (Cool White Fluorescent)
 * Represents cool white fluorescent light
 * Color temperature: 4230K
 */
export const CIE_F2_ILLUMINANT = {
  name: 'F2 - Cool White Fluorescent',
  colorTemperature: 4230,
  x: 99.187,
  y: 100.0,
  z: 67.395,
  description: 'CIE standard illuminant for cool white fluorescent',
} as const;

/**
 * CIE Standard Observer
 * 2° standard observer (1931)
 */
export const CIE_2_DEGREE_OBSERVER = {
  angle: 2,
  year: 1931,
  description: 'CIE 2° Standard Observer (most common)',
} as const;

/**
 * CIE Standard Observer
 * 10° standard observer (1964)
 */
export const CIE_10_DEGREE_OBSERVER = {
  angle: 10,
  year: 1964,
  description: 'CIE 10° Standard Observer (for wide viewing angles)',
} as const;

/**
 * Delta E Thresholds
 * Defines perceptual differences according to CIE standards
 */
export const DELTA_E_THRESHOLDS = {
  imperceptible: 0.5,
  justNoticeable: 1.0,
  noticeable: 2.0,
  obvious: 3.0,
  veryClear: 5.0,
  extreme: 10.0,
} as const;

/**
 * Delta E Interpretation Guide
 */
export const DELTA_E_INTERPRETATION = {
  0: 'Identical colors',
  0.5: 'Imperceptible to human eye',
  1.0: 'Just noticeable to trained observer',
  2.0: 'Noticeable color difference',
  3.0: 'Obvious color difference',
  5.0: 'Very clear color difference',
  10.0: 'Extreme color difference',
} as const;

/**
 * Color Tolerance Standards for Textile Industry
 * These are typical pass/fail criteria for fabric color matching
 */
export const TEXTILE_COLOR_TOLERANCE = {
  strict: {
    label: 'Strict (Grade A)',
    deltaE: 0.5,
    description: 'Highest quality standards',
  },
  high: {
    label: 'High (Grade B)',
    deltaE: 1.0,
    description: 'Premium textiles and fashion',
  },
  medium: {
    label: 'Medium (Grade C)',
    deltaE: 2.0,
    description: 'Standard commercial textiles',
  },
  loose: {
    label: 'Loose (Grade D)',
    deltaE: 3.0,
    description: 'Casual/decorative textiles',
  },
} as const;

/**
 * Calibration Quality Thresholds
 */
export const CALIBRATION_QUALITY = {
  excellent: {
    min: 80,
    label: 'Excellent',
    icon: '✓',
    color: 'green',
  },
  good: {
    min: 60,
    label: 'Good',
    icon: '✓',
    color: 'blue',
  },
  acceptable: {
    min: 40,
    label: 'Acceptable',
    icon: '⚠',
    color: 'yellow',
  },
  poor: {
    min: 0,
    label: 'Poor',
    icon: '✗',
    color: 'red',
  },
} as const;

/**
 * Light Calibration Parameters
 */
export const LIGHT_CALIBRATION_PARAMS = {
  minLuminance: 0.05, // 5% - minimum brightness
  maxLuminance: 0.98, // 98% - maximum brightness (avoid saturation)
  maxRgbImbalance: 0.15, // 15% - max difference between R, G, B channels
  maxLightVariation: 0.08, // 8% - coefficient of variation
  minStabilityScore: 0.3, // 30% - minimum stability
  sampleCount: 5, // number of samples for robust calibration
  captureIntervalMs: 200, // milliseconds between captures
} as const;

/**
 * Color Capture Parameters
 */
export const COLOR_CAPTURE_PARAMS = {
  sampleCount: 5, // number of samples for robust capture
  captureIntervalMs: 200, // milliseconds between captures
  minSamplesForProcessing: 2, // minimum valid samples needed
  outlierThreshold: 1.5, // IQR multiplier for outlier detection
  robustMeanTuningFactor: 5, // tuning for weighted mean
} as const;

/**
 * ICC Profile Information
 * Template for color profile metadata
 */
export interface IccProfileInfo {
  name: string;
  description: string;
  colorSpace: 'RGB' | 'LAB' | 'CMYK' | 'XYZ';
  illuminant: typeof CIE_D65_ILLUMINANT;
  observer: typeof CIE_2_DEGREE_OBSERVER;
  mediaWhitePoint: {
    X: number;
    Y: number;
    Z: number;
  };
  gamma?: number;
}

/**
 * Default ICC Profile for Fabric Analyzer
 */
export const DEFAULT_FABRIC_ANALYZER_PROFILE: IccProfileInfo = {
  name: 'Fabric Analyzer sRGB D65',
  description: 'Color profile for fabric analysis with D65 illuminant',
  colorSpace: 'RGB',
  illuminant: CIE_D65_ILLUMINANT,
  observer: CIE_2_DEGREE_OBSERVER,
  mediaWhitePoint: {
    X: CIE_D65_ILLUMINANT.x,
    Y: CIE_D65_ILLUMINANT.y,
    Z: CIE_D65_ILLUMINANT.z,
  },
  gamma: 2.2,
};

/**
 * sRGB Matrix (D65)
 * Official CIE RGB to XYZ conversion matrix for sRGB
 */
export const SRGB_TO_XYZ_MATRIX = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
] as const;

/**
 * Get appropriate delta E threshold for textile grade
 */
export function getDeltaEThreshold(grade: keyof typeof TEXTILE_COLOR_TOLERANCE): number {
  return TEXTILE_COLOR_TOLERANCE[grade].deltaE;
}

/**
 * Get calibration quality rating
 */
export function getQualityRating(score: number): (typeof CALIBRATION_QUALITY)[keyof typeof CALIBRATION_QUALITY] {
  if (score >= CALIBRATION_QUALITY.excellent.min) {
    return CALIBRATION_QUALITY.excellent;
  } else if (score >= CALIBRATION_QUALITY.good.min) {
    return CALIBRATION_QUALITY.good;
  } else if (score >= CALIBRATION_QUALITY.acceptable.min) {
    return CALIBRATION_QUALITY.acceptable;
  } else {
    return CALIBRATION_QUALITY.poor;
  }
}

/**
 * Get delta E interpretation
 */
export function getDeltaEInterpretation(deltaE: number): string {
  if (deltaE <= DELTA_E_THRESHOLDS.imperceptible) {
    return DELTA_E_INTERPRETATION[0];
  } else if (deltaE <= DELTA_E_THRESHOLDS.justNoticeable) {
    return DELTA_E_INTERPRETATION[0.5];
  } else if (deltaE <= DELTA_E_THRESHOLDS.noticeable) {
    return DELTA_E_INTERPRETATION[1.0];
  } else if (deltaE <= DELTA_E_THRESHOLDS.obvious) {
    return DELTA_E_INTERPRETATION[2.0];
  } else if (deltaE <= DELTA_E_THRESHOLDS.veryClear) {
    return DELTA_E_INTERPRETATION[3.0];
  } else if (deltaE <= DELTA_E_THRESHOLDS.extreme) {
    return DELTA_E_INTERPRETATION[5.0];
  } else {
    return DELTA_E_INTERPRETATION[10.0];
  }
}
