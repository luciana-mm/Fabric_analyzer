import { ProtectedRoute } from "@/components/ProtectedRoute";
import SelectAnalysisType from "@/views/SelectAnalysisType";

export default function AnalysisPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <SelectAnalysisType />
    </ProtectedRoute>
  );
}
