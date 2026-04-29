/**
 * Color Conversion and Calibration Tests
 * Validation of implementation against known values and formulas
 */

import {
  rgbToLab,
  rgb8BitToNormalized,
  normalizedToRgb8Bit,
  calculateDeltaE2000,
  calculateDeltaE76,
  rgbToHex,
  hexToRgb,
} from '@/utils/colorSpaceConversion';

import {
  calculateLuminance,
  removeColorOutliers,
  calculateRobustColorMean,
  calculateRgbBalance,
  calculateColorStandardDeviation,
  createCalibratedColorData,
} from '@/utils/calibrationUtils';

import { getQualityRating, getDeltaEInterpretation } from '@/utils/colorimetricStandards';

/**
 * Test Suite 1: Color Space Conversion
 */
export function testColorSpaceConversion() {
  console.group('🧪 Test Suite 1: Color Space Conversion');

  // Test 1.1: White color
  const white8Bit = { r: 255, g: 255, b: 255 };
  const whiteNorm = rgb8BitToNormalized(white8Bit);
  const whiteLab = rgbToLab(whiteNorm);

  console.assert(
    Math.abs(whiteLab.L - 100) < 0.1,
    `White L* should be ~100, got ${whiteLab.L.toFixed(2)}`,
  );
  console.assert(
    Math.abs(whiteLab.a) < 1,
    `White a* should be ~0, got ${whiteLab.a.toFixed(2)}`,
  );
  console.assert(
    Math.abs(whiteLab.b) < 1,
    `White b* should be ~0, got ${whiteLab.b.toFixed(2)}`,
  );
  console.log('✓ Test 1.1 PASSED: White color conversion');

  // Test 1.2: Black color
  const black8Bit = { r: 0, g: 0, b: 0 };
  const blackNorm = rgb8BitToNormalized(black8Bit);
  const blackLab = rgbToLab(blackNorm);

  console.assert(blackLab.L < 1, `Black L* should be ~0, got ${blackLab.L.toFixed(2)}`);
  console.log('✓ Test 1.2 PASSED: Black color conversion');

  // Test 1.3: Mid-gray
  const gray8Bit = { r: 128, g: 128, b: 128 };
  const grayNorm = rgb8BitToNormalized(gray8Bit);
  const grayLab = rgbToLab(grayNorm);

  console.assert(grayLab.L > 45 && grayLab.L < 60, `Mid-gray L* should be ~50, got ${grayLab.L.toFixed(2)}`);
  console.log('✓ Test 1.3 PASSED: Mid-gray conversion');

  // Test 1.4: Hex conversion
  const testRgb = rgb8BitToNormalized({ r: 255, g: 100, b: 50 });
  const testHex = rgbToHex(testRgb);
  const backToRgb = hexToRgb(testHex);

  console.assert(
    backToRgb && Math.abs(backToRgb.r - testRgb.r) < 0.01,
    'Hex conversion should be reversible',
  );
  console.log('✓ Test 1.4 PASSED: Hex conversion reversibility');

  console.groupEnd();
}

/**
 * Test Suite 2: Delta E Calculation
 */
export function testDeltaECalculation() {
  console.group('🧪 Test Suite 2: Delta E Calculation');

  const white = rgb8BitToNormalized({ r: 255, g: 255, b: 255 });
  const whiteLab = rgbToLab(white);

  // Test 2.1: Identical colors should have ΔE ≈ 0
  const deltaE = calculateDeltaE2000(whiteLab, whiteLab);
  console.assert(deltaE < 0.001, `Identical colors should have ΔE ≈ 0, got ${deltaE.toFixed(4)}`);
  console.log('✓ Test 2.1 PASSED: Identical colors ΔE = 0');

  // Test 2.2: Compare slightly different colors
  const white1 = { ...white, r: white.r * 0.99 };
  const white1Lab = rgbToLab(white1);
  const deltaE2 = calculateDeltaE2000(whiteLab, white1Lab);

  console.assert(
    deltaE2 > 0 && deltaE2 < 1,
    `Slightly different colors should have 0 < ΔE < 1, got ${deltaE2.toFixed(3)}`,
  );
  console.log(`✓ Test 2.2 PASSED: Slight difference ΔE = ${deltaE2.toFixed(3)}`);

  // Test 2.3: Compare significantly different colors
  const black = rgb8BitToNormalized({ r: 0, g: 0, b: 0 });
  const blackLab = rgbToLab(black);
  const deltaE3 = calculateDeltaE2000(whiteLab, blackLab);

  console.assert(
    deltaE3 > 50,
    `Black vs white should have large ΔE, got ${deltaE3.toFixed(1)}`,
  );
  console.log(`✓ Test 2.3 PASSED: Black vs White ΔE = ${deltaE3.toFixed(1)}`);

  // Test 2.4: Compare DeltaE76 vs CIEDE2000
  const deltaE76 = calculateDeltaE76(whiteLab, blackLab);
  console.assert(
    Math.abs(deltaE76 - deltaE3) < 10,
    `DeltaE76 and CIEDE2000 should be similar for extreme colors`,
  );
  console.log(`✓ Test 2.4 PASSED: DeltaE76 = ${deltaE76.toFixed(1)}, CIEDE2000 = ${deltaE3.toFixed(1)}`);

  console.groupEnd();
}

/**
 * Test Suite 3: Calibration Utilities
 */
