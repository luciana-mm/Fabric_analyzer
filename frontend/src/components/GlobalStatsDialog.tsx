"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Clock,
  Layers,
  Loader2,
  Printer,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useGlobalReportData, type GlobalReportPeriod } from "@/hooks/useDashboardData";

interface GlobalStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const periodLabels: Record<GlobalReportPeriod, string> = {
  daily: "Diário",
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
      ? `Personalizado: ${customStartDate || "--"} até ${customEndDate || "--"}`
      : periodLabels[period];
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
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-200 bg-orange-50">
              <BarChart3 className="h-6 w-6 text-[#B85D3B]" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-stone-900">
                Relatório Global de Operações
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Consolidado de Qualidade · Tecidos Lisos (OpenCV) e Detalhados (Anomalib)
              </DialogDescription>
              <p className="mt-1 text-xs text-stone-500">Período: {reportPeriodLabel}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          <div data-no-print className="flex flex-wrap items-center gap-3">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as GlobalReportPeriod)}
              className="block w-[170px] cursor-pointer rounded-lg border border-stone-200 bg-white p-2.5 text-xs font-medium uppercase tracking-wider text-stone-700 transition-colors focus:border-[#B85D3B] focus:outline-none"
            >
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
              <option value="semester">Semestral</option>
              <option value="yearly">Anual</option>
              <option value="custom">Personalizado</option>
            </select>

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando relatório...
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || isError || isCustomRangeInvalid}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>

          {period === "custom" && (
            <div data-no-print className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  Data inicial
                </span>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-stone-200 bg-white py-2 pl-10 pr-3 text-sm text-stone-900 outline-none transition-colors focus:border-[#B85D3B]"
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="block text-[10px] font-medium uppercase tracking-wider text-stone-500">
                  Data final
                </span>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-stone-200 bg-white py-2 pl-10 pr-3 text-sm text-stone-900 outline-none transition-colors focus:border-[#B85D3B]"
                  />
                </div>
              </label>
            </div>
          )}

          {isCustomRangeInvalid && (
            <p className="text-xs text-rose-600">
              A data final precisa ser igual ou posterior à data inicial.
            </p>
          )}

          {isError && (
            <p className="text-xs text-rose-600">
              Não foi possível carregar o relatório. Verifique as permissões da tabela analysis_records.
            </p>
          )}

          {/* Indicadores Principais */}
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                <Layers className="h-3.5 w-3.5" /> Produção Total
              </div>
              <p className="font-mono text-2xl font-bold text-stone-900">{stats.verified.toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-[11px] text-stone-500">
                {stats.patternedVerified} detalhado(s) · {stats.plainVerified} liso(s)
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                <Sparkles className="h-3.5 w-3.5" /> Defeitos (Detalhado)
              </div>
              <p className="font-mono text-2xl font-bold text-amber-700">
                {stats.patternedDefects.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-[11px] text-amber-700/80">
                Detectados pelo Anomalib
              </p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-rose-800">
                <AlertTriangle className="h-3.5 w-3.5" /> Total de Defeitos
              </div>
              <p className="font-mono text-2xl font-bold text-rose-700">
                {stats.totalDefects.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-[11px] text-rose-700/80">
                Soma de falhas físicas nos lotes
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-stone-500">
                <Clock className="h-3.5 w-3.5" /> Ritmo Médio
              </div>
              <p className="font-mono text-2xl font-bold text-stone-900">{stats.avgTime}</p>
              <p className="mt-1 text-[11px] text-stone-500">Por leitura registrada</p>
            </div>
          </div>

          <section className="rounded-xl border border-stone-200 bg-stone-50 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-600">
              <TrendingUp className="h-3.5 w-3.5 text-[#B85D3B]" /> Eficiência da Planta
            </h3>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="font-medium uppercase tracking-tight text-emerald-700">
                    Taxa de Aprovação ({stats.success} ok)
                  </span>
                  <span className="font-mono font-semibold text-stone-900">{successRate}%</span>
                </div>
                <Progress value={Number(successRate)} className="h-2 bg-stone-200" />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="font-medium uppercase tracking-tight text-rose-700">
                    Taxa de Rejeição ({stats.failure} reprovados)
                  </span>
                  <span className="font-mono font-semibold text-stone-900">{failureRate}%</span>
                </div>
                <Progress value={Number(failureRate)} className="h-2 bg-stone-200" />
              </div>
            </div>
          </section>

          {stats.errorBreakdown.length > 0 && (
            <section className="rounded-xl border border-stone-200 bg-stone-50 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-600">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Principais Ocorrências / Motivos de Falha
              </h3>
              <div className="space-y-2.5">
                {stats.errorBreakdown.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-stone-700">{item.label}</span>
                      <span className="font-mono font-semibold text-amber-700">{item.percentage}%</span>
                    </div>
                    <Progress value={item.percentage} className="h-1.5 bg-stone-200" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-600">
              <Layers className="h-3.5 w-3.5 text-[#B85D3B]" /> Desempenho por Operador no Período
            </h3>
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
              {stats.employeePerformance.length === 0 && (
                <div className="px-4 py-3 text-xs text-stone-500">
                  Nenhum funcionário com produção registrada neste período.
                </div>
              )}
              {stats.employeePerformance.length > 0 && (
                <>
                  <div className="grid grid-cols-12 gap-2 border-b border-stone-200 bg-stone-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    <div className="col-span-4">Funcionário</div>
                    <div className="col-span-2">Turno</div>
                    <div className="col-span-1 text-right">Total</div>
                    <div className="col-span-1 text-right">Aprov.</div>
                    <div className="col-span-2 text-right">Reprov.</div>
                    <div className="col-span-2 text-right">Defeitos (Detalhado)</div>
                  </div>
                  {stats.employeePerformance.map((employee) => (
                    <div
                      key={employee.userId}
                      className="grid grid-cols-12 items-center gap-2 border-b border-stone-100 px-4 py-3 text-xs last:border-b-0"
                    >
                      <div className="col-span-4 min-w-0">
                        <p className="truncate font-medium text-stone-900">{employee.name}</p>
                        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-stone-500">
                          {employee.id} - {employee.role}
                        </p>
                      </div>
                      <div className="col-span-2 text-stone-500">{employee.shift}</div>
                      <div className="col-span-1 text-right font-mono font-semibold text-stone-900">
                        {employee.verified}
                      </div>
                      <div className="col-span-1 text-right font-mono text-emerald-700">
                        {employee.success}
                      </div>
                      <div className="col-span-2 text-right font-mono text-rose-700">
                        {employee.failure}
                      </div>
                      <div className="col-span-2 text-right font-mono font-semibold text-amber-700">
                        {employee.totalDefects} ({employee.patternedDefects} det.)
                      </div>
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
