"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle, ChevronDown, ChevronUp, Loader, Sun } from "lucide-react";
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
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  const captureAreaWidth = clampCapturePercent(
    sampleAreaWidthPercent,
    defaultSystemConfig.sampleAreaWidthPercent,
  );
  const captureAreaHeight = clampCapturePercent(
    sampleAreaHeightPercent,
    defaultSystemConfig.sampleAreaHeightPercent,
  );
  const canFinish = calibrated || (mode === "setup" && hasMeasurement);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const syncPanelState = () => {
      setIsPanelExpanded(mediaQuery.matches);
    };

    syncPanelState();
    mediaQuery.addEventListener("change", syncPanelState);

    return () => {
      mediaQuery.removeEventListener("change", syncPanelState);
    };
  }, []);

  const handleCaptureAmbientLight = async () => {
    if (!hasReferenceConfigured) {
      toast.error("Defina a luz base nas configuracoes antes de calibrar no painel.", {
        description: "Acesse Configuracoes > Capturar Cor.",
      });
      return;
    }

    try {
      const rgbSample = await cameraCapture.captureRobustSample(5, 200, {
        areaWidthPercent: captureAreaWidth,
        areaHeightPercent: captureAreaHeight,
      });
      if (!rgbSample) {
        toast.error("Falha ao capturar a luz ambiente.");
        return;
      }

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
    <div className="fixed inset-0 z-20 overflow-hidden bg-[#0a0c14] text-white">
      <CameraPreview
        className="absolute inset-0 z-0 rounded-none border-0 bg-black"
        imageClassName="h-full w-full bg-black object-cover"
        offlineClassName="absolute inset-0 flex items-center justify-center bg-black p-6"
        fallbackMessage="Preview indisponivel durante calibracao"
        showRetryButton={false}
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-transparent to-black/45" />

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 pb-56 sm:pb-44 lg:pb-36">
        <div
          className="relative rounded-lg border-[6px] border-dashed border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.12),0_0_18px_rgba(0,0,0,0.9)] transition-all duration-150 ease-out"
          style={{
            width: `${captureAreaWidth}vw`,
            height: `${captureAreaHeight}vh`,
            maxWidth: "90vw",
            maxHeight: "68vh",
            minWidth: "140px",
            minHeight: "100px",
          }}
        />
      </div>

      <div className="absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-4 md:left-8 md:right-8 md:top-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/85 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <div className="hidden rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-right backdrop-blur-md md:block">
          <h2 className="font-sansserief text-sm uppercase tracking-[0.25em] text-white">
            Calibracao de Luz Ambiente
          </h2>
          <p className="mt-1 text-xs text-white/55">
            {mode === "setup"
              ? "Defina a luz base do ambiente."
              : "Compare a iluminacao atual com a luz base salva."}
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 md:bottom-6">
        <div className="relative rounded-2xl border border-white/10 bg-black/50 p-4 shadow-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setIsPanelExpanded((current) => !current)}
            aria-label={isPanelExpanded ? "Recolher painel" : "Expandir painel"}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            {isPanelExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>

          {isPanelExpanded && (
            <div className="mb-4 grid gap-3 pr-10 lg:grid-cols-[1fr_1fr_1.2fr]">
              <LightInfo
                label={mode === "setup" ? "Luz base atual" : "Luz base configurada"}
                hex={referenceHex}
                rgb={referenceRgb}
              />
              <LightInfo label="Luz ambiente capturada" hex={ambientHex} rgb={ambientRgb} />
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Status da calibracao
                </p>
                <p className="mt-2 text-sm text-white">
                  {mode === "setup"
                    ? matchLabel || "Nenhuma medicao realizada ainda."
                    : similarity !== null
                    ? `${similarity.toFixed(0)}% de similaridade com a luz base`
                    : calibrated
                    ? "Ultima medicao valida"
                    : "Luz ambiente ainda nao validada"}
                </p>
                {mode === "compare" && lastDeltaE !== null && (
                  <p className="mt-1 text-xs text-white/50">Delta E = {lastDeltaE.toFixed(2)}</p>
                )}
                {matchLabel && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-white/85">
                    {calibrated ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                    {matchLabel}
                  </div>
                )}
                <p className="mt-2 text-xs text-white/40">
                  {initialLightCalibrated ? "Calibracao anterior disponivel" : "Nenhum resultado salvo"}
                </p>
              </div>
            </div>
          )}

          {!isPanelExpanded && (
            <div className="mb-3 pr-10">
              <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                Calibracao de luz ambiente
              </p>
              {matchLabel && (
                <p className="mt-1 text-xs text-white/70">
                  {matchLabel}
                  {similarity !== null ? ` - ${similarity.toFixed(0)}%` : ""}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={handleCaptureAmbientLight}
              disabled={cameraCapture.isCapturing}
              className="flex min-h-[64px] items-center justify-center gap-2 rounded-xl border border-blue-500/45 bg-blue-950/45 px-4 py-3 text-center text-sm font-medium text-blue-200 transition hover:bg-blue-900/55 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cameraCapture.isCapturing ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Medindo luz ambiente
                </>
              ) : (
                <>
                  <Sun className="h-5 w-5" />
                  {mode === "setup" ? "Definir luz base" : "Capturar luz ambiente"}
                </>
              )}
            </button>

            <button
              onClick={handleFinish}
              disabled={!canFinish || cameraCapture.isCapturing}
              className={`flex min-h-[64px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${
                canFinish
                  ? "border-emerald-500/45 bg-emerald-950/45 text-emerald-200 hover:bg-emerald-900/55"
                  : "cursor-not-allowed border-slate-700/70 bg-slate-950/60 text-slate-500"
              }`}
            >
              <CheckCircle className="h-5 w-5" />
              Concluir
            </button>
          </div>
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-11 w-16 rounded-lg border-2 border-white/20 shadow-lg" style={{ backgroundColor: hex }} />
        <div>
          <p className="text-sm font-medium text-white">{hex.toUpperCase()}</p>
          <p className="text-xs text-white/45">
            {rgb.r}, {rgb.g}, {rgb.b}
          </p>
        </div>
      </div>
    </div>
  );
};
