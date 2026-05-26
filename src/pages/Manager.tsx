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
  const accentClasses = {
    default: "text-foreground",
    success: "text-primary",
    danger: "text-destructive",
  }[accent];

  return (
    <div className="relative flex items-center gap-4 p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
      <div className={`w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center ${accentClasses}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sansserief text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
          {label}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className={`font-sansserief text-2xl tracking-wider ${accentClasses}`}>{value}</p>
          {sublabel && (
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
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
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      <header className="relative z-10 flex items-center justify-between px-10 py-6 border-b border-border/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h1 className="font-sansserief text-xl tracking-[0.15em] text-foreground uppercase leading-tight">
              Painel do Gestor
            </h1>
            <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
              Visao Operacional - Meta Classificador
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user?.email && (
            <span className="hidden md:inline text-[11px] text-muted-foreground tracking-wider">
              {user.email}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-sansserief text-[10px] tracking-[0.25em] uppercase text-foreground/80"
          >
            <LogOut className="w-3 h-3" />
            Sair
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 p-10">
        <div className="w-full max-w-6xl mx-auto space-y-10">
          <section>
            <div className="flex items-center gap-4 mb-5">
              <p className="font-sansserief text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Resumo Diario
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
              <button
                type="button"
                onClick={() => setIsGlobalStatsOpen(true)}
                className="flex items-center justify-center text-muted-foreground w-[120px] border border-border/40 rounded-[10px] p-1 bg-transparent text-xs cursor-pointer hover:bg-muted/40 transition-colors"
              >
                Mais detalhes
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                icon={Users}
                label="Funcionarios Ativos"
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
                label="Taxa de Sucesso"
                value={`${successRate}%`}
                sublabel={`${dailyStats.totalSuccess} ok`}
                accent="success"
              />
              <OverviewCard
                icon={XCircle}
                label="Taxa de Erro"
                value={`${failureRate}%`}
                sublabel={`${dailyStats.totalFailure} falhas`}
                accent="danger"
              />
            </div>
            {isError && (
              <p className="text-xs text-destructive mt-3">
                Nao foi possivel carregar os dados do gestor. Verifique as policies e tabelas no Supabase.
              </p>
            )}
          </section>

          <section>
            <div className="flex flex-wrap items-center gap-4 mb-5">
              <p className="font-sansserief text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Desempenho por Funcionario - {periodLabel}
              </p>
              <div className="min-w-24 flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
              <select
                value={performancePeriod}
                onChange={(event) => setPerformancePeriod(event.target.value as ManagerPerformancePeriod)}
                className="h-9 rounded-full border border-border/30 bg-muted/40 px-3 text-[11px] text-foreground/80 outline-none transition-all hover:bg-muted/60 focus:border-foreground/30"
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="semester">Semestral</option>
                <option value="yearly">Anual</option>
              </select>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border/30">
                <Search className="w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground w-32"
                />
              </div>
              <button
                onClick={() => router.push("/gestor/funcionarios")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all text-xs text-foreground/80"
              >
                <ExternalLink className="w-3 h-3" />
                Detalhes
              </button>
            </div>

            <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border/30 bg-muted/20 font-sansserief text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                <div className="col-span-3">Funcionario</div>
                <div className="col-span-2">Turno</div>
                <div className="col-span-2 text-right">Verificados</div>
                <div className="col-span-2 text-right">Sucesso</div>
                <div className="col-span-2 text-right">Falhas</div>
                <div className="col-span-1 text-right">Detalhes</div>
              </div>

              {previewEmployees.length === 0 || noPerformanceInPeriod ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                  {loading
                    ? "Carregando funcionarios..."
                    : noPerformanceInPeriod
                    ? `Nenhum funcionario ativo com desempenho no periodo ${periodLabel.toLowerCase()}.`
                    : "Nenhum funcionario ativo encontrado"}
                </div>
              ) : (
                previewEmployees.map((employee, index) => {
                  const rate =
                    employee.verified === 0 ? "0.0" : ((employee.success / employee.verified) * 100).toFixed(1);

                  return (
                    <div
                      key={employee.id}
                      onClick={() => handleOpenEmployeeDetails(employee)}
                      className={`w-full grid grid-cols-12 gap-4 px-5 py-4 items-center text-left transition-colors hover:bg-muted/30 cursor-pointer ${
                        index !== previewEmployees.length - 1 ? "border-b border-border/20" : ""
                      }`}
                    >
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center font-sansserief text-xs text-foreground/80">
                          {employee.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground/90 truncate">{employee.name}</p>
                          <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                            {employee.role}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-xs text-muted-foreground">{employee.shift}</div>
                      <div className="col-span-2 text-right font-sansserief text-sm tracking-wider text-foreground/90">
                        {employee.verified}
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="font-sansserief text-sm tracking-wider text-primary">{employee.success}</p>
                        <p className="text-[10px] text-muted-foreground">{rate}%</p>
                      </div>
                      <div className="col-span-2 text-right font-sansserief text-sm tracking-wider text-destructive">
                        {employee.failure}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenEmployeeDetails(employee);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 border border-border/30 text-muted-foreground transition-all hover:bg-muted/60 hover:border-foreground/30 hover:text-foreground"
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
              <p className="font-sansserief text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Destaques da Equipe - {periodLabel}
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-foreground/70 text-[10px] tracking-[0.25em] uppercase mb-3">
                  <Award className="w-3.5 h-3.5" /> Maior Volume
                </div>
                <p className="font-sansserief text-lg text-foreground">{highestVolume?.name ?? "Sem dados"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {highestVolume ? `${highestVolume.verified} tecidos verificados` : "Aguardando sincronizacao"}
                </p>
              </div>
              <div className="p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-primary text-[10px] tracking-[0.25em] uppercase mb-3">
                  <TrendingUp className="w-3.5 h-3.5" /> Melhor Taxa
                </div>
                <p className="font-sansserief text-lg text-foreground">{bestRate?.name ?? "Sem dados"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {bestRate
                    ? `${((bestRate.success / Math.max(1, bestRate.verified)) * 100).toFixed(1)}% de aprovacao`
                    : "Aguardando sincronizacao"}
                </p>
              </div>
              <div className="p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-foreground/70 text-[10px] tracking-[0.25em] uppercase mb-3">
                  <Clock className="w-3.5 h-3.5" /> Mais Rapido
                </div>
                <p className="font-sansserief text-lg text-foreground">{fastest?.name ?? "Sem dados"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fastest ? `${fastest.avgTime} por analise` : "Aguardando sincronizacao"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <div className="relative z-10 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />

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
