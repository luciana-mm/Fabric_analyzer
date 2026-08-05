"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Info,
  Lightbulb,
  Loader,
  Pipette,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { CameraPreview } from "./CameraPreview";
import { RgbScreen } from "./RgbScreen";
import { useCameraRobustCapture } from "@/hooks/useCameraRobustCapture";
import { useRobustColorCalibration } from "@/hooks/useRobustColorCalibration";
import { defaultSystemConfig } from "@/lib/systemConfig";

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
  initialSampleAreaWidthPercent?: number;
  initialSampleAreaHeightPercent?: number;
}

const LIGHT_CALIBRATION_SAMPLES = 5;
const COLOR_CAPTURE_SAMPLES = 5;
const SAMPLE_INTERVAL_MS = 200;
const CAMERA_PROXY_URL =
  process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ?? "http://127.0.0.1:8090";

const clampCapturePercent = (value: number | undefined, fallback: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(5, Math.round(numberValue)));
};

export const ColorCapture = ({
  onBack,
  initialColorHex,
  initialColorRgb,
  initialLightCalibrated,
  onSave,
  initialSampleAreaWidthPercent = defaultSystemConfig.sampleAreaWidthPercent,
  initialSampleAreaHeightPercent = defaultSystemConfig.sampleAreaHeightPercent,
}: ColorCaptureProps) => {
  const [displayColor, setDisplayColor] = useState({
    hex: initialColorHex,
    rgb: initialColorRgb,
  });
  const [isLightCalibrated, setIsLightCalibrated] = useState(
    initialLightCalibrated,
  );
  const [isRgbPickerOpen, setIsRgbPickerOpen] = useState(false);
  const captureAreaWidth = clampCapturePercent(
    initialSampleAreaWidthPercent,
    defaultSystemConfig.sampleAreaWidthPercent,
  );
  const captureAreaHeight = clampCapturePercent(
    initialSampleAreaHeightPercent,
    defaultSystemConfig.sampleAreaHeightPercent,
  );

  const cameraCapture = useCameraRobustCapture();
  const colorCalibration = useRobustColorCalibration();

  const captureAreaOptions = {
    areaWidthPercent: captureAreaWidth,
    areaHeightPercent: captureAreaHeight,
  };

  const handleCalibrateLight = async () => {
    try {
      const success = await colorCalibration.startLightCalibration(
        async (sampleIndex, totalSamples) => {
          toast.loading(
            `Capturando amostra ${sampleIndex + 1}/${totalSamples}...`,
            {
              id: "light-calibration-progress",
            },
          );
          const captured = await cameraCapture.captureRobustSample(
            1,
            100,
            captureAreaOptions,
          );
          return captured?.rgb ?? null;
        },
        LIGHT_CALIBRATION_SAMPLES,
        SAMPLE_INTERVAL_MS,
      );

      if (success) {
        setIsLightCalibrated(true);

        toast.success("Calibracao de luz concluida!", {
          id: "light-calibration-progress",
          description: "Calibracao salva como referencia de luz base",
        });
      } else {
        toast.error("Falha na calibracao", {
          id: "light-calibration-progress",
          description: colorCalibration.error || "Tente novamente",
        });
      }
    } catch (err) {
      console.error("Erro ao calibrar luz:", err);
      toast.error("Erro na calibracao");
    }
  };

  const [capturedRawSamples, setCapturedRawSamples] = useState<
    { r: number; g: number; b: number }[]
  >([]);

  const handleCaptureColor = async () => {
    if (!colorCalibration.isLightCalibrated()) {
      toast.error("Calibre a luz primeiro!", {
        description: 'Clique em "Calibrar Luz" antes de capturar a cor',
      });
      return;
    }
    const allRawSamples: { r: number; g: number; b: number }[] = [];

    try {
      const result = await colorCalibration.startColorCapture(
        async (sampleIndex, totalSamples) => {
          toast.loading(`Capturando amostra ${sampleIndex + 1}/${totalSamples}...`, {
            id: "color-capture-progress",
          });
          const captured = await cameraCapture.captureRobustSample(1, 100, {
            ...captureAreaOptions,
            includeSamples: true,
            pixelPuro: true,
          });
          if (captured?.rawSamples) {
            allRawSamples.push(...captured.rawSamples);
          }
          return captured?.rgb ?? null;
        },
        COLOR_CAPTURE_SAMPLES,
        SAMPLE_INTERVAL_MS,
      );
      if (result.success && result.correctedColor) {
        const hex = rgbToHex(result.correctedColor);
        const rgb8Bit = rgbToRgb8Bit(result.correctedColor);

        setDisplayColor({ hex, rgb: rgb8Bit });
        setCapturedRawSamples(allRawSamples);   // <-- guarda pra usar no Salvar

        toast.success("Cor capturada com sucesso!", {
          id: "color-capture-progress",
          description: `Cor base salva: ${hex}`,
        });
      } else {
        toast.error("Falha na captura de cor", {
          id: "color-capture-progress",
          description: colorCalibration.error || "Tente novamente",
        });
      }
    } catch (err) {
      console.error("Erro ao capturar cor:", err);
      toast.error("Erro na captura");
    }
  };

  const handleSave = async () => {
    if (!isLightCalibrated) {
      toast.error("Luz nao calibrada", {
        description: "Realize a calibracao de luz antes de salvar",
      });
      return;
    }
    const hasNewLightReference = colorCalibration.isLightCalibrated();
    try {
      const samplesToSend =
        capturedRawSamples.length > 0
          ? capturedRawSamples
          : [displayColor.rgb]; // fallback: sem amostras cruas, manda só a cor final

      const response = await fetch(`${CAMERA_PROXY_URL}/reference-palette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: samplesToSend }),
      });
      if (!response.ok) {
        throw new Error("Falha ao salvar paleta de cor no proxy da câmera");
      }
    } catch (error) {
      console.error("Erro ao salvar paleta de cor:", error);
      toast.error("Não foi possível salvar a paleta de cor na câmera");
      return;
    }

    onSave({
      referenceColorHex: displayColor.hex.toUpperCase(),
      referenceColorRgb: displayColor.rgb,
      colorConfigured: true,
      lightCalibrated: hasNewLightReference || initialLightCalibrated,
      ambientLightConfigured: hasNewLightReference || initialLightCalibrated,
      ...(hasNewLightReference && colorCalibration.lightCalibrationData
        ? {
          ambientLightReferenceHex: (
            colorCalibration.lightCalibrationData.referenceHex || ""
          ).toUpperCase(),
          ambientLightReferenceRgb:
            colorCalibration.lightCalibrationData.referenceRgb8Bit,
        }
        : {}),
    });
    onBack();
  };

  const isBusy = colorCalibration.isCalibrating || cameraCapture.isCapturing;

  return (
    <div className="fixed inset-0 z-20 overflow-hidden bg-[#0a0c14] text-white">
      <CameraPreview
        className="absolute inset-0 z-0 rounded-none border-0 bg-black"
        imageClassName="h-full w-full bg-black object-contain"
        offlineClassName="absolute inset-0 flex items-center justify-center bg-black p-6"
        fallbackMessage="Preview indisponivel durante calibracao"
        showRetryButton={false}
        streamPath={`/stream-analyzed.mjpg?w=${captureAreaWidth}&h=${captureAreaHeight}&apenas_area=true`}
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/55 via-transparent to-black/45" />

      <div className="absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-4 md:left-8 md:right-8 md:top-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/85 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <div className="flex items-start gap-3">
          <div className="hidden rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-right backdrop-blur-md md:block">
            <h2 className="font-sansserief text-sm uppercase tracking-[0.25em] text-white">
              Calibracao de Luz (D65)
            </h2>
            <p className="mt-1 text-xs text-white/55">
              {colorCalibration.statusMessage}
            </p>
          </div>
          <div className="group relative flex items-center justify-center rounded-full border border-white/10 bg-black/40 p-2.5 backdrop-blur-md">
            <Info
              size={18}
              className="cursor-pointer text-white/65 transition-colors group-hover:text-white"
            />
            <div className="absolute right-0 top-full mt-3 hidden w-64 rounded-lg border border-white/10 bg-slate-950/95 p-3 text-xs text-white shadow-lg backdrop-blur-md group-hover:block">
              <h3 className="mb-2 border-b border-white/10 pb-1 text-sm font-bold">
                Procedimento de Medicao
              </h3>
              <p className="text-slate-300">
                A amostra usa somente a regiao pontilhada central definida na
                area de analise.
              </p>
            </div>
          </div>
        </div>
      </div>

      <RgbScreen
        open={isRgbPickerOpen}
        initialHex={displayColor.hex}
        onOpenChange={setIsRgbPickerOpen}
        onSelect={(color) => {
          setDisplayColor(color);
          setIsRgbPickerOpen(false);
          toast.success("Cor atualizada", {
            description: `${color.hex.toUpperCase()} selecionado`,
          });
        }}
      />

      <div className="absolute bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 md:bottom-6">
        <div className="rounded-2xl border border-white/10 bg-black/50 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-16 rounded-lg border-2 border-white/20 shadow-lg"
                style={{ backgroundColor: displayColor.hex }}
              />
              <div>
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Cor selecionada
                </p>
                <p className="text-sm font-medium text-white">
                  {displayColor.hex.toUpperCase()}
                </p>
              </div>
            </div>

            {colorCalibration.error && (
              <p className="max-w-md rounded-lg border border-red-500/30 bg-red-950/45 px-3 py-2 text-xs text-red-200">
                {colorCalibration.error}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={handleCalibrateLight}
              disabled={colorCalibration.isCalibrating}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition-all ${isLightCalibrated
                ? "border-emerald-500/45 bg-emerald-950/45 text-emerald-200"
                : "border-blue-500/45 bg-blue-950/45 text-blue-200 hover:bg-blue-900/55"
                } ${colorCalibration.isCalibrating ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              {colorCalibration.isCalibrating ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>
                    {colorCalibration.calibrationProgress.toFixed(0)}%
                  </span>
                </>
              ) : isLightCalibrated ? (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>Calibrada</span>
                </>
              ) : (
                <>
                  <Lightbulb className="h-5 w-5" />
                  <span>Calibrar Luz Ambiente</span>
                </>
              )}
            </button>

            <button
              onClick={handleCaptureColor}
              disabled={isBusy || !isLightCalibrated}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition-all ${!isLightCalibrated
                ? "cursor-not-allowed border-slate-700/70 bg-slate-950/60 text-slate-500"
                : "border-violet-500/45 bg-violet-950/45 text-violet-200 hover:bg-violet-900/55"
                } ${isBusy ? "opacity-60" : ""}`}
            >
              {isBusy ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Capturando</span>
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  <span>Capturar Cor</span>
                </>
              )}
            </button>

            <button
              onClick={handleSave}
              disabled={!isLightCalibrated}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition-all ${!isLightCalibrated
                ? "cursor-not-allowed border-slate-700/70 bg-slate-950/60 text-slate-500"
                : "border-emerald-500/45 bg-emerald-950/45 text-emerald-200 hover:bg-emerald-900/55"
                }`}
            >
              <Save className="h-5 w-5" />
              <span>Salvar</span>
            </button>

            <button
              onClick={() => isLightCalibrated && setIsRgbPickerOpen(true)}
              disabled={!isLightCalibrated}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition-all ${isLightCalibrated
                ? "border-white/15 bg-white/10 text-slate-100 hover:bg-white/15"
                : "cursor-not-allowed border-slate-700/70 bg-slate-950/60 text-slate-500"
                }`}
            >
              <Pipette className="h-5 w-5" />
              <span>Selecionar cor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
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
