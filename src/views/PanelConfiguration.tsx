"use client";

import { useEffect } from "react";
import { ArrowLeft, Loader2, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import gridBg from "@/assets/grid-bg.jpg";
import { Configuration } from "@/components/Configuration";
import { runAllTests } from "@/utils/colorConversionTests";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";

const PanelConfiguration = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { config, isLoading, persistPatch } = useOperatorSystemConfig(user?.id);

  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      runAllTests();
    }
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#050811]">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 industrial-bg" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/painel")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-xs font-medium text-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Painel
          </button>

          <div className="hidden md:flex items-center gap-3 pl-2 border-l border-white/10">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
              <Settings className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-sansserief text-sm font-bold tracking-[0.16em] uppercase text-white">
                Configuração de Parâmetros
              </h1>
              <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">
                Persistência individual por operador
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-3xl">
          {isLoading ? (
            <div className="min-h-[340px] rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : (
            <Configuration
              initialConfig={config}
              onPersistPatch={persistPatch}
              onClose={() => {
                router.push("/painel");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default PanelConfiguration;
