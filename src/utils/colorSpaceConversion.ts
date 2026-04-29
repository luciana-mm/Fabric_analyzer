/**
 * Color Space Conversion Utilities
 * Implements CIE standard color conversions with scientific precision
 * Based on meta-classificador-tecidos implementation
 */

/** Structure for LAB color representation */
export interface LabColor {
  L: number; // Lightness (0-100)
  a: number; // Green-Red axis
  b: number; // Blue-Yellow axis
}

/** Structure for RGB color */
export interface RgbColor {
  r: number; // 0-1
  g: number;
  b: number;
}

/** Structure for 8-bit RGB color */
export interface RgbColor8Bit {
  r: number; // 0-255
  g: number;
  b: number;
}

/** Structure for XYZ color */
export interface XyzColor {
  X: number;
  Y: number;
  Z: number;
}

// Illuminant D65 (CIE standard for sRGB)
const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

// sRGB gamma conversion constants
const SRGB_GAMMA_THRESHOLD = 0.04045;
const SRGB_GAMMA_LOW_SCALE = 1.0 / 12.92;
const SRGB_GAMMA_HIGH_A = 0.055;
const SRGB_GAMMA_HIGH_SCALE = 1.055;
const SRGB_GAMMA_POWER = 2.4;

// XYZ to Lab conversion constants
const XYZ_EPSILON = 0.008856; // (6/29)³
const XYZ_KAPPA = 903.3; // (29/3)² × 3
const XYZ_CUBE_ROOT_THRESHOLD = 0.008856;

// Official CIE RGB to XYZ matrix (D65)
const RGB_TO_XYZ_MATRIX = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];

/**
 * Convert 8-bit RGB to normalized RGB (0-1)
 */
export function rgb8BitToNormalized(rgb: RgbColor8Bit): RgbColor {
  return {
    r: Math.max(0, Math.min(1, rgb.r / 255)),
    g: Math.max(0, Math.min(1, rgb.g / 255)),
    b: Math.max(0, Math.min(1, rgb.b / 255)),
  };
}

/**
 * Convert normalized RGB to 8-bit RGB
 */
export function normalizedToRgb8Bit(rgb: RgbColor): RgbColor8Bit {
  return {
    r: Math.round(Math.max(0, Math.min(1, rgb.r)) * 255),
    g: Math.round(Math.max(0, Math.min(1, rgb.g)) * 255),
    b: Math.round(Math.max(0, Math.min(1, rgb.b)) * 255),
  };
}

/**
 * Convert sRGB to linear RGB with gamma correction
 */
function srgbToLinear(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));

  if (clamped <= SRGB_GAMMA_THRESHOLD) {
    return clamped * SRGB_GAMMA_LOW_SCALE;
  } else {
    return Math.pow((clamped + SRGB_GAMMA_HIGH_A) / SRGB_GAMMA_HIGH_SCALE, SRGB_GAMMA_POWER);
  }
}

/**
 * Convert linear RGB to sRGB with gamma correction
 */
function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));

  if (clamped <= 0.0031308) {
    return 12.92 * clamped;
  } else {
    return 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  }
}

/**
 * Convert normalized RGB to XYZ color space (D65)
 */
export function rgbToXyz(rgb: RgbColor): XyzColor {
  // Convert sRGB to linear RGB
  const rLinear = srgbToLinear(rgb.r);
  const gLinear = srgbToLinear(rgb.g);
  const bLinear = srgbToLinear(rgb.b);

  // Apply conversion matrix
  const X = (RGB_TO_XYZ_MATRIX[0][0] * rLinear +
    RGB_TO_XYZ_MATRIX[0][1] * gLinear +
    RGB_TO_XYZ_MATRIX[0][2] * bLinear) * 100.0;

  const Y = (RGB_TO_XYZ_MATRIX[1][0] * rLinear +
    RGB_TO_XYZ_MATRIX[1][1] * gLinear +
    RGB_TO_XYZ_MATRIX[1][2] * bLinear) * 100.0;

  const Z = (RGB_TO_XYZ_MATRIX[2][0] * rLinear +
    RGB_TO_XYZ_MATRIX[2][1] * gLinear +
    RGB_TO_XYZ_MATRIX[2][2] * bLinear) * 100.0;

  return { X, Y, Z };
}

/**
 * Convert XYZ to normalized RGB color space
 */
