"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ManagerShell } from "@/components/ManagerShell";
import { BatchHistoryTable } from "@/components/BatchHistoryTable";

export default function HistoricoPage() {
  const router = useRouter();

  return (
    <ProtectedRoute requireRole="gestor">
      <ManagerShell>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => router.push("/gestor")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Histórico de lotes
            </h2>
            <p className="text-xs text-stone-500">
              Todos os lotes inspecionados, com métricas de defeitos e ΔE.
            </p>
          </div>

          <BatchHistoryTable />
        </div>
      </ManagerShell>
    </ProtectedRoute>
  );
}
