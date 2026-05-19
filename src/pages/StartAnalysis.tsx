"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import gridBg from "@/assets/grid-bg.jpg";
import { CameraPreview } from "@/components/CameraPreview";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { defaultSystemConfig, getStartBlockedDescription, getSystemFlowState } from "@/lib/systemConfig";

const StartAnalysis = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { config: systemConfig, isLoading, persistPatch, setActiveView } = useOperatorSystemConfig(user?.id);
  const [isFinishing, setIsFinishing] = useState(false);
  const hasShownBlockedToast = useRef(false);
  const hasFinishedAnalysis = useRef(false);

  const isReady = getSystemFlowState(systemConfig).podeIniciar;

  useEffect(() => {
    if (isLoading || isReady || hasShownBlockedToast.current || hasFinishedAnalysis.current) {
      return;
    }

    hasShownBlockedToast.current = true;
    toast.error("Pré-requisitos pendentes", {
      description: getStartBlockedDescription(systemConfig),
    });
    router.replace("/painel");
  }, [isLoading, isReady, router, systemConfig]);

  useEffect(() => {
    if (!isLoading && isReady) {
      toast.success("Análise iniciada");
    }
  }, [isLoading, isReady]);

  const handleFinishAnalysis = async () => {
    hasFinishedAnalysis.current = true;
    setIsFinishing(true);

    await persistPatch(defaultSystemConfig);
    await setActiveView("home");

    toast.success("Análise finalizada", {
      description: "Configurações limpas para uma nova análise.",
    });
    router.push("/painel/config");
  };

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-sansserief text-[10px] tracking-[0.25em] uppercase text-foreground/80"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar
          </button>

          <div className="hidden md:flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h1 className="font-sansserief text-base tracking-[0.2em] uppercase text-foreground">
                Análise
              </h1>
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Processo iniciado
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 md:px-10 py-8">
        <div className="w-full max-w-6xl mx-auto">
          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
            <CameraPreview
              className="relative w-full min-h-[55vh] max-h-[75vh] overflow-hidden bg-black"
              imageClassName="w-full max-h-[75vh] object-contain bg-black"
              fallbackMessage="O servidor local da camera nao respondeu."
              overlay={
                <div className="absolute left-4 top-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/70 border border-border/30 backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-sansserief text-[10px] tracking-[0.25em] uppercase text-foreground/90">
                    Análise em andamento
                  </span>
                </div>
              }
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button 
            onClick={handleFinishAnalysis}
            disabled={isFinishing}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-sansserief text-[10px] tracking-[0.25em] uppercase text-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed ">
            {isFinishing ? "Finalizando..." : "Finalizar analise"}
          </button>
        </div>
      </main>
    </div>
  );
};

export default StartAnalysis;