export function xyzToRgb(xyz: XyzColor): RgbColor {
  // Normalize XYZ
  const x = xyz.X / 100.0;
  const y = xyz.Y / 100.0;
  const z = xyz.Z / 100.0;

  // Inverse matrix of RGB_TO_XYZ_MATRIX
  const rLinear = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const gLinear = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  const bLinear = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  // Convert linear RGB to sRGB
  const r = linearToSrgb(rLinear);
  const g = linearToSrgb(gLinear);
  const b = linearToSrgb(bLinear);

  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
  };
}

/**
 * Lab transformation function for XYZ to Lab conversion
 */
function labFunction(t: number): number {
  return t > XYZ_EPSILON ? Math.pow(t, 1 / 3) : (XYZ_KAPPA * t + 16) / 116;
}

/**
 * Convert XYZ to LAB color space
 */
export function xyzToLab(xyz: XyzColor): LabColor {
  const xr = xyz.X / REF_X;
  const yr = xyz.Y / REF_Y;
  const zr = xyz.Z / REF_Z;

  const fx = labFunction(xr);
  const fy = labFunction(yr);
  const fz = labFunction(zr);

  const L = yr > XYZ_EPSILON ? 116 * fy - 16 : XYZ_KAPPA * yr;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return {
    L: Math.max(0, Math.min(100, L)),
    a,
    b,
  };
}

/**
 * Inverse Lab transformation function for Lab to XYZ conversion
 */
function inverseLabFunction(t: number): number {
  const delta = 6 / 29;
  if (t > delta) {
    return Math.pow(t, 3);
  } else {
    return (3 * Math.pow(delta, 2) * (t - 4 / 29));
  }
}

/**
 * Convert LAB to XYZ color space
 */
export function labToXyz(lab: LabColor): XyzColor {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const X = REF_X * inverseLabFunction(fx);
  const Y = REF_Y * inverseLabFunction(fy);
  const Z = REF_Z * inverseLabFunction(fz);

  return { X, Y, Z };
}

/**
 * Convert RGB to LAB color space (complete pipeline)
 */
export function rgbToLab(rgb: RgbColor): LabColor {
  const xyz = rgbToXyz(rgb);
  return xyzToLab(xyz);
}

/**
 * Convert normalized RGB to LAB (from 8-bit input)
 */
export function rgb8BitToLab(rgb: RgbColor8Bit): LabColor {
  const normalized = rgb8BitToNormalized(rgb);
  return rgbToLab(normalized);
}

/**
 * Convert LAB to RGB color space (complete pipeline)
 */
export function labToRgb(lab: LabColor): RgbColor {
  const xyz = labToXyz(lab);
  return xyzToRgb(xyz);
}

/**
 * Validate LAB color values are in acceptable ranges
 */
export function isValidLabColor(lab: LabColor): boolean {
  return lab.L >= 0 && lab.L <= 100 && Math.abs(lab.a) <= 150 && Math.abs(lab.b) <= 150;
}

/**
 * Convert degrees to radians
 */
function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Get hue angle from a*, b* coordinates
 */
function getHueAngle(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  let hue = Math.atan2(b, a);
  return hue < 0 ? hue + 2 * Math.PI : hue;
}

/**
 * Calculate delta hue considering circularity
 */
function getDeltaHue(h1: number, h2: number): number {
  let diff = h2 - h1;
  if (Math.abs(diff) > Math.PI) {
    diff = diff > 0 ? diff - 2 * Math.PI : diff + 2 * Math.PI;
  }
  return diff;
}

/**
 * Calculate mean hue considering circularity
 */
function getMeanHue(h1: number, h2: number): number {
  if (Math.abs(h1 - h2) > Math.PI) {
    return h1 + h2 < 2 * Math.PI
      ? ((h1 + h2 + 2 * Math.PI) / 2)
      : ((h1 + h2 - 2 * Math.PI) / 2);
  } else {
    return (h1 + h2) / 2;
  }
}

/**
 * Calculate Delta E using CIEDE2000 formula
 * Most accurate color difference formula according to CIE
 * Returns a value where 0 = identical, 1.0 = just noticeable, 3+ = obvious difference
 */
