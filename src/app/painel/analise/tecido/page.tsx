import { ProtectedRoute } from "@/components/ProtectedRoute";
import ColorAnalysis from "@/pages/ColorAnalysis";

export default function AnalysisFabricPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ColorAnalysis analysisType="tecido" />
    </ProtectedRoute>
  );
}
