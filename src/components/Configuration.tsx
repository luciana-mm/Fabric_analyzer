"use client"

import { CheckCircle2, Circle, Scan, SwatchBook, Triangle, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  areConfigurationFieldsComplete,
  getSystemFlowState,
  loadSystemConfig,
  sanitizeSystemConfig,
  saveSystemConfig,
  type SystemConfig,
} from "@/lib/systemConfig"
import { toast } from "sonner"

interface PersistPatchResult {
  config?: SystemConfig;
  savedToSupabase?: boolean;
}

interface ConfigurationProps {
  onClose?: () => void;
  onSaveComplete?: (config: SystemConfig) => void;
  initialConfig?: SystemConfig;
  onPersistPatch?: (patch: Partial<SystemConfig>) => Promise<PersistPatchResult | undefined> | PersistPatchResult | undefined;
}

export const Configuration = ({
  onClose,
  onSaveComplete,
  initialConfig,
  onPersistPatch,
}: ConfigurationProps) => {
  const [config, setConfig] = useState<SystemConfig>(() => initialConfig ?? loadSystemConfig())

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig)
    }
  }, [initialConfig])

  const router = useRouter();

  const configurationStatusLabel = useMemo(() => {
    const step = getSystemFlowState(config).systemStep

    if (step === "READY") {
      return "Configuracoes e calibracao concluidas"
    }
    if (step === "LIGHT") {
      return "Configuracoes concluidas; falta calibracao da luz"
    }
    if (areConfigurationFieldsComplete(config)) {
      return "Configuracao pronta para salvar"
    }
    return "Configuracao pendente"
  }, [config])

  const configSteps = [
    { label: "Área de análise", done: config.analysisAreaConfigured },
    { label: "Cor e luz base", done: config.colorConfigured && config.ambientLightConfigured },
    { label: "Tolerância Delta E", done: config.deltaConfigured },
    { label: "Configuração salva", done: config.configurationSaved },
  ]


  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-8 text-white max-w-3xl mx-auto shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)]">
      <div className="text-center mb-6">
        <h2 className="font-sansserief text-xl font-bold tracking-[0.14em] uppercase text-white">
          Painel de Configuração
        </h2>
        <p className="text-xs text-slate-400 mt-1.5">{configurationStatusLabel}</p>
      </div>

      <div className="mb-8 grid gap-2.5 rounded-xl border border-white/10 bg-slate-950/60 p-4 sm:grid-cols-2">
        {configSteps.map((step) => {
          const Icon = step.done ? CheckCircle2 : Circle;

          return (
            <div
              key={step.label}
              className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-xs font-medium border transition-colors ${
                step.done
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-slate-900/60 border-white/5 text-slate-400"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${step.done ? "text-emerald-400" : "text-slate-500"}`} />
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => router.push("/painel/config/area-analise")}
          className="group relative flex flex-col items-center justify-between p-6 rounded-xl bg-slate-950/60 hover:bg-slate-900/90 border border-white/10 hover:border-cyan-400/50 transition-all duration-300 text-center glow-box active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
            <Scan size={24} />
          </div>
          <div>
            <p className="font-sansserief text-xs font-semibold tracking-wider uppercase text-white">
              Área e Detector
            </p>
            {config.analysisAreaConfigured ? (
              <>
                <p className="text-[11px] text-slate-400 mt-1">
                  {config.sampleAreaWidthPercent}% × {config.sampleAreaHeightPercent}% · {config.samplePoints} pts
                </p>
                <span
                  className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                    config.estampado
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
                      : "bg-cyan-500/15 border-cyan-500/35 text-cyan-300"
                  }`}
                >
                  {config.estampado ? "Anomalib · Detalhado" : "OpenCV · Liso"}
                </span>
              </>
            ) : (
              <>
                <p className="text-[11px] text-slate-500 mt-1">Definir ROI e modo IA</p>
                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase border border-white/10 bg-slate-900 text-slate-400">
                  Pendente
                </span>
              </>
            )}
          </div>
        </button>

        <button
          onClick={() => router.push("/painel/config/capturar-cor")}
          className="group relative flex flex-col items-center justify-between p-6 rounded-xl bg-slate-950/60 hover:bg-slate-900/90 border border-white/10 hover:border-cyan-400/50 transition-all duration-300 text-center glow-box active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
            <SwatchBook size={24} />
          </div>
          <div>
            <p className="font-sansserief text-xs font-semibold tracking-wider uppercase text-white">
              {config.estampado ? "Capturar Imagens Detalhadas" : "Capturar Cor"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {config.estampado ? "Amostras do tecido bom (Anomalib)" : "Luz base D65 e paleta"}
            </p>
            {config.colorConfigured ? (
              config.estampado ? (
                <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border bg-emerald-500/15 border-emerald-500/35 text-emerald-300">
                  Imagens Capturadas
                </span>
              ) : (
                <div className="inline-flex items-center gap-2 mt-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/15">
                  <span
                    className="w-3 h-3 rounded-full border border-white/30"
                    style={{ backgroundColor: config.referenceColorHex }}
                  />
                  <span className="font-mono-tech text-[10px] text-slate-200">
                    {config.referenceColorHex}
                  </span>
                </div>
              )
            ) : (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase border border-white/10 bg-slate-900 text-slate-400">
                Pendente
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => router.push("/painel/config/tolerancia-delta-e")}
          className="group relative flex flex-col items-center justify-between p-6 rounded-xl bg-slate-950/60 hover:bg-slate-900/90 border border-white/10 hover:border-cyan-400/50 transition-all duration-300 text-center glow-box active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
            <Triangle size={24} />
          </div>
          <div>
            <p className="font-sansserief text-xs font-semibold tracking-wider uppercase text-white">
              Tolerância Delta E
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Rigor colorimétrico</p>
            {config.deltaConfigured ? (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/15 font-mono-tech text-[10px] text-cyan-300">
                ΔE ≤ {config.deltaE}
              </span>
            ) : (
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase border border-white/10 bg-slate-900 text-slate-400">
                Pendente
              </span>
            )}
          </div>
        </button>
      </div>

      <button
        onClick={async () => {
          if (!areConfigurationFieldsComplete(config)) {
            toast.error("Configuração incompleta", {
              description: "Configure área de análise, cor e Delta E antes de salvar.",
            });
            return;
          }

          const patch = sanitizeSystemConfig({
            ...config,
            systemStep: "LIGHT",
            configurationSaved: true,
            lightCalibrated: false,
            updatedAt: new Date().toISOString(),
          });
          const updated = onPersistPatch
            ? ((await onPersistPatch(patch)) as PersistPatchResult | undefined)?.config ?? patch
            : saveSystemConfig(patch);
          setConfig(updated);
          onSaveComplete?.(updated);
          toast.success("Configuração geral salva");
          onClose?.();
        }}
        className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs tracking-[0.18em] uppercase shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:shadow-[0_0_32px_rgba(6,182,212,0.5)] transition-all active:scale-[0.99]"
      >
        <Save size={18} />
        <span>Salvar Configuração Geral</span>
      </button>
    </div>
  );
};