export function calculateDeltaE2000(lab1: LabColor, lab2: LabColor): number {
  if (!isValidLabColor(lab1) || !isValidLabColor(lab2)) {
    console.warn('[ColorConversion] Invalid LAB values for Delta E calculation');
    return Infinity;
  }

  // Weight parameters (kL, kC, kH = 1.0 for graphic applications)
  const kL = 1.0;
  const kC = 1.0;
  const kH = 1.0;

  // Lightness difference
  const deltaL = lab2.L - lab1.L;
  const meanL = (lab1.L + lab2.L) * 0.5;

  // Chroma calculation
  const c1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
  const c2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
  const meanC = (c1 + c2) * 0.5;

  // G factor for chroma compensation
  const meanC7 = Math.pow(meanC, 7);
  const g = 0.5 * (1 - Math.sqrt(meanC7 / (meanC7 + Math.pow(25, 7))));

  // Corrected a' values
  const a1Prime = lab1.a * (1 + g);
  const a2Prime = lab2.a * (1 + g);

  // Corrected chroma
  const c1Prime = Math.sqrt(a1Prime * a1Prime + lab1.b * lab1.b);
  const c2Prime = Math.sqrt(a2Prime * a2Prime + lab2.b * lab2.b);
  const meanCPrime = (c1Prime + c2Prime) * 0.5;
  const deltaCPrime = c2Prime - c1Prime;

  // Hue calculation
  const h1Prime = getHueAngle(a1Prime, lab1.b);
  const h2Prime = getHueAngle(a2Prime, lab2.b);

  let deltaHPrime: number;
  let meanHPrime: number;

  if (c1Prime === 0 || c2Prime === 0) {
    deltaHPrime = 0;
    meanHPrime = h1Prime + h2Prime;
  } else {
    deltaHPrime = getDeltaHue(h1Prime, h2Prime);
    meanHPrime = getMeanHue(h1Prime, h2Prime);
  }

  const deltaHPrimeValue = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(deltaHPrime * 0.5);

  // Correction factors
  const t =
    1.0 -
    0.17 * Math.cos(meanHPrime - degToRad(30)) +
    0.24 * Math.cos(2 * meanHPrime) +
    0.32 * Math.cos(3 * meanHPrime + degToRad(6)) -
    0.2 * Math.cos(4 * meanHPrime - degToRad(63));

  // Weight factors
  const lMinus50Squared = (meanL - 50) * (meanL - 50);
  const sL = 1 + (0.015 * lMinus50Squared) / Math.sqrt(20 + lMinus50Squared);
  const sC = 1 + 0.045 * meanCPrime;
  const sH = 1 + 0.015 * meanCPrime * t;

  // Rotation term
  const meanHPrimeDeg = radToDeg(meanHPrime);
  const deltaTheta = degToRad(30) * Math.exp(-Math.pow((meanHPrimeDeg - 275) / 25, 2));
  const meanCPrime7 = Math.pow(meanCPrime, 7);
  const rC = 2 * Math.sqrt(meanCPrime7 / (meanCPrime7 + Math.pow(25, 7)));
  const rT = -rC * Math.sin(2 * deltaTheta);

  // Final Delta E2000 calculation
  const termL = deltaL / (kL * sL);
  const termC = deltaCPrime / (kC * sC);
  const termH = deltaHPrimeValue / (kH * sH);

  const deltaE2000 = Math.sqrt(termL * termL + termC * termC + termH * termH + rT * termC * termH);

  if (isNaN(deltaE2000) || !isFinite(deltaE2000)) {
    console.error('[ColorConversion] Invalid Delta E2000 result:', deltaE2000);
    return Infinity;
  }

  return deltaE2000;
}

/**
 * Calculate Delta E using CIE76 formula (faster but less accurate than CIEDE2000)
 */
export function calculateDeltaE76(lab1: LabColor, lab2: LabColor): number {
  if (!isValidLabColor(lab1) || !isValidLabColor(lab2)) {
    console.warn('[ColorConversion] Invalid LAB values for Delta E76 calculation');
    return Infinity;
  }

  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;

  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Convert RGB color to hex string
 */
export function rgbToHex(rgb: RgbColor): string {
  const rgb8 = normalizedToRgb8Bit(rgb);
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb8.r)}${toHex(rgb8.g)}${toHex(rgb8.b)}`.toUpperCase();
}

/**
 * Parse hex string to RGB normalized color
 */
export function hexToRgb(hex: string): RgbColor | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!match) return null;

  let hexValue = match[1];
  if (hexValue.length === 3) {
    hexValue = hexValue
      .split('')
      .map((char) => char + char)
      .join('');
  }

  const r = parseInt(hexValue.substr(0, 2), 16) / 255;
  const g = parseInt(hexValue.substr(2, 2), 16) / 255;
  const b = parseInt(hexValue.substr(4, 2), 16) / 255;

  return { r, g, b };
}
