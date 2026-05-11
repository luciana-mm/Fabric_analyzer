"use client";

import cameraImage from "@/assets/camera-bg.jpg";
import { useState, useEffect } from "react";
import { Play, Sun, Settings, Microscope, Layers, CheckCircle2, XCircle, Lock, BarChart3, LogOut, Camera } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import gridBg from "@/assets/grid-bg.jpg";
import { StatsDetailsDialog } from "@/components/StatsDetailsDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { useOperatorDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/integrations/supabase/client";
import {
  getSystemStep,
  isConfigurationComplete,
  isLightCalibrated,
} from "@/lib/systemConfig";

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
        <p className="font-sansserief text-[10px] tracking-[0.25em] uppercase text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className={`font-sansserief text-2xl tracking-wider ${accentClasses}`}>{value}</p>
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
  bgImage?: string;
}

const ActionCard = ({ icon: Icon, label, description, onClick, highlight, disabled, badge, bgImage }: ActionCardProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`group overflow-hidden relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border transition-all duration-300 text-center
      ${disabled
        ? "bg-card/20 border-border/20 opacity-50 cursor-not-allowed"
        : highlight
        ? "bg-foreground/10 border-foreground/30 glow-primary hover:bg-foreground/15"
        : "bg-card/50 border-border/30 hover:border-foreground/20 hover:bg-card/80"
      } ${!disabled && "active:scale-[0.97]"}`}
  >
    {bgImage && (
      <>
        <img
          src={bgImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity duration-500 z-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent z-0" />
      </>
    )}
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
      <p className="font-sansserief text-sm tracking-[0.2em] uppercase text-foreground/90">{label}</p>
      <p className="text-xs text-muted-foreground mt-1.5">{description}</p>
    </div>
  </button>
);

