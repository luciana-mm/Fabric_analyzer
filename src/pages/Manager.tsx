"use client";

import { useState } from "react";
import { Users, Layers, CheckCircle2, XCircle, TrendingUp, Award, Clock, BarChart3, LogOut, Search } from "lucide-react";
import { LucideIcon } from "lucide-react";
import gridBg from "@/assets/grid-bg.jpg";
import { EmployeeDetailsDialog, Employee } from "@/components/EmployeeDetailsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface OverviewCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "success" | "danger";
}

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
        <p className="font-display text-[10px] tracking-[0.25em] uppercase text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className={`font-display text-2xl tracking-wider ${accentClasses}`}>{value}</p>
          {sublabel && <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
};

const employees: Employee[] = [
  { id: "EMP-001", name: "Ana Souza", role: "Operadora Sênior", verified: 412, success: 398, failure: 14, avgTime: "2,1s", shift: "Manhã" },
  { id: "EMP-002", name: "Carlos Mendes", role: "Operador", verified: 356, success: 328, failure: 28, avgTime: "2,6s", shift: "Manhã" },
  { id: "EMP-003", name: "Beatriz Lima", role: "Operadora", verified: 289, success: 271, failure: 18, avgTime: "2,4s", shift: "Tarde" },
  { id: "EMP-004", name: "Diego Ramos", role: "Operador Jr.", verified: 191, success: 184, failure: 7, avgTime: "2,8s", shift: "Tarde" },
];

const Manager = () => {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const { signOut, user } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const totalVerified = employees.reduce((s, e) => s + e.verified, 0);
  const totalSuccess = employees.reduce((s, e) => s + e.success, 0);
  const totalFailure = employees.reduce((s, e) => s + e.failure, 0);
  const successRate = ((totalSuccess / totalVerified) * 100).toFixed(1);
  const failureRate = ((totalFailure / totalVerified) * 100).toFixed(1);

  const filtered = employees.filter(
    (e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <img src={gridBg.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between px-10 py-6 border-b border-border/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl tracking-[0.15em] text-foreground uppercase leading-tight">
              Painel do Gestor
            </h1>
            <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
              Visão Operacional · TissueScope
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
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-foreground/80"
          >
            <LogOut className="w-3 h-3" />
            Sair
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 p-10">
        <div className="w-full max-w-6xl mx-auto space-y-10">
          {/* Estatísticas Gerais */}
          <section>
            <div className="flex items-center gap-4 mb-5">
              <p className="font-display text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Estatísticas Gerais
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <OverviewCard icon={Users} label="Funcionários Ativos" value={String(employees.length)} sublabel="hoje" />
              <OverviewCard icon={Layers} label="Tecidos Verificados" value={totalVerified.toLocaleString("pt-BR")} sublabel="total" />
              <OverviewCard icon={CheckCircle2} label="Taxa de Sucesso" value={`${successRate}%`} sublabel={`${totalSuccess} ok`} accent="success" />
              <OverviewCard icon={XCircle} label="Taxa de Erro" value={`${failureRate}%`} sublabel={`${totalFailure} falhas`} accent="danger" />
            </div>
          </section>

          {/* Funcionários */}
          <section>
            <div className="flex items-center gap-4 mb-5">
              <p className="font-display text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Desempenho por Funcionário
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border/30">
                <Search className="w-3 h-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground w-32"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border/30 bg-muted/20 font-display text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                <div className="col-span-3">Funcionário</div>
                <div className="col-span-2">Turno</div>
                <div className="col-span-2 text-right">Verificados</div>
                <div className="col-span-2 text-right">Sucesso</div>
                <div className="col-span-2 text-right">Falhas</div>
                <div className="col-span-1 text-right">Detalhes</div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Nenhum funcionário encontrado
                </div>
              ) : (
                filtered.map((emp, i) => {
                  const rate = ((emp.success / emp.verified) * 100).toFixed(1);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => setSelected(emp)}
                      className={`w-full grid grid-cols-12 gap-4 px-5 py-4 items-center text-left transition-colors hover:bg-muted/30 ${
                        i !== filtered.length - 1 ? "border-b border-border/20" : ""
                      }`}
                    >
                      <div className="col-span-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center font-display text-xs text-foreground/80">
                          {emp.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-foreground/90 truncate">{emp.name}</p>
                          <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{emp.role}</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-xs text-muted-foreground">{emp.shift}</div>
                      <div className="col-span-2 text-right font-display text-sm tracking-wider text-foreground/90">
                        {emp.verified}
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="font-display text-sm tracking-wider text-primary">{emp.success}</p>
                        <p className="text-[10px] text-muted-foreground">{rate}%</p>
                      </div>
                      <div className="col-span-2 text-right font-display text-sm tracking-wider text-destructive">
                        {emp.failure}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Destaques */}
          <section>
            <div className="flex items-center gap-4 mb-5">
              <p className="font-display text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Destaques da Equipe
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-foreground/70 text-[10px] tracking-[0.25em] uppercase mb-3">
                  <Award className="w-3.5 h-3.5" /> Maior Volume
                </div>
                <p className="font-display text-lg text-foreground">{employees[0].name}</p>
                <p className="text-xs text-muted-foreground mt-1">{employees[0].verified} tecidos verificados</p>
              </div>
              <div className="p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-primary text-[10px] tracking-[0.25em] uppercase mb-3">
                  <TrendingUp className="w-3.5 h-3.5" /> Melhor Taxa
                </div>
                <p className="font-display text-lg text-foreground">{employees[3].name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((employees[3].success / employees[3].verified) * 100).toFixed(1)}% de aprovação
                </p>
              </div>
              <div className="p-5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-foreground/70 text-[10px] tracking-[0.25em] uppercase mb-3">
                  <Clock className="w-3.5 h-3.5" /> Mais Rápido
                </div>
                <p className="font-display text-lg text-foreground">{employees[0].name}</p>
                <p className="text-xs text-muted-foreground mt-1">{employees[0].avgTime} por análise</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <div className="relative z-10 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />

      <EmployeeDetailsDialog
        employee={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
};

export default Manager;
