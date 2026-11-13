"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OperatorShell } from "@/components/OperatorShell";
import { DeltaE } from "@/components/DeltaE";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { getSystemFlowState, type DeltaEValue } from "@/lib/systemConfig";

function ConfigDeltaEContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { config, persistPatch } = useOperatorSystemConfig(user?.id);

  return (
    <OperatorShell
      systemStep={getSystemFlowState(config).systemStep}
      operatorName={user?.email ?? undefined}
      onSignOut={async () => {
        await signOut();
        router.replace("/");
      }}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => router.push("/painel/config")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            Tolerância Delta E
          </h2>
          <p className="text-xs text-stone-500">
            Quanto menor o valor, mais rigorosa a aprovação de cor.
          </p>
        </div>

        <DeltaE
          onBack={() => router.push("/painel/config")}
          initialDelta={config.deltaE as DeltaEValue}
          onSave={async (value) => {
            if (persistPatch) {
              await persistPatch({ deltaE: value, deltaConfigured: true });
            }
            toast.success("Tolerância Delta E salva");
          }}
        />
      </div>
    </OperatorShell>
  );
}

export default function ConfigDeltaEPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ConfigDeltaEContent />
    </ProtectedRoute>
  );
}
