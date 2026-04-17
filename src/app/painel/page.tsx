import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "@/pages/Index";

export default function PainelPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <Index />
    </ProtectedRoute>
  );
}