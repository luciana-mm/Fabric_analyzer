'use client';

import { useState } from 'react';
import { Camera, Lightbulb, Save, CheckCircle, AlertCircle, Loader, Pipette, Info } from 'lucide-react';
import { toast } from 'sonner';
import { CameraPreview } from './CameraPreview';
import { RgbScreen } from './RgbScreen';
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
    ambientLightConfigured: boolean;
    ambientLightReferenceHex?: string;
    ambientLightReferenceRgb?: {
      r: number;
      g: number;
      b: number;
    };
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
  const [isRgbPickerOpen, setIsRgbPickerOpen] = useState(false);

  const cameraCapture = useCameraRobustCapture();
  const colorCalibration = useRobustColorCalibration();

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
        setIsLightCalibrated(true);

        toast.success('Calibração de luz concluída!', {
          id: 'light-calibration-progress',
          description: 'Calibração salva como referência de luz base',
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

        toast.success('Cor capturada com sucesso!', {
          id: 'color-capture-progress',
          description: `Cor base salva: ${hex}`,
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

    const hasNewLightReference = colorCalibration.isLightCalibrated();

    onSave({
      referenceColorHex: displayColor.hex,
      referenceColorRgb: displayColor.rgb,
      colorConfigured: true,
      lightCalibrated: false,
      ambientLightConfigured: hasNewLightReference || initialLightCalibrated,
      ...(hasNewLightReference && colorCalibration.lightCalibrationData
        ? {
            ambientLightReferenceHex: colorCalibration.lightCalibrationData.referenceHex,
            ambientLightReferenceRgb: colorCalibration.lightCalibrationData.referenceRgb8Bit,
          }
        : {}),
    });
    onBack();
  };

  return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-3xl mx-auto">
      <div className="relative flex items-center justify-center mb-10">
        <div>
          <h2 className="text-xl font-bold cursor-default text-center">
            Calibração de Luz (D65)
          </h2>
          <p className="text-center text-xs text-slate-400">
            Sistema de calibração robusto com múltiplas amostras e validação de qualidade
          </p>
        </div>
        <div className="absolute right-0">
          <div className="group relative flex items-center justify-center">
            <Info
              size={20}
              className="cursor-pointer text-slate-400 group-hover:text-slate-100 transition-colors"
            />
            <div className="absolute left-full ml-3 hidden group-hover:block w-64 p-3 bg-slate-800 text-xs text-white rounded shadow-lg border border-slate-700 glow-box z-50">
              <h3 className="text-sm font-bold mb-2 border-b border-slate-700 pb-1">Procedimento de Medição</h3>
              <p className="text-slate-300 mb-3 leading-relaxed">
                Para garantir a precisão cromática, o sistema exige uma calibração prévia da luz ambiente antes da seleção de cores.
              </p>
              <span className="text-blue-400 font-semibold block mb-1">1. Calibração (Obrigatório)</span>
              <p className="text-[10px] text-slate-400">
                Ajusta os sensores ao iluminante padrão D65 para compensar variações de luz externa.
              </p>
              <span className="text-blue-400 font-semibold block mb-1">2. Captura e Seleção</span>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300">
                <li><strong className="text-white">Câmera:</strong> Captura a cor em tempo real através do sensor.</li>
                <li><strong className="text-white">Manual:</strong> Insira valores precisos via código Hexadecimal ou RGB.</li>
              </ul>
              <div className="absolute top-1/2 -translate-y-1/2 right-full border-8 border-transparent border-r-slate-800"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-6 mb-6">
        {/* Left Panel - Controls */}
        <div className="flex flex-col gap-3">
          {/* Light Calibration Button */}
          <button
            onClick={handleCalibrateLight}
            disabled={colorCalibration.isCalibrating}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg font-medium transition-all ${isLightCalibrated
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
                <span className="text-xs">Calibrar Luz Ambiente</span>
              </>
            )}
          </button>

          {/* Color Capture Button */}
          <button
            onClick={handleCaptureColor}
            disabled={colorCalibration.isCalibrating || cameraCapture.isCapturing || !isLightCalibrated}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg font-medium transition-all ${!isLightCalibrated
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
            className={`flex flex-col items-center gap-2 p-4 rounded-lg font-medium transition-all ${!isLightCalibrated
                ? 'bg-slate-900/40 border border-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-green-900/40 border border-green-700 hover:bg-green-800/40 text-green-300'
              }`}
          >
            <Save className="w-5 h-5" />
            <span className="text-xs">Salvar</span>
          </button>

          <button
            onClick={() => isLightCalibrated && setIsRgbPickerOpen(true)}
            disabled={!isLightCalibrated}
            className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${isLightCalibrated
                ? 'border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800/60'
                : 'border-slate-800 bg-slate-950/50 text-slate-500 cursor-not-allowed'
              }`}
          >
            <Pipette className="w-5 h-5" />
            <span className="text-xs">Selecionar cor</span>
          </button>
        </div>
        <RgbScreen
          open={isRgbPickerOpen}
          initialHex={displayColor.hex}
          onOpenChange={setIsRgbPickerOpen}
          onSelect={(color) => {
            setDisplayColor(color);
            setIsRgbPickerOpen(false);
            toast.success('Cor atualizada', {
              description: `${color.hex.toUpperCase()} selecionado`,
            });
          }}
        />

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
          {/* Quality score hidden in configuration context (base definition). */}

          {/* Status Message intentionally hidden here:
              this flow defines base calibration, so we avoid showing similarity/quality percentages. */}

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
