import { ProtectedRoute } from "@/components/ProtectedRoute";
import CalibrarLuzPage from "@/views/calibrar-luz";

export default function PainelCalibrarLuzPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <CalibrarLuzPage />
    </ProtectedRoute>
  );
}
