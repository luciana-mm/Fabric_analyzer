import { ProtectedRoute } from "@/components/ProtectedRoute";
import StartAnalysis from "@/views/StartAnalysis";

export default function PainelIniciarPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <StartAnalysis />
    </ProtectedRoute>
  );
}
