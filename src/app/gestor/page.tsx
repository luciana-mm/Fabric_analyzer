import { ProtectedRoute } from "@/components/ProtectedRoute";
import Manager from "@/pages/Manager";

export default function GestorPage() {
  return (
    <ProtectedRoute requireRole="gestor">
      <Manager />
    </ProtectedRoute>
  );
}