import { CheckCircle2, XCircle, Layers, Clock, TrendingUp, User, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export interface Employee {
  id: string;
  name: string;
  role: string;
  verified: number;
  success: number;
  failure: number;
  avgTime: string;
  shift: string;
  errorBreakdown: { label: string; percentage: number }[];
  recentAnalyses: { id: string; type: string; result: "ok" | "fail"; analyzedAt: string }[];
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

  const successRate = employee.verified === 0 ? "0.0" : ((employee.success / employee.verified) * 100).toFixed(1);
  const failureRate = employee.verified === 0 ? "0.0" : ((employee.failure / employee.verified) * 100).toFixed(1);
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-report-print className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-foreground/10 flex items-center justify-center">
              <User className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <DialogTitle className="font-sansserief tracking-[0.2em] uppercase text-lg">
                Detalhes de {employee.name}
              </DialogTitle>
              <DialogDescription className="text-[11px] tracking-[0.25em] uppercase">
                {employee.id} · {employee.role} · Turno {employee.shift}
              </DialogDescription>
            </div>
          </div>
          <button
            data-no-print
            type="button"
            onClick={handlePrint}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-border/40 bg-card/50 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Resumo */}
          <section>
            <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
              Resumo Individual
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] tracking-[0.2em] uppercase mb-2">
                  <Layers className="w-3.5 h-3.5" /> Total Verificado
                </div>
                <p className="font-sansserief text-2xl">{employee.verified}</p>
                <p className="text-xs text-muted-foreground mt-1">na sessão atual</p>
              </div>
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] tracking-[0.2em] uppercase mb-2">
                  <Clock className="w-3.5 h-3.5" /> Tempo Médio
                </div>
                <p className="font-sansserief text-2xl">{employee.avgTime}</p>
                <p className="text-xs text-muted-foreground mt-1">por tecido analisado</p>
              </div>
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-primary text-[10px] tracking-[0.2em] uppercase mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sucessos
                </div>
                <p className="font-sansserief text-2xl text-primary">{employee.success}</p>
                <Progress value={parseFloat(successRate)} className="mt-2 h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{successRate}% de aprovação</p>
              </div>
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-destructive text-[10px] tracking-[0.2em] uppercase mb-2">
                  <XCircle className="w-3.5 h-3.5" /> Falhas
                </div>
                <p className="font-sansserief text-2xl text-destructive">{employee.failure}</p>
                <Progress value={parseFloat(failureRate)} className="mt-2 h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{failureRate}% de rejeição</p>
              </div>
            </div>
          </section>

          {/* Análises Recentes */}
          <section>
            <h3 className="font-sansserief text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Análises Recentes
            </h3>
            <div className="rounded-lg border border-border/40 bg-card/50 overflow-hidden">
              {employee.recentAnalyses.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground">Sem análises recentes.</div>
              )}
              {employee.recentAnalyses.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between px-4 py-3 text-xs ${
                    i !== employee.recentAnalyses.length - 1 ? "border-b border-border/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {a.result === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="font-sansserief tracking-wider text-foreground/80">{a.id}</span>
                    <span className="text-muted-foreground">{a.type}</span>
                  </div>
                  <span className="text-muted-foreground text-[11px]">{formatRelativeTime(a.analyzedAt)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
