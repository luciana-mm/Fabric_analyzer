"use client";

import { useState } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  TrendingUp,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmployeeDetailsDialog } from "@/components/EmployeeDetailsDialog";
import { GlobalStatsDialog } from "@/components/GlobalStatsDialog";
import { ManagerShell } from "@/components/ManagerShell";
import { useManagerDashboardData } from "@/hooks/useDashboardData";
import type { ManagerEmployeeRow, ManagerPerformancePeriod } from "@/hooks/useDashboardData";

interface OverviewCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "success" | "danger";
}

const performancePeriodLabels: Record<ManagerPerformancePeriod, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  semester: "Semestral",
  yearly: "Anual",
};

const OverviewCard = ({ icon: Icon, label, value, sublabel, accent = "default" }: OverviewCardProps) => {
  const styles = {
    default: {
      iconBox: "bg-stone-100 text-stone-600",
      valueText: "text-stone-900",
    },
    success: {
      iconBox: "bg-emerald-50 text-emerald-600",
      valueText: "text-stone-900",
    },
    danger: {
      iconBox: "bg-rose-50 text-rose-600",
      valueText: "text-stone-900",
    },
  }[accent];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBox}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className={`mt-2.5 font-mono-tech text-2xl font-bold tracking-tight ${styles.valueText}`}>
        {value}
      </p>
      {sublabel && <p className="mt-1 text-xs text-stone-400">{sublabel}</p>}
    </div>
  );
};

