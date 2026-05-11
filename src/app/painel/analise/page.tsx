import { ProtectedRoute } from "@/components/ProtectedRoute";
import ColorAnalysis from "@/pages/ColorAnalysis";

export default function AnalysisPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ColorAnalysis />
    </ProtectedRoute>
  );
}
