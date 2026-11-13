"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  ScanLine,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraPreview } from "@/components/CameraPreview";
import { OperatorShell } from "@/components/OperatorShell";
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
import { getCameraProxyUrl } from "@/lib/camera-proxy";

const clampCapturePercent = (value: number | undefined, fallback: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.min(100, Math.max(5, Math.round(numberValue)));
};

const AUTO_ANALYSIS_INTERVAL_MS = 2500;

interface SessionReading {
  id: string;
  time: string;
  batchCode: string;
  deltaE: number;
  precision: number;
  defects: number;
  approved: boolean;
}

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

  const [sessionReadings, setSessionReadings] = useState<SessionReading[]>([]);
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

  // Zera automaticamente o contador de falhas na câmera ao entrar na tela de análise
  useEffect(() => {
    if (analysisType !== "tecido") return;
    fetch(`${getCameraProxyUrl()}/reset-count`, { method: "POST" })
      .then(() => setDefectCount(0))
      .catch(() => {});
  }, [analysisType]);

  // Polling para buscar a contagem de defeitos da câmera em tempo real (apenas quando a análise foi iniciada)
  useEffect(() => {
    if (analysisType !== "tecido" || !isInspectionActive) return;

    const fetchDefects = async () => {
      try {
        const response = await fetch(`${getCameraProxyUrl()}/defect-count`);
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
      const response = await fetch(`${getCameraProxyUrl()}/reset-count`, { method: "POST" });
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
          await fetch(`${getCameraProxyUrl()}/reset-count`, { method: "POST" });
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
          await fetch(`${getCameraProxyUrl()}/reset-count`, { method: "POST" });
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
      setSessionReadings((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          batchCode: activeTissueCode,
          deltaE: evaluation.deltaE,
          precision,
          defects: defectCount,
          approved: success,
        },
        ...prev.slice(0, 19),
      ]);

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
        await fetch(`${getCameraProxyUrl()}/reset-count`, { method: "POST" });
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
      await fetch(`${getCameraProxyUrl()}/reset-count`, { method: "POST" });
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
    return (
      <OperatorShell>
        <div className="h-64 animate-pulse rounded-xl border border-stone-200 bg-white" />
      </OperatorShell>
    );
  }

  // Enquanto o operador não clicar em "Analisar Agora" (isInspectionActive = false),
  // enviamos apenas_area=true para que a câmera mostre só a área pontilhada SEM contar defeitos antes da hora!
  const cameraStreamPath =
    analysisType === "tecido"
      ? `/stream-analyzed.mjpg?w=${captureAreaWidth}&h=${captureAreaHeight}&estampado=${config.estampado}&apenas_area=${!isInspectionActive}`
      : `/stream.mjpg`;

  const totalReadings = sessionReadings.length;
  const approvedReadings = sessionReadings.filter((r) => r.approved).length;
  const failedReadings = totalReadings - approvedReadings;

  return (
    <OperatorShell>
      <div className="space-y-6">
        {/* Top bar: Back + Title + Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.push("/painel")}
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                  Bancada · {analysisType === "tecido" ? "Rolo / Tecido" : "Peças Confeccionadas"}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isInspectionActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isInspectionActive ? "bg-emerald-500" : "bg-stone-400"
                    }`}
                  />
                  {isInspectionActive ? "Inspeção ativa" : "Aguardando"}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-stone-500">
                Lote <span className="font-mono font-medium text-stone-700">{config.activeTissueCode}</span>
                {config.estampado
                  ? " · Anomalib (PatchCore)"
                  : ` · tolerância ΔE ≤ ${config.deltaE} · precisão mín. ${requiredPrecision.toFixed(0)}%`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {analysisType === "tecido" && !config.estampado && (
              <label className="inline-flex cursor-pointer items-center gap-2.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 shadow-sm">
                <Switch
                  checked={isAutoAnalysisEnabled}
                  onCheckedChange={(checked) => void handleAutoAnalysisToggle(checked)}
                  disabled={cameraCapture.isCapturing}
                  aria-label="Ativar análise automática"
                />
                <span>Análise automática contínua</span>
              </label>
            )}

            {config.estampado && analysisType === "tecido" ? (
              <button
                onClick={() => void handleTogglePatternInspection()}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
                  isInspectionActive
                    ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "bg-stone-900 text-white hover:bg-stone-800"
                }`}
              >
                <ScanLine className="h-4 w-4" />
                {isInspectionActive ? "Pausar Contagem de Falhas" : "Iniciar Contagem de Falhas"}
              </button>
            ) : (
              <button
                onClick={() => void handleAnalyze("manual")}
                disabled={cameraCapture.isCapturing || isAutoAnalysisEnabled}
                className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cameraCapture.isCapturing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analisando...</span>
                  </>
                ) : isAutoAnalysisEnabled ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Automática Ativa</span>
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4" />
                    <span>Analisar Agora</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleFinishTissue}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100"
            >
              Finalizar Lote
            </button>
          </div>
        </div>

        {/* Main 2-column grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Live Camera Preview */}
          <div className="lg:col-span-7">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-950 shadow-sm">
              <CameraPreview
                className="h-full w-full rounded-none border-0 bg-stone-950"
                imageClassName="h-full w-full bg-stone-950 object-contain"
                offlineClassName="flex h-full w-full items-center justify-center bg-stone-900 p-6"
                fallbackMessage="Não foi possível acessar a câmera."
                showRetryButton={false}
                streamPath={cameraStreamPath}
              />

              <div className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                AO VIVO
              </div>

              {analysisType === "tecido" && (
                <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {config.estampado ? "Anomalib (Estampado)" : "OpenCV (Liso)"}
                </div>
              )}
            </div>
          </div>

          {/* Right: Última leitura + Counters */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-stone-900">
                  Última leitura
                </h2>
                {config.estampado ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      !isInspectionActive
                        ? "bg-stone-100 text-stone-600"
                        : defectCount === 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {!isInspectionActive
                      ? "AGUARDANDO"
                      : defectCount === 0
                        ? "SEM FALHAS"
                        : `${defectCount} FALHA(S)`}
                  </span>
                ) : result ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      result.success
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {result.success ? "APROVADO" : "REPROVADO"}
                  </span>
                ) : (
                  <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
                    Aguardando
                  </span>
                )}
              </div>

              {config.estampado ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-stone-400">
                        Área
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-stone-900">
                        {captureAreaWidth}% × {captureAreaHeight}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-stone-400">
                        Defeitos
                      </p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-stone-900">
                        {defectCount}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500">
                    {!isInspectionActive
                      ? 'Clique em "Iniciar Contagem de Falhas" para detectar anomalias no tecido.'
                      : defectCount === 0
                        ? "Monitorando estampa em tempo real — nenhuma anomalia até o momento."
                        : `${defectCount} anomalia(s) contabilizada(s) neste lote.`}
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                        Cor padrão
                      </p>
                      <div className="mt-2 flex items-center gap-2.5">
                        <div
                          className="h-8 w-10 shrink-0 rounded border border-stone-300"
                          style={{ backgroundColor: config.referenceColorHex }}
                        />
                        <span className="font-mono text-xs font-semibold text-stone-900">
                          {config.referenceColorHex}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                        Cor lida
                      </p>
                      <div className="mt-2 flex items-center gap-2.5">
                        <div
                          className="h-8 w-10 shrink-0 rounded border border-stone-300 bg-stone-200"
                          style={
                            result?.capturedHex
                              ? { backgroundColor: result.capturedHex }
                              : undefined
                          }
                        />
                        <span className="font-mono text-xs font-semibold text-stone-900">
                          {result?.capturedHex ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-stone-100 pt-3">
                    <div>
                      <p className="text-[11px] text-stone-400">ΔE medido</p>
                      <p className="font-mono text-base font-semibold text-stone-900">
                        {result ? result.deltaE.toFixed(2) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-400">Precisão</p>
                      <p className="font-mono text-base font-semibold text-stone-900">
                        {result ? `${result.precision.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-400">Defeitos</p>
                      <p className="font-mono text-base font-semibold text-stone-900">
                        {analysisType === "tecido" ? defectCount : 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {analysisType === "tecido" && (
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="text-xs text-stone-500">
                    Contador de falhas físicas na câmera
                  </span>
                  <button
                    onClick={handleResetDefects}
                    className="rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
                  >
                    Zerar ({defectCount})
                  </button>
                </div>
              )}
            </div>

            {/* Counters: Lidas / OK / Falhas */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                  Lidas
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-stone-900">
                  {totalReadings}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                  OK
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-emerald-700">
                  {approvedReadings}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-center shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
                  Falhas
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold text-rose-600">
                  {failedReadings}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Leituras recentes do turno */}
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-stone-900">
              Leituras recentes do turno
            </h2>
            <span className="text-xs text-stone-400">
              {totalReadings} registro(s) nesta sessão
            </span>
          </div>

          {sessionReadings.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-stone-400">
              Nenhuma leitura registrada nesta sessão ainda. Clique em &quot;Analisar Agora&quot; para iniciar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-5 py-2.5">Horário</th>
                    <th className="px-5 py-2.5">Lote</th>
                    <th className="px-5 py-2.5">ΔE</th>
                    <th className="px-5 py-2.5">Precisão</th>
                    <th className="px-5 py-2.5">Defeitos</th>
                    <th className="px-5 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sessionReadings.map((reading) => (
                    <tr key={reading.id} className="hover:bg-stone-50/70">
                      <td className="px-5 py-2.5 font-mono text-xs text-stone-600">
                        {reading.time}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs font-medium text-stone-800">
                        {reading.batchCode}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-stone-700">
                        {reading.deltaE.toFixed(2)}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-stone-700">
                        {reading.precision.toFixed(1)}%
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-stone-700">
                        {reading.defects}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            reading.approved
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {reading.approved ? "APROVADO" : "REPROVADO"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </OperatorShell>
  );
};

export default ColorAnalysis;
