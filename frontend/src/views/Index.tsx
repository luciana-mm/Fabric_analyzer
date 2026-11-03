"use client";

import cameraImage from "@/assets/camera-bg.jpg";
import { useState } from "react";
import { Play, Sun, Settings, Microscope, Layers, CheckCircle2, XCircle, Lock, BarChart3, LogOut, Camera, RotateCcw } from "lucide-react";
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
import { fetchJson } from "@/lib/api-client";
import {
  clearSystemConfigCache,
  createTissueBatchCode,
  getSystemFlowState,
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
        <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className={`font-sansserief text-2xl font-semibold tracking-wider ${styles.valueText}`}>{value}</p>
          {sublabel && <p className="text-[11px] text-slate-400 font-medium uppercase">{sublabel}</p>}
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
  completed?: boolean;
  disabled?: boolean;
  badge?: string;
  bgImage?: string;
  stepNumber?: number;
}

const ActionCard = ({
  icon: Icon,
  label,
  description,
  onClick,
  highlight,
  completed,
  disabled,
  badge,
  bgImage,
  stepNumber,
}: ActionCardProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`group overflow-hidden relative flex flex-col items-center justify-center gap-3.5 p-7 rounded-2xl border transition-all duration-300 text-center min-h-[210px]
      ${
        disabled
          ? "bg-slate-900/30 border-white/5 opacity-45 cursor-not-allowed"
          : highlight
          ? "bg-gradient-to-b from-cyan-500/15 to-blue-600/10 border-cyan-400/50 glow-primary hover:border-cyan-300 hover:from-cyan-500/20"
          : completed
          ? "bg-slate-900/65 border-emerald-500/30 hover:border-emerald-400/50 hover:bg-slate-900/80"
          : "bg-slate-900/65 border-white/10 hover:border-cyan-400/35 hover:bg-slate-900/85"
      } ${!disabled && "active:scale-[0.98] hover:-translate-y-0.5"}`}
  >
    {bgImage && (
      <>
        <img
          src={bgImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-40 transition-opacity duration-500 z-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-[#050811]/70 to-transparent z-0" />
      </>
    )}

    {stepNumber && (
      <span
        className={`absolute top-3.5 left-3.5 z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
          completed
            ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
            : highlight
            ? "bg-cyan-500/25 border-cyan-400/50 text-cyan-200"
            : "bg-slate-800/80 border-white/10 text-slate-400"
        }`}
      >
        {stepNumber}
      </span>
    )}

    {badge && (
      <span className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-white/15 text-[10px] font-medium tracking-wider uppercase text-slate-300">
        <Lock className="w-2.5 h-2.5 text-amber-400" />
        {badge}
      </span>
    )}

    <div
      className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
        highlight && !disabled
          ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_24px_rgba(6,182,212,0.25)]"
          : completed
          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
          : "bg-slate-800/70 border-white/10 text-slate-300 group-hover:text-cyan-300 group-hover:border-cyan-500/30"
      }`}
    >
      <Icon className="w-8 h-8 transition-transform duration-300 group-hover:scale-105" />
    </div>

    <div className="relative z-10">
      <p className="font-sansserief text-sm font-semibold tracking-[0.14em] uppercase text-white">
        {label}
      </p>
      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{description}</p>
    </div>
  </button>
);

const Index = () => {
  const [statsOpen, setStatsOpen] = useState(false);
  const [employeeInfoOpen, setEmployeeInfoOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { config: systemConfig, persistPatch } = useOperatorSystemConfig(user?.id);
  const { stats, isLoading: dashboardLoading, isError, formatMsToSecondsLabel } = useOperatorDashboardData(user?.id);
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: ["operator-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const result = await fetchJson<{ data: { display_name?: string | null; employee_code?: string | null; shift?: string | null; job_title?: string | null } | null }>(
        `/api/profiles?userId=${encodeURIComponent(user?.id ?? "")}`,
      );

      return result.data ?? {};
    },
  });

  const systemStep = getSystemFlowState(systemConfig).systemStep;
  const calibrated = isLightCalibrated(systemConfig);
  const configured = isConfigurationComplete(systemConfig);
  const isReady = systemStep === "READY";
  const shouldHighlightConfig = systemStep === "CONFIG";
  const shouldHighlightCalibrate = systemStep === "LIGHT";
  const shouldHighlightStart = systemStep === "READY";

  const resetWorkflowState = async () => {
    if (persistPatch) {
      await persistPatch({
        systemStep: "CONFIG",
        activeTissueCode: createTissueBatchCode(),
        deltaE: 3,
        samplePoints: 9,
        sampleAreaWidthPercent: 60,
        sampleAreaHeightPercent: 50,
        estampado: false,
        referenceColorHex: "#FFFFFF",
        referenceColorRgb: { r: 255, g: 255, b: 255 },
        ambientLightReferenceHex: "#000000",
        ambientLightReferenceRgb: { r: 0, g: 0, b: 0 },
        deltaConfigured: false,
        analysisAreaConfigured: false,
        colorConfigured: false,
        ambientLightConfigured: false,
        lightCalibrated: false,
        configurationSaved: false,
      });
    }
    clearSystemConfigCache(user?.id);
  };

  const handleResetProcess = async () => {
    await resetWorkflowState();
    toast.success("Processo reiniciado", {
      description: "Etapas de configuração e calibração foram zeradas.",
    });
  };

  const handleSignOut = async () => {
    await resetWorkflowState();
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
    ? "Iniciar inspeção em tempo real"
    : !configured
    ? "Conclua as configurações (Etapa 1)"
    : !calibrated
    ? "Calibre a luz ambiente (Etapa 2)"
    : "Pronto para iniciar";

  const totalLabel = dashboardLoading ? "..." : stats.totalVerified.toLocaleString("pt-BR");
  const successLabel = dashboardLoading ? "..." : `${stats.successRate}%`;
  const failureLabel = dashboardLoading ? "..." : `${stats.failureRate}%`;
  const operatorName = profileQuery.data?.display_name ?? user?.email ?? "Funcionário";
  const operatorCode = profileQuery.data?.employee_code ?? "Não informado";
  const operatorShift = profileQuery.data?.shift ?? "Não informado";
  const operatorRole = profileQuery.data?.job_title ?? "Operador";

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#050811]">
      {/* Background */}
      <img src={gridBg.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity" width={1920} height={1080} />
      <div className="absolute inset-0 industrial-bg" />

      {/* Top Bar */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 md:px-10 py-5 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.18)]">
            <Microscope className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-sansserief text-lg font-bold tracking-[0.16em] text-white uppercase leading-tight">
              META · Estação do Operador
            </h1>
            <p className="text-[11px] tracking-[0.2em] text-slate-400 uppercase mt-0.5">
              Controle de Qualidade e Colorimetria Têxtil
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium ${
              isReady
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : systemStep === "LIGHT"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isReady ? "bg-emerald-400" : systemStep === "LIGHT" ? "bg-amber-400" : "bg-cyan-400"
              }`}
            />
            <span>
              {systemStep === "READY"
                ? "Sistema Pronto"
                : systemStep === "CONFIG"
                ? "Etapa 1: Configurar"
                : "Etapa 2: Calibrar Luz"}
            </span>
          </div>

          {user?.email && (
            <button
              type="button"
              onClick={() => setEmployeeInfoOpen(true)}
              className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-white transition-all text-xs text-slate-300"
            >
              <span>Operador: <strong className="text-white font-medium">{operatorName}</strong></span>
            </button>
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

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-6xl space-y-8">
          {/* Active Parameter Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              {systemConfig.estampado ? (
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-bold ${
                    systemConfig.colorConfigured
                      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300"
                      : "border-dashed border-amber-500/40 bg-slate-950/60 text-amber-400"
                  }`}
                  title="Padrão de estampa (Anomalib)"
                >
                  IA
                </div>
              ) : systemConfig.colorConfigured ? (
                <div
                  className="w-8 h-8 rounded-lg border border-white/20 shadow-inner"
                  style={{ backgroundColor: systemConfig.referenceColorHex }}
                  title={`Cor de referência: ${systemConfig.referenceColorHex}`}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-lg border border-dashed border-slate-600 bg-slate-950/60 flex items-center justify-center text-[10px] text-slate-500"
                  title="Cor ainda não capturada"
                >
                  ?
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Parâmetros Atuais do Lote</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-200">
                  <span className="font-mono-tech font-medium text-cyan-300">
                    {configured ? systemConfig.activeTissueCode : "Aguardando Configuração"}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    {systemConfig.estampado ? "Padrão: " : "Cor: "}
                    {systemConfig.colorConfigured ? (
                      <strong>
                        {systemConfig.estampado ? "Imagens capturadas" : systemConfig.referenceColorHex}
                      </strong>
                    ) : (
                      <span className="text-slate-500 italic">
                        {systemConfig.estampado ? "Não capturado" : "Não definida"}
                      </span>
                    )}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    Tolerância:{" "}
                    {systemConfig.deltaConfigured ? (
                      <strong>ΔE ≤ {systemConfig.deltaE}</strong>
                    ) : (
                      <span className="text-slate-500 italic">Não definida</span>
                    )}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>
                    Área:{" "}
                    {systemConfig.analysisAreaConfigured ? (
                      <>
                        <strong>
                          {systemConfig.sampleAreaWidthPercent}% × {systemConfig.sampleAreaHeightPercent}%
                        </strong>{" "}
                        ({systemConfig.samplePoints} pts)
                      </>
                    ) : (
                      <span className="text-slate-500 italic">Não definida</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {systemConfig.analysisAreaConfigured ? (
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border ${
                    systemConfig.estampado
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
                      : "bg-cyan-500/15 border-cyan-500/35 text-cyan-300"
                  }`}
                >
                  {systemConfig.estampado ? "Modo IA: Anomalib (Detalhado)" : "Modo Clássico: OpenCV (Liso)"}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-[11px] font-medium tracking-wider uppercase border border-white/10 bg-slate-950/60 text-slate-400">
                  Detector: Não selecionado
                </span>
              )}
              {(configured || calibrated || systemConfig.deltaConfigured || systemConfig.analysisAreaConfigured || systemConfig.colorConfigured) && (
                <button
                  type="button"
                  onClick={() => void handleResetProcess()}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-white/10 hover:border-amber-400/50 hover:text-amber-300 text-[11px] font-medium text-slate-300 transition-all"
                  title="Zerar etapas do processo atual"
                >
                  <RotateCcw className="w-3 h-3" />
                  Zerar Processo
                </button>
              )}
            </div>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <ActionCard
              stepNumber={1}
              icon={configured ? CheckCircle2 : Settings}
              label="Configuração"
              description={configured ? "Parâmetros e cor base concluídos" : "Definir área, cor, ΔE e detector"}
              highlight={shouldHighlightConfig}
              completed={configured}
              onClick={() => router.push("/painel/config")}
            />
            <ActionCard
              stepNumber={2}
              icon={calibrated ? CheckCircle2 : Sun}
              label="Calibrar Luz"
              description={calibrated ? "Iluminação D65 validada" : "Comparar iluminação do ambiente"}
              highlight={shouldHighlightCalibrate}
              completed={calibrated}
              disabled={!configured}
              onClick={handleCalibrate}
              badge={!configured ? "Requer Config" : !systemConfig.ambientLightConfigured ? "Luz base" : undefined}
            />
            <ActionCard
              stepNumber={3}
              icon={Play}
              label="Iniciar Análise"
              description={startDescription}
              highlight={shouldHighlightStart}
              disabled={!isReady}
              badge={!isReady ? "Bloqueado" : undefined}
              onClick={handleStart}
            />
            <ActionCard
              icon={Camera}
              label="Câmera Ao Vivo"
              description="Visualização direta do stream RTSP"
              onClick={handleOpenCamera}
              bgImage={cameraImage.src}
            />
          </div>

          {/* Stats Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-sansserief text-xs font-semibold tracking-[0.25em] text-slate-300 uppercase whitespace-nowrap">
                Métricas da Sessão
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
              <button
                onClick={() => setStatsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-xs font-medium text-slate-200"
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                Relatório Detalhado
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                icon={Layers}
                label="Tecidos Verificados"
                value={totalLabel}
                sublabel="amostras"
              />
              <StatCard
                icon={CheckCircle2}
                label="Taxa de Aprovação"
                value={successLabel}
                sublabel={dashboardLoading ? "..." : `${stats.totalSuccess.toLocaleString("pt-BR")} aprovados`}
                accent="success"
              />
              <StatCard
                icon={XCircle}
                label="Taxa de Rejeição"
                value={failureLabel}
                sublabel={dashboardLoading ? "..." : `${stats.totalFailure.toLocaleString("pt-BR")} fora do padrão`}
                accent="danger"
              />
            </div>
            {isError && (
              <p className="text-xs text-rose-400">
                Não foi possível carregar os dados do painel. Verifique a conexão com a tabela analysis_records.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Bottom accent line */}
      <div className="relative z-10 h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

      <StatsDetailsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        totalVerified={stats.totalVerified}
        averageTimeLabel={formatMsToSecondsLabel(stats.averageTimeMs)}
        totalSuccess={stats.totalSuccess}
        totalFailure={stats.totalFailure}
        totalDefects={stats.totalDefects}
        patternedVerified={stats.patternedVerified}
        patternedDefects={stats.patternedDefects}
        plainVerified={stats.plainVerified}
        plainDefects={stats.plainDefects}
        successRate={stats.successRate}
        failureRate={stats.failureRate}
        errorBreakdown={stats.errorBreakdown}
        recentAnalyses={stats.recentAnalyses}
      />

      <Dialog open={employeeInfoOpen} onOpenChange={setEmployeeInfoOpen}>
        <DialogContent className="max-w-md border-white/10 bg-slate-900/95 backdrop-blur-xl text-white">
          <DialogHeader>
            <DialogTitle className="font-sansserief tracking-wider uppercase text-cyan-300">
              Ficha do Operador
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Dados do colaborador autenticado nesta estação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 text-sm pt-2">
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-slate-400">Nome:</span>
              <span className="font-medium text-white">{operatorName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-slate-400">Código:</span>
              <span className="font-mono-tech text-cyan-300">{operatorCode}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-slate-400">Cargo:</span>
              <span className="font-medium text-white">{operatorRole}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/10">
              <span className="text-slate-400">Turno:</span>
              <span className="font-medium text-white">{operatorShift}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-400">E-mail:</span>
              <span className="font-mono-tech text-slate-300">{user?.email ?? "Não informado"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
