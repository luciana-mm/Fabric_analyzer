import { ProtectedRoute } from "@/components/ProtectedRoute";
import ColorAnalysis from "@/pages/ColorAnalysis";

export default function AnalysisItemsPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ColorAnalysis analysisType="pecas" />
    </ProtectedRoute>
  );
}
