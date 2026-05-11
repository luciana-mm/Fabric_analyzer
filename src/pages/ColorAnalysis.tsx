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

  const handleAnalyze = async () => {
    if (!config.colorConfigured || !config.lightCalibrated) {
      toast.error("Configuracao incompleta", {
        description: "Defina a cor base e calibre a luz antes de iniciar a analise.",
      });
      return;
    }

    const rgbSample = await cameraCapture.captureRobustSample(5, 200);
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
      reference_code: `ANL-${Date.now()}`,
      tissue_type: "camera_live",
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
    if (!persistPatch) {
      return;
    }

    await persistPatch({
      deltaConfigured: false,
      analysisAreaConfigured: false,
      colorConfigured: false,
      configurationSaved: false,
      lightCalibrated: false,
      systemStep: "CONFIG",
    });

    setResult(null);
    toast.success("Tecido finalizado", {
      description: "Reconfigure o sistema antes de iniciar a nova análise.",
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
          Analise de Cores
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 md:px-10 py-8">
        <div className="w-full max-w-5xl mx-auto space-y-4">
          <div className="rounded-xl border border-border/30 bg-card/40 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              <span className="text-foreground">ΔE &lt;= {config.deltaE}</span> | Precisao minima:{" "}
              <span className="text-foreground">{requiredPrecision.toFixed(1)}%</span>
            </div>
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
            <button
              onClick={handleFinishTissue}
              disabled={cameraCapture.isCapturing}
              className="px-4 py-2 rounded-full border border-destructive text-destructive bg-destructive/10 hover:bg-destructive/15 transition-all font-display text-[10px] tracking-[0.25em] uppercase disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Finalizar Tecido
            </button>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
            <CameraPreview
              className="w-full min-h-[55vh] max-h-[75vh]"
              imageClassName="w-full max-h-[75vh] object-contain bg-black"
              fallbackMessage="Nao foi possivel acessar a camera."
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
                {result.success ? "Sucesso: tecido dentro do padrao de cor." : "fora do padrao"}
              </p>
              <p className="text-sm mt-1">
                Precisao: <strong>{result.precision.toFixed(1)}%</strong> | Delta E: {result.deltaE.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ColorAnalysis;
