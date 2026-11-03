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
const CAMERA_API_URL =
  process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ?? "http://localhost:8090";

interface ColorAnalysisProps {
  analysisType?: "tecido" | "pecas";
}

const ColorAnalysis = ({ analysisType = "tecido" }: ColorAnalysisProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const { config, isLoading, persistPatch } = useOperatorSystemConfig(user?.id);
  const cameraCapture = useCameraRobustCapture();

  const [result, setResult] = useState<{
    precision: number;
    deltaE: number;
    success: boolean;
    capturedHex: string;
  } | null>(null);

  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isAutoAnalysisEnabled, setIsAutoAnalysisEnabled] = useState(false);
  const [isInspectionActive, setIsInspectionActive] = useState(false);
  const [hasInspectedInSession, setHasInspectedInSession] = useState(false);

  // Estado para armazenar a contagem de falhas (defeitos)
  const [defectCount, setDefectCount] = useState<number>(0);

  const requiredPrecision = useMemo(() => {
    if (config.deltaE === 1) return 80;
    if (config.deltaE === 2) return 70;
    return 60;
  }, [config.deltaE]);

  const activeTissueCode = config.activeTissueCode;
  const flowState = getSystemFlowState(config);

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

  // Zera automaticamente o contador de falhas na câmera ao entrar na tela de análise
  useEffect(() => {
    if (analysisType !== "tecido") return;
    fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" })
      .then(() => setDefectCount(0))
      .catch(() => {});
  }, [analysisType]);

  // Polling para buscar a contagem de defeitos da câmera em tempo real (apenas quando a análise foi iniciada)
  useEffect(() => {
    if (analysisType !== "tecido" || !isInspectionActive) return;

    const fetchDefects = async () => {
      try {
        const response = await fetch(`${CAMERA_API_URL}/defect-count`);
        if (response.ok) {
          const data = await response.json();
          setDefectCount(data.count);
        }
      } catch {
        // Ignora erro silenciosamente caso a câmera esteja off
      }
    };

    fetchDefects();
    const intervalId = setInterval(fetchDefects, 1000);

    return () => clearInterval(intervalId);
  }, [analysisType, isInspectionActive]);

  const handleResetDefects = async () => {
    try {
      const response = await fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" });
      if (response.ok) {
        setDefectCount(0);
        toast.success("Contagem de falhas zerada.");
      }
    } catch {
      toast.error("Erro ao zerar contagem da câmera.");
    }
  };

  const handleTogglePatternInspection = async () => {
    if (!isInspectionActive) {
      // Se for o primeiro início da sessão, zera o contador; se estava apenas pausado, mantém a contagem atual do lote
      if (!hasInspectedInSession) {
        try {
          await fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" });
          setDefectCount(0);
        } catch {
          // continua mesmo se falhar o reset
        }
      }
      setIsInspectionActive(true);
      setHasInspectedInSession(true);
      toast.success("Inspeção iniciada", {
        description: "O Anomalib começou a monitorar e contabilizar falhas em tempo real.",
      });
    } else {
      setIsInspectionActive(false);
      toast.info("Inspeção pausada", {
        description: "A contagem de falhas foi pausada.",
      });
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
          description: "Defina a referencia e calibre a luz antes de iniciar a analise.",
        });
        return;
      }

      // Ativa a detecção de falhas no vídeo a partir do primeiro clique em Analisar Agora
      if (!isInspectionActive) {
        try {
          await fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" });
          setDefectCount(0);
        } catch {
          // ignora erro de rede
        }
        setIsInspectionActive(true);
        setHasInspectedInSession(true);
      }

      const captured = await cameraCapture.captureRobustSample(5, 200, {
        areaWidthPercent: captureAreaWidth,
        areaHeightPercent: captureAreaHeight,
        samplePoints: config.samplePoints,
      });

      if (!captured) {
        if (trigger === "manual") {
          toast.error("Nao foi possivel capturar amostra da camera.");
        }
        return;
      }
      const { rgb: rgbSample } = captured;

      const measured = rgb8BitToNormalized(rgbSample);
      const reference = {
        r: config.referenceColorRgb.r / 255,
        g: config.referenceColorRgb.g / 255,
        b: config.referenceColorRgb.b / 255,
      };

      const evaluation = evaluateColorMatch(measured, reference, config.deltaE);
      const precision = Math.max(0, Math.min(100, 100 - evaluation.deltaE * 2));
      const colorApproved = evaluation.matches && precision >= requiredPrecision;
      const success = colorApproved && defectCount === 0;
      const measuredHex = rgbToHex(measured);

      setResult({ precision, deltaE: evaluation.deltaE, success, capturedHex: measuredHex });

      if (!user?.id) {
        if (trigger === "manual") {
          toast.warning("Analise concluida sem usuario autenticado para salvar historico.");
        }
        return;
      }

      const failureReason = success
        ? null
        : !colorApproved && defectCount > 0
        ? `Divergencia ΔE (${evaluation.deltaE.toFixed(2)}) + ${defectCount} falha(s) fisica(s)`
        : !colorApproved
        ? "Precisao abaixo do minimo configurado"
        : `${defectCount} falha(s) fisica(s) detectada(s) no tecido`;

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
            failure_reason: failureReason,
            processing_time_ms: 1000,
            delta_e_measured: Number(evaluation.deltaE.toFixed(4)),
            delta_e_threshold: config.deltaE,
            precision_percent: Number(precision.toFixed(2)),
            required_precision_percent: Number(requiredPrecision.toFixed(2)),
            comparison_method: "CIEDE2000",
            reference_color_hex: config.referenceColorHex,
            measured_color_hex: measuredHex,
            defect_count: defectCount,
            is_patterned: false,
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
          description: `Precisao ${precision.toFixed(1)}% | Falhas: ${defectCount}`,
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
      defectCount,
      flowState.podeIniciar,
      isInspectionActive,
      requiredPrecision,
      user?.id,
    ],
  );

  useEffect(() => {
    if (!isAutoAnalysisEnabled || cameraCapture.isCapturing || analysisType === "pecas" || config.estampado) {
      return;
    }
    const timerId = window.setTimeout(() => {
      void handleAnalyze("auto");
    }, AUTO_ANALYSIS_INTERVAL_MS);

    return () => window.clearTimeout(timerId);
  }, [cameraCapture.isCapturing, config.estampado, handleAnalyze, isAutoAnalysisEnabled, analysisType]);

  const handleAutoAnalysisToggle = async (enabled: boolean) => {
    if (enabled && (!config.colorConfigured || !flowState.podeIniciar)) {
      toast.error("Configuracao incompleta", {
        description: "Defina a cor base e calibre a luz antes de ativar a analise automatica.",
      });
      return;
    }
    if (enabled && !isInspectionActive) {
      try {
        await fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" });
        setDefectCount(0);
      } catch {
        // ignora erro de rede
      }
      setIsInspectionActive(true);
      setHasInspectedInSession(true);
    }
    setIsAutoAnalysisEnabled(enabled);
  };

  const handleFinishTissue = async () => {
    // Se for tecido detalhado (Anomalib) e houve inspeção (ativa ou pausada), registra o lote no histórico com a quantidade exata de defeitos
    if (config.estampado && (isInspectionActive || hasInspectedInSession || defectCount > 0) && user?.id) {
      const approved = defectCount === 0;
      try {
        await fetchJson<{ data: unknown }>("/api/analysis", {
          method: "POST",
          body: JSON.stringify({
            operator_user_id: user.id,
            reference_code: `${activeTissueCode}-${Date.now()}`,
            tissue_type: activeTissueCode,
            tissue_batch_code: activeTissueCode,
            analysis_type: analysisType,
            result: approved ? "ok" : "fail",
            failure_reason: approved
              ? null
              : `${defectCount} defeito(s) detectado(s) no tecido detalhado (Anomalib)`,
            processing_time_ms: 500,
            delta_e_measured: 0,
            delta_e_threshold: config.deltaE,
            precision_percent: approved ? 100 : Math.max(0, 100 - defectCount * 10),
            required_precision_percent: Number(requiredPrecision.toFixed(2)),
            comparison_method: "ANOMALIB_PATCHCORE",
            reference_color_hex: config.referenceColorHex,
            measured_color_hex: config.referenceColorHex,
            defect_count: defectCount,
            is_patterned: true,
          }),
        });
      } catch {
        // continua finalização mesmo se falhar o log
      }
    }

    // Zera automaticamente as falhas na câmera ao finalizar o lote
    try {
      await fetch(`${CAMERA_API_URL}/reset-count`, { method: "POST" });
    } catch {
      // ignora erro se câmera estiver offline
    }

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

    const finalDefects = defectCount;
    setDefectCount(0);
    setResult(null);
    setIsAutoAnalysisEnabled(false);
    setIsInspectionActive(false);
    setHasInspectedInSession(false);
    toast.success(`${analysisType === "tecido" ? "Tecido" : "Peça"} finalizado`, {
      description: `Lote salvo com ${finalDefects} falha(s) e contagem zerada para o próximo.`,
    });
    router.push("/painel");
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#050811]" />;
  }

  // Enquanto o operador não clicar em "Analisar Agora" (isInspectionActive = false),
  // enviamos apenas_area=true para que a câmera mostre só a área pontilhada SEM contar defeitos antes da hora!
  const cameraStreamPath =
    analysisType === "tecido"
      ? `/stream-analyzed.mjpg?w=${captureAreaWidth}&h=${captureAreaHeight}&estampado=${config.estampado}&apenas_area=${!isInspectionActive}`
      : `/stream.mjpg`;

  return (
    <div className="fixed inset-0 z-20 overflow-hidden bg-[#050811] text-white">
      <CameraPreview
        className="absolute inset-0 z-0 rounded-none border-0 bg-black"
        imageClassName="h-full w-full bg-black object-contain"
        offlineClassName="absolute inset-0 flex items-center justify-center bg-black p-6"
        fallbackMessage="Não foi possível acessar a câmera."
        showRetryButton={false}
        streamPath={cameraStreamPath}
      />

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-transparent to-black/50" />

      <div className="absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-4 md:left-8 md:right-8 md:top-6">
        <button
          onClick={() => router.push("/painel")}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/75 px-4 py-2 text-xs font-medium text-slate-200 backdrop-blur-xl transition-all hover:border-cyan-400/50 hover:text-cyan-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao Painel
        </button>

        {/* HUD SUPERIOR DIREITA */}
        <div className="hidden rounded-2xl border border-white/15 bg-slate-950/80 px-5 py-3.5 text-right backdrop-blur-xl shadow-2xl md:block">
          <div className="flex items-center justify-end gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isInspectionActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <h2 className="font-sansserief text-xs font-bold uppercase tracking-[0.2em] text-white">
              {isInspectionActive ? "Inspeção Ativa" : "Aguardando Início"}
            </h2>
          </div>

          <div className="mt-2.5 flex items-center justify-end gap-2">
            <span className="text-[11px] text-slate-400">Modo:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                analysisType === "tecido"
                  ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/35"
                  : "bg-blue-500/20 text-blue-200 border-blue-400/35"
              }`}
            >
              {analysisType === "tecido" ? "Rolo / Tecido" : "Peças"}
            </span>
          </div>

          {analysisType === "tecido" && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="text-[11px] text-slate-400">Detector:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                  config.estampado
                    ? "bg-amber-500/20 text-amber-200 border-amber-400/40"
                    : "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                }`}
              >
                {config.estampado ? "Anomalib (Detalhado)" : "OpenCV (Liso)"}
              </span>
            </div>
          )}

          {analysisType === "tecido" && (
            <div className="mt-3 border-t border-white/10 pt-2.5 flex items-center justify-end gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider">Falhas:</span>
                <span className="font-mono-tech text-lg font-bold text-amber-400">{defectCount}</span>
              </div>
              <button
                onClick={handleResetDefects}
                className="rounded-lg border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300 transition hover:bg-amber-500/25"
              >
                Zerar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PAINEL INFERIOR */}
      <div className="absolute bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 md:bottom-6">
        <div className="relative rounded-2xl border border-white/15 bg-slate-950/85 p-5 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setIsPanelExpanded((current) => !current)}
            aria-label={isPanelExpanded ? "Recolher painel" : "Expandir painel"}
            className="absolute right-3.5 top-3.5 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-slate-900/80 text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300"
          >
            {isPanelExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>

          {isPanelExpanded && (
            <div className="mb-4 grid gap-3 pr-10 lg:grid-cols-[1fr_1fr_1.5fr]">
              {config.estampado ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      Padrão Aprendido
                    </p>
                    <p className="mt-1.5 font-sansserief text-base font-bold text-amber-300">
                      Anomalib · PatchCore
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Referência de tecido bom ativa
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      Área & Lote Atual
                    </p>
                    <p className="mt-1.5 font-sansserief text-base font-bold text-cyan-300">
                      {captureAreaWidth}% × {captureAreaHeight}%
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Lote: <span className="font-mono-tech text-slate-200">{config.activeTissueCode}</span>
                    </p>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 ${
                      !isInspectionActive
                        ? "border-white/10 bg-slate-900/70 text-slate-300"
                        : defectCount === 0
                        ? "border-emerald-500/40 bg-emerald-950/45 text-emerald-100"
                        : "border-amber-500/40 bg-amber-950/45 text-amber-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-wider opacity-75">
                        Monitoramento de Anomalias
                      </p>
                      {isInspectionActive && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            defectCount === 0
                              ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
                              : "bg-amber-500/25 text-amber-200 border border-amber-400/40"
                          }`}
                        >
                          {defectCount === 0 ? "Sem Falhas" : `${defectCount} Falha(s)`}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs">
                      {!isInspectionActive
                        ? 'Clique em "Iniciar Contagem de Falhas" abaixo para começar a detectar defeitos no tecido.'
                        : defectCount === 0
                        ? "Monitorando estampa em tempo real — nenhuma anomalia cruzou a linha até o momento."
                        : `Foram contabilizadas ${defectCount} anomalia(s) cruzando a linha de inspeção neste lote.`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Cor Padrão & Tolerância
                      </p>
                      <p className="mt-1.5 font-sansserief text-base font-bold text-white">
                        ΔE ≤ {config.deltaE}
                      </p>
                      <p className="text-[11px] font-mono-tech text-cyan-300 mt-0.5">
                        Ref: {config.referenceColorHex}
                      </p>
                    </div>
                    <div
                      className="w-11 h-11 rounded-xl border border-white/20 shadow-inner shrink-0"
                      style={{ backgroundColor: config.referenceColorHex }}
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      Precisão Mínima Exigida
                    </p>
                    <p className="mt-1.5 font-sansserief text-xl font-bold text-cyan-300">
                      {requiredPrecision.toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Lote: <span className="font-mono-tech text-slate-200">{config.activeTissueCode}</span>
                    </p>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 ${
                      !result
                        ? "border-white/10 bg-slate-900/70 text-slate-300"
                        : result.success
                        ? "border-emerald-500/40 bg-emerald-950/45 text-emerald-100"
                        : "border-rose-500/40 bg-rose-950/45 text-rose-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-wider opacity-75">
                        Resultado da Inspeção
                      </p>
                      {result && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            result.success
                              ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
                              : "bg-rose-500/25 text-rose-200 border border-rose-400/40"
                          }`}
                        >
                          {result.success ? "Aprovado" : "Reprovado"}
                        </span>
                      )}
                    </div>
                    {result ? (
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {result.success
                              ? "Tecido dentro do padrão colorimétrico"
                              : "Divergência acima da tolerância ΔE"}
                          </p>
                          <p className="mt-0.5 text-xs font-mono-tech opacity-90">
                            Precisão: <strong>{result.precision.toFixed(1)}%</strong> · ΔE:{" "}
                            <strong>{result.deltaE.toFixed(2)}</strong>
                          </p>
                        </div>
                        <div
                          className="w-9 h-9 rounded-lg border border-white/30 shrink-0"
                          style={{ backgroundColor: result.capturedHex }}
                          title={`Cor capturada: ${result.capturedHex}`}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">
                        Aguardando leitura manual ou automática da câmera...
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {!isPanelExpanded && (
            <div className="mb-3 pr-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-sansserief text-xs font-bold uppercase tracking-wider text-white">
                    Inspeção de {analysisType === "tecido" ? "Tecidos" : "Peças"}
                  </p>
                  {config.estampado ? (
                    <p className="mt-0.5 text-xs text-slate-300">
                      {isInspectionActive
                        ? `Monitorando anomalias ao vivo (${defectCount} falha(s))`
                        : "Aguardando início da contagem de falhas"}
                    </p>
                  ) : (
                    result && (
                      <p className="mt-0.5 text-xs text-slate-300">
                        {result.success ? "Aprovado" : "Fora do padrão"} · {result.precision.toFixed(1)}% (ΔE {result.deltaE.toFixed(2)})
                      </p>
                    )
                  )}
                </div>
                {analysisType === "tecido" && (
                  <div className="flex flex-col items-end mr-4 md:hidden">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Falhas</span>
                    <span className="font-mono-tech font-bold text-amber-400">{defectCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {analysisType === "tecido" && !config.estampado && (
              <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Inspeção Contínua Automática</p>
                  <p className="text-xs text-slate-400">
                    Coleta e registra uma nova leitura de tonalidade a cada 2,5 segundos automaticamente.
                  </p>
                </div>
                <Switch
                  checked={isAutoAnalysisEnabled}
                  onCheckedChange={(checked) => void handleAutoAnalysisToggle(checked)}
                  disabled={cameraCapture.isCapturing}
                  aria-label="Ativar análise automática"
                />
              </div>
            )}

            <button
              onClick={handleFinishTissue}
              className="flex min-h-[56px] items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950/45 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-rose-200 transition hover:bg-rose-900/60"
            >
              Finalizar Lote ({analysisType === "tecido" ? "Tecido" : "Peça"})
            </button>

            {config.estampado && analysisType === "tecido" ? (
              <button
                onClick={() => void handleTogglePatternInspection()}
                className={`flex min-h-[56px] items-center justify-center rounded-xl px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider transition ${
                  isInspectionActive
                    ? "border border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                    : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <ScanLine className="h-4 w-4" />
                  {isInspectionActive ? "Pausar Contagem de Falhas" : "Iniciar Contagem de Falhas"}
                </span>
              </button>
            ) : (
              <button
                onClick={() => void handleAnalyze("manual")}
                disabled={cameraCapture.isCapturing || isAutoAnalysisEnabled}
                className="flex min-h-[56px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.35)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cameraCapture.isCapturing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Capturando e Analisando...
                  </span>
                ) : isAutoAnalysisEnabled ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Análise Automática Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ScanLine className="h-4 w-4" />
                    Analisar Agora
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorAnalysis;
