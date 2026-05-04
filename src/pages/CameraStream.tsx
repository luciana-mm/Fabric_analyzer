"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import gridBg from "@/assets/grid-bg.jpg";
import { CameraPreview } from "@/components/CameraPreview";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { useCameraRobustCapture } from "@/hooks/useCameraRobustCapture";
import { evaluateColorMatch } from "@/utils/calibrationUtils";
import { rgb8BitToNormalized } from "@/utils/colorSpaceConversion";
import { supabase } from "@/integrations/supabase/client";

const CameraStream = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { config } = useOperatorSystemConfig(user?.id);
  const cameraCapture = useCameraRobustCapture();
  const [analysisResult, setAnalysisResult] = useState<{
    deltaE: number;
    approved: boolean;
  } | null>(null);

  const toleranceLabel = useMemo(() => `ΔE <= ${config.deltaE}`, [config.deltaE]);

  const handleAnalyze = async () => {
    if (!user?.id) {
      toast.error("Usuario nao autenticado");
      return;
    }

    if (!config.colorConfigured || !config.lightCalibrated) {
      toast.error("Configuracao incompleta", {
        description: "Defina cor base e calibre a luz antes de analisar.",
      });
      return;
    }

    const startedAt = performance.now();
    const rgbSample = await cameraCapture.captureRobustSample(5, 200);

    if (!rgbSample) {
      toast.error("Falha ao capturar a amostra para analise");
      return;
    }

    const normalizedSample = rgb8BitToNormalized(rgbSample);
    const normalizedReference = {
      r: config.referenceColorRgb.r / 255,
      g: config.referenceColorRgb.g / 255,
      b: config.referenceColorRgb.b / 255,
    };

    const evaluation = evaluateColorMatch(
      normalizedSample,
      normalizedReference,
      config.deltaE,
    );
    const approved = evaluation.matches;
    const processingTimeMs = Math.round(performance.now() - startedAt);
    setAnalysisResult({ deltaE: evaluation.deltaE, approved });

    const failureReason = approved
      ? null
      : `ΔE ${evaluation.deltaE.toFixed(2)} acima da tolerancia ${config.deltaE} (CIEDE2000)`;

    const { error } = await supabase.from("analysis_records").insert({
      operator_user_id: user.id,
      reference_code: `LIVE-${Date.now()}`,
      tissue_type: "camera_live",
      result: approved ? "ok" : "fail",
      failure_reason: failureReason,
      processing_time_ms: processingTimeMs,
    });

    if (error) {
      console.error("Erro ao registrar analise:", error);
      toast.warning("Analise concluida, mas nao foi possivel registrar no historico.");
      return;
    }

    toast.success(approved ? "Tecido aprovado" : "Tecido reprovado", {
      description: `ΔE ${evaluation.deltaE.toFixed(2)} com tolerancia ${config.deltaE} (CIEDE2000)`,
    });
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/painel")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-foreground/80"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar
          </button>

          <div className="hidden md:flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h1 className="font-display text-base tracking-[0.2em] uppercase text-foreground">
                Camera
              </h1>
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Stream em tempo real
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 md:px-10 py-8">
        <div className="w-full max-w-6xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/30 bg-card/40 px-4 py-3">
            <div className="text-xs tracking-wider text-muted-foreground">
              Formula ativa: <span className="text-foreground">CIEDE2000</span> · Tolerancia ativa:{" "}
              <span className="text-foreground">{toleranceLabel}</span>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={cameraCapture.isCapturing}
              className="px-4 py-2 rounded-full bg-foreground/10 border border-foreground/30 hover:bg-foreground/15 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cameraCapture.isCapturing ? "Analisando..." : "Analisar Tecido"}
            </button>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
            <CameraPreview
              className="w-full min-h-[55vh] max-h-[75vh]"
              imageClassName="w-full max-h-[75vh] object-contain bg-black"
              fallbackMessage="O servidor local da camera nao respondeu."
            />
          </div>

          {analysisResult && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                analysisResult.approved
                  ? "border-emerald-600/40 bg-emerald-950/30 text-emerald-200"
                  : "border-rose-600/40 bg-rose-950/30 text-rose-200"
              }`}
            >
              Resultado: <strong>{analysisResult.approved ? "APROVADO" : "REPROVADO"}</strong> · ΔE{" "}
              {analysisResult.deltaE.toFixed(2)} com limite {config.deltaE}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CameraStream;
