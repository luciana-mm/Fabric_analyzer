"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  ScanLine,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraPreview } from "@/components/CameraPreview";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { useCameraRobustCapture } from "@/hooks/useCameraRobustCapture";
import { fetchJson } from "@/lib/api-client";
import {
  createTissueBatchCode,
  defaultSystemConfig,
  getSystemFlowState,
} from "@/lib/systemConfig";
import { evaluateColorMatch } from "@/utils/calibrationUtils";
import { rgb8BitToNormalized, rgbToHex } from "@/utils/colorSpaceConversion";

const clampCapturePercent = (value: number | undefined, fallback: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(100, Math.max(5, Math.round(numberValue)));
};

const AUTO_ANALYSIS_INTERVAL_MS = 2500;
// URL base da câmera (ajuste se for diferente no seu ambiente)
const CAMERA_API_URL = "http://localhost:8090"; 

interface ColorAnalysisProps {
  analysisType?: "tecido" | "pecas";
}

const ColorAnalysis = ({ analysisType = "tecido" }: ColorAnalysisProps) => {
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
  const [isAutoAnalysisEnabled, setIsAutoAnalysisEnabled] = useState(false);
  
  // NOVO: Estado para armazenar a contagem de falhas (defeitos)
  const [defectCount, setDefectCount] = useState<number>(0);

  const requiredPrecision = useMemo(() => {
    if (config.deltaE === 1) return 80;
    if (config.deltaE === 2) return 70;
    return 60;
  }, [config.deltaE]);

  const activeTissueCode = config.activeTissueCode;
  const flowState = getSystemFlowState(config);
  
  // Aqui estão as variáveis dinâmicas do quadradinho
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
    const syncPanelState = () => setIsPanelExpanded(mediaQuery.matches);

    syncPanelState();
    mediaQuery.addEventListener("change", syncPanelState);
    return () => mediaQuery.removeEventListener("change", syncPanelState);
  }, []);

  // NOVO: Polling para buscar a contagem de defeitos da câmera em tempo real
  useEffect(() => {
    if (analysisType !== "tecido") return;

    const fetchDefects = async () => {
      try {
        const response = await fetch(`${CAMERA_API_URL}/defect-count`);
        if (response.ok) {
          const data = await response.json();
          setDefectCount(data.count);
        }
      } catch (error) {
        // Ignora erro silenciosamente para não floodar o console caso a câmera esteja off
      }
    };

    fetchDefects(); // Busca imediatamente
    const intervalId = setInterval(fetchDefects, 1000); // A cada 1 segundo

    return () => clearInterval(intervalId);
  }, [analysisType]);

  // NOVO: Função para zerar as falhas
  const handleResetDefects = async () => {
    try {
      const response = await fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" });
      if (response.ok) {
        setDefectCount(0);
        toast.success("Contagem de falhas zerada.");
      }
    } catch (error) {
      toast.error("Erro ao zerar contagem da câmera.");
    }
  };

  const handleAnalyze = useCallback(
    async (trigger: "manual" | "auto" = "manual") => {
      if (cameraCapture.isCapturing) return;

      if (!config.colorConfigured || !flowState.podeIniciar) {
        if (trigger === "auto") {
          setIsAutoAnalysisEnabled(false);
          toast.warning("Analise automatica pausada", {
            description: "Finalize a configuracao para retomar a analise automatica.",
          });
          return;
        }
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
        if (trigger === "manual") {
          toast.error("Nao foi possivel capturar amostra da camera.");
        }
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

      setResult({ precision, deltaE: evaluation.deltaE, success });

      if (!user?.id) {
        if (trigger === "manual") {
          toast.warning("Analise concluida sem usuario autenticado para salvar historico.");
        }
        return;
      }

      try {
        await fetchJson<{ data: unknown }>("/api/analysis", {
          method: "POST",
          body: JSON.stringify({
            operator_user_id: user.id,
            reference_code: `${activeTissueCode}-${Date.now()}`,
            tissue_type: activeTissueCode,
            tissue_batch_code: activeTissueCode,
            analysis_type: analysisType,
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
          }),
        });
      } catch (error) {
        console.error("Erro ao salvar analise:", error);
        if (trigger === "manual") {
          toast.warning("Analise concluida, mas nao foi possivel salvar no historico.");
        }
        return;
      }

      if (trigger === "manual") {
        toast.success(success ? "Sucesso na analise" : "Falha na analise", {
          description: `Precisao ${precision.toFixed(1)}% | Minimo ${requiredPrecision.toFixed(1)}%`,
        });
      }
    },
    [
      activeTissueCode,
      analysisType,
      cameraCapture,
      captureAreaHeight,
      captureAreaWidth,
      config,
      flowState.podeIniciar,
      requiredPrecision,
      user?.id,
    ],
  );

  useEffect(() => {
    if (!isAutoAnalysisEnabled || cameraCapture.isCapturing || analysisType === "pecas") {
      return;
    }
    const timerId = window.setTimeout(() => {
      void handleAnalyze("auto");
    }, AUTO_ANALYSIS_INTERVAL_MS);

    return () => window.clearTimeout(timerId);
  }, [cameraCapture.isCapturing, handleAnalyze, isAutoAnalysisEnabled, analysisType]);

  const handleAutoAnalysisToggle = (enabled: boolean) => {
    if (enabled && (!config.colorConfigured || !flowState.podeIniciar)) {
      toast.error("Configuracao incompleta", {
        description: "Defina a cor base e calibre a luz antes de ativar a analise automatica.",
      });
      return;
    }
    setIsAutoAnalysisEnabled(enabled);
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
        configurationSaved: false,
      });
    }

    setResult(null);
    setIsAutoAnalysisEnabled(false);
    toast.success(`${analysisType === "tecido" ? "Tecido" : "Peça"} finalizado`, {
      description: "Novo lote iniciado. Refaca as configuracoes e a calibracao de luz.",
    });
    router.push("/painel");
  };

  // NOVO: Monta a URL dinâmica passando os percentuais para a API do Python
  const cameraStreamPath = analysisType === "tecido" 
    ? `/stream-analyzed.mjpg?w=${captureAreaWidth}&h=${captureAreaHeight}`
    : `/stream.mjpg`;

  return (
    <div className="fixed inset-0 z-20 overflow-hidden bg-[#0a0c14] text-white">
      <CameraPreview
        className="absolute inset-0 z-0 rounded-none border-0 bg-black"
        imageClassName="h-full w-full bg-black object-contain"
        offlineClassName="absolute inset-0 flex items-center justify-center bg-black p-6"
        fallbackMessage="Nao foi possivel acessar a camera."
        showRetryButton={false}
        streamPath={cameraStreamPath} // <--- Enviando URL com parâmetros dinâmicos
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-transparent to-black/45" />



      <div className="absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-4 md:left-8 md:right-8 md:top-6">
        <button
          onClick={() => router.push("/painel")}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/85 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>

        {/* INFORMAÇÕES SUPERIOR DIREITA (Onde as falhas vão aparecer no Desktop) */}
        <div className="hidden rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-right backdrop-blur-md md:block">
          <h2 className="font-sansserief text-sm uppercase tracking-[0.25em] text-white">
            Analise de Cores
          </h2>
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="text-xs text-white/55">Tipo:</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium uppercase tracking-widest ${
                analysisType === "tecido"
                  ? "bg-blue-500/20 text-blue-200 border border-blue-500/30"
                  : "bg-purple-500/20 text-purple-200 border border-purple-500/30"
              }`}
            >
              {analysisType === "tecido" ? "Tecido" : "Peças"}
            </span>
          </div>

          {/* NOVO: Badge do Defect Tracker */}
          {analysisType === "tecido" && (
            <div className="mt-3 border-t border-white/10 pt-3 flex items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/55 uppercase tracking-widest">Falhas:</span>
                <span className="text-xl font-bold text-orange-500">{defectCount}</span>
              </div>
              <button
                onClick={handleResetDefects}
                className="rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-orange-400 transition hover:bg-orange-500/20"
              >
                Zerar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PAINEL INFERIOR */}
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
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">Delta E</p>
                <p className="mt-2 text-lg font-medium text-white">Delta E &lt;= {config.deltaE}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">Precisao minima</p>
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
                <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">Resultado</p>
                {result ? (
                  <>
                    <p className="mt-2 text-sm font-medium">
                      {result.success ? "Sucesso: tecido dentro do padrao de cor." : "Fora do padrao"}
                    </p>
                    <p className="mt-1 text-xs opacity-85">
                      Precisao: <strong>{result.precision.toFixed(1)}%</strong> | Delta E: {result.deltaE.toFixed(2)}
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-sansserief text-[10px] uppercase tracking-[0.25em] text-white/45">
                    Analise de {analysisType === "tecido" ? "tecidos" : "pecas"}
                  </p>
                  {result && (
                    <p className="mt-1 text-xs text-white/70">
                      {result.success ? "Sucesso" : "Fora do padrao"} - {result.precision.toFixed(1)}%
                    </p>
                  )}
                </div>
                {/* Badge para Mobile */}
                {analysisType === "tecido" && (
                  <div className="flex flex-col items-end mr-4 md:hidden">
                    <span className="text-[10px] text-white/55 uppercase tracking-widest">Falhas</span>
                    <span className="font-bold text-orange-500">{defectCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {analysisType === "tecido" && (
              <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Analise automatica</p>
                  <p className="text-xs text-white/65">Executa uma nova analise a cada 2,5 segundos.</p>
                </div>
                <Switch
                  checked={isAutoAnalysisEnabled}
                  onCheckedChange={handleAutoAnalysisToggle}
                  disabled={cameraCapture.isCapturing}
                  aria-label="Ativar analise automatica"
                />
              </div>
            )}

            <button
              onClick={handleFinishTissue}
              className="flex min-h-[64px] items-center justify-center rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-center text-sm font-medium text-rose-200 transition hover:bg-rose-900/45"
            >
              Finalizar {analysisType === "tecido" ? "Tecido" : "Peça"}
            </button>
            <button
              onClick={() => void handleAnalyze("manual")}
              disabled={cameraCapture.isCapturing || isAutoAnalysisEnabled}
              className="flex min-h-[64px] items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cameraCapture.isCapturing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analisando
                </span>
              ) : isAutoAnalysisEnabled ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analise automatica ativa
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