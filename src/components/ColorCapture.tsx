'use client';

import { useEffect, useState } from 'react';
import { Camera, Lightbulb, Save, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'sonner';
import { CameraPreview } from './CameraPreview';
import { useCameraRobustCapture } from '@/hooks/useCameraRobustCapture';
import { useRobustColorCalibration } from '@/hooks/useRobustColorCalibration';

interface ColorCaptureProps {
  onBack: () => void;
  initialColorHex: string;
  initialColorRgb: {
    r: number;
    g: number;
    b: number;
  };
  initialLightCalibrated: boolean;
  onSave: (value: {
    referenceColorHex: string;
    referenceColorRgb: {
      r: number;
      g: number;
      b: number;
    };
    colorConfigured: boolean;
    lightCalibrated: boolean;
  }) => void;
}

// Default configuration
const LIGHT_CALIBRATION_SAMPLES = 5;
const COLOR_CAPTURE_SAMPLES = 5;
const SAMPLE_INTERVAL_MS = 200;

export const ColorCapture = ({
  onBack,
  initialColorHex,
  initialColorRgb,
  initialLightCalibrated,
  onSave,
}: ColorCaptureProps) => {
  const [displayColor, setDisplayColor] = useState({
    hex: initialColorHex,
    rgb: initialColorRgb,
  });
  const [isLightCalibrated, setIsLightCalibrated] = useState(initialLightCalibrated);
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  const cameraCapture = useCameraRobustCapture();
  const colorCalibration = useRobustColorCalibration();

  // Monitor calibration state
  useEffect(() => {
    if (colorCalibration.lightCalibrationData) {
      setIsLightCalibrated(true);
      setDisplayColor({
        hex: colorCalibration.lightCalibrationData.referenceHex,
        rgb: colorCalibration.lightCalibrationData.referenceRgb8Bit,
      });
      setQualityScore(colorCalibration.lightCalibrationData.qualityScore);
    }
  }, [colorCalibration.lightCalibrationData]);

  const handleCalibrateLight = async () => {
    try {
      const success = await colorCalibration.startLightCalibration(
        async (sampleIndex, totalSamples) => {
          toast.loading(`Capturando amostra ${sampleIndex + 1}/${totalSamples}...`, {
            id: 'light-calibration-progress',
          });
          return await cameraCapture.captureRobustSample(1, 100);
        },
        LIGHT_CALIBRATION_SAMPLES,
        SAMPLE_INTERVAL_MS,
      );

      if (success) {
        const latestQualityScore =
          colorCalibration.lastValidationResult?.qualityScore ??
          colorCalibration.lightCalibrationData?.qualityScore ??
          qualityScore;
        toast.success('Calibração de luz concluída!', {
          id: 'light-calibration-progress',
          description:
            latestQualityScore !== null && latestQualityScore !== undefined
              ? `Qualidade: ${latestQualityScore.toFixed(0)}%`
              : 'Calibração concluída com sucesso',
        });
      } else {
        toast.error('Falha na calibração', {
          id: 'light-calibration-progress',
          description: colorCalibration.error || 'Tente novamente',
        });
      }
    } catch (err) {
      console.error('Erro ao calibrar luz:', err);
      toast.error('Erro na calibração');
    }
  };

  const handleCaptureColor = async () => {
    if (!colorCalibration.isLightCalibrated()) {
      toast.error('Calibre a luz primeiro!', {
        description: 'Clique em "Calibrar Luz" antes de capturar a cor',
      });
      return;
    }

    try {
      const result = await colorCalibration.startColorCapture(
        async (sampleIndex, totalSamples) => {
          toast.loading(`Capturando amostra ${sampleIndex + 1}/${totalSamples}...`, {
            id: 'color-capture-progress',
          });
          return await cameraCapture.captureRobustSample(1, 100);
        },
        COLOR_CAPTURE_SAMPLES,
        SAMPLE_INTERVAL_MS,
      );

      if (result.success && result.correctedColor) {
        const hex = rgbToHex(result.correctedColor);
        const rgb8Bit = rgbToRgb8Bit(result.correctedColor);

        setDisplayColor({
          hex,
          rgb: rgb8Bit,
        });
        setQualityScore(result.qualityMetrics?.overallScore ?? null);

        toast.success('Cor capturada com sucesso!', {
          id: 'color-capture-progress',
          description: `Cor: ${hex} | Qualidade: ${result.qualityMetrics?.overallScore.toFixed(0)}%`,
        });
      } else {
        toast.error('Falha na captura de cor', {
          id: 'color-capture-progress',
          description: colorCalibration.error || 'Tente novamente',
        });
      }
    } catch (err) {
      console.error('Erro ao capturar cor:', err);
      toast.error('Erro na captura');
    }
  };

  const handleSave = () => {
    if (!isLightCalibrated) {
      toast.error('Luz não calibrada', {
        description: 'Realize a calibração de luz antes de salvar',
      });
      return;
    }

    onSave({
      referenceColorHex: displayColor.hex,
      referenceColorRgb: displayColor.rgb,
      colorConfigured: true,
      lightCalibrated: true,
    });
    onBack();
  };

  return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-center text-2xl font-bold mb-2">Calibração de Luz (D65)</h2>
        <p className="text-center text-xs text-slate-400">
          Sistema de calibração robusto com múltiplas amostras e validação de qualidade
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-6 mb-6">
        {/* Left Panel - Controls */}
        <div className="flex flex-col gap-3">
          {/* Light Calibration Button */}
          <button
            onClick={handleCalibrateLight}
            disabled={colorCalibration.isCalibrating}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg font-medium transition-all ${
              isLightCalibrated
                ? 'bg-green-900/40 border border-green-700 text-green-300'
                : 'bg-blue-900/40 border border-blue-700 hover:bg-blue-800/40 text-blue-300'
            } ${colorCalibration.isCalibrating ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {colorCalibration.isCalibrating ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span className="text-xs">{colorCalibration.calibrationProgress.toFixed(0)}%</span>
              </>
            ) : isLightCalibrated ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span className="text-xs">Calibrada</span>
              </>
            ) : (
              <>
                <Lightbulb className="w-5 h-5" />
                <span className="text-xs">Calibrar Luz</span>
              </>
            )}
          </button>

          {/* Color Capture Button */}
          <button
            onClick={handleCaptureColor}
            disabled={colorCalibration.isCalibrating || cameraCapture.isCapturing || !isLightCalibrated}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg font-medium transition-all ${
              !isLightCalibrated
                ? 'bg-slate-900/40 border border-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-purple-900/40 border border-purple-700 hover:bg-purple-800/40 text-purple-300'
            } ${cameraCapture.isCapturing || colorCalibration.isCalibrating ? 'opacity-60' : ''}`}
          >
            {cameraCapture.isCapturing || colorCalibration.isCalibrating ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span className="text-xs">Capturando</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span className="text-xs">Capturar Cor</span>
              </>
            )}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!isLightCalibrated}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg font-medium transition-all ${
              !isLightCalibrated
                ? 'bg-slate-900/40 border border-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-green-900/40 border border-green-700 hover:bg-green-800/40 text-green-300'
            }`}
          >
            <Save className="w-5 h-5" />
            <span className="text-xs">Salvar</span>
          </button>
        </div>

        {/* Right Panel - Preview and Info */}
        <div className="space-y-4">
          {/* Camera Preview */}
          <div className="rounded-lg overflow-hidden border border-slate-700/70">
            <CameraPreview
              className="w-full h-[200px] border-0 rounded-none"
              imageClassName="w-full h-full object-cover"
              fallbackMessage="Preview indisponível durante calibração"
              showRetryButton={false}
            />
          </div>

          {/* Color Display */}
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Cor Selecionada</p>
              <p className="text-xs text-slate-400">{displayColor.hex.toUpperCase()}</p>
            </div>
            <div
              className="w-[80px] h-[50px] rounded-lg border-2 border-slate-600 shadow-lg"
              style={{ backgroundColor: displayColor.hex }}
            />
          </div>

          {/* Quality Score */}
          {qualityScore !== null && (
            <div className="p-3 bg-slate-900/40 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Qualidade da Calibração</span>
                <div className="flex items-center gap-2">
                  {qualityScore >= 80 ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : qualityScore >= 60 ? (
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="font-mono text-sm">{qualityScore.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {colorCalibration.statusMessage && (
            <p className="text-xs text-slate-400 italic">{colorCalibration.statusMessage}</p>
          )}

          {/* Error Message */}
          {colorCalibration.error && (
            <div className="p-3 bg-red-900/30 rounded-lg border border-red-700/50">
              <p className="text-xs text-red-300">{colorCalibration.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

function rgbToRgb8Bit(rgb: { r: number; g: number; b: number }) {
  return {
    r: Math.round(Math.max(0, Math.min(1, rgb.r)) * 255),
    g: Math.round(Math.max(0, Math.min(1, rgb.g)) * 255),
    b: Math.round(Math.max(0, Math.min(1, rgb.b)) * 255),
  };
}
