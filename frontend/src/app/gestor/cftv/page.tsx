import { ProtectedRoute } from "@/components/ProtectedRoute";
import ManagerCftv from "@/views/ManagerCftv";

export default function GestorCftvPage() {
  return (
    <ProtectedRoute requireRole="gestor">
      <ManagerCftv />
    </ProtectedRoute>
  );
}
