"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Camera, RefreshCw, Circle, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import gridBg from "@/assets/grid-bg.jpg";

const CAMERA_PROXY_URL = process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ?? "http://127.0.0.1:8090";

const CameraStream = () => {
  const router = useRouter();
  const [streamKey, setStreamKey] = useState(0);
  const [proxyOnline, setProxyOnline] = useState(false);
  const [proxyChecked, setProxyChecked] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkProxy = async () => {
      try {
        const response = await fetch(`${CAMERA_PROXY_URL}/health`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Proxy respondeu com status ${response.status}`);
        }

        if (!cancelled) {
          setProxyOnline(true);
          setProxyError(null);
          setProxyChecked(true);
        }
      } catch {
        if (!cancelled) {
          setProxyOnline(false);
          setProxyError(`Nao foi possivel acessar ${CAMERA_PROXY_URL}`);
          setProxyChecked(true);
        }
      }
    };

    void checkProxy();

    const intervalId = window.setInterval(() => {
      void checkProxy();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

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
                Camera
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
            {!proxyChecked || proxyOnline ? (
              <img
                src={streamUrl}
                alt="Video ao vivo da camera"
                className="w-full max-h-[75vh] object-contain bg-black"
                onError={() => {
                  setProxyOnline(false);
                  setProxyError(`Falha ao carregar o stream em ${CAMERA_PROXY_URL}`);
                }}
              />
            ) : (
              <div className="min-h-[55vh] flex items-center justify-center p-8 bg-black/60">
                <div className="w-full max-w-lg rounded-2xl border border-border/30 bg-card/70 p-6 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-display text-lg tracking-[0.18em] uppercase text-foreground">
                      Camera offline
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {proxyError ?? "O servidor local da camera nao respondeu."}
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                      Tente novamente mais tarde.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setProxyChecked(false);
                        setProxyError(null);
                        setProxyOnline(false);
                        restartStream();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background font-display text-[10px] tracking-[0.25em] uppercase"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Tentar novamente
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/painel")}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 font-display text-[10px] tracking-[0.25em] uppercase text-foreground/80"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CameraStream;
