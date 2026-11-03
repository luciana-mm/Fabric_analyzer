"use client";

import { ArrowLeft, Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import gridBg from "@/assets/grid-bg.jpg";
import { CameraPreview } from "@/components/CameraPreview";

const CameraStream = () => {
  const router = useRouter();

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
              <Camera className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="font-sansserief text-sm font-bold tracking-[0.16em] uppercase text-white">
                Monitoramento Ao Vivo
              </h1>
              <p className="text-[11px] tracking-[0.18em] uppercase text-slate-400">
                Stream MJPEG em tempo real · Porta 8090
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 md:px-10 py-8">
        <div className="w-full max-w-6xl mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/65 backdrop-blur-xl px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Visualização direta da câmera na linha de inspeção (modo somente leitura).
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl overflow-hidden shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)]">
            <CameraPreview
              className="w-full min-h-[58vh] max-h-[76vh]"
              imageClassName="w-full max-h-[76vh] object-contain bg-black"
              fallbackMessage="O servidor local da câmera (camera-proxy :8090) não respondeu."
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CameraStream;
