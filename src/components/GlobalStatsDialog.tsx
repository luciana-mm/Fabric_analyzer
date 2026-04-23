import { CheckCircle2, XCircle, Layers, Clock, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// Seus mocks prontos
const errorBreakdown = [
  { label: "Falha de iluminação", percentage: 38.2 },
  { label: "Tecido fora de posição", percentage: 29.7 },
  { label: "Padrão não reconhecido", percentage: 19.4 },
  { label: "Outros", percentage: 12.7 },
];

interface GlobalStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totals: {
    verified: number;
    success: number;
    failure: number;
    avgTime: string;
  };
}

export const GlobalStatsDialog = ({ open, onOpenChange, totals }: GlobalStatsDialogProps) => {
  const successRate = ((totals.success / totals.verified) * 100).toFixed(1);
  const failureRate = ((totals.failure / totals.verified) * 100).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0a0c14] text-white border-slate-800">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="font-display tracking-[0.2em] uppercase text-lg">
                Relatório Global de Operações
              </DialogTitle>
              <DialogDescription className="text-[11px] tracking-[0.25em] uppercase text-slate-400">
                Consolidado de todos os setores · TissueScope Pro
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Grid de Resumo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.2em] uppercase mb-2">
                <Layers className="w-3.5 h-3.5" /> Produção Total
              </div>
              <p className="text-2xl font-bold">{totals.verified.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.2em] uppercase mb-2">
                <Clock className="w-3.5 h-3.5" /> Ritmo Médio
              </div>
              <p className="text-2xl font-bold">{totals.avgTime}</p>
            </div>
          </div>

          {/* Seção de Performance com os Mocks */}
          <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/30">
             <h3 className="text-[11px] tracking-[0.3em] uppercase text-slate-500 mb-4 flex items-center gap-2">
               <TrendingUp className="w-3.5 h-3.5" /> Eficiência da Planta
             </h3>
             <div className="space-y-4">
                <div>
                   <div className="flex justify-between text-xs mb-2">
                      <span className="text-emerald-400 uppercase tracking-tighter">Taxa de Aprovação</span>
                      <span>{successRate}%</span>
                   </div>
                   <Progress value={Number(successRate)} className="h-2 bg-slate-800 accent-emerald-500" />
                </div>
                <div>
                   <div className="flex justify-between text-xs mb-2">
                      <span className="text-rose-400 uppercase tracking-tighter">Taxa de Rejeição</span>
                      <span>{failureRate}%</span>
                   </div>
                   <Progress value={Number(failureRate)} className="h-2 bg-slate-800 accent-rose-500" />
                </div>
             </div>
          </section>

          {/* O seu Mock Pronto de Causas de Erro */}
          <section>
            <h3 className="text-[11px] tracking-[0.3em] uppercase text-slate-500 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" /> Distribuição de Erros (Geral)
            </h3>
            <div className="space-y-4 p-4 rounded-lg border border-slate-800 bg-slate-900/50">
              {errorBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-slate-500">{item.percentage}%</span>
                  </div>
                  <Progress value={item.percentage} className="h-1 bg-slate-800" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};