"use client"

import { Scan, SwatchBook, Triangle, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  areConfigurationFieldsComplete,
  getSystemStep,
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
  onPersistPatch?: (patch: Partial<SystemConfig>) => Promise<PersistPatchResult | void> | PersistPatchResult | void;
}

export const Configuration = ({
  onClose,
  onSaveComplete,
  initialConfig,
  onPersistPatch,
}: ConfigurationProps) => {
  const [config, setConfig] = useState<SystemConfig>(() => initialConfig ?? loadSystemConfig())

  const router = useRouter();

  const configurationStatusLabel = useMemo(() => {
    const step = getSystemStep(config)

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


  return(
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-2xl mx-auto">
      <h2 className="text-center text-xl font-bold mb-6">Painel de configuração</h2>
      <p className="text-center text-xs text-slate-300 mb-6">{configurationStatusLabel}</p>
      
      <div className="grid grid-cols-3 gap-4">
        <button 
        onClick={() => router.push("/painel/config/area-analise")}
        className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg flex flex-col items-center gap-2 transition-all border border-white/10  border-foreground/30 glow-box hover:bg-foreground/15">
        <span className="text-xs text-center">
            <Scan size={35} className="m-auto mb-2"/>
            Área de Análise
        </span>
        </button>
        
        <button 
          onClick={() => router.push("/painel/config/capturar-cor")}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs border border-white/10  border-foreground/30 glow-box hover:bg-foreground/15">
        <span>
            <SwatchBook size={35} className="m-auto mb-2"/>
            Capturar Cor
        </span>
        </button>

        <button 
          onClick={() => router.push("/painel/config/tolerancia-delta-e")}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs border border-white/10  border-foreground/30 glow-box hover:bg-foreground/15">
        <Triangle size={35} className="m-auto mb-2"/>
          Tolerância Delta E
        </button>

        <button
          onClick={async () => {
            if (!areConfigurationFieldsComplete(config)) {
              toast.error("Configuracao incompleta", {
                description: "Configure area de analise, cor e Delta E antes de salvar.",
              })
              return
            }

            const patch = sanitizeSystemConfig({
              ...config,
              systemStep: "LIGHT",
              lightCalibrated: false,
              updatedAt: new Date().toISOString(),
            })
            const updated = onPersistPatch
              ? ((await onPersistPatch(patch)) as PersistPatchResult | undefined)?.config ?? patch
              : saveSystemConfig(patch)
            setConfig(updated)
            onSaveComplete?.(updated)
            toast.success("Configuracao geral salva")
            onClose?.()
          }}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs col-start-1 border border-white/10  border-foreground/30 glow-box hover:bg-foreground/15"
        >
          <Save size={35} className="m-auto mb-2"/>
          Salvar Configuração
        </button>
      </div>
    </div>
  )
}
