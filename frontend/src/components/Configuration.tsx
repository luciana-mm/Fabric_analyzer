"use client"

import { ArrowRight, CheckCircle2, Save, Scan, SwatchBook, Triangle } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  areConfigurationFieldsComplete,
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

  const configSteps = [
    { num: 1, label: "Área de análise", done: config.analysisAreaConfigured },
    { num: 2, label: "Cor e luz base", done: config.colorConfigured && config.ambientLightConfigured },
    { num: 3, label: "Tolerância ΔE", done: config.deltaConfigured },
    { num: 4, label: "Configuração salva", done: config.configurationSaved },
  ]

  const handleSave = async () => {
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
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Coluna Esquerda: Resumo do Lote + Checklist + Botão Salvar */}
      <div className="lg:col-span-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          <div className="pb-3 border-b border-stone-100">
            <p className="text-[11px] font-medium text-stone-400">Código do lote</p>
            <p className="font-mono-tech text-sm font-bold text-stone-900 mt-0.5">
              {config.activeTissueCode}
            </p>
          </div>

          <div className="pb-3 border-b border-stone-100">
            <p className="text-[11px] font-medium text-stone-400">Cor / Padrão</p>
            <div className="flex items-center gap-2 mt-1">
              {config.colorConfigured && !config.estampado && (
                <span
                  className="w-4 h-4 rounded border border-stone-300 shrink-0"
                  style={{ backgroundColor: config.referenceColorHex }}
                />
              )}
              <p className="text-xs font-semibold text-stone-900">
                {config.colorConfigured
                  ? config.estampado
                    ? "Imagens capturadas (IA)"
                    : config.referenceColorHex
                  : "Aguardando captura"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-medium text-stone-400 mb-2.5">Checklist</p>
            <div className="space-y-2">
              {configSteps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center gap-2.5 text-xs"
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-stone-100 border border-stone-200 text-stone-500 text-[10px] font-semibold flex items-center justify-center shrink-0">
                      {step.num}
                    </span>
                  )}
                  <span className={step.done ? "font-medium text-stone-900" : "text-stone-500"}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-sm transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Salvar Configuração</span>
        </button>
      </div>

      {/* Coluna Direita: 3 Cartões de Etapas */}
      <div className="lg:col-span-8 space-y-3.5">
        <button
          type="button"
          onClick={() => router.push("/painel/config/area-analise")}
          className="w-full group flex items-center justify-between gap-4 p-5 rounded-xl bg-white border border-stone-200 hover:border-stone-400 shadow-sm transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-200 text-[#B85D3B] flex items-center justify-center shrink-0">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">Área e Detector</p>
              <p className="font-mono-tech text-xs text-stone-500 mt-0.5">
                {config.analysisAreaConfigured
                  ? `${config.sampleAreaWidthPercent}% × ${config.sampleAreaHeightPercent}% · ${config.samplePoints} pts · ${config.estampado ? "Anomalib" : "OpenCV"}`
                  : "Definir ROI, pontos e modo (OpenCV / Anomalib)"}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => router.push("/painel/config/capturar-cor")}
          className="w-full group flex items-center justify-between gap-4 p-5 rounded-xl bg-white border border-stone-200 hover:border-stone-400 shadow-sm transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center shrink-0">
              <SwatchBook className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">
                {config.estampado ? "Capturar Imagens e Luz" : "Capturar Cor e Luz"}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {config.colorConfigured
                  ? config.estampado
                    ? "Imagens de referência capturadas"
                    : `Cor padrão ${config.referenceColorHex} · Luz base registrada`
                  : "Ainda não capturada"}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => router.push("/painel/config/tolerancia-delta-e")}
          className="w-full group flex items-center justify-between gap-4 p-5 rounded-xl bg-white border border-stone-200 hover:border-stone-400 shadow-sm transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center shrink-0">
              <Triangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">Tolerância ΔE</p>
              <p className="font-mono-tech text-xs text-stone-500 mt-0.5">
                {config.deltaConfigured ? `ΔE ≤ ${config.deltaE}` : "Definir limite máximo de desvio"}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
      </div>
    </div>
  );
};
