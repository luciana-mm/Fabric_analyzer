"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Loader, Sun } from "lucide-react";
import { toast } from "sonner";
import { CameraPreview } from "./CameraPreview";
import { useCameraRobustCapture } from "@/hooks/useCameraRobustCapture";
import { calculateAmbientLightMatch } from "@/utils/calibrationUtils";
import { rgb8BitToNormalized, rgbToHex } from "@/utils/colorSpaceConversion";
import { defaultSystemConfig } from "@/lib/systemConfig";

interface AmbientLightCalibrationProps {
  onBack: () => void;
  onSave: (patch: {
    lightCalibrated: boolean;
    ambientLightConfigured?: boolean;
    ambientLightReferenceHex?: string;
    ambientLightReferenceRgb?: {
      r: number;
      g: number;
      b: number;
    };
  }) => Promise<void> | void;
  referenceHex: string;
  referenceRgb: {
    r: number;
    g: number;
    b: number;
  };
  hasReferenceConfigured: boolean;
  initialLightCalibrated: boolean;
  sampleAreaWidthPercent?: number;
  sampleAreaHeightPercent?: number;
  mode?: "setup" | "compare";
}

const clampCapturePercent = (value: number | undefined, fallback: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(5, Math.round(numberValue)));
};

export const AmbientLightCalibration = ({
  onBack,
  onSave,
  referenceHex,
  referenceRgb,
  hasReferenceConfigured,
  initialLightCalibrated,
  sampleAreaWidthPercent = defaultSystemConfig.sampleAreaWidthPercent,
  sampleAreaHeightPercent = defaultSystemConfig.sampleAreaHeightPercent,
  mode = "compare",
}: AmbientLightCalibrationProps) => {
  const cameraCapture = useCameraRobustCapture();
  const [ambientHex, setAmbientHex] = useState<string>("#000000");
  const [ambientRgb, setAmbientRgb] = useState({ r: 0, g: 0, b: 0 });
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [matchLabel, setMatchLabel] = useState<string>("");
  const [lastDeltaE, setLastDeltaE] = useState<number | null>(null);
  const [calibrated, setCalibrated] = useState(initialLightCalibrated);
  const [hasMeasurement, setHasMeasurement] = useState(initialLightCalibrated);

  const captureAreaWidth = clampCapturePercent(
    sampleAreaWidthPercent,
    defaultSystemConfig.sampleAreaWidthPercent,
  );
  const captureAreaHeight = clampCapturePercent(
    sampleAreaHeightPercent,
    defaultSystemConfig.sampleAreaHeightPercent,
  );
  const canFinish = calibrated || (mode === "setup" && hasMeasurement);

  const handleCaptureAmbientLight = async () => {
    if (!hasReferenceConfigured) {
      toast.error("Defina a luz base nas configuracoes antes de calibrar no painel.", {
        description: "Acesse Configuracoes > Capturar Cor.",
      });
      return;
    }

    try {
      const captured = await cameraCapture.captureRobustSample(5, 200, {
        areaWidthPercent: captureAreaWidth,
        areaHeightPercent: captureAreaHeight,
      });
      if (!captured) {
        toast.error("Falha ao capturar a luz ambiente.");
        return;
      }
      const { rgb: rgbSample } = captured;

      const normalizedAmbient = rgb8BitToNormalized(rgbSample);
      const ambientColorHex = rgbToHex(normalizedAmbient);
      const result = calculateAmbientLightMatch(normalizedAmbient, {
        r: referenceRgb.r / 255,
        g: referenceRgb.g / 255,
        b: referenceRgb.b / 255,
      });

      setAmbientRgb(rgbSample);
      setAmbientHex(ambientColorHex);
      setHasMeasurement(true);

      if (mode === "setup") {
        setSimilarity(null);
        setMatchLabel("Luz base definida");
        setLastDeltaE(null);
        setCalibrated(true);
        await onSave({
          lightCalibrated: false,
          ambientLightConfigured: true,
          ambientLightReferenceHex: ambientColorHex,
          ambientLightReferenceRgb: rgbSample,
        });
        toast.success("Luz base salva nas configuracoes");
        return;
      }

      setSimilarity(result.similarityPercent);
      setMatchLabel(result.matches ? "Ambiente compativel" : "Ambiente divergente");
      setLastDeltaE(result.deltaE);
      setCalibrated(result.matches);

      await onSave({ lightCalibrated: result.matches });

      toast.success("Calibracao de luz ambiente concluida", {
        description: `Similaridade: ${result.similarityPercent.toFixed(0)}% (${result.matches ? "compativel" : "divergente"})`,
      });
    } catch (err) {
      console.error("Erro ao medir luz ambiente:", err);
      toast.error("Erro ao comparar a luz ambiente.");
    }
  };

  const handleFinish = async () => {
    if (!canFinish) {
      return;
    }

    await onSave({
      lightCalibrated: mode === "compare" ? calibrated : false,
      ...(mode === "setup"
        ? {
            ambientLightConfigured: true,
            ambientLightReferenceHex: ambientHex,
            ambientLightReferenceRgb: ambientRgb,
          }
        : {}),
    });
    onBack();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Live Camera Preview (explicitly requested by user) */}
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
          {mode === "setup"
            ? "Posicione a bancada sob a iluminação padrão para definir a luz base."
            : "A medição compara a iluminação atual na região central com a luz base salva."}
        </p>
      </div>

      {/* Right: Swatches comparison, Delta E / Similarity bar & actions */}
      <div className="space-y-4 lg:col-span-5">
        <div className="grid grid-cols-2 gap-3">
          <LightInfo
            label={mode === "setup" ? "Luz base atual" : "Luz base salva"}
            hex={referenceHex}
            rgb={referenceRgb}
          />
          <LightInfo
            label="Luz atual da câmera"
            hex={ambientHex}
            rgb={ambientRgb}
          />
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-stone-900">
              Status da calibração
            </h3>
            {matchLabel && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  calibrated
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {calibrated ? (
                  <CheckCircle className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {calibrated ? "Dentro do limite" : "Divergente"}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-stone-700">
            {mode === "setup"
              ? matchLabel || "Nenhuma medição realizada ainda."
              : similarity !== null
                ? `${similarity.toFixed(0)}% de similaridade com a luz base`
                : calibrated
                  ? "Última medição válida"
                  : "Luz ambiente ainda não validada"}
          </p>

          {mode === "compare" && similarity !== null && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Similaridade</span>
                <span className="font-mono font-medium text-stone-800">
                  {similarity.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    calibrated ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, similarity))}%` }}
                />
              </div>
            </div>
          )}

          {mode === "compare" && lastDeltaE !== null && (
            <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
              <span>ΔE da luz</span>
              <span className="font-mono font-semibold text-stone-900">
                {lastDeltaE.toFixed(2)}
              </span>
            </div>
          )}

          <p className="mt-2 text-xs text-stone-400">
            {initialLightCalibrated
              ? "Calibração anterior disponível"
              : "Nenhum resultado salvo"}
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={handleCaptureAmbientLight}
            disabled={cameraCapture.isCapturing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cameraCapture.isCapturing ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Medindo luz ambiente...</span>
              </>
            ) : (
              <>
                <Sun className="h-4 w-4" />
                <span>
                  {mode === "setup"
                    ? "Definir luz base"
                    : hasMeasurement
                      ? "Medir novamente"
                      : "Capturar luz ambiente"}
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleFinish}
            disabled={!canFinish || cameraCapture.isCapturing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Confirmar Calibração</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface LightInfoProps {
  label: string;
  hex: string;
  rgb: {
    r: number;
    g: number;
    b: number;
  };
}

const LightInfo = ({ label, hex, rgb }: LightInfoProps) => {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <div className="mt-2.5 flex items-center gap-3">
        <div
          className="h-10 w-12 shrink-0 rounded-lg border border-stone-200 shadow-inner"
          style={{ backgroundColor: hex }}
        />
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold text-stone-900">
            {hex.toUpperCase()}
          </p>
          <p className="font-mono text-[11px] text-stone-500">
            {rgb.r}, {rgb.g}, {rgb.b}
          </p>
        </div>
      </div>
    </div>
  );
};
