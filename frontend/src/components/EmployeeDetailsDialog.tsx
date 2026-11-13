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
        className="max-w-3xl max-h-[88vh] overflow-y-auto border-stone-200 bg-white text-stone-900"
      >
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-orange-200 bg-orange-50">
                <User className="h-6 w-6 text-[#B85D3B]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-stone-900">
                  Relatório Individual · {employee.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-stone-500">
                  {employee.id} · {employee.role} · Turno {employee.shift}
                </DialogDescription>
              </div>
            </div>
            <button
              data-no-print
              type="button"
              onClick={handlePrint}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {/* Resumo */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Indicadores do Operador
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  <Layers className="h-3.5 w-3.5" /> Total Verificado
                </div>
                <p className="font-mono text-2xl font-bold text-stone-900">{employee.verified}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {patternedVerified} detalhado(s) · {Math.max(0, employee.verified - patternedVerified)} liso(s)
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                  <Sparkles className="h-3.5 w-3.5" /> Defeitos (Detalhado)
                </div>
                <p className="font-mono text-2xl font-bold text-amber-700">{patternedDefects}</p>
                <p className="mt-1 text-xs text-amber-700/80">
                  Total geral de falhas: {totalDefects}
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  <Clock className="h-3.5 w-3.5" /> Tempo Médio
                </div>
                <p className="font-mono text-2xl font-bold text-stone-900">{employee.avgTime}</p>
                <p className="mt-1 text-xs text-stone-500">por tecido analisado</p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 md:col-span-1">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprovados
                </div>
                <p className="font-mono text-2xl font-bold text-emerald-700">{employee.success}</p>
                <Progress value={parseFloat(successRate)} className="mt-2 h-1.5 bg-emerald-100" />
                <p className="mt-1 text-xs text-emerald-700/80">{successRate}% de aprovação</p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 md:col-span-2">
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-rose-800">
                  <XCircle className="h-3.5 w-3.5" /> Lotes Reprovados
                </div>
                <p className="font-mono text-2xl font-bold text-rose-700">{employee.failure}</p>
                <Progress value={parseFloat(failureRate)} className="mt-2 h-1.5 bg-rose-100" />
                <p className="mt-1 text-xs text-rose-700/80">
                  {failureRate}% de rejeição ({totalDefects} defeito(s) físico(s) registrado(s))
                </p>
              </div>
            </div>
          </section>

          {employee.errorBreakdown.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Ocorrências Registradas
              </h3>
              <div className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50 p-4">
                {employee.errorBreakdown.map((err) => (
                  <div key={err.label} className="flex items-center justify-between text-xs">
                    <span className="text-stone-700">{err.label}</span>
                    <span className="font-mono font-semibold text-amber-700">{err.percentage}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Análises Recentes */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <TrendingUp className="h-3.5 w-3.5 text-[#B85D3B]" /> Análises Recentes
            </h3>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {employee.recentAnalyses.length === 0 && (
                <div className="px-4 py-4 text-xs text-stone-500">Sem análises recentes.</div>
              )}
              {employee.recentAnalyses.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs ${
                    i !== employee.recentAnalyses.length - 1 ? "border-b border-stone-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {a.result === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-stone-900">{a.type}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            a.isPatterned
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-orange-200 bg-orange-50 text-[#B85D3B]"
                          }`}
                        >
                          {a.isPatterned ? "Detalhado · Anomalib" : "Liso · OpenCV"}
                        </span>
                        <span
                          className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                            (a.defectCount ?? 0) > 0
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {a.defectCount ?? 0} defeito(s)
                        </span>
                      </div>
                      {a.failureReason && (
                        <p className="mt-0.5 text-[11px] text-stone-500">{a.failureReason}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-stone-400">
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
