"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Grid,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Square,
  Video,
  VideoOff,
} from "lucide-react";
import type { CameraDevice, DvrDevice } from "@/types/dvr";

export type MosaicGridSize = "1x1" | "2x2" | "3x3";
export type StreamRenderMode = "raw" | "analyzed";

export interface MosaicCameraItem {
  camera: CameraDevice;
  dvr: DvrDevice;
}

interface CftvMosaicPlayerProps {
  dvrs: DvrDevice[];
  cameraProxyUrl: string;
  onCaptureSnapshot: (
    dvr: DvrDevice,
    channelNumber: number,
    cameraName: string,
    camId: string
  ) => void;
  capturingCamId: string | null;
}

const GRID_CAPACITY: Record<MosaicGridSize, number> = {
  "1x1": 1,
  "2x2": 4,
  "3x3": 9,
};

export function CftvMosaicPlayer({
  dvrs,
  cameraProxyUrl,
  onCaptureSnapshot,
  capturingCamId,
}: CftvMosaicPlayerProps) {
  const [gridSize, setGridSize] = useState<MosaicGridSize>("2x2");
  const [streamMode, setStreamMode] = useState<StreamRenderMode>("raw");
  const [page, setPage] = useState(0);
  const [pausedCamIds, setPausedCamIds] = useState<Record<string, boolean>>({});
  const [streamErrorIds, setStreamErrorIds] = useState<Record<string, boolean>>({});
  const [focusedCamId, setFocusedCamId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Polling leve para canais Mock ou em fallback de snapshot
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRefreshTick((t) => (t + 1) % 10000);
    }, 2500);
    return () => window.clearInterval(timer);
  }, []);

  // Flatten todas as câmeras ativas dos DVRs cadastrados
  const allCameras = useMemo<MosaicCameraItem[]>(() => {
    const items: MosaicCameraItem[] = [];
    for (const dvr of dvrs) {
      for (const cam of dvr.cameras || []) {
        if (cam.is_active !== false) {
          items.push({ camera: cam, dvr });
        }
      }
    }
    return items;
  }, [dvrs]);

  const effectiveGrid: MosaicGridSize = focusedCamId ? "1x1" : gridSize;
  const capacity = GRID_CAPACITY[effectiveGrid];

  const visibleItems = useMemo(() => {
    if (focusedCamId) {
      const found = allCameras.find((item) => item.camera.id === focusedCamId);
      return found ? [found] : allCameras.slice(0, 1);
    }
    const start = page * capacity;
    return allCameras.slice(start, start + capacity);
  }, [allCameras, capacity, focusedCamId, page]);

  const totalPages = Math.max(1, Math.ceil(allCameras.length / capacity));

  useEffect(() => {
    if (page >= totalPages) {
      setPage(0);
    }
  }, [page, totalPages]);

  const togglePauseCamera = (camId: string) => {
    setPausedCamIds((prev) => ({ ...prev, [camId]: !prev[camId] }));
  };

  const retryCameraStream = (camId: string) => {
    setStreamErrorIds((prev) => ({ ...prev, [camId]: false }));
    setRefreshTick((t) => t + 1);
  };

  const gridClassName = {
    "1x1": "grid-cols-1",
    "2x2": "grid-cols-1 md:grid-cols-2",
    "3x3": "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  }[effectiveGrid];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/75 backdrop-blur-xl p-5 shadow-2xl space-y-4">
      {/* Barra de Controle do Mosaico */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-white flex items-center gap-2">
              Player CFTV Multi-Câmera (Mosaico)
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {allCameras.length} Canais Ativos
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Lazy-loading automático de streams fora de foco · Suporte a MJPEG & IA Overlay
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Modo Stream Bruto vs Analisado IA */}
          <div className="flex items-center rounded-xl bg-slate-950/90 border border-white/10 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStreamMode("raw")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                streamMode === "raw"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Live Bruto
            </button>
            <button
              type="button"
              onClick={() => setStreamMode("analyzed")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                streamMode === "analyzed"
                  ? "bg-purple-500/25 text-purple-200 border border-purple-400/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              IA Overlay (OpenCV/Anomalib)
            </button>
          </div>

          {/* Seletor de Grade 1x1 / 2x2 / 3x3 */}
          <div className="flex items-center rounded-xl bg-slate-950/90 border border-white/10 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setFocusedCamId(null);
                setGridSize("1x1");
                setPage(0);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-mono-tech transition-all flex items-center gap-1 ${
                effectiveGrid === "1x1"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Visualização 1x1 (Tela Única)"
            >
              <Square className="w-3.5 h-3.5" />
              1x1
            </button>
            <button
              type="button"
              onClick={() => {
                setFocusedCamId(null);
                setGridSize("2x2");
                setPage(0);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-mono-tech transition-all flex items-center gap-1 ${
                effectiveGrid === "2x2"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Mosaico 2x2 (4 Canais)"
            >
              <Grid className="w-3.5 h-3.5" />
              2x2
            </button>
            <button
              type="button"
              onClick={() => {
                setFocusedCamId(null);
                setGridSize("3x3");
                setPage(0);
              }}
              className={`px-2.5 py-1.5 rounded-lg font-mono-tech transition-all flex items-center gap-1 ${
                effectiveGrid === "3x3"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Mosaico 3x3 (9 Canais)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              3x3
            </button>
          </div>

          {/* Paginação do Mosaico */}
          {!focusedCamId && totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs font-mono-tech text-slate-300 bg-slate-950/90 border border-white/10 rounded-xl px-2.5 py-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-0.5 hover:text-cyan-300 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Pág {page + 1}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="p-0.5 hover:text-cyan-300 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grade de Vídeo */}
      <div className={`grid gap-4 ${gridClassName}`}>
        {Array.from({ length: capacity }).map((_, slotIdx) => {
          const item = visibleItems[slotIdx];
          if (!item) {
            return (
              <div
                key={`empty-slot-${slotIdx}`}
                className="aspect-video rounded-xl border border-dashed border-white/10 bg-slate-950/50 flex flex-col items-center justify-center text-slate-500 gap-2"
              >
                <VideoOff className="w-7 h-7 opacity-40" />
                <span className="text-[11px] font-mono-tech uppercase tracking-wider">
                  Slot {slotIdx + 1} Disponível
                </span>
              </div>
            );
          }

          const { camera, dvr } = item;
          const isPaused = Boolean(pausedCamIds[camera.id]);
          const hasStreamError = Boolean(streamErrorIds[camera.id]);
          const isFocused = focusedCamId === camera.id;
          const isCapturing = capturingCamId === camera.id;

          const streamSrc =
            dvr.brand === "mock"
              ? `${cameraProxyUrl}/dvr/mock/snapshot?channel=${camera.channel_number}&t=${refreshTick}`
              : streamMode === "analyzed"
              ? `${cameraProxyUrl}/stream-analyzed.mjpg?cam=${encodeURIComponent(camera.id)}`
              : `${cameraProxyUrl}/stream.mjpg?cam=${encodeURIComponent(camera.id)}`;

          return (
            <div
              key={camera.id}
              className="relative aspect-video rounded-xl overflow-hidden border border-white/15 bg-black flex flex-col justify-between group shadow-lg"
            >
              {/* Camada de Vídeo / Fallback */}
              {!isPaused && !hasStreamError ? (
                <img
                  src={streamSrc}
                  alt={camera.name}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  onError={() =>
                    setStreamErrorIds((prev) => ({ ...prev, [camera.id]: true }))
                  }
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-cyan-400 mb-2.5">
                    {isPaused ? (
                      <Pause className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Video className="w-5 h-5 text-cyan-400" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white">{camera.name}</p>
                  <p className="text-[11px] font-mono-tech text-slate-400 mt-1">
                    {dvr.host}:{dvr.rtsp_port} · CH {camera.channel_number} ({dvr.brand.toUpperCase()})
                  </p>
                  <span className="mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech bg-slate-800 text-slate-300 border border-white/10">
                    {isPaused
                      ? "STREAM PAUSADO (ECONOMIA DE BANDA)"
                      : "PROXY 8090 STANDBY · USE SNAPSHOT OU RECONECTAR"}
                  </span>
                </div>
              )}

              {/* Overlay Topo: Identificação do Canal */}
              <div className="relative z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isPaused
                        ? "bg-amber-400"
                        : camera.status === "online"
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-rose-400"
                    }`}
                  />
                  <span className="text-xs font-semibold text-white truncate drop-shadow">
                    {camera.name}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-black/60 border border-white/10 font-mono-tech text-[10px] text-cyan-300 uppercase shrink-0">
                  {dvr.brand} · CH {camera.channel_number}
                </span>
              </div>

              {/* Overlay Base: Controles do Player */}
              <div className="relative z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
                <span className="text-[10px] font-mono-tech text-slate-300 truncate max-w-[55%]">
                  {streamMode === "analyzed" ? "IA OVERLAY" : "LIVE"} · {camera.fps || 12} FPS
                </span>

                <div className="flex items-center gap-1.5">
                  {hasStreamError && !isPaused && (
                    <button
                      type="button"
                      onClick={() => retryCameraStream(camera.id)}
                      className="p-1.5 rounded-lg bg-slate-900/90 border border-white/15 hover:border-cyan-400 text-cyan-300 transition-all"
                      title="Tentar reconectar stream"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => togglePauseCamera(camera.id)}
                    className="p-1.5 rounded-lg bg-slate-900/90 border border-white/15 hover:border-cyan-400 text-slate-200 transition-all"
                    title={isPaused ? "Retomar Stream" : "Pausar Stream"}
                  >
                    {isPaused ? (
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Pause className="w-3.5 h-3.5 text-amber-300" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isCapturing}
                    onClick={() =>
                      onCaptureSnapshot(
                        dvr,
                        camera.channel_number,
                        camera.name,
                        camera.id
                      )
                    }
                    className="p-1.5 rounded-lg bg-slate-900/90 border border-white/15 hover:border-cyan-400 text-cyan-300 transition-all"
                    title="Capturar Snapshot deste canal"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setFocusedCamId(isFocused ? null : camera.id)}
                    className="p-1.5 rounded-lg bg-slate-900/90 border border-white/15 hover:border-cyan-400 text-slate-200 transition-all"
                    title={isFocused ? "Voltar à Grade" : "Expandir Canal (1x1)"}
                  >
                    {isFocused ? (
                      <Minimize2 className="w-3.5 h-3.5 text-cyan-300" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
