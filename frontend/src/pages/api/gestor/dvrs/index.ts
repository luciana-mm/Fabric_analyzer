import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { DvrAdapterFactory } from "@/lib/dvr-adapters";
import type { DvrDevice, CameraDevice, DvrBrand } from "@/types/dvr";
import { getCameraProxyUrl } from "@/lib/camera-proxy";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (auth.role !== "gestor") {
    return res.status(403).json({ error: "Acesso restrito a gestores" });
  }

  if (req.method === "GET") {
    try {
      const dvrsResult = await query(`
        SELECT id, name, brand, host, rtsp_port, http_port, sdk_port, username, password_encrypted,
               total_channels, status, last_checked_at, metadata, created_at, updated_at
        FROM public.dvr_devices
        ORDER BY created_at ASC
      `);

      const camerasResult = await query(`
        SELECT id, dvr_id, name, channel_number, stream_url_main, stream_url_sub,
               snapshot_url, resolution_width, resolution_height, fps, is_active,
               COALESCE(is_operator_default, false) AS is_operator_default,
               status, last_frame_at, created_at, updated_at
        FROM public.camera_devices
        ORDER BY channel_number ASC
      `);

      const camerasByDvr: Record<string, CameraDevice[]> = {};
      for (const cam of camerasResult.rows) {
        if (!camerasByDvr[cam.dvr_id]) {
          camerasByDvr[cam.dvr_id] = [];
        }
        camerasByDvr[cam.dvr_id].push(cam);
      }

      const cameraProxyUrl = getCameraProxyUrl();

      // Sincroniza as credenciais de cada DVR com o backend Python para que cada canal do Mosaico tenha seu próprio stream
      for (const row of dvrsResult.rows) {
        const rawPwd =
          row.password_encrypted && row.password_encrypted !== "configured"
            ? String(row.password_encrypted)
            : "";
        void fetch(`${cameraProxyUrl}/dvr/monitor/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: String(row.id),
            name: String(row.name),
            brand: String(row.brand).toLowerCase(),
            host: String(row.host),
            rtsp_port: Number(row.rtsp_port || 554),
            http_port: Number(row.http_port || 80),
            sdk_port: Number(row.sdk_port || 8000),
            username: String(row.username || "admin"),
            password: rawPwd,
            total_channels: Number(row.total_channels || 1),
          }),
          signal: AbortSignal.timeout(1500),
        }).catch(() => null);
      }

      const dvrs: DvrDevice[] = dvrsResult.rows.map((row) => {
        const { password_encrypted: _unused, ...safeRow } = row;
        void _unused;
        return {
          ...safeRow,
          cameras: camerasByDvr[row.id] || [],
        };
      });

      return res.status(200).json({ data: dvrs });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn("Tabelas de DVR indisponíveis, usando adaptadores padrão:", msg);

      const defaultHikvision: DvrDevice = {
        id: "dvr-default-hikvision",
        name: "Hikvision Linha Industrial 01",
        brand: "hikvision",
        host: process.env.CAMERA_IP || "192.168.1.64",
        rtsp_port: parseInt(process.env.CAMERA_RTSP_PORT || "554", 10),
        http_port: 80,
        sdk_port: 8000,
        username: process.env.CAMERA_USER || "admin",
        total_channels: 1,
        status: "online",
        last_checked_at: new Date().toISOString(),
        metadata: {
          channel: process.env.CAMERA_CHANNEL || "101",
          adapter: "HikvisionDvrAdapter",
        },
        cameras: [
          {
            id: "cam-default-101",
            dvr_id: "dvr-default-hikvision",
            name: "Câmera Superior Têxtil (Canal 101)",
            channel_number: parseInt(process.env.CAMERA_CHANNEL || "101", 10),
            stream_url_main: "rtsp://admin:****@192.168.1.64:554/Streaming/Channels/101",
            stream_url_sub: "rtsp://admin:****@192.168.1.64:554/Streaming/Channels/102",
            snapshot_url: "http://192.168.1.64:80/ISAPI/Streaming/channels/101/picture",
            fps: 12,
            is_active: true,
            is_operator_default: true,
            status: "online",
            last_frame_at: new Date().toISOString(),
          },
        ],
      };

      const defaultMock: DvrDevice = {
        id: "dvr-mock-default",
        name: "Simulador CFTV Têxtil (MockAdapter)",
        brand: "mock",
        host: "127.0.0.1",
        rtsp_port: 8090,
        http_port: 8090,
        sdk_port: 8090,
        username: "admin",
        total_channels: 2,
        status: "online",
        last_checked_at: new Date().toISOString(),
        metadata: {
          adapter: "MockOrSimulatorAdapter",
        },
        cameras: [
          {
            id: "cam-mock-1",
            dvr_id: "dvr-mock-default",
            name: "Câmera Simulada 01 (Inspeção Superior Rolo A)",
            channel_number: 1,
            stream_url_main: "mock://127.0.0.1/channels/1/main",
            stream_url_sub: "mock://127.0.0.1/channels/1/sub",
            snapshot_url: "/dvr/mock/snapshot?channel=1",
            fps: 12,
            is_active: true,
            is_operator_default: false,
            status: "online",
            last_frame_at: new Date().toISOString(),
          },
          {
            id: "cam-mock-2",
            dvr_id: "dvr-mock-default",
            name: "Câmera Simulada 02 (Inspeção Lateral Ourela)",
            channel_number: 2,
            stream_url_main: "mock://127.0.0.1/channels/2/main",
            stream_url_sub: "mock://127.0.0.1/channels/2/sub",
            snapshot_url: "/dvr/mock/snapshot?channel=2",
            fps: 12,
            is_active: true,
            is_operator_default: false,
            status: "online",
            last_frame_at: new Date().toISOString(),
          },
        ],
      };

      return res.status(200).json({ data: [defaultHikvision, defaultMock] });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        name,
        brand,
        host,
        rtsp_port,
        http_port,
        sdk_port,
        username = "admin",
        password = "",
        total_channels = 1,
      } = req.body || {};

      if (!name || !brand || !host) {
        return res.status(400).json({ error: "Campos obrigatórios: name, brand, host" });
      }

      const resolvedRtspPort = Number(rtsp_port || (brand === "droidcam" ? 4747 : 554));
      const resolvedHttpPort = Number(http_port || (brand === "droidcam" ? 4747 : 80));
      const defaultSdkPort = sdk_port ?? (brand === "intelbras" || brand === "dahua" ? 37777 : 8000);
      const resolvedUsername = username || "admin";

      // Instancia o adaptador da Fase 2 para testar conectividade e descobrir canais com sintaxe da marca
      const adapter = DvrAdapterFactory.create({
        name,
        brand: brand as DvrBrand,
        host,
        rtsp_port: resolvedRtspPort,
        http_port: resolvedHttpPort,
        sdk_port: Number(defaultSdkPort),
        username: resolvedUsername,
        password,
        total_channels: brand === "droidcam" ? 1 : Number(total_channels),
      });

      const connResult = await adapter.testConnection();
      const discovered = await adapter.discoverCameras();
      const initialStatus = connResult.success ? "online" : "offline";

      const insertResult = await query(
        `INSERT INTO public.dvr_devices (
          name, brand, host, rtsp_port, http_port, sdk_port, username, password_encrypted, total_channels, status, last_checked_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING id, name, brand, host, rtsp_port, http_port, sdk_port, username, total_channels, status, created_at`,
        [
          name,
          brand,
          host,
          resolvedRtspPort,
          resolvedHttpPort,
          defaultSdkPort,
          resolvedUsername,
          password || "configured",
          brand === "droidcam" ? 1 : Number(total_channels),
          initialStatus,
        ]
      );

      const newDvr = insertResult.rows[0];

      // Desmarca a câmera anterior caso este novo dispositivo passe a ser a câmera ativa do operário
      await query(`UPDATE public.camera_devices SET is_operator_default = false`).catch(() => null);

      let firstInsertedCamId: string | null = null;
      let firstInsertedCamName = name;
      let firstInsertedChannel = 1;

      // Persiste cada câmera descoberta pelo DvrAdapter da marca
      for (let idx = 0; idx < discovered.length; idx++) {
        const cam = discovered[idx];
        const isOpDefault = idx === 0;
        const subUrl = await adapter.getCameraStream(String(cam.channelNumber), "sub");
        const camInsert = await query(
          `INSERT INTO public.camera_devices (
            dvr_id, name, channel_number, stream_url_main, stream_url_sub,
            snapshot_url, resolution_width, resolution_height, fps, is_active, is_operator_default, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
          RETURNING id`,
          [
            newDvr.id,
            cam.name,
            cam.channelNumber,
            cam.streamUrl || null,
            subUrl || null,
            cam.snapshotUrl || null,
            cam.resolution?.width || 1920,
            cam.resolution?.height || 1080,
            cam.fps || 12,
            isOpDefault,
            cam.online ? "online" : "offline",
          ]
        );
        if (isOpDefault && camInsert.rows[0]?.id) {
          firstInsertedCamId = String(camInsert.rows[0].id);
          firstInsertedCamName = cam.name;
          firstInsertedChannel = cam.channelNumber;
        }
      }

      // Aciona imediatamente o servidor Python para que a nova câmera já funcione no Painel do Operário sem precisar de .env
      if (firstInsertedCamId) {
        const cameraProxyUrl = getCameraProxyUrl();
        await fetch(`${cameraProxyUrl}/dvr/active-camera`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cameraId: firstInsertedCamId,
            dvrId: String(newDvr.id),
            cameraName: firstInsertedCamName,
            channel: String(firstInsertedChannel),
            brand: String(brand).toLowerCase(),
            host,
            rtspPort: resolvedRtspPort,
            httpPort: resolvedHttpPort,
            username: resolvedUsername,
            password,
          }),
          signal: AbortSignal.timeout(3500),
        }).catch(() => null);
      }

      return res.status(201).json({ data: newDvr, connection: connResult });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro interno ao cadastrar DVR";
      console.error("Erro ao cadastrar DVR:", error);
      return res.status(500).json({ error: msg });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
