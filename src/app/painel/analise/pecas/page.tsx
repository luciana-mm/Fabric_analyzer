import { ProtectedRoute } from "@/components/ProtectedRoute";
import ColorAnalysis from "@/pages/ColorAnalysis";
import { SystemConfigGuard } from "@/components/SystemConfigGuard";

export default function AnalysisItemsPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <SystemConfigGuard requireReady>
        <ColorAnalysis analysisType="pecas" />
      </SystemConfigGuard>
    </ProtectedRoute>
  );
}
