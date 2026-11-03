"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BatchHistoryTable } from "@/components/BatchHistoryTable";

export default function HistoricoPage() {
  const router = useRouter();

  return (
    <ProtectedRoute requireRole="gestor">
      <div className="min-h-screen bg-[#050811] text-white">
        <header className="border-b border-white/10 bg-slate-950/60 backdrop-blur-xl px-6 md:px-10 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-400/30 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-sansserief text-lg font-bold tracking-[0.16em] uppercase text-white">
                Histórico e Relatório Detalhado de Lotes
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Consulte inspeções, quantidade de defeitos no tecido detalhado (Anomalib) e métricas de cor (OpenCV)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/gestor")}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao Painel do Gestor
          </button>
        </header>
        <main className="p-6 md:p-10">
          <div className="w-full max-w-7xl mx-auto">
            <BatchHistoryTable />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
