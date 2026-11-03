import { ProtectedRoute } from "@/components/ProtectedRoute";
import ColorAnalysis from "@/views/ColorAnalysis";
import { SystemConfigGuard } from "@/components/SystemConfigGuard";

export default function AnalysisFabricPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <SystemConfigGuard requireReady>
        <ColorAnalysis analysisType="tecido" />
      </SystemConfigGuard>
    </ProtectedRoute>
  );
}
