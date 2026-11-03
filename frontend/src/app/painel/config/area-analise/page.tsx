"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AnalysisArea } from "@/components/AnalysisArea";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import type { SamplePointsValue } from "@/lib/systemConfig";

function ConfigAnalysisAreaContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { config, isLoading, persistPatch } = useOperatorSystemConfig(user?.id);

  if (isLoading) {
    return <div className="min-h-screen bg-[#050811]" />;
  }

  return (
    <AnalysisArea
      onBack={() => {
        router.push("/painel/config");
      }}
      onSave={async ({ samplePoints, sampleAreaWidthPercent, sampleAreaHeightPercent, estampado }) => {
        if (persistPatch) {
          await persistPatch({
            samplePoints,
            sampleAreaWidthPercent,
            sampleAreaHeightPercent,
            estampado,
            analysisAreaConfigured: true,
          });
        }
        toast.success("Área de análise salva");
      }}
      initialWidth={config.sampleAreaWidthPercent}
      initialHeight={config.sampleAreaHeightPercent}
      initialPoints={config.samplePoints as SamplePointsValue}
      initialEstampado={config.estampado}
    />
  );
}

export default function ConfigAnalysisAreaPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ConfigAnalysisAreaContent />
    </ProtectedRoute>
  );
}
