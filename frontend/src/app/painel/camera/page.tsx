import { ProtectedRoute } from "@/components/ProtectedRoute";
import CameraStream from "@/views/CameraStream";

export default function CameraPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <CameraStream />
    </ProtectedRoute>
  );
}
