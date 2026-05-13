"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraPreview } from "@/components/CameraPreview";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { useCameraRobustCapture } from "@/hooks/useCameraRobustCapture";
import { createTissueBatchCode, defaultSystemConfig } from "@/lib/systemConfig";
import { evaluateColorMatch } from "@/utils/calibrationUtils";
import { rgb8BitToNormalized, rgbToHex } from "@/utils/colorSpaceConversion";
import { supabase } from "@/integrations/supabase/client";

const clampCapturePercent = (value: number | undefined, fallback: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(5, Math.round(numberValue)));
};

const ColorAnalysis = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { config, persistPatch } = useOperatorSystemConfig(user?.id);
  const cameraCapture = useCameraRobustCapture();

  const [result, setResult] = useState<{
    precision: number;
    deltaE: number;
    success: boolean;
  } | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  const requiredPrecision = useMemo(() => {
    if (config.deltaE === 1) return 80;
    if (config.deltaE === 2) return 70;
    return 60;
  }, [config.deltaE]);

  const activeTissueCode = config.activeTissueCode;
  const captureAreaWidth = clampCapturePercent(
    config.sampleAreaWidthPercent,
    defaultSystemConfig.sampleAreaWidthPercent,
  );
  const captureAreaHeight = clampCapturePercent(
    config.sampleAreaHeightPercent,
    defaultSystemConfig.sampleAreaHeightPercent,
  );

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

  const handleAnalyze = async () => {
    if (!config.colorConfigured || !config.lightCalibrated) {
      toast.error("Configuracao incompleta", {
        description: "Defina a cor base e calibre a luz antes de iniciar a analise.",
      });
      return;
    }

    const rgbSample = await cameraCapture.captureRobustSample(5, 200, {
      areaWidthPercent: captureAreaWidth,
      areaHeightPercent: captureAreaHeight,
      samplePoints: config.samplePoints,
    });
    if (!rgbSample) {
      toast.error("Nao foi possivel capturar amostra da camera.");
      return;
    }

    const measured = rgb8BitToNormalized(rgbSample);
    const reference = {
      r: config.referenceColorRgb.r / 255,
      g: config.referenceColorRgb.g / 255,
      b: config.referenceColorRgb.b / 255,
    };

    const evaluation = evaluateColorMatch(measured, reference, config.deltaE);
    const precision = Math.max(0, Math.min(100, 100 - evaluation.deltaE * 2));
    const success = precision >= requiredPrecision;
    const measuredHex = rgbToHex(measured);

    setResult({
      precision,
      deltaE: evaluation.deltaE,
      success,
    });

    if (!user?.id) {
      toast.warning("Analise concluida sem usuario autenticado para salvar historico.");
      return;
    }

    const { error } = await supabase.from("analysis_records").insert({
      operator_user_id: user.id,
      reference_code: `${activeTissueCode}-${Date.now()}`,
      tissue_type: activeTissueCode,
      tissue_batch_code: activeTissueCode,
      result: success ? "ok" : "fail",
      failure_reason: success ? null : "Precisao abaixo do minimo configurado",
      processing_time_ms: 1000,
      delta_e_measured: Number(evaluation.deltaE.toFixed(4)),
      delta_e_threshold: config.deltaE,
      precision_percent: Number(precision.toFixed(2)),
      required_precision_percent: Number(requiredPrecision.toFixed(2)),
      comparison_method: "CIEDE2000",
      reference_color_hex: config.referenceColorHex,
      measured_color_hex: measuredHex,
    });

    if (error) {
      console.error("Erro ao salvar analise:", error);
      toast.warning("Analise concluida, mas nao foi possivel salvar no historico.");
      return;
    }

    toast.success(success ? "Sucesso na analise" : "Falha na analise", {
      description: `Precisao ${precision.toFixed(1)}% | Minimo ${requiredPrecision.toFixed(1)}%`,
    });
  };

  const handleFinishTissue = async () => {
    const nextBatchCode = createTissueBatchCode();

    if (persistPatch) {
      await persistPatch({
        systemStep: "CONFIG",
        activeTissueCode: nextBatchCode,
        deltaConfigured: false,
        analysisAreaConfigured: false,
        colorConfigured: false,
        ambientLightConfigured: false,
        lightCalibrated: false,
      });
    }

    setResult(null);
    toast.success("Tecido finalizado", {
      description: "Novo lote iniciado. Refaca as configuracoes e a calibracao de luz.",
    });
    router.push("/painel");
  };

  return (
    <div className="fixed inset-0 z-20 overflow-hidden bg-[#0a0c14] text-white">
      <CameraPreview
        className="absolute inset-0 z-0 rounded-none border-0 bg-black"
        imageClassName="h-full w-full bg-black object-cover"
        offlineClassName="absolute inset-0 flex items-center justify-center bg-black p-6"
        fallbackMessage="Nao foi possivel acessar a camera."
        showRetryButton={false}
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-transparent to-black/45" />

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 pb-48 sm:pb-40 lg:pb-32">
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
          onClick={() => router.push("/painel")}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/85 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        <div className="hidden rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-right backdrop-blur-md md:block">
          <h2 className="font-sansserief text-sm uppercase tracking-[0.25em] text-white">
            Analise de Cores
          </h2>
          <p className="mt-1 text-xs text-white/55">Area definida na etapa de analise</p>
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
            <div className="mb-4 grid gap-3 pr-10 lg:grid-cols-[1fr_1fr_1.4fr]">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Delta E
                </p>
                <p className="mt-2 text-lg font-medium text-white">Delta E &lt;= {config.deltaE}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Precisao minima
                </p>
                <p className="mt-2 text-lg font-medium text-white">{requiredPrecision.toFixed(1)}%</p>
              </div>

              <div
                className={`rounded-xl border p-3 ${
                  !result
                    ? "border-white/10 bg-white/5 text-white/65"
                    : result.success
                    ? "border-emerald-500/35 bg-emerald-950/35 text-emerald-100"
                    : "border-rose-500/35 bg-rose-950/35 text-rose-100"
                }`}
              >
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Resultado
                </p>
                {result ? (
                  <>
                    <p className="mt-2 text-sm font-medium">
                      {result.success ? "Sucesso: tecido dentro do padrao de cor." : "Fora do padrao"}
                    </p>
                    <p className="mt-1 text-xs opacity-85">
                      Precisao: <strong>{result.precision.toFixed(1)}%</strong> | Delta E:{" "}
                      {result.deltaE.toFixed(2)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm">Nenhuma analise realizada ainda.</p>
                )}
              </div>
            </div>
          )}

          {!isPanelExpanded && (
            <div className="mb-3 pr-10">
              <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                Analise de tecidos
              </p>
              {result && (
                <p className="mt-1 text-xs text-white/70">
                  {result.success ? "Sucesso" : "Fora do padrao"} - {result.precision.toFixed(1)}%
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={handleFinishTissue}
              className="flex min-h-[64px] items-center justify-center rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-center text-sm font-medium text-rose-200 transition hover:bg-rose-900/45"
            >
              Finalizar Tecido
            </button>
            <button
              onClick={handleAnalyze}
              disabled={cameraCapture.isCapturing}
              className="flex min-h-[64px] items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cameraCapture.isCapturing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analisando
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <ScanLine className="h-5 w-5" />
                  Analisar Agora
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorAnalysis;
