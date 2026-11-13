"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraPreview } from "@/components/CameraPreview";
import { OperatorShell } from "@/components/OperatorShell";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import {
  defaultSystemConfig,
  getStartBlockedDescriptionFromFlow,
  getSystemFlowState,
} from "@/lib/systemConfig";

const StartAnalysis = () => {
  const router = useRouter();
  const { user } = useAuth();
  const {
    config: systemConfig,
    isLoading,
    persistPatch,
    setActiveView,
  } = useOperatorSystemConfig(user?.id);
  const [isFinishing, setIsFinishing] = useState(false);
  const hasShownBlockedToast = useRef(false);
  const hasFinishedAnalysis = useRef(false);

  const isReady = getSystemFlowState(systemConfig).podeIniciar;

  useEffect(() => {
    if (
      isLoading ||
      isReady ||
      hasShownBlockedToast.current ||
      hasFinishedAnalysis.current
    ) {
      return;
    }

    hasShownBlockedToast.current = true;
    toast.error("Pré-requisitos pendentes", {
      description: getStartBlockedDescriptionFromFlow(systemConfig),
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
      <OperatorShell>
        <div className="flex h-64 items-center justify-center rounded-xl border border-stone-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      </OperatorShell>
    );
  }

  return (
    <OperatorShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.push("/painel")}
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                Análise em Andamento
              </h1>
              <p className="text-sm text-stone-500">
                Processo iniciado na bancada de inspeção.
              </p>
            </div>
          </div>

          <button
            onClick={handleFinishAnalysis}
            disabled={isFinishing}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFinishing ? "Finalizando..." : "Finalizar análise"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950 shadow-sm">
          <CameraPreview
            className="relative min-h-[55vh] w-full max-h-[75vh] overflow-hidden bg-stone-950"
            imageClassName="max-h-[75vh] w-full bg-stone-950 object-contain"
            fallbackMessage="O servidor local da câmera não respondeu."
            streamPath={`/stream-analyzed.mjpg?w=${systemConfig.sampleAreaWidthPercent}&h=${systemConfig.sampleAreaHeightPercent}&estampado=${systemConfig.estampado}`}
            overlay={
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Análise em andamento
              </div>
            }
          />
        </div>
      </div>
    </OperatorShell>
  );
};

export default StartAnalysis;
