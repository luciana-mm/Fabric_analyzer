import { CheckCircle2, XCircle, Layers, Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface StatsDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalVerified: number;
  averageTimeLabel: string;
  totalSuccess: number;
  totalFailure: number;
  successRate: number;
  failureRate: number;
  errorBreakdown: Array<{ label: string; count: number; percentage: number }>;
  recentAnalyses: Array<{ id: string; type: string; result: "ok" | "fail"; analyzedAt: string }>;
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
  successRate,
  failureRate,
  errorBreakdown,
  recentAnalyses,
}: StatsDetailsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-[0.2em] uppercase text-lg">
            Detalhes das Estatísticas
          </DialogTitle>
          <DialogDescription className="text-[11px] tracking-[0.25em] uppercase">
            Análise completa da sessão atual
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Resumo */}
          <section>
            <h3 className="font-display text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
              Resumo Geral
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] tracking-[0.2em] uppercase mb-2">
                  <Layers className="w-3.5 h-3.5" /> Total Verificado
                </div>
                <p className="font-display text-2xl">{totalVerified.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground mt-1">desde o início da sessão</p>
              </div>
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] tracking-[0.2em] uppercase mb-2">
                  <Clock className="w-3.5 h-3.5" /> Tempo Médio
                </div>
                <p className="font-display text-2xl">{averageTimeLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">por tecido analisado</p>
              </div>
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-primary text-[10px] tracking-[0.2em] uppercase mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Sucessos
                </div>
                <p className="font-display text-2xl text-primary">{totalSuccess.toLocaleString("pt-BR")}</p>
                <Progress value={successRate} className="mt-2 h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{successRate}% de aprovação</p>
              </div>
              <div className="p-4 rounded-lg border border-border/40 bg-card/50">
                <div className="flex items-center gap-2 text-destructive text-[10px] tracking-[0.2em] uppercase mb-2">
                  <XCircle className="w-3.5 h-3.5" /> Falhas
                </div>
                <p className="font-display text-2xl text-destructive">{totalFailure.toLocaleString("pt-BR")}</p>
                <Progress value={failureRate} className="mt-2 h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{failureRate}% de rejeição</p>
              </div>
            </div>
          </section>

          {/* Causas de Erro */}
          <section>
            <h3 className="font-display text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" /> Causas de Falha
            </h3>
            <div className="space-y-3 p-4 rounded-lg border border-border/40 bg-card/50">
              {errorBreakdown.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem falhas registradas.</p>
              )}
              {errorBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-foreground/80">{item.label}</span>
                    <span className="font-display tracking-wider text-muted-foreground">
                      {item.count} <span className="text-foreground/50">· {item.percentage}%</span>
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-1" />
                </div>
              ))}
            </div>
          </section>

          {/* Análises Recentes */}
          <section>
            <h3 className="font-display text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Análises Recentes
            </h3>
            <div className="rounded-lg border border-border/40 bg-card/50 overflow-hidden">
              {recentAnalyses.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground">Sem análises recentes.</div>
              )}
              {recentAnalyses.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between px-4 py-3 text-xs ${
                    i !== recentAnalyses.length - 1 ? "border-b border-border/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {a.result === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="font-display tracking-wider text-foreground/80">{a.id}</span>
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
