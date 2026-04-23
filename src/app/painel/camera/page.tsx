import { ProtectedRoute } from "@/components/ProtectedRoute";
import CameraStream from "@/pages/CameraStream";

export default function CameraPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <CameraStream />
    </ProtectedRoute>
  );
}
