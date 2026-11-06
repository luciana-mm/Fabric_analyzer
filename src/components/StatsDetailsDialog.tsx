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
        className="max-w-4xl max-h-[88vh] overflow-y-auto bg-[#0a0c14] text-white border-slate-800"
      >
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <DialogTitle className="font-sansserief tracking-[0.2em] uppercase text-lg text-white">
                Relatório Detalhado de Inspeção
              </DialogTitle>
              <DialogDescription className="text-[11px] tracking-[0.22em] uppercase text-slate-400 mt-1">
                Consolidado de Tecidos Lisos (OpenCV · CIEDE2000) e Tecidos Detalhados (Anomalib · PatchCore)
              </DialogDescription>
            </div>
            <button
              data-no-print
              type="button"
              onClick={handlePrint}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-xs font-medium uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-300"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Resumo Geral */}
          <section>
            <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-3">
              Indicadores Gerais da Estação
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.18em] uppercase mb-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" /> Total Inspecionado
                </div>
                <p className="font-mono-tech text-2xl font-bold text-white">
                  {totalVerified.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {patternedVerified} detalhado(s) · {plainVerified} liso(s)
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10">
                <div className="flex items-center gap-2 text-amber-300 text-[10px] tracking-[0.18em] uppercase mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Defeitos (Tecido Detalhado)
                </div>
                <p className="font-mono-tech text-2xl font-bold text-amber-300">
                  {patternedDefects.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-amber-200/80 mt-1">
                  Em {patternedVerified} lote(s) no Anomalib
                </p>
              </div>

              <div className="p-4 rounded-xl border border-rose-500/35 bg-rose-500/10">
                <div className="flex items-center gap-2 text-rose-300 text-[10px] tracking-[0.18em] uppercase mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Total Geral de Defeitos
                </div>
                <p className="font-mono-tech text-2xl font-bold text-rose-400">
                  {totalDefects.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-rose-200/80 mt-1">
                  { patternedDefects } detalhado(s) + { plainDefects } liso(s)
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.18em] uppercase mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Tempo Médio
                </div>
                <p className="font-mono-tech text-2xl font-bold text-white">{averageTimeLabel}</p>
                <p className="text-[11px] text-slate-400 mt-1">por leitura registrada</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3.5">
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="flex items-center gap-2 text-emerald-300 font-semibold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" /> Lotes / Leituras Aprovados
                  </span>
                  <span className="font-mono-tech text-lg font-bold text-emerald-400">
                    {totalSuccess.toLocaleString("pt-BR")} ({successRate}%)
                  </span>
                </div>
                <Progress value={successRate} className="h-2 bg-slate-800" />
              </div>

              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="flex items-center gap-2 text-rose-300 font-semibold uppercase tracking-wider">
                    <XCircle className="w-4 h-4" /> Lotes / Leituras com Falha
                  </span>
                  <span className="font-mono-tech text-lg font-bold text-rose-400">
                    {totalFailure.toLocaleString("pt-BR")} ({failureRate}%)
                  </span>
                </div>
                <Progress value={failureRate} className="h-2 bg-slate-800" />
              </div>
            </div>
          </section>

          {/* Comparativo Tecido Detalhado vs Tecido Liso */}
          <section className="p-4 rounded-xl border border-slate-800 bg-slate-900/45">
            <h3 className="font-sansserief text-[11px] tracking-[0.25em] uppercase text-cyan-300 mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Resumo por Tipo de Tecido
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-amber-500/25 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-amber-300 uppercase tracking-wider">
                    Tecido Detalhado / Estampado (Anomalib)
                  </p>
                  <p className="text-slate-400 mt-1">
                    Inspeções realizadas: <strong className="text-white">{patternedVerified}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Defeitos Encontrados
                  </span>
                  <span className="font-mono-tech text-xl font-bold text-amber-300">
                    {patternedDefects}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-cyan-500/25 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-cyan-300 uppercase tracking-wider">
                    Tecido Liso (OpenCV + Colorimetria ΔE)
                  </p>
                  <p className="text-slate-400 mt-1">
                    Inspeções realizadas: <strong className="text-white">{plainVerified}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                    Defeitos Físicos
                  </span>
                  <span className="font-mono-tech text-xl font-bold text-cyan-300">
                    {plainDefects}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Causas de Falha */}
          <section>
            <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Detalhamento de Causas de Falha
            </h3>
            <div className="space-y-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              {errorBreakdown.length === 0 && (
                <p className="text-xs text-slate-400">Sem falhas registradas até o momento.</p>
              )}
              {errorBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-200 font-medium">{item.label}</span>
                    <span className="font-mono-tech text-amber-300 font-semibold">
                      {item.count} ocorrência(s) <span className="text-slate-400">· {item.percentage}%</span>
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-1.5 bg-slate-800" />
                </div>
              ))}
            </div>
          </section>

          {/* Análises Recentes */}
          <section>
            <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Últimas Inspeções Registradas
            </h3>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              {recentAnalyses.length === 0 && (
                <div className="px-4 py-4 text-xs text-slate-400">Sem análises recentes.</div>
              )}
              {recentAnalyses.map((a, i) => {
                const defects = a.defectCount ?? 0;
                return (
                  <div
                    key={a.id}
                    className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-xs ${
                      i !== recentAnalyses.length - 1 ? "border-b border-slate-800/70" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {a.result === "ok" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-tech font-bold text-white">{a.type}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              a.isPatterned
                                ? "bg-amber-500/15 text-amber-300 border border-amber-400/35"
                                : "bg-cyan-500/15 text-cyan-300 border border-cyan-400/35"
                            }`}
                          >
                            {a.isPatterned ? "Tecido Detalhado · Anomalib" : "Tecido Liso · OpenCV"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-mono-tech text-[10px] font-semibold ${
                              defects > 0
                                ? "bg-rose-500/15 text-rose-300 border border-rose-500/35"
                                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
                            }`}
                          >
                            {defects} defeito{defects !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {a.failureReason && (
                          <p className="text-[11px] text-slate-400 mt-1">{a.failureReason}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-400 text-[11px] font-mono-tech">
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
