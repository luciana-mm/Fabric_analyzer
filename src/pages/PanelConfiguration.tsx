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
  const { config, isLoading, persistPatch, loadSource } = useOperatorSystemConfig(user?.id);

  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      runAllTests();
    }
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6 border-b border-border/20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/painel")}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-sansserief text-[10px] tracking-[0.25em] uppercase text-foreground/80"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar
          </button>

          <div className="hidden md:flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h1 className="font-sansserief text-base tracking-[0.2em] uppercase text-foreground">
                Configuracoes
              </h1>
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Persistencia por operador
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-2xl">
          {isLoading ? (
            <div className="min-h-[320px] rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
