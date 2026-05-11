"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import gridBg from "@/assets/grid-bg.jpg";
import { CameraPreview } from "@/components/CameraPreview";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { useCameraRobustCapture } from "@/hooks/useCameraRobustCapture";
import { createTissueBatchCode } from "@/lib/systemConfig";
import { evaluateColorMatch } from "@/utils/calibrationUtils";
import { rgb8BitToNormalized, rgbToHex } from "@/utils/colorSpaceConversion";
import { supabase } from "@/integrations/supabase/client";

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

  const requiredPrecision = useMemo(() => {
    if (config.deltaE === 1) return 80;
    if (config.deltaE === 2) return 70;
    return 60;
  }, [config.deltaE]);

  const activeTissueCode = config.activeTissueCode;

  const handleAnalyze = async () => {
    if (!config.colorConfigured || !config.lightCalibrated) {
      toast.error("Configuração incompleta", {
        description: "Defina a cor base e calibre a luz antes de iniciar a análise.",
      });
      return;
    }

    const rgbSample = await cameraCapture.captureRobustSample(5, 200, {
      areaWidthPercent: config.sampleAreaWidthPercent,
      areaHeightPercent: config.sampleAreaHeightPercent,
      samplePoints: config.samplePoints,
    });
    if (!rgbSample) {
      toast.error("Não foi possível capturar amostra da câmera.");
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
      toast.warning("Análise concluída sem usuário autenticado para salvar histórico.");
      return;
    }

    const { error } = await supabase.from("analysis_records").insert({
      operator_user_id: user.id,
      reference_code: `${activeTissueCode}-${Date.now()}`,
      tissue_type: activeTissueCode,
      tissue_batch_code: activeTissueCode,
      result: success ? "ok" : "fail",
      failure_reason: success ? null : "Precisão abaixo do mínimo configurado",
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
      console.error("Erro ao salvar análise:", error);
      toast.warning("Análise concluída, mas não foi possível salvar no histórico.");
      return;
    }

    toast.success(success ? "Sucesso na análise" : "Falha na análise", {
      description: `Precisão ${precision.toFixed(1)}% | Mínimo ${requiredPrecision.toFixed(1)}%`,
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
      description: "Novo lote iniciado. Refaça as configurações e a calibração de luz.",
    });
    router.push("/painel/config");
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6 border-b border-border/20">
        <button
          onClick={() => router.push("/painel")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-foreground/80"
        >
          <ArrowLeft className="w-3 h-3" />
          Voltar
        </button>

        <div className="font-display text-[11px] tracking-[0.3em] uppercase text-muted-foreground">
          Análise de Cores
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 md:px-10 py-8">
        <div className="w-full max-w-5xl mx-auto space-y-4">
          <div className="rounded-xl border border-border/30 bg-card/40 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground">ΔE &lt;= {config.deltaE}</span> | Precisão mínima:{" "}
              <span className="text-foreground">{requiredPrecision.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFinishTissue}
                className="px-4 py-2 rounded-full bg-destructive/10 border border-destructive/30 hover:bg-destructive/20 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-destructive"
              >
                Finalizar Tecido
              </button>
              <button
                onClick={handleAnalyze}
                disabled={cameraCapture.isCapturing}
                className="px-4 py-2 rounded-full bg-foreground/10 border border-foreground/30 hover:bg-foreground/15 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cameraCapture.isCapturing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analisando
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <ScanLine className="w-3.5 h-3.5" />
                    Analisar Agora
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
            <CameraPreview
              className="w-full min-h-[55vh] max-h-[75vh]"
              imageClassName="w-full max-h-[75vh] object-contain bg-black"
              fallbackMessage="Não foi possível acessar a câmera."
            />
          </div>

          {result && (
            <div
              className={`rounded-xl border p-4 ${
                result.success
                  ? "border-emerald-600/40 bg-emerald-950/30 text-emerald-200"
                  : "border-rose-600/40 bg-rose-950/30 text-rose-200"
              }`}
            >
              <p className="text-sm font-medium">
                {result.success ? "Sucesso: tecido dentro do padrão de cor." : "Fora do padrão"}
              </p>
              <p className="text-sm mt-1">
                Precisão: <strong>{result.precision.toFixed(1)}%</strong> | Delta E: {result.deltaE.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ColorAnalysis;