const Index = () => {
  const [statsOpen, setStatsOpen] = useState(false);
  const [employeeInfoOpen, setEmployeeInfoOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { config: systemConfig } = useOperatorSystemConfig(user?.id);
  const { stats, isLoading: dashboardLoading, isError, formatMsToSecondsLabel } = useOperatorDashboardData(user?.id);
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ["operator-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, employee_code, shift, job_title")
        .eq("user_id", user?.id as string)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const systemStep = getSystemStep(systemConfig);
  const calibrated = isLightCalibrated(systemConfig);
  const configured = isConfigurationComplete(systemConfig);
  const isReady = systemStep === "READY";
  const shouldHighlightConfig = systemStep === "CONFIG";
  const shouldHighlightCalibrate = systemStep === "LIGHT";
  const shouldHighlightStart = systemStep === "READY";

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const handleCalibrate = () => {
    if (!configured) {
      toast.error("Pré-requisitos pendentes", {
        description: "Conclua as configurações antes de calibrar.",
      });
      return;
    }

    if (!systemConfig.ambientLightConfigured) {
      toast.error("Requisitos pendentes", {
        description: "Configure a luz base primeiro.",
      });
      return;
    }

    router.push("/painel/calibrar-luz");
    toast.info("Abrindo calibragem de luz", {
      description: "Compare a iluminação atual com a luz base definida nas configurações.",
    });
  };

  const handleOpenCamera = () => {
    router.push("/painel/camera");
  };


  const handleStart = () => {
    if (!isReady) {
      toast.error("Pré-requisitos pendentes", {
        description: !calibrated && !configured
          ? "Conclua as configurações e depois calibre a luz antes de iniciar."
          : !calibrated
          ? "Execute a calibração da luz antes de iniciar."
          : "Conclua as configurações antes de iniciar.",
      });
      return;
    }
    router.push("/painel/analise");
  };

  const startDescription = isReady
    ? "Começar análise"
    : !configured
    ? "Conclua as configurações"
    : !calibrated
    ? "Calibre a luz primeiro"
    : "Pronto para iniciar";

  const totalLabel = dashboardLoading ? "..." : stats.totalVerified.toLocaleString("pt-BR");
  const successLabel = dashboardLoading ? "..." : `${stats.successRate}%`;
  const failureLabel = dashboardLoading ? "..." : `${stats.failureRate}%`;
  const operatorName = profileQuery.data?.display_name ?? user?.email ?? "Funcionário";
  const operatorCode = profileQuery.data?.employee_code ?? "Não informado";
  const operatorShift = profileQuery.data?.shift ?? "Não informado";
  const operatorRole = profileQuery.data?.job_title ?? "Operador";


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
            <h1 className="font-sansserief text-xl tracking-[0.15em] text-foreground uppercase leading-tight">
              Meta
            </h1>
            <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase">
              Análise de Cores de Tecidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${isReady ? "bg-primary" : "bg-muted-foreground"}`} />
            <span>
              {systemStep === "READY"
                ? "Sistema Pronto"
                : systemStep === "CONFIG"
                ? "Aguardando Configuração"
                : "Aguardando Calibração"}
            </span>
          </div>
          {user?.email && (
            <button
              type="button"
              onClick={() => setEmployeeInfoOpen(true)}
              className="hidden md:inline px-3 py-1.5 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all text-[11px] text-muted-foreground tracking-wider"
            >
              Funcionário: {operatorName}
            </button>
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

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-10">
            <p className="font-sansserief text-[11px] tracking-[0.4em] text-muted-foreground uppercase mb-3">
              Painel de Controle
            </p>
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
            <ActionCard
              icon={configured ? CheckCircle2 : Settings}
              label="Configuração"
              description={configured ? "Configurações concluídas" : "Parâmetros do sistema"}
              highlight={shouldHighlightConfig}
              onClick={() => router.push("/painel/config")}
            />
            <ActionCard
              icon={calibrated ? CheckCircle2 : Sun}
              label="Calibrar Luz"
              description={calibrated ? "Calibração concluída" : "Ajustar iluminação"}
              highlight={shouldHighlightCalibrate}
              disabled={!configured}
              onClick={handleCalibrate}
              badge={!configured ? "Config" : !systemConfig.ambientLightConfigured ? "Luz base" : undefined}
            />
            <ActionCard
              icon={Play}
              label="Iniciar"
              description={startDescription}
              highlight={shouldHighlightStart}
              disabled={!isReady}
              badge={!isReady ? "Bloqueado" : undefined}
              onClick={handleStart}
            />
            <ActionCard
              icon={Camera}
              label="Camera Ao Vivo"
              description="Apenas visualização da câmera"
              onClick={handleOpenCamera}
              bgImage={cameraImage.src}
            />
          </div>

          {/* Stats Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-sansserief text-[11px] tracking-[0.4em] text-muted-foreground uppercase whitespace-nowrap">
                Estatísticas de Análise
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-foreground/20 via-foreground/10 to-transparent" />
              <button
                onClick={() => setStatsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-sansserief text-[10px] tracking-[0.2em] uppercase text-foreground/80"
              >
                <BarChart3 className="w-3 h-3" />
                Ver Detalhes
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard
                icon={Layers}
                label="Tecidos Verificados"
                value={totalLabel}
                sublabel="total"
              />
              <StatCard
                icon={CheckCircle2}
                label="Taxa de Sucesso"
                value={successLabel}
                sublabel={dashboardLoading ? "..." : `${stats.totalSuccess.toLocaleString("pt-BR")} ok`}
                accent="success"
              />
              <StatCard
                icon={XCircle}
                label="Taxa de Erro"
                value={failureLabel}
                sublabel={dashboardLoading ? "..." : `${stats.totalFailure.toLocaleString("pt-BR")} falhas`}
                accent="danger"
              />
            </div>
            {isError && (
              <p className="text-xs text-destructive">
                Não foi possível carregar os dados do painel. Verifique as policies e a tabela analysis_records.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Bottom accent line */}
      <div className="relative z-10 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />

      <StatsDetailsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        totalVerified={stats.totalVerified}
        averageTimeLabel={formatMsToSecondsLabel(stats.averageTimeMs)}
        totalSuccess={stats.totalSuccess}
        totalFailure={stats.totalFailure}
        successRate={stats.successRate}
        failureRate={stats.failureRate}
        errorBreakdown={stats.errorBreakdown}
        recentAnalyses={stats.recentAnalyses}
      />

      <Dialog open={employeeInfoOpen} onOpenChange={setEmployeeInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Informações do Funcionário</DialogTitle>
            <DialogDescription>Dados do operador autenticado nesta sessão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Nome:</strong> {operatorName}</p>
            <p><strong>Código:</strong> {operatorCode}</p>
            <p><strong>Cargo:</strong> {operatorRole}</p>
            <p><strong>Turno:</strong> {operatorShift}</p>
            <p><strong>E-mail:</strong> {user?.email ?? "Não informado"}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
