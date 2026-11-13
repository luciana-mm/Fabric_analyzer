"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OperatorShell } from "@/components/OperatorShell";
import { ColorCapture } from "@/components/ColorCapture";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { getSystemFlowState } from "@/lib/systemConfig";

function ConfigCaptureColorContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { config, isLoading, persistPatch } = useOperatorSystemConfig(user?.id);

  if (isLoading) {
    return <div className="min-h-screen bg-[#F7F6F3]" />;
  }

  return (
    <OperatorShell
      systemStep={getSystemFlowState(config).systemStep}
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
            onClick={() => router.push("/painel/config")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            {config.estampado ? "Capturar imagens e luz" : "Capturar cor e luz"}
          </h2>
          <p className="text-xs text-stone-500">
            {config.estampado
              ? "Modo estampado: registre a luz ambiente e as imagens de referência do tecido."
              : "Modo liso: registre a luz ambiente e a cor padrão do tecido."}
          </p>
        </div>

        <ColorCapture
          onBack={() => router.push("/painel/config")}
          initialColorHex={config.referenceColorHex}
          initialColorRgb={config.referenceColorRgb}
          initialLightCalibrated={config.ambientLightConfigured}
          initialSampleAreaWidthPercent={config.sampleAreaWidthPercent}
          initialSampleAreaHeightPercent={config.sampleAreaHeightPercent}
          estampado={config.estampado}
          onSave={async (payload) => {
            if (persistPatch) {
              await persistPatch(payload);
            }
            toast.success("Configuração de cor e luz base salva");
          }}
        />
      </div>
    </OperatorShell>
  );
}

export default function ConfigCaptureColorPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ConfigCaptureColorContent />
    </ProtectedRoute>
  );
}
