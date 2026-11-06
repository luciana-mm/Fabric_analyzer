"use client";

import { useState } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  LogOut,
  Search,
  TrendingUp,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import gridBg from "@/assets/grid-bg.jpg";
import { EmployeeDetailsDialog } from "@/components/EmployeeDetailsDialog";
import { GlobalStatsDialog } from "@/components/GlobalStatsDialog";
import { useAuth } from "@/hooks/useAuth";
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
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensal",
  semester: "Semestral",
  yearly: "Anual",
};

const OverviewCard = ({ icon: Icon, label, value, sublabel, accent = "default" }: OverviewCardProps) => {
  const styles = {
    default: {
      iconBox: "bg-cyan-500/10 border-cyan-500/25 text-cyan-400",
      valueText: "text-white",
      cardBorder: "border-white/10 hover:border-cyan-500/30",
    },
    success: {
      iconBox: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
      valueText: "text-emerald-400",
      cardBorder: "border-emerald-500/20 hover:border-emerald-500/40",
    },
    danger: {
      iconBox: "bg-rose-500/10 border-rose-500/25 text-rose-400",
      valueText: "text-rose-400",
      cardBorder: "border-rose-500/20 hover:border-rose-500/40",
    },
  }[accent];

  return (
    <div
      className={`relative flex items-center gap-4 p-5 rounded-2xl border bg-slate-900/65 backdrop-blur-xl shadow-lg transition-all duration-300 ${styles.cardBorder}`}
    >
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${styles.iconBox}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
          {label}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className={`font-sansserief text-2xl font-semibold tracking-wider ${styles.valueText}`}>{value}</p>
          {sublabel && (
            <p className="text-[11px] text-slate-400 font-medium uppercase">
              {sublabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const Manager = () => {
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<ManagerEmployeeRow | null>(null);
  const [isEmployeeDetailsOpen, setIsEmployeeDetailsOpen] = useState(false);
  const [isGlobalStatsOpen, setIsGlobalStatsOpen] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState<ManagerPerformancePeriod>("daily");
  const { signOut, user } = useAuth();
  const { employees, dailyStats, loading, isError } = useManagerDashboardData({ period: performancePeriod });
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

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
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#050811]">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 industrial-bg" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 md:px-10 py-5 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.18)]">
            <Users className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-sansserief text-lg font-bold tracking-[0.16em] text-white uppercase leading-tight">
              META · Painel do Gestor
            </h1>
            <p className="text-[11px] tracking-[0.2em] text-slate-400 uppercase mt-0.5">
              Supervisão Operacional e Qualidade de Lotes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden md:inline-flex items-center px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 font-mono-tech text-xs text-cyan-300">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-200 transition-all text-xs font-medium text-slate-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 p-6 md:p-10">
        <div className="w-full max-w-6xl mx-auto space-y-10">
          <section>
            <div className="flex items-center gap-4 mb-5">
              <p className="font-sansserief text-xs font-semibold tracking-[0.25em] text-slate-300 uppercase whitespace-nowrap">
                Indicadores do Dia
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
              <button
                type="button"
                onClick={() => setIsGlobalStatsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-xs font-medium text-slate-200"
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                Estatísticas Globais
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                icon={Users}
                label="Operadores Ativos"
                value={String(dailyStats.activeEmployeesToday)}
                sublabel="hoje"
              />
              <OverviewCard
                icon={Layers}
                label="Tecidos Verificados"
                value={dailyStats.totalVerified.toLocaleString("pt-BR")}
                sublabel="hoje"
              />
              <OverviewCard
                icon={CheckCircle2}
                label="Taxa de Aprovação"
                value={`${successRate}%`}
                sublabel={`${dailyStats.totalSuccess} ok`}
                accent="success"
              />
              <OverviewCard
                icon={XCircle}
                label="Taxa de Rejeição"
                value={`${failureRate}%`}
                sublabel={`${dailyStats.totalFailure} falhas`}
                accent="danger"
              />
            </div>
            {isError && (
              <p className="text-xs text-rose-400 mt-3">
                Não foi possível carregar os dados do gestor. Verifique a conexão e as configurações do banco.
              </p>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <p className="font-sansserief text-xs font-semibold tracking-[0.25em] text-slate-300 uppercase whitespace-nowrap">
                Desempenho por Operador · {periodLabel}
              </p>
              <div className="min-w-16 flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
              <select
                value={performancePeriod}
                onChange={(event) => setPerformancePeriod(event.target.value as ManagerPerformancePeriod)}
                className="h-9 rounded-full border border-white/10 bg-slate-900/80 px-3.5 text-xs text-slate-200 outline-none transition-all hover:border-cyan-400/40 focus:border-cyan-400/60"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="semester">Semestral</option>
                <option value="yearly">Anual</option>
              </select>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 focus-within:border-cyan-400/50 transition-colors">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar operador..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="bg-transparent outline-none text-xs text-white placeholder:text-slate-500 w-36"
                />
              </div>
              <button
                onClick={() => router.push("/gestor/funcionarios")}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-xs font-medium text-slate-200"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                Gerenciar Equipe
              </button>
              <button
                onClick={() => router.push("/gestor/cftv")}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-xs font-medium text-slate-200"
              >
                <Video className="w-3.5 h-3.5 text-cyan-400" />
                CFTV & Câmeras
              </button>
              <button
                onClick={() => router.push("/gestor/historico")}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/35 hover:bg-cyan-500/25 transition-all text-xs font-semibold text-cyan-200"
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-300" />
                Histórico de Lotes
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl overflow-hidden shadow-xl">
              <div className="grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-white/10 bg-slate-950/60 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                <div className="col-span-4">Operador</div>
                <div className="col-span-2">Turno</div>
                <div className="col-span-2 text-right">Verificados</div>
                <div className="col-span-2 text-right">Aprovação</div>
                <div className="col-span-1 text-right">Falhas</div>
                <div className="col-span-1 text-right">Ficha</div>
              </div>

              {previewEmployees.length === 0 || noPerformanceInPeriod ? (
                <div className="px-6 py-10 text-center text-xs text-slate-400">
                  {loading
                    ? "Carregando operadores..."
                    : noPerformanceInPeriod
                    ? `Nenhum operador ativo com leituras registradas no período ${periodLabel.toLowerCase()}.`
                    : "Nenhum operador ativo encontrado."}
                </div>
              ) : (
                previewEmployees.map((employee, index) => {
                  const rate =
                    employee.verified === 0 ? "0.0" : ((employee.success / employee.verified) * 100).toFixed(1);

                  return (
                    <div
                      key={employee.id}
                      onClick={() => handleOpenEmployeeDetails(employee)}
                      className={`w-full grid grid-cols-12 gap-4 px-6 py-4 items-center text-left transition-colors hover:bg-white/[0.04] cursor-pointer ${
                        index !== previewEmployees.length - 1 ? "border-b border-white/5" : ""
                      }`}
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center font-sansserief text-xs font-bold text-cyan-300 shrink-0">
                          {employee.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{employee.name}</p>
                          <p className="text-[11px] text-slate-400 uppercase tracking-wider">
                            {employee.role}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-xs text-slate-300">{employee.shift}</div>
                      <div className="col-span-2 text-right font-mono-tech text-sm font-semibold text-white">
                        {employee.verified}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 font-mono-tech text-xs font-semibold text-emerald-300">
                          {employee.success} ({rate}%)
                        </span>
                      </div>
                      <div className="col-span-1 text-right font-mono-tech text-sm font-semibold text-rose-400">
                        {employee.failure}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEmployeeDetails(employee);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950/80 border border-white/10 text-slate-300 transition-all hover:border-cyan-400/50 hover:text-cyan-300"
                          aria-label={`Ver detalhes de ${employee.name}`}
                          title={`Ver detalhes de ${employee.name}`}
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-5">
              <p className="font-sansserief text-xs font-semibold tracking-[0.25em] text-slate-300 uppercase whitespace-nowrap">
                Destaques da Equipe · {periodLabel}
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="p-5 rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold tracking-wider uppercase mb-2.5">
                  <Award className="w-4 h-4" /> Maior Volume
                </div>
                <p className="font-sansserief text-lg font-bold text-white">{highestVolume?.name ?? "Sem dados"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {highestVolume ? `${highestVolume.verified} tecidos verificados` : "Aguardando sincronização"}
                </p>
              </div>
              <div className="p-5 rounded-2xl border border-emerald-500/20 bg-slate-900/65 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-2.5">
                  <TrendingUp className="w-4 h-4" /> Melhor Taxa de Qualidade
                </div>
                <p className="font-sansserief text-lg font-bold text-white">{bestRate?.name ?? "Sem dados"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {bestRate
                    ? `${((bestRate.success / Math.max(1, bestRate.verified)) * 100).toFixed(1)}% de aprovação`
                    : "Aguardando sincronização"}
                </p>
              </div>
              <div className="p-5 rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl">
                <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold tracking-wider uppercase mb-2.5">
                  <Clock className="w-4 h-4" /> Menor Tempo de Inspeção
                </div>
                <p className="font-sansserief text-lg font-bold text-white">{fastest?.name ?? "Sem dados"}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {fastest ? `${fastest.avgTime} por análise` : "Aguardando sincronização"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <div className="relative z-10 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

      <GlobalStatsDialog open={isGlobalStatsOpen} onOpenChange={setIsGlobalStatsOpen} />

      <EmployeeDetailsDialog
        employee={selectedEmployee}
        open={isEmployeeDetailsOpen}
        onOpenChange={setIsEmployeeDetailsOpen}
      />
    </div>
  );
};

export default Manager;
