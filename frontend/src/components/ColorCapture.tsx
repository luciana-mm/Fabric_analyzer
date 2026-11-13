"use client";

import { useState } from "react";
import {
  Camera,
  CheckCircle,
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
import { getCameraProxyUrl } from "@/lib/camera-proxy";

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
  estampado?: boolean;
}

const LIGHT_CALIBRATION_SAMPLES = 5;
const COLOR_CAPTURE_SAMPLES = 5;
const SAMPLE_INTERVAL_MS = 200;

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
  estampado = false,
}: ColorCaptureProps) => {
  const [displayColor, setDisplayColor] = useState({
    hex: initialColorHex,
    rgb: initialColorRgb,
  });
  const [isLightCalibrated, setIsLightCalibrated] = useState(
    initialLightCalibrated,
  );
  const [isCalibratingPattern, setIsCalibratingPattern] = useState(false);
  const [patternCapturedCount, setPatternCapturedCount] = useState<number>(0);
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

  const handleCapturePatternImages = async () => {
    if (!isLightCalibrated) {
      toast.error("Calibre a luz primeiro!", {
        description: 'Clique em "Calibrar Luz Ambiente" antes de capturar as imagens',
      });
      return;
    }

    try {
      setIsCalibratingPattern(true);
      toast.loading(
        "Capturando 15 imagens detalhadas do tecido bom e aprendendo padrão no Anomalib...",
        { id: "anomalib-pattern-calibration" },
      );

      const patternRes = await fetch(`${getCameraProxyUrl()}/calibrate-pattern`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          w: captureAreaWidth,
          h: captureAreaHeight,
          num_frames: 15,
          interval_ms: 120,
        }),
      });

      setIsCalibratingPattern(false);

      if (!patternRes.ok) {
        throw new Error("Falha ao capturar imagens da estampa na câmera");
      }

      const patternData = await patternRes.json();
      const savedCount = patternData?.metadata?.num_frames ?? 15;
      setPatternCapturedCount(savedCount);

      toast.success("Imagens detalhadas capturadas com sucesso!", {
        id: "anomalib-pattern-calibration",
        description: `${savedCount} fotos do tecido bom aprendidas pelo Anomalib.`,
      });
    } catch (err) {
      setIsCalibratingPattern(false);
      console.error("Erro ao capturar imagens da estampa:", err);
      toast.error("Erro ao capturar imagens do tecido na câmera", {
        id: "anomalib-pattern-calibration",
      });
    }
  };

  const handleCaptureColor = async () => {
    if (estampado) {
      await handleCapturePatternImages();
      return;
    }

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
        setCapturedRawSamples(allRawSamples);

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
      if (estampado) {
        if (patternCapturedCount === 0) {
          setIsCalibratingPattern(true);
          toast.loading(
            "Capturando 15 imagens detalhadas do tecido bom no Anomalib...",
            { id: "anomalib-pattern-calibration" },
          );

          const patternRes = await fetch(`${getCameraProxyUrl()}/calibrate-pattern`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              w: captureAreaWidth,
              h: captureAreaHeight,
              num_frames: 15,
              interval_ms: 120,
            }),
          });

          setIsCalibratingPattern(false);

          if (!patternRes.ok) {
            throw new Error("Falha ao calibrar padrão da estampa no Anomalib");
          }

          const patternData = await patternRes.json();
          const savedCount = patternData?.metadata?.num_frames ?? 15;
          setPatternCapturedCount(savedCount);
          toast.success("Padrão da estampa aprendido no Anomalib!", {
            id: "anomalib-pattern-calibration",
            description: `${savedCount} fotos do tecido bom salvas.`,
          });
        }
      } else {
        const samplesToSend =
          capturedRawSamples.length > 0
            ? capturedRawSamples
            : [displayColor.rgb];

        const response = await fetch(`${getCameraProxyUrl()}/reference-palette`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ samples: samplesToSend }),
        });
        if (!response.ok) {
          throw new Error("Falha ao salvar paleta de cor no proxy da câmera");
        }
      }
    } catch (error) {
      setIsCalibratingPattern(false);
      console.error("Erro ao salvar calibração no proxy:", error);
      toast.error("Não foi possível concluir a calibração na câmera", {
        id: "anomalib-pattern-calibration",
      });
      return;
    }

    await onSave({
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

  const isBusy =
    colorCalibration.isCalibrating ||
    cameraCapture.isCapturing ||
    isCalibratingPattern;

  return (
    <div className="space-y-6">
      {!estampado && (
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
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Live Camera Preview */}
        <div className="lg:col-span-7">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-950 shadow-sm">
            <CameraPreview
              className="h-full w-full rounded-none border-0 bg-stone-950"
              imageClassName="h-full w-full bg-stone-950 object-contain"
              offlineClassName="flex h-full w-full items-center justify-center bg-stone-900 p-6"
              fallbackMessage="Preview indisponível durante calibração"
              showRetryButton={false}
              streamPath={`/stream-analyzed.mjpg?w=${captureAreaWidth}&h=${captureAreaHeight}&apenas_area=true`}
            />

            <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              AO VIVO
            </div>
          </div>
          <p className="mt-2.5 text-xs text-stone-500">
            {estampado
              ? "Posicione um trecho do tecido BOM (sem defeito) na região pontilhada para o Anomalib aprender a estampa."
              : "A amostra usa somente a região pontilhada central definida na área de análise."}
          </p>
        </div>

        {/* Right: Calibration & Capture Controls */}
        <div className="space-y-4 lg:col-span-5">
          {/* Card 1: Luz ambiente base */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-stone-900">
                Luz ambiente base (D65)
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isLightCalibrated
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {isLightCalibrated ? "OK" : "Pendente"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-stone-500">
              Leia a área com o tecido iluminado pela luz padrão da bancada.
            </p>
            <p className="mt-1 font-mono text-[11px] text-stone-400">
              {colorCalibration.statusMessage}
            </p>

            <button
              onClick={handleCalibrateLight}
              disabled={colorCalibration.isCalibrating}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                isLightCalibrated
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  : "border-stone-300 bg-white text-stone-800 hover:bg-stone-50"
              } ${colorCalibration.isCalibrating ? "cursor-not-allowed opacity-60" : ""}`}
            >
              {colorCalibration.isCalibrating ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>
                    Calibrando {colorCalibration.calibrationProgress.toFixed(0)}%...
                  </span>
                </>
              ) : isLightCalibrated ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Luz calibrada (recalibrar)</span>
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4" />
                  <span>Capturar luz base</span>
                </>
              )}
            </button>
          </div>

          {/* Card 2: Cor padrão / Estampa */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            {estampado ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-stone-900">
                    Padrão de estampa (Anomalib)
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      patternCapturedCount > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {patternCapturedCount > 0
                      ? `${patternCapturedCount} fotos`
                      : "Aguardando"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-stone-500">
                  {patternCapturedCount > 0
                    ? `${patternCapturedCount} fotos do tecido bom aprendidas.`
                    : "Capture 15 imagens detalhadas do tecido sem defeito."}
                </p>
                <button
                  onClick={handleCaptureColor}
                  disabled={isBusy || !isLightCalibrated}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Capturando imagens...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      <span>
                        {patternCapturedCount > 0
                          ? `Recapturar imagens (${patternCapturedCount})`
                          : "Capturar imagens detalhadas"}
                      </span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-stone-900">
                    Cor padrão do tecido
                  </h3>
                  <span className="font-mono text-xs font-medium text-stone-600">
                    {displayColor.hex.toUpperCase()}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3.5 rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <div
                    className="h-11 w-14 shrink-0 rounded-md border border-stone-300 shadow-sm"
                    style={{ backgroundColor: displayColor.hex }}
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-stone-900">
                      {displayColor.hex.toUpperCase()}
                    </p>
                    <p className="font-mono text-xs text-stone-500">
                      RGB({displayColor.rgb.r}, {displayColor.rgb.g},{" "}
                      {displayColor.rgb.b})
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    onClick={handleCaptureColor}
                    disabled={isBusy || !isLightCalibrated}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isBusy ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>Capturando...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        <span>Capturar cor padrão</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => isLightCalibrated && setIsRgbPickerOpen(true)}
                    disabled={!isLightCalibrated}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pipette className="h-4 w-4" />
                    <span>Selecionar cor</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {colorCalibration.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              {colorCalibration.error}
            </div>
          )}

          {/* Confirmar captura */}
          <button
            onClick={handleSave}
            disabled={!isLightCalibrated || isBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>Confirmar captura</span>
          </button>
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
