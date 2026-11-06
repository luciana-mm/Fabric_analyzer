"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Cpu,
  Download,
  Edit3,
  Eye,
  LayoutGrid,
  Plus,
  Power,
  Radar,
  RefreshCw,
  Server,
  ShieldAlert,
  Sliders,
  Trash2,
  Video,
  Wifi,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import gridBg from "@/assets/grid-bg.jpg";
import { CftvMosaicPlayer } from "@/components/CftvMosaicPlayer";
import { toast } from "sonner";
import type {
  CameraDevice,
  CameraDescriptor,
  ConnectionResult,
  DvrBrand,
  DvrDevice,
  StreamEvent,
} from "@/types/dvr";
import type { MonitoredDvrState } from "@/lib/dvr-adapters/stream-monitor";

const CAMERA_PROXY_URL =
  process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ?? "http://localhost:8090";

const ADAPTER_LABELS: Record<DvrBrand, string> = {
  hikvision: "HikvisionDvrAdapter (ISAPI / RTSP)",
  intelbras: "IntelbrasDvrAdapter (Port 37777 / RealMonitor)",
  dahua: "IntelbrasDvrAdapter (Dahua OEM CGI)",
  onvif: "GenericOnvifAdapter (SOAP Profile S/T)",
  generic: "GenericRtspAdapter (Direct RTSP)",
  mock: "MockOrSimulatorAdapter (Frames Locais)",
};

interface CapturedSnapshotModalData {
  cameraId: string;
  cameraName?: string;
  dvrName: string;
  brand: string;
  width: number;
  height: number;
  capturedAt: string;
  dataUrl: string;
}

