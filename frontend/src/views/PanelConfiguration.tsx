"use client";

import { useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { OperatorShell } from "@/components/OperatorShell";
import { Configuration } from "@/components/Configuration";
import { runAllTests } from "@/utils/colorConversionTests";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { getSystemFlowState } from "@/lib/systemConfig";

const PanelConfiguration = () => {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { config, isLoading, persistPatch } = useOperatorSystemConfig(user?.id);

  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      runAllTests();
    }
  }, []);

  const systemStep = getSystemFlowState(config).systemStep;

  return (
    <OperatorShell
      systemStep={systemStep}
      operatorName={user?.email ?? undefined}
      onSignOut={async () => {
        await signOut();
        router.replace("/");
      }}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => router.push("/painel")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            Configuração do lote
          </h2>
          <p className="text-xs text-stone-500">
            Complete as três etapas e salve para liberar a calibração de luz.
          </p>
        </div>

        {isLoading ? (
          <div className="min-h-[340px] rounded-xl border border-stone-200 bg-white flex items-center justify-center shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
          </div>
        ) : (
          <Configuration
            initialConfig={config}
            onPersistPatch={persistPatch}
            onClose={() => {
              router.push("/painel");
            }}
          />
        )}
      </div>
    </OperatorShell>
  );
};

export default PanelConfiguration;
