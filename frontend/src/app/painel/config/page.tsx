import { ProtectedRoute } from "@/components/ProtectedRoute";
import PanelConfiguration from "@/views/PanelConfiguration";

export default function ConfigPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <PanelConfiguration />
    </ProtectedRoute>
  );
}
