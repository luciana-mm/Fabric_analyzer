import { ProtectedRoute } from "@/components/ProtectedRoute";
import PanelConfiguration from "@/pages/PanelConfiguration";

export default function ConfigPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <PanelConfiguration />
    </ProtectedRoute>
  );
}
