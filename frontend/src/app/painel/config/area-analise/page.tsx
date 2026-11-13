"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OperatorShell } from "@/components/OperatorShell";
import { AnalysisArea } from "@/components/AnalysisArea";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { getSystemFlowState, type SamplePointsValue } from "@/lib/systemConfig";

function ConfigAnalysisAreaContent() {
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
        initialEstampado={Boolean(config.estampado)}
      />
    </OperatorShell>
  );
}

export default function ConfigAnalysisAreaPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ConfigAnalysisAreaContent />
    </ProtectedRoute>
  );
}
