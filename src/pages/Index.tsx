"use client";

import { useState } from "react";
import { Play, Sun, Settings, Microscope, Layers, CheckCircle2, XCircle, Lock, BarChart3, LogOut } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import gridBg from "@/assets/grid-bg.jpg";
import { StatsDetailsDialog } from "@/components/StatsDetailsDialog";
import { useAuth } from "@/hooks/useAuth";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "default" | "success" | "danger";
}

const StatCard = ({ icon: Icon, label, value, sublabel, accent = "default" }: StatCardProps) => {
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

interface ActionCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick?: () => void;
  highlight?: boolean;
  disabled?: boolean;
  badge?: string;
}

const ActionCard = ({ icon: Icon, label, description, onClick, highlight, disabled, badge }: ActionCardProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`group relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border transition-all duration-300 text-center
      ${disabled
        ? "bg-card/20 border-border/20 opacity-50 cursor-not-allowed"
        : highlight
        ? "bg-foreground/10 border-foreground/30 glow-primary hover:bg-foreground/15"
        : "bg-card/50 border-border/30 hover:border-foreground/20 hover:bg-card/80"
      } ${!disabled && "active:scale-[0.97]"}`}
  >
    {badge && (
      <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/40 text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
        <Lock className="w-2.5 h-2.5" />
        {badge}
      </span>
    )}
    <div className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300
      ${highlight && !disabled ? "bg-foreground/15" : "bg-muted/60 group-hover:bg-foreground/10"}`}>
      <Icon className={`w-8 h-8 transition-all duration-300
        ${highlight && !disabled ? "text-foreground" : "text-secondary group-hover:text-foreground"}`} />
    </div>
    <div>
      <p className="font-display text-sm tracking-[0.2em] uppercase text-foreground/90">{label}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{description}</p>
    </div>
  </button>
);

const Index = () => {
  const [calibrated, setCalibrated] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const { signOut, user } = useAuth();
  const router = useRouter();

  const isReady = calibrated && configured;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const handleCalibrate = () => {
    setCalibrated(true);
    toast.success("Luz calibrada com sucesso", {
      description: configured
        ? "O sistema está pronto para iniciar a análise."
        : "Agora conclua as configurações do sistema.",
    });
  };

  const handleConfigure = () => {
    setConfigured(true);
    toast.success("Configurações concluídas", {
      description: calibrated
        ? "O sistema está pronto para iniciar a análise."
        : "Agora calibre a luz para liberar o início.",
    });
  };

  const handleStart = () => {
    if (!isReady) {
      toast.error("Pré-requisitos pendentes", {
        description: !calibrated && !configured
          ? "Calibre a luz e conclua as configurações antes de iniciar."
          : !calibrated
          ? "Execute a calibração da luz antes de iniciar."
          : "Conclua as configurações antes de iniciar.",
      });
      return;
    }
    toast.success("Análise iniciada");
  };

  const startDescription = isReady
    ? "Começar análise"
    : !calibrated && !configured
    ? "Calibre a luz e configure"
    : !calibrated
    ? "Calibre a luz primeiro"
    : "Conclua as configurações";

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Background */}
      <img src={gridBg.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between px-10 py-6 border-b border-border/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center">
            <Microscope className="w-6 h-6 text-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl tracking-[0.15em] text-foreground uppercase leading-tight">
              TissueScope
            </h1>
            <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
              Análise de Tecidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${isReady ? "bg-primary" : "bg-muted-foreground"}`} />
            <span>
              {isReady
                ? "Sistema Pronto"
                : !calibrated && !configured
                ? "Aguardando Calibração e Configuração"
                : !calibrated
                ? "Aguardando Calibração"
                : "Aguardando Configuração"}
            </span>
          </div>
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
          <span className="px-4 py-1.5 rounded-full bg-muted/40 border border-border/30 font-display text-[11px] tracking-wider">
            v1.0.0
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-10">
            <p className="font-display text-[11px] tracking-[0.4em] text-muted-foreground uppercase mb-3">
              Painel de Controle
            </p>
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent mx-auto" />
          </div>

          <div className="grid grid-cols-3 gap-6 mb-10">
            <ActionCard
              icon={Play}
              label="Iniciar"
              description={startDescription}
              highlight
              disabled={!isReady}
              badge={!isReady ? "Bloqueado" : undefined}
              onClick={handleStart}
            />
            <ActionCard
              icon={calibrated ? CheckCircle2 : Sun}
              label="Calibrar Luz"
              description={calibrated ? "Calibração concluída" : "Ajustar iluminação"}
              onClick={handleCalibrate}
            />
            <ActionCard
              icon={configured ? CheckCircle2 : Settings}
              label="Configurações"
              description={configured ? "Configurações concluídas" : "Parâmetros do sistema"}
              onClick={handleConfigure}
            />
          </div>

          {/* Stats Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-display text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Estatísticas de Análise
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
              <button
                onClick={() => setStatsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-display text-[10px] tracking-[0.2em] uppercase text-foreground/80"
              >
                <BarChart3 className="w-3 h-3" />
                Ver Detalhes
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard
                icon={Layers}
                label="Tecidos Verificados"
                value="1.248"
                sublabel="total"
              />
              <StatCard
                icon={CheckCircle2}
                label="Taxa de Sucesso"
                value="94.6%"
                sublabel="1.181 ok"
                accent="success"
              />
              <StatCard
                icon={XCircle}
                label="Taxa de Erro"
                value="5.4%"
                sublabel="67 falhas"
                accent="danger"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom accent line */}
      <div className="relative z-10 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />

      <StatsDetailsDialog open={statsOpen} onOpenChange={setStatsOpen} />
    </div>
  );
};

export default Index;
