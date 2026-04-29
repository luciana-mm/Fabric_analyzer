/**
 * useRobustColorCalibration Hook
 * Implements robust light calibration with validation
 * Based on meta-classificador-tecidos calibration system
 */

import { useState, useCallback } from 'react';
import { RgbColor, rgb8BitToNormalized, RgbColor8Bit } from '@/utils/colorSpaceConversion';
import {
  calculateLuminance,
  removeColorOutliers,
  calculateRobustColorMean,
  calculateColorStandardDeviation,
  calculateLightVariation,
  validateLightCalibration,
  applyColorCorrection,
  calculateColorQualityMetrics,
  ColorQualityMetrics,
  CalibrationValidationResult,
  CalibratedColorData,
  createCalibratedColorData,
} from '@/utils/calibrationUtils';

export interface RobustCalibrationState {
  isCalibrating: boolean;
  calibrationProgress: number; // 0-100
  lightCalibrationData: CalibratedColorData | null;
  lastValidationResult: CalibrationValidationResult | null;
  error: string | null;
  statusMessage: string;
}

export interface UseRobustColorCalibrationReturn extends RobustCalibrationState {
  startLightCalibration: (
    onSampleCapture: (sampleIndex: number, totalSamples: number) => Promise<RgbColor8Bit | null>,
    captureCount?: number,
    captureInterval?: number,
  ) => Promise<boolean>;
  startColorCapture: (
    onSampleCapture: (sampleIndex: number, totalSamples: number) => Promise<RgbColor8Bit | null>,
    captureCount?: number,
    captureInterval?: number,
  ) => Promise<{
    success: boolean;
    fabricColor: RgbColor | null;
    correctedColor: RgbColor | null;
    qualityMetrics: ColorQualityMetrics | null;
  }>;
  clearCalibration: () => void;
  isLightCalibrated: () => boolean;
}

// Default configuration
const DEFAULT_LIGHT_CAPTURE_COUNT = 5;
const DEFAULT_LIGHT_CAPTURE_INTERVAL = 200; // ms
const DEFAULT_COLOR_CAPTURE_COUNT = 5;
const DEFAULT_COLOR_CAPTURE_INTERVAL = 200; // ms
const MIN_LUMINANCE = 0.05;
const MAX_LUMINANCE = 0.98;
const MAX_LIGHT_VARIATION = 0.08;

