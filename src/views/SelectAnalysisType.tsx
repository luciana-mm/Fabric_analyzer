"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Shirt } from "lucide-react";
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
        <button
          onClick={() => router.push("/painel")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-xs font-medium text-slate-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Painel
        </button>

        <div className="hidden md:block text-center">
          <h1 className="font-sansserief text-lg font-bold tracking-[0.16em] text-white uppercase leading-tight">
            Modo de Inspeção
          </h1>
          <p className="text-[11px] tracking-[0.2em] text-slate-400 uppercase mt-0.5">
            Selecione o tipo de material na bancada
          </p>
        </div>

        <div className="w-24" />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-semibold tracking-[0.2em] text-cyan-300 uppercase mb-3">
              Etapa 3 · Iniciar Inspeção
            </span>
            <h2 className="font-sansserief text-2xl font-bold tracking-[0.12em] text-white uppercase">
              O que será inspecionado agora?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tecido Card */}
            <button
              onClick={handleSelectTecido}
              className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl hover:border-cyan-400/50 hover:bg-slate-900/90 transition-all duration-300 active:scale-[0.98] hover:-translate-y-1 glow-box"
            >
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all duration-300">
                <Shirt className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="font-sansserief text-lg font-bold tracking-[0.16em] uppercase text-white">
                  Rolo / Tecido
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Inspeção contínua de tecido com detecção em tempo real (OpenCV para liso ou Anomalib para estampado) e rastreamento de falhas.
                </p>
              </div>
            </button>

            {/* Peças Card */}
            <button
              onClick={handleSelectPecas}
              className="group relative flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl hover:border-blue-400/50 hover:bg-slate-900/90 transition-all duration-300 active:scale-[0.98] hover:-translate-y-1 glow-box"
            >
              <div className="w-20 h-20 rounded-2xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400 group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all duration-300">
                <Package className="w-10 h-10" />
              </div>
              <div className="text-center">
                <h3 className="font-sansserief text-lg font-bold tracking-[0.16em] uppercase text-white">
                  Peças Confeccionadas
                </h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Inspeção pontual de peças prontas ou recortes individuais comparando fidelidade colorimétrica (ΔE).
                </p>
              </div>
            </button>
          </div>

          <div className="mt-8 p-4 rounded-xl border border-white/10 bg-slate-900/50 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">
              Todas as leituras serão vinculadas automaticamente ao seu turno e ao código de lote configurado.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SelectAnalysisType;