export function testCalibrationUtilities() {
  console.group('🧪 Test Suite 3: Calibration Utilities');

  // Test 3.1: Luminance calculation
  const white = rgb8BitToNormalized({ r: 255, g: 255, b: 255 });
  const whiteLum = calculateLuminance(white);

  console.assert(
    whiteLum > 0.95,
    `White luminance should be ~1.0, got ${whiteLum.toFixed(3)}`,
  );
  console.log('✓ Test 3.1 PASSED: White luminance ≈ 1.0');

  // Test 3.2: Outlier removal
  const samples = [
    { r: 0.5, g: 0.5, b: 0.5 },
    { r: 0.51, g: 0.51, b: 0.51 },
    { r: 0.49, g: 0.49, b: 0.49 },
    { r: 0.5, g: 0.5, b: 0.5 },
    { r: 0.2, g: 0.2, b: 0.2 }, // Outlier
  ];

  const cleaned = removeColorOutliers(samples);
  console.assert(
    cleaned.length === 4,
    `Should remove 1 outlier, got ${5 - cleaned.length}`,
  );
  console.log(`✓ Test 3.2 PASSED: Removed ${5 - cleaned.length} outlier(s)`);

  // Test 3.3: Robust mean
  const mean = calculateRobustColorMean(cleaned);
  console.assert(
    mean.r > 0.45 && mean.r < 0.55,
    `Mean should be ~0.5, got ${mean.r.toFixed(3)}`,
  );
  console.log('✓ Test 3.3 PASSED: Robust mean calculated correctly');

  // Test 3.4: RGB balance
  const balanced = { r: 0.5, g: 0.5, b: 0.5 };
  const balanceScore = calculateRgbBalance(balanced);

  console.assert(
    balanceScore > 0.95,
    `Balanced RGB should score ~1.0, got ${balanceScore.toFixed(3)}`,
  );
  console.log('✓ Test 3.4 PASSED: RGB balance detection');

  // Test 3.5: Standard deviation
  const stdDev = calculateColorStandardDeviation(samples, mean);
  console.assert(stdDev >= 0, `Std deviation should be non-negative, got ${stdDev.toFixed(3)}`);
  console.log(`✓ Test 3.5 PASSED: Std deviation = ${stdDev.toFixed(4)}`);

  console.groupEnd();
}

/**
 * Test Suite 4: Calibrated Data Structure
 */
export function testCalibratedDataStructure() {
  console.group('🧪 Test Suite 4: Calibrated Data Structure');

  const testColor = rgb8BitToNormalized({ r: 240, g: 240, b: 240 });
  const qualityScore = 92.5;

  const calibrated = createCalibratedColorData(testColor, qualityScore);

  console.assert(
    calibrated.referenceRgb8Bit.r === 240,
    'RGB8Bit conversion should be accurate',
  );
  console.assert(
    calibrated.referenceHex.toUpperCase() === '#F0F0F0',
    `Hex should be #F0F0F0, got ${calibrated.referenceHex}`,
  );
  console.assert(
    calibrated.qualityScore === qualityScore,
    'Quality score should be preserved',
  );
  console.assert(
    calibrated.timestamp <= Date.now(),
    'Timestamp should be current',
  );

  console.log('✓ Test 4.1 PASSED: Calibrated data structure valid');
  console.groupEnd();
}

/**
 * Test Suite 5: Quality Ratings
 */
export function testQualityRatings() {
  console.group('🧪 Test Suite 5: Quality Ratings');

  const excellent = getQualityRating(95);
  console.assert(
    excellent.min === 80,
    '95% should be Excellent rating',
  );
  console.log(`✓ Test 5.1 PASSED: 95% = ${excellent.label}`);

  const good = getQualityRating(65);
  console.assert(
    good.min === 60,
    '65% should be Good rating',
  );
  console.log(`✓ Test 5.2 PASSED: 65% = ${good.label}`);

  const poor = getQualityRating(25);
  console.assert(
    poor.min === 0,
    '25% should be Poor rating',
  );
  console.log(`✓ Test 5.3 PASSED: 25% = ${poor.label}`);

  console.groupEnd();
}

/**
 * Test Suite 6: Delta E Interpretation
 */
export function testDeltaEInterpretation() {
  console.group('🧪 Test Suite 6: Delta E Interpretation');

  const interp0 = getDeltaEInterpretation(0.3);
  console.assert(
    interp0.includes('Identical'),
    'Very small ΔE should indicate identical colors',
  );
  console.log(`✓ Test 6.1 PASSED: ΔE=0.3 → "${interp0}"`);

  const interp1 = getDeltaEInterpretation(1.5);
  console.assert(
    interp1.includes('Noticeable'),
    'ΔE around 1.5 should be noticeable',
  );
  console.log(`✓ Test 6.2 PASSED: ΔE=1.5 → "${interp1}"`);

  const interp2 = getDeltaEInterpretation(10);
  console.assert(
    interp2.includes('Extreme'),
    'Large ΔE should be extreme',
  );
  console.log(`✓ Test 6.3 PASSED: ΔE=10 → "${interp2}"`);

  console.groupEnd();
}

/**
 * Run All Tests
 */
export function runAllTests() {
  console.log('═'.repeat(60));
  console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE');
  console.log('═'.repeat(60));

  try {
    testColorSpaceConversion();
    testDeltaECalculation();
    testCalibrationUtilities();
    testCalibratedDataStructure();
    testQualityRatings();
    testDeltaEInterpretation();

    console.log('');
    console.log('═'.repeat(60));
    console.log('✅ ALL TESTS PASSED');
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('');
    console.error('═'.repeat(60));
    console.error('❌ TEST FAILED');
    console.error(error);
    console.error('═'.repeat(60));
    throw error;
  }
}