const Manager = () => {
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<ManagerEmployeeRow | null>(null);
  const [isEmployeeDetailsOpen, setIsEmployeeDetailsOpen] = useState(false);
  const [isGlobalStatsOpen, setIsGlobalStatsOpen] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState<ManagerPerformancePeriod>("daily");
  const { employees, dailyStats, loading, isError } = useManagerDashboardData({ period: performancePeriod });
  const router = useRouter();

  const handleOpenEmployeeDetails = (employee: ManagerEmployeeRow) => {
    setSelectedEmployee(employee);
    setIsEmployeeDetailsOpen(true);
  };

  const successRate = dailyStats.successRate.toFixed(1);
  const failureRate = dailyStats.failureRate.toFixed(1);
  const employeesWithPerformance = employees.filter((employee) => employee.verified > 0);

  const highestVolume = employeesWithPerformance[0] ?? null;
  const bestRate =
    employeesWithPerformance.length === 0
      ? null
      : [...employeesWithPerformance].sort(
          (a, b) => b.success / Math.max(1, b.verified) - a.success / Math.max(1, a.verified),
        )[0];
  const fastest =
    employeesWithPerformance.length === 0
      ? null
      : [...employeesWithPerformance].sort((a, b) => a.avgTimeMs - b.avgTimeMs)[0];

  const filtered = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(search.toLowerCase()) ||
      employee.id.toLowerCase().includes(search.toLowerCase()),
  );
  const previewEmployees = filtered.slice(0, 5);
  const noPerformanceInPeriod =
    !loading && filtered.length > 0 && filtered.every((employee) => employee.verified === 0);
  const periodLabel = performancePeriodLabels[performancePeriod];

  return (
    <ManagerShell>
      <div className="w-full max-w-6xl mx-auto space-y-8">
        {/* Indicadores do Dia */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Indicadores do Dia
            </h2>
            <button
              type="button"
              onClick={() => setIsGlobalStatsOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 shadow-sm transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
              Estatísticas Globais
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              icon={Users}
              label="Operadores ativos"
              value={String(dailyStats.activeEmployeesToday)}
              sublabel="Em turno hoje"
            />
            <OverviewCard
              icon={Layers}
              label="Tecidos verificados"
              value={dailyStats.totalVerified.toLocaleString("pt-BR")}
              sublabel="Volume inspecionado"
            />
            <OverviewCard
              icon={CheckCircle2}
              label="Taxa de aprovação"
              value={`${successRate}%`}
              sublabel={`${dailyStats.totalSuccess} ok`}
              accent="success"
            />
            <OverviewCard
              icon={XCircle}
              label="Taxa de rejeição"
              value={`${failureRate}%`}
              sublabel={`${dailyStats.totalFailure} falhas`}
              accent="danger"
            />
          </div>

          {isError && (
            <p className="text-xs text-rose-600">
              Não foi possível carregar os dados do gestor. Verifique a conexão com o banco.
            </p>
          )}
        </section>

        {/* Desempenho por Operador */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Desempenho por Operador
          </h2>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-stone-200 bg-white p-1 shadow-sm">
                {(Object.keys(performancePeriodLabels) as ManagerPerformancePeriod[]).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setPerformancePeriod(period)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      performancePeriod === period
                        ? "bg-stone-900 text-white"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {performancePeriodLabels[period]}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar operador..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 pl-8 pr-3 rounded-lg border border-stone-200 bg-white text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 w-44"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/gestor/funcionarios")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-stone-500" />
                Gerenciar Equipe
              </button>
              <button
                type="button"
                onClick={() => router.push("/gestor/cftv")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors"
              >
                <Video className="w-3.5 h-3.5 text-stone-500" />
                CFTV &amp; Câmeras
              </button>
              <button
                type="button"
                onClick={() => router.push("/gestor/historico")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
                Histórico de Lotes
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-stone-200 bg-stone-50/70 text-xs font-medium text-stone-500">
              <div className="col-span-4">Operador</div>
              <div className="col-span-2">Turno</div>
              <div className="col-span-2 text-right">Verificados</div>
              <div className="col-span-2 text-right">Aprovação</div>
              <div className="col-span-1 text-right">Falhas</div>
              <div className="col-span-1 text-right">Ficha</div>
            </div>

            {previewEmployees.length === 0 || noPerformanceInPeriod ? (
              <div className="px-6 py-10 text-center text-xs text-stone-500">
                {loading
                  ? "Carregando operadores..."
                  : noPerformanceInPeriod
                  ? `Nenhum operador ativo com leituras registradas no período ${periodLabel.toLowerCase()}.`
                  : "Nenhum operador ativo encontrado."}
              </div>
            ) : (
              previewEmployees.map((employee, index) => {
                const rate =
                  employee.verified === 0 ? "0.0" : ((employee.success / employee.verified) * 100).toFixed(0);

                return (
                  <div
                    key={employee.id}
                    onClick={() => handleOpenEmployeeDetails(employee)}
                    className={`grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-stone-50 transition-colors cursor-pointer ${
                      index !== previewEmployees.length - 1 ? "border-b border-stone-100" : ""
                    }`}
                  >
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-xs font-semibold text-[#B85D3B] shrink-0">
                        {employee.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{employee.name}</p>
                        <p className="text-xs text-stone-500 truncate">{employee.role}</p>
                      </div>
                    </div>
                    <div className="col-span-2 text-xs text-stone-600">{employee.shift}</div>
                    <div className="col-span-2 text-right font-mono-tech text-sm font-semibold text-stone-900">
                      {employee.verified}
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 font-mono-tech text-xs font-medium text-emerald-700">
                        {employee.success} · {rate}%
                      </span>
                    </div>
                    <div className="col-span-1 text-right font-mono-tech text-sm font-medium text-rose-600">
                      {employee.failure}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenEmployeeDetails(employee);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900"
                        aria-label={`Ver detalhes de ${employee.name}`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Ver
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Destaques da Equipe */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Destaques da Equipe · {periodLabel}
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Maior Volume
                </p>
                <p className="text-sm font-semibold text-stone-900 truncate">
                  {highestVolume?.name ?? "Sem dados"}
                </p>
                <p className="font-mono-tech text-xs text-stone-500">
                  {highestVolume ? `${highestVolume.verified} verificados` : "Aguardando dados"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Melhor Taxa de Qualidade
                </p>
                <p className="text-sm font-semibold text-stone-900 truncate">
                  {bestRate?.name ?? "Sem dados"}
                </p>
                <p className="font-mono-tech text-xs text-stone-500">
                  {bestRate
                    ? `${((bestRate.success / Math.max(1, bestRate.verified)) * 100).toFixed(0)}% de aprovação`
                    : "Aguardando dados"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-stone-800 text-white flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Menor Tempo de Inspeção
                </p>
                <p className="text-sm font-semibold text-stone-900 truncate">
                  {fastest?.name ?? "Sem dados"}
                </p>
                <p className="font-mono-tech text-xs text-stone-500">
                  {fastest ? `${fastest.avgTime} por análise` : "Aguardando dados"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <GlobalStatsDialog open={isGlobalStatsOpen} onOpenChange={setIsGlobalStatsOpen} />

      <EmployeeDetailsDialog
        employee={selectedEmployee}
        open={isEmployeeDetailsOpen}
        onOpenChange={setIsEmployeeDetailsOpen}
      />
    </ManagerShell>
  );
};

export default Manager;
