import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Layers,
  Clock,
  TrendingUp,
  User,
  Printer,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export interface Employee {
  id: string;
  name: string;
  role: string;
  verified: number;
  success: number;
  failure: number;
  totalDefects?: number;
  patternedVerified?: number;
  patternedDefects?: number;
  avgTime: string;
  shift: string;
  errorBreakdown: { label: string; percentage: number }[];
  recentAnalyses: {
    id: string;
    type: string;
    result: "ok" | "fail";
    analyzedAt: string;
    defectCount?: number;
    isPatterned?: boolean;
    failureReason?: string | null;
  }[];
}

interface EmployeeDetailsDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export const EmployeeDetailsDialog = ({ employee, open, onOpenChange }: EmployeeDetailsDialogProps) => {
  if (!employee) return null;

  const successRate =
    employee.verified === 0 ? "0.0" : ((employee.success / employee.verified) * 100).toFixed(1);
  const failureRate =
    employee.verified === 0 ? "0.0" : ((employee.failure / employee.verified) * 100).toFixed(1);
  const totalDefects = employee.totalDefects ?? 0;
  const patternedDefects = employee.patternedDefects ?? 0;
  const patternedVerified = employee.patternedVerified ?? 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-report-print
        className="max-w-3xl max-h-[88vh] overflow-y-auto bg-[#0a0c14] text-white border-slate-800"
      >
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
                <User className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <DialogTitle className="font-sansserief tracking-[0.2em] uppercase text-lg text-white">
                  Relatório Individual · {employee.name}
                </DialogTitle>
                <DialogDescription className="text-[11px] tracking-[0.25em] uppercase text-slate-400">
                  {employee.id} · {employee.role} · Turno {employee.shift}
                </DialogDescription>
              </div>
            </div>
            <button
              data-no-print
              type="button"
              onClick={handlePrint}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-300"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Resumo */}
          <section>
            <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-3">
              Indicadores do Operador
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.2em] uppercase mb-1.5">
                  <Layers className="w-3.5 h-3.5" /> Total Verificado
                </div>
                <p className="font-mono-tech text-2xl font-bold text-white">{employee.verified}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {patternedVerified} detalhado(s) · {Math.max(0, employee.verified - patternedVerified)} liso(s)
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/35 bg-amber-500/10">
                <div className="flex items-center gap-2 text-amber-300 text-[10px] tracking-[0.2em] uppercase mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Defeitos (Detalhado)
                </div>
                <p className="font-mono-tech text-2xl font-bold text-amber-300">{patternedDefects}</p>
                <p className="text-xs text-amber-200/75 mt-1">
                  Total geral de falhas: {totalDefects}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.2em] uppercase mb-1.5">
                  <Clock className="w-3.5 h-3.5" /> Tempo Médio
                </div>
                <p className="font-mono-tech text-2xl font-bold text-white">{employee.avgTime}</p>
                <p className="text-xs text-slate-400 mt-1">por tecido analisado</p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 md:col-span-1">
                <div className="flex items-center gap-2 text-emerald-400 text-[10px] tracking-[0.2em] uppercase mb-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprovados
                </div>
                <p className="font-mono-tech text-2xl font-bold text-emerald-400">{employee.success}</p>
                <Progress value={parseFloat(successRate)} className="mt-2 h-1.5 bg-slate-800" />
                <p className="text-xs text-emerald-200/80 mt-1">{successRate}% de aprovação</p>
              </div>

              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 md:col-span-2">
                <div className="flex items-center gap-2 text-rose-400 text-[10px] tracking-[0.2em] uppercase mb-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Lotes Reprovados
                </div>
                <p className="font-mono-tech text-2xl font-bold text-rose-400">{employee.failure}</p>
                <Progress value={parseFloat(failureRate)} className="mt-2 h-1.5 bg-slate-800" />
                <p className="text-xs text-rose-200/80 mt-1">
                  {failureRate}% de rejeição ({totalDefects} defeito(s) físico(s) registrado(s))
                </p>
              </div>
            </div>
          </section>

          {employee.errorBreakdown.length > 0 && (
            <section>
              <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Ocorrências Registradas
              </h3>
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2.5">
                {employee.errorBreakdown.map((err) => (
                  <div key={err.label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-200">{err.label}</span>
                    <span className="font-mono-tech font-semibold text-amber-300">{err.percentage}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Análises Recentes */}
          <section>
            <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-slate-400 mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Análises Recentes
            </h3>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
              {employee.recentAnalyses.length === 0 && (
                <div className="px-4 py-4 text-xs text-slate-500">Sem análises recentes.</div>
              )}
              {employee.recentAnalyses.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs ${
                    i !== employee.recentAnalyses.length - 1 ? "border-b border-slate-800/70" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {a.result === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tech font-semibold text-white">{a.type}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            a.isPatterned
                              ? "bg-amber-500/15 text-amber-300 border border-amber-400/30"
                              : "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30"
                          }`}
                        >
                          {a.isPatterned ? "Detalhado · Anomalib" : "Liso · OpenCV"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono-tech text-[10px] font-semibold ${
                            (a.defectCount ?? 0) > 0
                              ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {a.defectCount ?? 0} defeito(s)
                        </span>
                      </div>
                      {a.failureReason && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{a.failureReason}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono-tech">
                    {formatRelativeTime(a.analyzedAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
