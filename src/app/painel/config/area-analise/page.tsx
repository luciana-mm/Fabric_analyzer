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
  const { config, persistPatch } = useOperatorSystemConfig(user?.id);

  return (
    <AnalysisArea
      onBack={() => {
        router.push("/painel/config");
      }}
      onSave={async ({ samplePoints, sampleAreaWidthPercent, sampleAreaHeightPercent }) => {
        if (persistPatch) {
          await persistPatch({
            samplePoints,
            sampleAreaWidthPercent,
            sampleAreaHeightPercent,
            analysisAreaConfigured: true,
          });
        }
        toast.success("Area de analise salva");
      }}
      initialWidth={config.sampleAreaWidthPercent}
      initialHeight={config.sampleAreaHeightPercent}
      initialPoints={config.samplePoints as SamplePointsValue}
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
