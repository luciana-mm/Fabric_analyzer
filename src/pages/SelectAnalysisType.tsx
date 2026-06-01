"use client";

import { useRouter } from "next/navigation";
import { Fabric, Package, ArrowLeft } from "lucide-react";
import gridBg from "@/assets/grid-bg.jpg";

const SelectAnalysisType = () => {
  const router = useRouter();

  const handleSelectTecido = () => {
    router.push("/painel/analise/tecido");
  };

  const handleSelectPecas = () => {
    router.push("/painel/analise/pecas");
  };

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
        <button
          onClick={() => router.push("/painel")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-sansserief text-[10px] tracking-[0.25em] uppercase text-foreground/80"
        >
          <ArrowLeft className="w-3 h-3" />
          Voltar
        </button>

        <div className="hidden md:block text-center">
          <h1 className="font-sansserief text-xl tracking-[0.15em] text-foreground uppercase leading-tight">
            Análise de Cores
          </h1>
          <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase mt-1">
            Selecione o tipo de análise
          </p>
        </div>

        <div className="w-12" />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-12">
            <p className="font-sansserief text-[11px] tracking-[0.4em] text-muted-foreground uppercase mb-3">
              Escolha a análise
            </p>
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tecido Card */}
            <button
              onClick={handleSelectTecido}
              className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm hover:border-foreground/30 hover:bg-card/60 transition-all duration-300 active:scale-[0.98]"
            >
              <div className="w-20 h-20 rounded-xl bg-foreground/10 flex items-center justify-center group-hover:bg-foreground/15 transition-all duration-300">
                <Fabric className="w-10 h-10 text-foreground" />
              </div>
              <div className="text-center">
                <h2 className="font-sansserief text-lg tracking-[0.2em] uppercase text-foreground/90">
                  Tecido
                </h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Analise a cor de um tecido completo ou amostra de pano.
                </p>
              </div>
            </button>

            {/* Peças Card */}
            <button
              onClick={handleSelectPecas}
              className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm hover:border-foreground/30 hover:bg-card/60 transition-all duration-300 active:scale-[0.98]"
            >
              <div className="w-20 h-20 rounded-xl bg-foreground/10 flex items-center justify-center group-hover:bg-foreground/15 transition-all duration-300">
                <Package className="w-10 h-10 text-foreground" />
              </div>
              <div className="text-center">
                <h2 className="font-sansserief text-lg tracking-[0.2em] uppercase text-foreground/90">
                  Peças
                </h2>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Analise a cor de peças ou vestuários já confeccionados.
                </p>
              </div>
            </button>
          </div>

          <div className="mt-10 p-4 rounded-xl border border-border/30 bg-muted/20">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              A análise será configurada de acordo com o tipo selecionado. Você
              poderá mudar entre tipos na próxima sessão.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SelectAnalysisType;
