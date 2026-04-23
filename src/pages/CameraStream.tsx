"use client";

import { useState } from "react";
import { ArrowLeft, Camera, RefreshCw, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import gridBg from "@/assets/grid-bg.jpg";

const CAMERA_PROXY_URL = process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ?? "http://127.0.0.1:8090";

const CameraStream = () => {
  const router = useRouter();
  const [streamKey, setStreamKey] = useState(0);

  const streamUrl = `${CAMERA_PROXY_URL}/stream.mjpg?t=${streamKey}`;
  const restartStream = () => setStreamKey((value) => value + 1);

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
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-foreground/80"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar
          </button>

          <div className="hidden md:flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h1 className="font-display text-base tracking-[0.2em] uppercase text-foreground">
                Camera Hikvision
              </h1>
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Stream em tempo real
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 md:px-10 py-8">
        <div className="w-full max-w-6xl mx-auto">

          <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm overflow-hidden">
            <img
              src={streamUrl}
              alt="Video ao vivo da camera"
              className="w-full max-h-[75vh] object-contain bg-black"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default CameraStream;