export function useRobustColorCalibration(): UseRobustColorCalibrationReturn {
  const [state, setState] = useState<RobustCalibrationState>({
    isCalibrating: false,
    calibrationProgress: 0,
    lightCalibrationData: null,
    lastValidationResult: null,
    error: null,
    statusMessage: 'Aguardando calibração',
  });

  const setProgress = useCallback((progress: number, message: string) => {
    setState((prev) => ({
      ...prev,
      calibrationProgress: progress,
      statusMessage: message,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
      isCalibrating: false,
    }));
  }, []);

  /**
   * Start light calibration routine
   * Captures multiple samples and validates them
   */
  const startLightCalibration = useCallback(
    async (
      onSampleCapture: (sampleIndex: number, totalSamples: number) => Promise<RgbColor8Bit | null>,
      captureCount: number = DEFAULT_LIGHT_CAPTURE_COUNT,
      captureInterval: number = DEFAULT_LIGHT_CAPTURE_INTERVAL,
    ): Promise<boolean> => {
      setState((prev) => ({
        ...prev,
        isCalibrating: true,
        error: null,
        calibrationProgress: 0,
      }));

      try {
        setProgress(5, 'Iniciando calibração de luz...');

        const lightSamples: RgbColor[] = [];
        const luminanceValues: number[] = [];
        let successfulCaptures = 0;

        // Capture multiple samples
        for (let i = 0; i < captureCount; i++) {
          setProgress(10 + (i / captureCount) * 40, `Capturando amostra ${i + 1}/${captureCount}...`);

          try {
            const rgbSample = await onSampleCapture(i, captureCount);

            if (rgbSample) {
              const normalizedRgb = rgb8BitToNormalized(rgbSample);
              lightSamples.push(normalizedRgb);
              luminanceValues.push(calculateLuminance(normalizedRgb));
              successfulCaptures++;

              console.log(
                `[useRobustColorCalibration] Sample ${i + 1}: RGB(${normalizedRgb.r.toFixed(3)}, ${normalizedRgb.g.toFixed(3)}, ${normalizedRgb.b.toFixed(3)}), Luminance=${(calculateLuminance(normalizedRgb) * 100).toFixed(1)}%`,
              );
            }
          } catch (err) {
            console.warn(`[useRobustColorCalibration] Falha na captura ${i + 1}:`, err);
          }

          // Wait between captures
          if (i < captureCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, captureInterval));
          }
        }

        // Check if we have enough valid samples
        if (lightSamples.length === 0) {
          throw new Error('Nenhuma amostra válida capturada. Verifique se a câmera está funcionando.');
        }

        setProgress(60, `Processando ${lightSamples.length} amostras...`);

        // Remove outliers
        const cleanSamples = removeColorOutliers(lightSamples);

        // Calculate robust mean
        const calibrationColor = calculateRobustColorMean(cleanSamples);
        const standardDeviation = calculateColorStandardDeviation(cleanSamples, calibrationColor);

        setProgress(80, 'Validando calibração...');

        // Validate calibration
        const validationResult = validateLightCalibration(
          calibrationColor,
          cleanSamples,
          luminanceValues,
          standardDeviation,
          MIN_LUMINANCE,
          MAX_LUMINANCE,
          MAX_LIGHT_VARIATION,
        );

        setProgress(90, 'Finalizando calibração...');

        if (validationResult.isValid) {
          const calibratedData = createCalibratedColorData(calibrationColor, validationResult.qualityScore);

          setState((prev) => ({
            ...prev,
            isCalibrating: false,
            calibrationProgress: 100,
            lightCalibrationData: calibratedData,
            lastValidationResult: validationResult,
            statusMessage: `Calibração bem-sucedida! Qualidade: ${validationResult.qualityScore.toFixed(0)}%`,
            error: null,
          }));

          console.log('[useRobustColorCalibration] Calibração bem-sucedida:', calibratedData);
          return true;
        } else {
          const issuesSummary = validationResult.issues.join('\n');
          throw new Error(
            `Calibração falhou:\n${issuesSummary}\n\nSugestões:\n- Use cartão branco neutro\n- Ajuste a iluminação\n- Mantenha estável durante captura`,
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[useRobustColorCalibration] Erro na calibração:', errorMessage);
        setError(errorMessage);
        return false;
      }
    },
    [setProgress, setError],
  );

  /**
   * Start color capture routine
   * Captures multiple color samples and applies correction
   */
  const startColorCapture = useCallback(
    async (
      onSampleCapture: (sampleIndex: number, totalSamples: number) => Promise<RgbColor8Bit | null>,
      captureCount: number = DEFAULT_COLOR_CAPTURE_COUNT,
      captureInterval: number = DEFAULT_COLOR_CAPTURE_INTERVAL,
    ): Promise<{
      success: boolean;
      fabricColor: RgbColor | null;
      correctedColor: RgbColor | null;
      qualityMetrics: ColorQualityMetrics | null;
    }> => {
      if (!state.lightCalibrationData) {
        setError('Calibração de luz não realizada. Execute a calibração primeiro.');
        return { success: false, fabricColor: null, correctedColor: null, qualityMetrics: null };
      }

      setState((prev) => ({
        ...prev,
        isCalibrating: true,
        error: null,
        calibrationProgress: 0,
      }));

      try {
        setProgress(5, 'Iniciando captura de cor...');

        const colorSamples: RgbColor[] = [];
        let successfulCaptures = 0;

        // Capture multiple samples
        for (let i = 0; i < captureCount; i++) {
          setProgress(10 + (i / captureCount) * 40, `Capturando amostra ${i + 1}/${captureCount}...`);

          try {
            const rgbSample = await onSampleCapture(i, captureCount);

            if (rgbSample) {
              const normalizedRgb = rgb8BitToNormalized(rgbSample);
              colorSamples.push(normalizedRgb);
              successfulCaptures++;
            }
          } catch (err) {
            console.warn(`[useRobustColorCalibration] Falha na captura ${i + 1}:`, err);
          }

          // Wait between captures
          if (i < captureCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, captureInterval));
          }
        }

        // Check if we have enough valid samples
        if (colorSamples.length === 0) {
          throw new Error('Nenhuma amostra de cor capturada.');
        }

        setProgress(60, `Processando ${colorSamples.length} amostras...`);

        // Remove outliers
        const cleanSamples = removeColorOutliers(colorSamples);

        if (cleanSamples.length < 2) {
          throw new Error('Poucas amostras válidas após remoção de outliers.');
        }

        // Calculate robust mean
        const fabricColor = calculateRobustColorMean(cleanSamples);

        // Apply color correction using light calibration
        const correctedColor = applyColorCorrection(
          fabricColor,
          state.lightCalibrationData.referenceRgbNormalized,
        );

        setProgress(80, 'Calculando qualidade...');

        // Calculate quality metrics
        const qualityMetrics = calculateColorQualityMetrics(cleanSamples, fabricColor, correctedColor);

        setProgress(100, 'Captura concluída!');

        setState((prev) => ({
          ...prev,
          isCalibrating: false,
          statusMessage: `Cor capturada com qualidade ${qualityMetrics.overallScore.toFixed(0)}%`,
          error: null,
        }));

        console.log('[useRobustColorCalibration] Captura bem-sucedida:', {
          fabricColor,
          correctedColor,
          qualityMetrics,
        });

        return { success: true, fabricColor, correctedColor, qualityMetrics };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[useRobustColorCalibration] Erro na captura:', errorMessage);
        setError(errorMessage);
        return { success: false, fabricColor: null, correctedColor: null, qualityMetrics: null };
      }
    },
    [state.lightCalibrationData, setProgress, setError],
  );

  /**
   * Clear calibration data
   */
  const clearCalibration = useCallback(() => {
    setState({
      isCalibrating: false,
      calibrationProgress: 0,
      lightCalibrationData: null,
      lastValidationResult: null,
      error: null,
      statusMessage: 'Calibração removida',
    });
  }, []);

  /**
   * Check if light calibration is valid
   */
  const isLightCalibrated = useCallback((): boolean => {
    return state.lightCalibrationData !== null && state.lastValidationResult?.isValid === true;
  }, [state.lightCalibrationData, state.lastValidationResult]);

  return {
    ...state,
    startLightCalibration,
    startColorCapture,
    clearCalibration,
    isLightCalibrated,
  };
}
