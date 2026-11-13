"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Layers,
  Lock,
  Play,
  RotateCcw,
  Settings,
  Sun,
  XCircle,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { OperatorShell } from "@/components/OperatorShell";
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
  const iconStyle = {
    default: "bg-stone-100 text-stone-600",
    success: "bg-emerald-50 text-emerald-600",
    danger: "bg-rose-50 text-rose-600",
  }[accent];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="mt-2.5 font-mono-tech text-2xl font-bold text-stone-900">{value}</p>
      {sublabel && <p className="mt-1 text-xs text-stone-400">{sublabel}</p>}
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
  stepLabel: string;
}

const ActionCard = ({
  icon: Icon,
  label,
  description,
  onClick,
  highlight,
  completed,
  disabled,
  stepLabel,
}: ActionCardProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`group flex flex-col justify-between p-5 rounded-xl border text-left transition-all min-h-[168px] ${
      disabled
        ? "bg-stone-50 border-stone-200/80 opacity-60 cursor-not-allowed"
        : highlight
        ? "bg-white border-stone-900 ring-1 ring-stone-900/10 shadow-sm hover:shadow"
        : completed
        ? "bg-white border-emerald-200 shadow-sm hover:border-emerald-300"
        : "bg-white border-stone-200 shadow-sm hover:border-stone-300 hover:shadow"
    }`}
  >
    <div className="flex items-center justify-between w-full">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          completed
            ? "bg-emerald-50 text-emerald-600"
            : highlight && !disabled
            ? "bg-stone-900 text-white"
            : "bg-stone-100 text-stone-600"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-[11px] font-medium text-stone-400">{stepLabel}</span>
    </div>

    <div className="mt-4">
      <p className="text-sm font-semibold text-stone-900">{label}</p>
      <p className="text-xs text-stone-500 mt-1 leading-relaxed">{description}</p>
    </div>

    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-1.5 text-xs font-medium">
      {disabled ? (
        <span className="inline-flex items-center gap-1 text-stone-400">
          <Lock className="w-3 h-3" />
          Bloqueado
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-stone-900 group-hover:translate-x-0.5 transition-transform">
          Abrir
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      )}
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
      const result = await fetchJson<{
        data: { display_name?: string | null; employee_code?: string | null; shift?: string | null; job_title?: string | null } | null;
      }>(`/api/profiles?userId=${encodeURIComponent(user?.id ?? "")}`);

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
    <OperatorShell
      systemStep={systemStep}
      operatorName={operatorName}
      onOpenProfile={() => setEmployeeInfoOpen(true)}
      onSignOut={handleSignOut}
    >
      <div className="w-full max-w-6xl mx-auto space-y-8">
        {/* Barra de Parâmetros Atuais do Lote */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              {systemConfig.estampado ? (
                <div className="w-9 h-9 rounded-lg border border-orange-200 bg-orange-50 flex items-center justify-center text-xs font-bold text-[#B85D3B]">
                  IA
                </div>
              ) : systemConfig.colorConfigured ? (
                <div
                  className="w-9 h-9 rounded-lg border border-stone-200 shadow-inner"
                  style={{ backgroundColor: systemConfig.referenceColorHex }}
                  title={`Cor de referência: ${systemConfig.referenceColorHex}`}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-xs text-stone-400">
                  ?
                </div>
              )}
              <div>
                <p className="text-[11px] text-stone-400">Lote</p>
                <p className="font-mono-tech text-xs font-semibold text-stone-900">
                  {configured ? systemConfig.activeTissueCode : "Aguardando"}
                </p>
              </div>
            </div>

            <div className="h-7 w-px bg-stone-200 hidden sm:block" />

            <div>
              <p className="text-[11px] text-stone-400">
                {systemConfig.estampado ? "Padrão" : "Cor / Padrão"}
              </p>
              <p className="text-xs font-semibold text-stone-900">
                {systemConfig.colorConfigured
                  ? systemConfig.estampado
                    ? "Imagens capturadas"
                    : systemConfig.referenceColorHex
                  : "Não definida"}
              </p>
            </div>

            <div className="h-7 w-px bg-stone-200 hidden sm:block" />

            <div>
              <p className="text-[11px] text-stone-400">Tolerância</p>
              <p className="font-mono-tech text-xs font-semibold text-stone-900">
                {systemConfig.deltaConfigured ? `ΔE ≤ ${systemConfig.deltaE}` : "Não definida"}
              </p>
            </div>

            <div className="h-7 w-px bg-stone-200 hidden sm:block" />

            <div>
              <p className="text-[11px] text-stone-400">Área</p>
              <p className="font-mono-tech text-xs font-semibold text-stone-900">
                {systemConfig.analysisAreaConfigured
                  ? `${systemConfig.sampleAreaWidthPercent}% × ${systemConfig.sampleAreaHeightPercent}% (${systemConfig.samplePoints} pts)`
                  : "Não definida"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {systemConfig.analysisAreaConfigured ? (
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  systemConfig.estampado
                    ? "bg-orange-50 border-orange-200 text-[#B85D3B]"
                    : "bg-stone-100 border-stone-200 text-stone-700"
                }`}
              >
                {systemConfig.estampado ? "Modo IA: Anomalib (Detalhado)" : "Modo Clássico: OpenCV (Liso)"}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium border border-stone-200 bg-stone-50 text-stone-500">
                Detector: Não selecionado
              </span>
            )}

            {(configured ||
              calibrated ||
              systemConfig.deltaConfigured ||
              systemConfig.analysisAreaConfigured ||
              systemConfig.colorConfigured) && (
              <button
                type="button"
                onClick={() => void handleResetProcess()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                Zerar Processo
              </button>
            )}
          </div>
        </div>

        {/* Próximos Passos */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Próximos Passos
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <ActionCard
              stepLabel="Etapa 1"
              icon={configured ? CheckCircle2 : Settings}
              label="Configuração"
              description={configured ? "Parâmetros e cor base concluídos" : "Definir área, cor, ΔE e detector"}
              highlight={shouldHighlightConfig}
              completed={configured}
              onClick={() => router.push("/painel/config")}
            />
            <ActionCard
              stepLabel="Etapa 2"
              icon={calibrated ? CheckCircle2 : Sun}
              label="Calibrar Luz"
              description={calibrated ? "Iluminação D65 validada" : "Comparar iluminação do ambiente (D65)"}
              highlight={shouldHighlightCalibrate}
              completed={calibrated}
              disabled={!configured}
              onClick={handleCalibrate}
            />
            <ActionCard
              stepLabel="Etapa 3"
              icon={Play}
              label="Iniciar Análise"
              description={startDescription}
              highlight={shouldHighlightStart}
              disabled={!isReady}
              onClick={handleStart}
            />
            <ActionCard
              stepLabel="Livre"
              icon={Camera}
              label="Câmera Ao Vivo"
              description="Visualização direta do stream RTSP"
              onClick={handleOpenCamera}
            />
          </div>
        </section>

        {/* Métricas da Sessão */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Métricas da Sessão
            </h2>
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 shadow-sm transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5 text-stone-500" />
              Relatório Detalhado
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              icon={Layers}
              label="Tecidos verificados"
              value={totalLabel}
              sublabel="Amostras lidas hoje"
            />
            <StatCard
              icon={CheckCircle2}
              label="Taxa de aprovação"
              value={successLabel}
              sublabel={dashboardLoading ? "..." : `${stats.totalSuccess.toLocaleString("pt-BR")} aprovados`}
              accent="success"
            />
            <StatCard
              icon={XCircle}
              label="Taxa de rejeição"
              value={failureLabel}
              sublabel={dashboardLoading ? "..." : `${stats.totalFailure.toLocaleString("pt-BR")} fora do padrão`}
              accent="danger"
            />
          </div>

          {isError && (
            <p className="text-xs text-rose-600">
              Não foi possível carregar os dados do painel. Verifique a conexão com o banco.
            </p>
          )}
        </section>
      </div>

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
        <DialogContent className="max-w-md border-stone-200 bg-white text-stone-900">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-stone-900">
              Ficha do Operador
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Dados do colaborador autenticado nesta estação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 text-sm pt-2">
            <div className="flex justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500">Nome:</span>
              <span className="font-medium text-stone-900">{operatorName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500">Código:</span>
              <span className="font-mono-tech text-stone-900">{operatorCode}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500">Cargo:</span>
              <span className="font-medium text-stone-900">{operatorRole}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500">Turno:</span>
              <span className="font-medium text-stone-900">{operatorShift}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-stone-500">E-mail:</span>
              <span className="font-mono-tech text-stone-700">{user?.email ?? "Não informado"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </OperatorShell>
  );
};

export default Index;
