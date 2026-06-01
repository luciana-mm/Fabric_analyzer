import { ProtectedRoute } from "@/components/ProtectedRoute";
import SelectAnalysisType from "@/pages/SelectAnalysisType";

export default function AnalysisPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <SelectAnalysisType />
    </ProtectedRoute>
  );
}
