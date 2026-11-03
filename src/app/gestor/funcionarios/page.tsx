import { ProtectedRoute } from "@/components/ProtectedRoute";
import ManagerEmployees from "@/views/ManagerEmployees";

export default function GestorFuncionariosPage() {
  return (
    <ProtectedRoute requireRole="gestor">
      <ManagerEmployees />
    </ProtectedRoute>
  );
}
