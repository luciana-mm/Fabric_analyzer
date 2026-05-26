"use client";

import { useState } from "react";
import { BarChart3, Calendar, Clock, Layers, Loader2, Printer, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useGlobalReportData, type GlobalReportPeriod } from "@/hooks/useDashboardData";

interface GlobalStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const periodLabels: Record<GlobalReportPeriod, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensal",
  semester: "Semestral",
  yearly: "Anual",
  custom: "Personalizado",
};

export const GlobalStatsDialog = ({ open, onOpenChange }: GlobalStatsDialogProps) => {
  const [period, setPeriod] = useState<GlobalReportPeriod>("daily");
  const [customStartDate, setCustomStartDate] = useState(getDateInputValue(new Date()));
  const [customEndDate, setCustomEndDate] = useState(getDateInputValue(new Date()));
  const customRange = {
    startDate: customStartDate,
    endDate: customEndDate,
  };
  const isCustomRangeInvalid =
    period === "custom" &&
    Boolean(customStartDate) &&
    Boolean(customEndDate) &&
    customEndDate < customStartDate;
  const { stats, isLoading, isError } = useGlobalReportData(period, customRange);
  const successRate = stats.verified === 0 ? "0.0" : ((stats.success / stats.verified) * 100).toFixed(1);
  const failureRate = stats.verified === 0 ? "0.0" : ((stats.failure / stats.verified) * 100).toFixed(1);
  const reportPeriodLabel =
    period === "custom"
      ? `Personalizado: ${customStartDate || "--"} ate ${customEndDate || "--"}`
      : periodLabels[period];
  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-report-print
        className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0a0c14] text-white border-slate-800"
      >
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <DialogTitle className="font-sansserief tracking-[0.2em] uppercase text-lg">
                Relatorio Global de Operacoes
              </DialogTitle>
              <DialogDescription className="text-[11px] tracking-[0.25em] uppercase text-slate-400">
                Consolidado de todos os setores
              </DialogDescription>
              <p className="mt-1 text-xs text-slate-500">
                Periodo: {reportPeriodLabel}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <div data-no-print className="flex flex-wrap items-center gap-3">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as GlobalReportPeriod)}
              className="block w-[170px] bg-slate-900 border border-slate-800 text-slate-300 rounded-lg p-2.5 text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors focus:outline-none focus:border-blue-500 appearance-none bg-[length:12px_12px] bg-[position:right_12px_center] bg-no-repeat pr-8"
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="semester">Semestral</option>
              <option value="yearly">Anual</option>
              <option value="custom">Personalizado</option>
            </select>

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando relatorio...
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || isError || isCustomRangeInvalid}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs font-medium uppercase tracking-wider text-slate-300 transition-colors hover:border-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>

          {period === "custom" && (
            <div data-no-print className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  Data inicial
                </span>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-200 outline-none transition-colors focus:border-blue-500"
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  Data final
                </span>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-200 outline-none transition-colors focus:border-blue-500"
                  />
                </div>
              </label>
            </div>
          )}

          {isCustomRangeInvalid && (
            <p className="text-xs text-rose-300">
              A data final precisa ser igual ou posterior a data inicial.
            </p>
          )}

          {isError && (
            <p className="text-xs text-rose-300">
              Nao foi possivel carregar o relatorio. Verifique as permissoes da tabela analysis_records.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.2em] uppercase mb-2">
                <Layers className="w-3.5 h-3.5" /> Producao Total
              </div>
              <p className="text-2xl font-bold">{stats.verified.toLocaleString("pt-BR")}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2 text-slate-400 text-[10px] tracking-[0.2em] uppercase mb-2">
                <Clock className="w-3.5 h-3.5" /> Ritmo Medio
              </div>
              <p className="text-2xl font-bold">{stats.avgTime}</p>
            </div>
          </div>

          <section className="p-5 rounded-xl border border-slate-800 bg-slate-900/30">
            <h3 className="text-[11px] tracking-[0.3em] uppercase text-slate-500 mb-4 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Eficiencia da Planta
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-emerald-400 uppercase tracking-tighter">Taxa de Aprovacao</span>
                  <span>{successRate}%</span>
                </div>
                <Progress value={Number(successRate)} className="h-2 bg-slate-800 accent-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-rose-400 uppercase tracking-tighter">Taxa de Rejeicao</span>
                  <span>{failureRate}%</span>
                </div>
                <Progress value={Number(failureRate)} className="h-2 bg-slate-800 accent-rose-500" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] tracking-[0.3em] uppercase text-slate-500 mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Funcionarios no Periodo
            </h3>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
              {stats.employeePerformance.length === 0 && (
                <div className="px-4 py-3 text-xs text-slate-500">
                  Nenhum funcionario com producao registrada neste periodo.
                </div>
              )}
              {stats.employeePerformance.length > 0 && (
                <>
                  <div className="grid grid-cols-12 gap-3 border-b border-slate-800 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    <div className="col-span-4">Funcionario</div>
                    <div className="col-span-2">Turno</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-2 text-right">Sucesso</div>
                    <div className="col-span-2 text-right">Falhas</div>
                  </div>
                  {stats.employeePerformance.map((employee) => (
                    <div
                      key={employee.userId}
                      className="grid grid-cols-12 gap-3 border-b border-slate-800/70 px-4 py-3 text-xs last:border-b-0"
                    >
                      <div className="col-span-4 min-w-0">
                        <p className="truncate text-slate-200">{employee.name}</p>
                        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {employee.id} - {employee.role}
                        </p>
                      </div>
                      <div className="col-span-2 text-slate-400">{employee.shift}</div>
                      <div className="col-span-2 text-right font-semibold text-slate-100">{employee.verified}</div>
                      <div className="col-span-2 text-right text-emerald-300">{employee.success}</div>
                      <div className="col-span-2 text-right text-rose-300">{employee.failure}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
};
