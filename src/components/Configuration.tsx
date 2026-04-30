"use client"

import { Scan, SwatchBook, Triangle, Save } from "lucide-react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  isConfigurationComplete,
  isLightCalibrated,
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

  const persistAndSync = async (patch: Partial<SystemConfig>) => {
    const optimisticConfig = sanitizeSystemConfig({
      ...config,
      ...patch,
      updatedAt: new Date().toISOString(),
    })

    setConfig(optimisticConfig)

    if (onPersistPatch) {
      const persisted = (await onPersistPatch(patch)) as PersistPatchResult | undefined
      const resolvedConfig = persisted?.config ?? optimisticConfig
      setConfig(resolvedConfig)
      onSaveComplete?.(resolvedConfig)

      if (persisted && persisted.savedToSupabase === false) {
        toast.warning("Salvo localmente", {
          description: "Nao foi possivel sincronizar com o Supabase agora.",
        })
      }
      return
    }

    const nextConfig = saveSystemConfig(optimisticConfig)
    setConfig(nextConfig)
    onSaveComplete?.(nextConfig)
  }

  const configurationStatusLabel = useMemo(() => {
    if (isConfigurationComplete(config) && isLightCalibrated(config)) {
      return "Configuracoes e calibracao concluidas"
    }
    if (isConfigurationComplete(config)) {
      return "Configuracoes concluidas; falta calibracao da luz"
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
        className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg flex flex-col items-center gap-2 transition-all ">
        <span className="text-xs text-center">
            <Scan size={35} className="m-auto mb-2"/>
            Área de Análise
        </span>
        </button>
        
        <button 
          onClick={() => router.push("/painel/config/capturar-cor")}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs">
        <span>
            <SwatchBook size={35} className="m-auto mb-2"/>
            Capturar Cor
        </span>
        </button>

        <button 
          onClick={() => router.push("/painel/config/tolerancia-delta-e")}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs">
        <Triangle size={35} className="m-auto mb-2"/>
          Tolerância Delta E
        </button>

        <button
          onClick={async () => {
            const updated = onPersistPatch
              ? ((await onPersistPatch(config)) as PersistPatchResult | undefined)?.config ?? config
              : saveSystemConfig(config)
            setConfig(updated)
            onSaveComplete?.(updated)
            toast.success("Configuracao geral salva")
            onClose?.()
          }}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs col-start-1"
        >
          <Save size={35} className="m-auto mb-2"/>
          Salvar Configuração
        </button>
      </div>
    </div>
  )
}