export default function ManagerCftv() {
  const router = useRouter();
  const [dvrs, setDvrs] = useState<DvrDevice[]>([]);
  const [monitorStates, setMonitorStates] = useState<Record<string, MonitoredDvrState>>({});
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [autoMonitorEnabled, setAutoMonitorEnabled] = useState(true);
  const [showMosaicPlayer, setShowMosaicPlayer] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);

  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [capturingCamId, setCapturingCamId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionResult>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDvrId, setEditingDvrId] = useState<string | null>(null);
  const [snapshotModal, setSnapshotModal] = useState<CapturedSnapshotModalData | null>(null);
  const [selectedPreviewCamera, setSelectedPreviewCamera] = useState<{
    camId: string;
    brand: DvrBrand;
    channelNumber: number;
  } | null>(null);

  // Form state (Criar ou Editar DVR)
  const [formName, setFormName] = useState("");
  const [formBrand, setFormBrand] = useState<DvrBrand>("hikvision");
  const [formHost, setFormHost] = useState("");
  const [formRtspPort, setFormRtspPort] = useState(554);
  const [formUsername, setFormUsername] = useState("admin");
  const [formPassword, setFormPassword] = useState("");
  const [formChannels, setFormChannels] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchMonitorEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/gestor/dvrs/monitor");
      const json = await res.json();
      if (res.ok && json.data) {
        if (json.data.states) setMonitorStates(json.data.states);
        if (json.data.events) setStreamEvents(json.data.events);
      }
    } catch {
      // Silencioso em polling
    }
  }, []);

  const runHealthCheckSweep = useCallback(
    async (targetDvrs: DvrDevice[], silent = true) => {
      if (targetDvrs.length === 0) return;
      try {
        if (!silent) setCheckingAll(true);
        const res = await fetch("/api/gestor/dvrs/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check", dvrs: targetDvrs }),
        });
        const json = await res.json();
        if (res.ok && json.data) {
          const states: Record<string, MonitoredDvrState> = json.data.states || {};
          setMonitorStates(states);
          if (json.data.events) setStreamEvents(json.data.events);
          setDvrs((prev) =>
            prev.map((d) =>
              states[d.id] ? { ...d, status: states[d.id].status } : d
            )
          );
          if (!silent) {
            toast.success("Health Check & Circuit Breaker atualizados em todos os DVRs");
          }
        }
      } catch {
        if (!silent) toast.error("Falha ao executar varredura de monitoramento");
      } finally {
        if (!silent) setCheckingAll(false);
      }
    },
    []
  );

  const fetchDvrs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/gestor/dvrs");
      const json = await res.json();
      if (res.ok && json.data) {
        setDvrs(json.data);
        void runHealthCheckSweep(json.data, true);
      }
    } catch {
      toast.error("Erro ao carregar dispositivos de CFTV");
    } finally {
      setLoading(false);
    }
  }, [runHealthCheckSweep]);

  useEffect(() => {
    void fetchDvrs();
    void fetchMonitorEvents();
  }, [fetchDvrs, fetchMonitorEvents]);

  useEffect(() => {
    if (!autoMonitorEnabled || dvrs.length === 0) return;
    const timer = window.setInterval(() => {
      void runHealthCheckSweep(dvrs, true);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [autoMonitorEnabled, dvrs, runHealthCheckSweep]);

  const openCreateModal = () => {
    setEditingDvrId(null);
    setFormName("");
    setFormBrand("hikvision");
    setFormHost("");
    setFormRtspPort(554);
    setFormUsername("admin");
    setFormPassword("");
    setFormChannels(1);
    setIsModalOpen(true);
  };

  const openEditModal = (dvr: DvrDevice) => {
    setEditingDvrId(dvr.id);
    setFormName(dvr.name);
    setFormBrand(dvr.brand);
    setFormHost(dvr.host);
    setFormRtspPort(dvr.rtsp_port);
    setFormUsername(dvr.username);
    setFormPassword("");
    setFormChannels(dvr.total_channels);
    setIsModalOpen(true);
  };

  const handleDeleteDvr = async (dvr: DvrDevice) => {
    try {
      const res = await fetch(`/api/gestor/dvrs/${encodeURIComponent(dvr.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDvrs((prev) => prev.filter((item) => item.id !== dvr.id));
        void fetchMonitorEvents();
        toast.success(`Dispositivo '${dvr.name}' removido do catálogo`);
      } else {
        toast.error("Não foi possível excluir o dispositivo");
      }
    } catch {
      toast.error("Erro ao excluir DVR");
    }
  };

  const handleToggleCameraActive = async (dvrId: string, cam: CameraDevice) => {
    const nextActive = cam.is_active === false ? true : false;
    try {
      const res = await fetch("/api/gestor/dvrs/cameras", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: cam.id,
          name: cam.name,
          is_active: nextActive,
        }),
      });
      if (res.ok) {
        setDvrs((prev) =>
          prev.map((d) =>
            d.id === dvrId
              ? {
                  ...d,
                  cameras: d.cameras?.map((c) =>
                    c.id === cam.id ? { ...c, is_active: nextActive } : c
                  ),
                }
              : d
          )
        );
        void fetchMonitorEvents();
        toast.success(
          `Canal '${cam.name}' ${nextActive ? "ativado no Mosaico" : "pausado no Mosaico"}`
        );
      }
    } catch {
      toast.error("Erro ao alterar status do canal");
    }
  };

  const handleToggleSubtype = async (dvr: DvrDevice, nextSubtype: "main" | "sub") => {
    try {
      const res = await fetch("/api/gestor/dvrs/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_subtype",
          dvrId: dvr.id,
          subtype: nextSubtype,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        if (json.data.states) setMonitorStates(json.data.states);
        if (json.data.events) setStreamEvents(json.data.events);
        toast.success(
          `Perfil de '${dvr.name}' alterado para ${
            nextSubtype === "main"
              ? "Main Stream (Alta Resolução)"
              : "Sub Stream (Mosaico Leve)"
          }`
        );
      }
    } catch {
      toast.error("Não foi possível alterar o perfil de stream");
    }
  };

  const handleCaptureSnapshot = async (
    dvr: DvrDevice,
    channelNumber: number,
    cameraName: string,
    camId: string
  ) => {
    setCapturingCamId(camId);
    try {
      const res = await fetch("/api/gestor/dvrs/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dvrId: dvr.id,
          dvrName: dvr.name,
          cameraName,
          brand: dvr.brand,
          host: dvr.host,
          rtsp_port: dvr.rtsp_port,
          http_port: dvr.http_port,
          username: dvr.username,
          channelNumber,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setSnapshotModal({
          ...json.data,
          cameraName,
        });
        void fetchMonitorEvents();
        toast.success(`Snapshot capturado de ${cameraName}`);
      } else {
        toast.error("Falha ao capturar snapshot sob demanda");
      }
    } catch {
      toast.error("Erro na requisição de snapshot");
    } finally {
      setCapturingCamId(null);
    }
  };

  const handleTestConnection = async (dvr: DvrDevice) => {
    setTestingId(dvr.id);
    try {
      const res = await fetch("/api/gestor/dvrs/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dvr.id,
          name: dvr.name,
          host: dvr.host,
          rtsp_port: dvr.rtsp_port,
          http_port: dvr.http_port,
          sdk_port: dvr.sdk_port,
          username: dvr.username,
          brand: dvr.brand,
          total_channels: dvr.total_channels,
        }),
      });
      const json = await res.json();
      if (res.ok && json.data) {
        setTestResults((prev) => ({ ...prev, [dvr.id]: json.data }));
        void runHealthCheckSweep([dvr], true);
        if (json.data.success) {
          toast.success(`Conexão OK com ${dvr.name} (${json.data.latencyMs}ms)`);
        } else {
          toast.error(json.data.message);
        }
      } else {
        toast.error("Falha ao realizar teste de ping/handshake");
      }
    } catch {
      toast.error("Falha de rede ao testar dispositivo");
    } finally {
      setTestingId(null);
    }
  };

  const handleDiscoverCameras = async (dvr: DvrDevice) => {
    setDiscoveringId(dvr.id);
    try {
      const res = await fetch("/api/gestor/dvrs/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dvr.id,
          name: dvr.name,
          brand: dvr.brand,
          host: dvr.host,
          rtsp_port: dvr.rtsp_port,
          http_port: dvr.http_port,
          sdk_port: dvr.sdk_port,
          username: dvr.username,
          total_channels: dvr.total_channels,
        }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        const discovered: CameraDescriptor[] = json.data;
        setDvrs((prev) =>
          prev.map((item) =>
            item.id === dvr.id
              ? {
                  ...item,
                  cameras: discovered.map((c) => ({
                    id: c.id,
                    dvr_id: dvr.id,
                    name: c.name,
                    channel_number: c.channelNumber,
                    stream_url_main: c.streamUrl,
                    snapshot_url: c.snapshotUrl,
                    resolution_width: c.resolution?.width,
                    resolution_height: c.resolution?.height,
                    fps: c.fps || 12,
                    is_active: true,
                    status: c.online ? "online" : "offline",
                  })),
                }
              : item
          )
        );
        toast.success(
          `${discovered.length} canal(is) descoberto(s) via ${ADAPTER_LABELS[dvr.brand]}`
        );
      } else {
        toast.error("Não foi possível descobrir canais neste dispositivo");
      }
    } catch {
      toast.error("Erro ao executar descoberta de canais");
    } finally {
      setDiscoveringId(null);
    }
  };

  const handleSaveDvr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formHost || !formUsername) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setSubmitting(true);
      const isEdit = Boolean(editingDvrId);
      const endpoint = isEdit
        ? `/api/gestor/dvrs/${encodeURIComponent(editingDvrId!)}`
        : "/api/gestor/dvrs";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          brand: formBrand,
          host: formHost,
          rtsp_port: formRtspPort,
          username: formUsername,
          password: formPassword,
          total_channels: formChannels,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        if (isEdit && json.data) {
          setDvrs((prev) =>
            prev.map((item) => (item.id === editingDvrId ? json.data : item))
          );
          void fetchMonitorEvents();
          toast.success(`Dispositivo '${formName}' atualizado com sucesso!`);
        } else {
          toast.success("Dispositivo DVR cadastrado e incluído no Health Monitor!");
          void fetchDvrs();
        }
        setIsModalOpen(false);
      } else {
        toast.error(json.error || "Erro ao salvar DVR");
      }
    } catch {
      toast.error("Erro ao comunicar com o servidor");
    } finally {
      setSubmitting(false);
    }
  };

  const totalCameras = dvrs.reduce(
    (acc, d) => acc + (d.cameras?.length || d.total_channels || 0),
    0
  );
  const onlineDvrs = dvrs.filter((d) => d.status === "online").length;
  const openCircuitsCount = Object.values(monitorStates).filter(
    (s) => s.circuitState === "OPEN"
  ).length;

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#050811] text-slate-100">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity pointer-events-none"
      />
      <div className="absolute inset-0 industrial-bg pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-6 md:px-10 py-5 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/gestor")}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-slate-300"
            title="Voltar ao Painel do Gestor"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.18)]">
            <Video className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-sansserief text-lg font-bold tracking-[0.16em] text-white uppercase leading-tight">
              Gerenciamento CFTV & Câmeras
            </h1>
            <p className="text-[11px] tracking-[0.2em] text-slate-400 uppercase mt-0.5">
              Central de Monitoramento, Mosaico Live & Adaptadores de DVR
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowMosaicPlayer((v) => !v)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
              showMosaicPlayer
                ? "bg-cyan-500/15 border-cyan-400/40 text-cyan-300"
                : "bg-slate-900/80 border-white/10 text-slate-400"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {showMosaicPlayer ? "Ocultar Mosaico" : "Exibir Mosaico Live"}
          </button>

          <button
            onClick={() => setAutoMonitorEnabled((v) => !v)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
              autoMonitorEnabled
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-slate-900/80 border-white/10 text-slate-400"
            }`}
            title="Ativa ou pausa o monitoramento periódico em background (a cada 12s)"
          >
            <Activity
              className={`w-3.5 h-3.5 ${
                autoMonitorEnabled ? "text-emerald-400 animate-pulse" : "text-slate-500"
              }`}
            />
            Auto-Monitor: {autoMonitorEnabled ? "ATIVO" : "PAUSADO"}
          </button>

          <button
            onClick={() => runHealthCheckSweep(dvrs, false)}
            disabled={checkingAll || loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 text-xs font-medium text-slate-300 transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                checkingAll || loading ? "animate-spin text-cyan-400" : ""
              }`}
            />
            Health Check
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30 text-cyan-200 text-xs font-semibold shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all"
          >
            <Plus className="w-4 h-4 text-cyan-300" />
            Novo Dispositivo
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-6 md:p-10">
        <div className="w-full max-w-6xl mx-auto space-y-8">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                  DVRs / NVRs
                </p>
                <p className="font-sansserief text-2xl font-semibold text-white mt-0.5">
                  {dvrs.length}
                </p>
                <p className="text-[10px] text-emerald-400 font-medium uppercase mt-0.5">
                  {onlineDvrs} Online · {dvrs.length - onlineDvrs} Offline
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                  Canais / Sessões
                </p>
                <p className="font-sansserief text-2xl font-semibold text-white mt-0.5">
                  {totalCameras}
                </p>
                <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                  Main & Substream
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                  openCircuitsCount === 0
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/25 text-rose-400"
                }`}
              >
                {openCircuitsCount === 0 ? (
                  <Wifi className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                  Circuit Breaker
                </p>
                <p
                  className={`font-sansserief text-lg font-semibold mt-0.5 ${
                    openCircuitsCount === 0 ? "text-emerald-300" : "text-rose-400"
                  }`}
                >
                  {openCircuitsCount === 0 ? "CLOSED (Estável)" : `${openCircuitsCount} OPEN`}
                </p>
                <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                  Backoff Exponencial Ativo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                  Motor de Visão / IA
                </p>
                <p className="font-sansserief text-lg font-semibold text-purple-300 mt-0.5">
                  Híbrido Ativo
                </p>
                <p className="text-[10px] text-purple-400 font-medium uppercase mt-0.5">
                  OpenCV + Anomalib
                </p>
              </div>
            </div>
          </div>

          {/* Fase 5: Visualização em Grade / Mosaico Multi-Câmera */}
          {showMosaicPlayer && (
            <section className="space-y-4">
              <CftvMosaicPlayer
                dvrs={dvrs}
                cameraProxyUrl={CAMERA_PROXY_URL}
                onCaptureSnapshot={handleCaptureSnapshot}
                capturingCamId={capturingCamId}
              />
            </section>
          )}

          {/* Section: Dispositivos Cadastrados (CRUD Fase 4) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-sansserief text-xs font-semibold tracking-[0.25em] text-slate-300 uppercase">
                Catálogo de DVRs & Gerenciamento de Canais
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {dvrs.map((dvr) => {
                const testResult = testResults[dvr.id];
                const monState = monitorStates[dvr.id];
                const isTesting = testingId === dvr.id;
                const isDiscovering = discoveringId === dvr.id;
                const activeSubtype = monState?.activeSubtype || "main";
                const circuitState = monState?.circuitState || "CLOSED";

                return (
                  <div
                    key={dvr.id}
                    className="p-6 rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-xl space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-bold uppercase text-xs">
                          {dvr.brand.substring(0, 3)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-white tracking-wide">
                              {dvr.name}
                            </h2>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                dvr.status === "online"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              {dvr.status === "online" ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {dvr.status}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase border ${
                                circuitState === "CLOSED"
                                  ? "bg-slate-800/80 text-cyan-300 border-cyan-500/25"
                                  : circuitState === "HALF_OPEN"
                                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                              }`}
                            >
                              Circuit: {circuitState}
                              {monState && monState.consecutiveFailures > 0
                                ? ` (Backoff ${monState.backoffSeconds}s)`
                                : ""}
                            </span>
                          </div>
                          <p className="font-mono-tech text-xs text-slate-400 mt-1">
                            {dvr.username}@{dvr.host}:{dvr.rtsp_port} · Adapter:{" "}
                            <span className="text-cyan-300">
                              {ADAPTER_LABELS[dvr.brand] || dvr.brand}
                            </span>
                            {monState ? ` · Latência: ${monState.latencyMs}ms` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Seletor Main Stream vs Sub Stream */}
                        <div className="flex items-center rounded-xl bg-slate-950/90 border border-white/10 p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleToggleSubtype(dvr, "main")}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                              activeSubtype === "main"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            <Sliders className="w-3 h-3" />
                            Main
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSubtype(dvr, "sub")}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                              activeSubtype === "sub"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            Sub
                          </button>
                        </div>

                        <button
                          onClick={() => handleDiscoverCameras(dvr)}
                          disabled={isDiscovering}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 hover:border-cyan-400/40 text-xs text-slate-300 transition-all"
                        >
                          <Radar
                            className={`w-3.5 h-3.5 ${
                              isDiscovering ? "animate-spin text-cyan-400" : "text-cyan-400"
                            }`}
                          />
                          {isDiscovering ? "Varrendo..." : "Descobrir"}
                        </button>

                        <button
                          onClick={() => handleTestConnection(dvr)}
                          disabled={isTesting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 hover:border-cyan-400/40 text-xs text-slate-300 transition-all"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isTesting ? "animate-spin text-cyan-400" : ""
                            }`}
                          />
                          {isTesting ? "Testando..." : "Testar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(dvr)}
                          className="p-1.5 rounded-xl bg-slate-950/80 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-300 transition-all"
                          title="Editar configurações do DVR"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDvr(dvr)}
                          className="p-1.5 rounded-xl bg-slate-950/80 border border-white/10 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all"
                          title="Remover DVR"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {testResult && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-mono-tech flex items-center justify-between ${
                          testResult.success
                            ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-950/30 border-rose-500/30 text-rose-300"
                        }`}
                      >
                        <span>{testResult.message}</span>
                        <span className="font-semibold">{testResult.latencyMs} ms</span>
                      </div>
                    )}

                    {/* Canais Vinculados */}
                    <div className="pt-2 border-t border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                          Canais Mapeados ({dvr.cameras?.length || 0}) · Perfil Ativo:{" "}
                          <span className="text-cyan-300 uppercase">{activeSubtype}</span>
                        </p>
                        {monState && monState.reconnectCount > 0 && (
                          <span className="text-[10px] font-mono-tech text-emerald-400">
                            Reconexões Automáticas: {monState.reconnectCount}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dvr.cameras?.map((cam) => {
                          const isSelected = selectedPreviewCamera?.camId === cam.id;
                          const isCapturing = capturingCamId === cam.id;
                          const isActive = cam.is_active !== false;
                          const displayedUrl =
                            activeSubtype === "sub" && cam.stream_url_sub
                              ? cam.stream_url_sub
                              : cam.stream_url_main;

                          return (
                            <div
                              key={cam.id}
                              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-opacity ${
                                isActive
                                  ? "border-white/5 bg-slate-950/40"
                                  : "border-white/5 bg-slate-950/20 opacity-60"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                                  <Video className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-white truncate">
                                    {cam.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono-tech truncate">
                                    {displayedUrl ||
                                      `Canal ${cam.channel_number} · ${cam.fps} FPS`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCameraActive(dvr.id, cam)}
                                  className={`p-1.5 rounded-lg border text-[11px] transition-all ${
                                    isActive
                                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                      : "bg-slate-800 border-white/10 text-slate-400"
                                  }`}
                                  title={
                                    isActive
                                      ? "Ativo no Mosaico (Clique para desativar)"
                                      : "Inativo no Mosaico (Clique para ativar)"
                                  }
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  disabled={isCapturing}
                                  onClick={() =>
                                    handleCaptureSnapshot(
                                      dvr,
                                      cam.channel_number,
                                      cam.name,
                                      cam.id
                                    )
                                  }
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 hover:border-cyan-400/40 text-slate-200 text-[11px] font-medium transition-all"
                                  title="Capturar frame estático sob demanda (Snapshot)"
                                >
                                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                                  {isCapturing ? "..." : "Snapshot"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedPreviewCamera(
                                      isSelected
                                        ? null
                                        : {
                                            camId: cam.id,
                                            brand: dvr.brand,
                                            channelNumber: cam.channel_number,
                                          }
                                    )
                                  }
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-400/25 hover:bg-cyan-500/20 text-cyan-300 text-[11px] font-medium transition-all"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  {isSelected ? "Fechar" : "Live"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Live View Inline se selecionado */}
                      {selectedPreviewCamera &&
                        dvr.cameras?.some((c) => c.id === selectedPreviewCamera.camId) && (
                          <div className="p-4 rounded-xl border border-cyan-500/30 bg-slate-950/90 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                {selectedPreviewCamera.brand === "mock"
                                  ? `Frame Simulador CFTV (Canal ${selectedPreviewCamera.channelNumber})`
                                  : "Live Stream Industrial (Proxy 8090)"}
                              </span>
                              <span className="text-[10px] font-mono-tech text-slate-400">
                                {selectedPreviewCamera.brand === "mock"
                                  ? `/dvr/mock/snapshot?channel=${selectedPreviewCamera.channelNumber}`
                                  : "/stream.mjpg · Resolução Nativa"}
                              </span>
                            </div>
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                              <img
                                src={
                                  selectedPreviewCamera.brand === "mock"
                                    ? `${CAMERA_PROXY_URL}/dvr/mock/snapshot?channel=${selectedPreviewCamera.channelNumber}`
                                    : `${CAMERA_PROXY_URL}/stream.mjpg`
                                }
                                alt="Live Stream CFTV"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section: Log de Eventos de Conectividade e Monitoramento */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-sansserief text-xs font-semibold tracking-[0.25em] text-slate-300 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Eventos de Sessão & Reconexão Automática ({streamEvents.length})
              </p>
              <div className="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/65 backdrop-blur-xl overflow-hidden shadow-xl">
              {streamEvents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhum evento de stream registrado até o momento.
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                  {streamEvents.map((ev) => {
                    const badgeStyle =
                      ev.severity === "critical" || ev.severity === "error"
                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        : ev.severity === "warning"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";

                    return (
                      <div
                        key={ev.id}
                        className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tech uppercase border shrink-0 ${badgeStyle}`}
                          >
                            {ev.event_type}
                          </span>
                          <span className="text-slate-200 truncate">{ev.message}</span>
                        </div>
                        <span className="font-mono-tech text-[11px] text-slate-400 shrink-0">
                          {new Date(ev.created_at).toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Modal: Visualização de Snapshot Capturado Sob Demanda */}
      {snapshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  Snapshot Capturado · {snapshotModal.cameraName || snapshotModal.cameraId}
                </h3>
                <p className="text-[11px] font-mono-tech text-slate-400 mt-0.5">
                  Resolução: {snapshotModal.width}x{snapshotModal.height}px ·{" "}
                  {new Date(snapshotModal.capturedAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => setSnapshotModal(null)}
                className="text-slate-400 hover:text-white text-xs uppercase px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center max-h-[60vh]">
              <img
                src={snapshotModal.dataUrl}
                alt="Snapshot Capturado"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] font-mono-tech text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />
                Dispositivo: {snapshotModal.dvrName} ({snapshotModal.brand.toUpperCase()})
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={snapshotModal.dataUrl}
                  download={`snapshot-${snapshotModal.cameraId}-${Date.now()}.jpg`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-semibold text-slate-950 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Frame
                </a>
                <button
                  type="button"
                  onClick={() => setSnapshotModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar ou Editar DVR (CRUD Fase 4) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                {editingDvrId ? (
                  <>
                    <Edit3 className="w-5 h-5 text-cyan-400" />
                    Editar Dispositivo CFTV
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-cyan-400" />
                    Cadastrar Dispositivo CFTV
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs uppercase"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDvr} className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Nome Identificador
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: NVR Linha de Tecelagem 02"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 focus:border-cyan-400 text-xs text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Fabricante / Adaptador
                  </label>
                  <select
                    value={formBrand}
                    onChange={(e) => {
                      const nextBrand = e.target.value as DvrBrand;
                      setFormBrand(nextBrand);
                      if (nextBrand === "mock" && !formHost) {
                        setFormHost("127.0.0.1");
                      }
                    }}
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 focus:border-cyan-400 text-xs text-white outline-none"
                  >
                    <option value="hikvision">Hikvision (ISAPI / RTSP)</option>
                    <option value="intelbras">Intelbras (DVR / 37777)</option>
                    <option value="dahua">Dahua (RealMonitor CGI)</option>
                    <option value="onvif">ONVIF Profile S/T</option>
                    <option value="generic">RTSP Genérico</option>
                    <option value="mock">Simulador / Mock</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    IP / Hostname
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.65"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 focus:border-cyan-400 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Porta RTSP
                  </label>
                  <input
                    type="number"
                    value={formRtspPort}
                    onChange={(e) => setFormRtspPort(Number(e.target.value))}
                    className="w-full mt-1.5 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 focus:border-cyan-400 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Usuário
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 focus:border-cyan-400 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Qtd Canais
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={formChannels}
                    onChange={(e) => setFormChannels(Number(e.target.value))}
                    className="w-full mt-1.5 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 focus:border-cyan-400 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  {editingDvrId
                    ? "Nova Senha (deixe em branco para manter a atual)"
                    : "Senha do Dispositivo"}
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/10 focus:border-cyan-400 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-semibold text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                >
                  {submitting
                    ? "Salvando..."
                    : editingDvrId
                    ? "Atualizar Dispositivo"
                    : "Salvar Dispositivo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
