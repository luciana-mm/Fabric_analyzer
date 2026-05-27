import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BatchHistoryTable } from "@/components/BatchHistoryTable";

export default function HistoricoPage() {
  return (
    <ProtectedRoute requireRole="gestor">
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/20 px-10 py-6">
          <h1 className="font-sansserief text-2xl tracking-[0.15em] uppercase">
            Histórico de Análises
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Consulte e filtre todas as análises realizadas por lote
          </p>
        </header>
        <main className="p-10">
          <div className="w-full max-w-7xl mx-auto">
            <BatchHistoryTable />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
