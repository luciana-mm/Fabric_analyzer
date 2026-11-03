import { ProtectedRoute } from "@/components/ProtectedRoute";
import Manager from "@/views/Manager";

export default function GestorPage() {
  return (
    <ProtectedRoute requireRole="gestor">
      <Manager />
    </ProtectedRoute>
  );
}