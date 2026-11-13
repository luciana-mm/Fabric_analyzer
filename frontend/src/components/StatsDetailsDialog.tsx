import {
  CheckCircle2,
  XCircle,
  Layers,
  Clock,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Printer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface StatsDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalVerified: number;
  averageTimeLabel: string;
  totalSuccess: number;
  totalFailure: number;
  totalDefects?: number;
  patternedVerified?: number;
  patternedDefects?: number;
  plainVerified?: number;
  plainDefects?: number;
  successRate: number;
  failureRate: number;
  errorBreakdown: Array<{ label: string; count: number; percentage: number }>;
  recentAnalyses: Array<{
    id: string;
    type: string;
    result: "ok" | "fail";
    analyzedAt: string;
    defectCount?: number;
    isPatterned?: boolean;
    failureReason?: string | null;
  }>;
}

const formatRelativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "agora";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} d`;
};

export const StatsDetailsDialog = ({
  open,
  onOpenChange,
  totalVerified,
  averageTimeLabel,
  totalSuccess,
  totalFailure,
  totalDefects = 0,
  patternedVerified = 0,
  patternedDefects = 0,
  plainVerified = 0,
  plainDefects = 0,
  successRate,
  failureRate,
  errorBreakdown,
  recentAnalyses,
}: StatsDetailsDialogProps) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-report-print
        className="max-w-4xl max-h-[88vh] overflow-y-auto border-stone-200 bg-white text-stone-900"
      >
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-semibold text-stone-900">
                Relatório Detalhado de Inspeção
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-stone-500">
                Consolidado de Tecidos Lisos (OpenCV · CIEDE2000) e Tecidos Detalhados (Anomalib · PatchCore)
              </DialogDescription>
            </div>
            <button
              data-no-print
              type="button"
              onClick={handlePrint}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {/* Resumo Geral */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Indicadores Gerais da Estação
            </h3>
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  <Layers className="h-3.5 w-3.5 text-[#B85D3B]" /> Total Inspecionado
                </div>
                <p className="font-mono text-2xl font-bold text-stone-900">
                  {totalVerified.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-[11px] text-stone-500">
                  {patternedVerified} detalhado(s) · {plainVerified} liso(s)
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                  <Sparkles className="h-3.5 w-3.5" /> Defeitos (Tecido Detalhado)
                </div>
                <p className="font-mono text-2xl font-bold text-amber-700">
                  {patternedDefects.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-[11px] text-amber-700/80">
                  Em {patternedVerified} lote(s) no Anomalib
                </p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-rose-800">
                  <AlertTriangle className="h-3.5 w-3.5" /> Total Geral de Defeitos
                </div>
                <p className="font-mono text-2xl font-bold text-rose-700">
                  {totalDefects.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-[11px] text-rose-700/80">
                  {patternedDefects} detalhado(s) + {plainDefects} liso(s)
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  <Clock className="h-3.5 w-3.5 text-stone-600" /> Tempo Médio
                </div>
                <p className="font-mono text-2xl font-bold text-stone-900">{averageTimeLabel}</p>
                <p className="mt-1 text-[11px] text-stone-500">por leitura registrada</p>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-semibold uppercase tracking-wider text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Lotes / Leituras Aprovados
                  </span>
                  <span className="font-mono text-lg font-bold text-emerald-700">
                    {totalSuccess.toLocaleString("pt-BR")} ({successRate}%)
                  </span>
                </div>
                <Progress value={successRate} className="h-2 bg-emerald-100" />
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-semibold uppercase tracking-wider text-rose-800">
                    <XCircle className="h-4 w-4" /> Lotes / Leituras com Falha
                  </span>
                  <span className="font-mono text-lg font-bold text-rose-700">
                    {totalFailure.toLocaleString("pt-BR")} ({failureRate}%)
                  </span>
                </div>
                <Progress value={failureRate} className="h-2 bg-rose-100" />
              </div>
            </div>
          </section>

          {/* Comparativo Tecido Detalhado vs Tecido Liso */}
          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B85D3B]">
              <Sparkles className="h-3.5 w-3.5" /> Resumo por Tipo de Tecido
            </h3>
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3.5">
                <div>
                  <p className="font-semibold uppercase tracking-wider text-amber-800">
                    Tecido Detalhado / Estampado (Anomalib)
                  </p>
                  <p className="mt-1 text-stone-500">
                    Inspeções realizadas: <strong className="text-stone-900">{patternedVerified}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-stone-400">
                    Defeitos Encontrados
                  </span>
                  <span className="font-mono text-xl font-bold text-amber-700">
                    {patternedDefects}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-3.5">
                <div>
                  <p className="font-semibold uppercase tracking-wider text-stone-800">
                    Tecido Liso (OpenCV + Colorimetria ΔE)
                  </p>
                  <p className="mt-1 text-stone-500">
                    Inspeções realizadas: <strong className="text-stone-900">{plainVerified}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-stone-400">
                    Defeitos Físicos
                  </span>
                  <span className="font-mono text-xl font-bold text-[#B85D3B]">
                    {plainDefects}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Causas de Falha */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Detalhamento de Causas de Falha
            </h3>
            <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              {errorBreakdown.length === 0 && (
                <p className="text-xs text-stone-500">Sem falhas registradas até o momento.</p>
              )}
              {errorBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-medium text-stone-800">{item.label}</span>
                    <span className="font-mono font-semibold text-amber-700">
                      {item.count} ocorrência(s) <span className="text-stone-500">· {item.percentage}%</span>
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-1.5 bg-stone-200" />
                </div>
              ))}
            </div>
          </section>

          {/* Análises Recentes */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <TrendingUp className="h-3.5 w-3.5 text-[#B85D3B]" /> Últimas Inspeções Registradas
            </h3>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {recentAnalyses.length === 0 && (
                <div className="px-4 py-4 text-xs text-stone-500">Sem análises recentes.</div>
              )}
              {recentAnalyses.map((a, i) => {
                const defects = a.defectCount ?? 0;
                return (
                  <div
                    key={a.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-xs ${
                      i !== recentAnalyses.length - 1 ? "border-b border-stone-100" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {a.result === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-stone-900">{a.type}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              a.isPatterned
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-orange-200 bg-orange-50 text-[#B85D3B]"
                            }`}
                          >
                            {a.isPatterned ? "Tecido Detalhado · Anomalib" : "Tecido Liso · OpenCV"}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                              defects > 0
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {defects} defeito{defects !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {a.failureReason && (
                          <p className="mt-1 text-[11px] text-stone-500">{a.failureReason}</p>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-stone-400">
                      {formatRelativeTime(a.analyzedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
