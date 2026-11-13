"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { AmbientLightCalibration } from "@/components/AmbientLightCalibration";
import { OperatorShell } from "@/components/OperatorShell";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";

export default function CalibrarLuzPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { config: systemConfig, isLoading, persistPatch } = useOperatorSystemConfig(user?.id);

  if (isLoading) {
    return (
      <OperatorShell>
        <div className="h-64 animate-pulse rounded-xl border border-stone-200 bg-white" />
      </OperatorShell>
    );
  }

  return (
    <OperatorShell>
      <div className="space-y-6">
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
              Calibrar Luz Ambiente
            </h1>
            <p className="text-sm text-stone-500">
              Compare a iluminação atual da bancada com a luz base salva.
            </p>
          </div>
        </div>

        <AmbientLightCalibration
          onBack={() => router.push("/painel")}
          onSave={async (patch) => {
            if (persistPatch) {
              await persistPatch({
                lightCalibrated: patch.lightCalibrated,
                systemStep: patch.lightCalibrated ? "READY" : "LIGHT",
              });
            }
          }}
          referenceHex={systemConfig.ambientLightReferenceHex}
          referenceRgb={systemConfig.ambientLightReferenceRgb}
          hasReferenceConfigured={systemConfig.ambientLightConfigured}
          initialLightCalibrated={systemConfig.lightCalibrated}
          sampleAreaWidthPercent={systemConfig.sampleAreaWidthPercent}
          sampleAreaHeightPercent={systemConfig.sampleAreaHeightPercent}
          mode="compare"
        />
      </div>
    </OperatorShell>
  );
}
