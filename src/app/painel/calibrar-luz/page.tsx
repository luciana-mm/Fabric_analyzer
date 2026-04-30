import { ProtectedRoute } from "@/components/ProtectedRoute";
import CalibrarLuzPage from "@/pages/calibrar-luz";

export default function PainelCalibrarLuzPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <CalibrarLuzPage />
    </ProtectedRoute>
  );
}
