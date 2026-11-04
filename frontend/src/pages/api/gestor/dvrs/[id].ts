import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { DvrAdapterFactory } from "@/lib/dvr-adapters";
import { streamMonitorService } from "@/lib/dvr-adapters/stream-monitor";
import type { DvrBrand } from "@/types/dvr";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (auth.role !== "gestor") {
    return res.status(403).json({ error: "Acesso restrito a gestores" });
  }

  const dvrId = typeof req.query.id === "string" ? req.query.id : "";
  if (!dvrId) {
    return res.status(400).json({ error: "ID do DVR é obrigatório" });
  }

  if (req.method === "GET") {
    try {
      const dvrRes = await query(
        `SELECT id, name, brand, host, rtsp_port, http_port, sdk_port, username,
                total_channels, status, last_checked_at, metadata, created_at, updated_at
           FROM public.dvr_devices
          WHERE id = $1`,
        [dvrId]
      );

      if (dvrRes.rows.length === 0) {
        return res.status(404).json({ error: "Dispositivo DVR não encontrado" });
      }

      const camRes = await query(
        `SELECT id, dvr_id, name, channel_number, stream_url_main, stream_url_sub,
                snapshot_url, resolution_width, resolution_height, fps, is_active,
                status, last_frame_at, created_at, updated_at
           FROM public.camera_devices
          WHERE dvr_id = $1
          ORDER BY channel_number ASC`,
        [dvrId]
      );

      return res.status(200).json({
        data: {
          ...dvrRes.rows[0],
          cameras: camRes.rows,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao buscar DVR";
      return res.status(500).json({ error: msg });
    }
  }

  if (req.method === "PUT") {
    const {
      name,
      brand,
      host,
      rtsp_port = 554,
      http_port = 80,
      sdk_port,
      username,
      password,
      total_channels = 1,
    } = req.body || {};

    if (!name || !brand || !host || !username) {
      return res.status(400).json({
        error: "Campos obrigatórios: name, brand, host, username",
      });
    }

    try {
      const defaultSdkPort =
        sdk_port ?? (brand === "intelbras" || brand === "dahua" ? 37777 : 8000);

      const adapter = DvrAdapterFactory.create({
        id: dvrId,
        name,
        brand: brand as DvrBrand,
        host,
        rtsp_port: Number(rtsp_port),
        http_port: Number(http_port),
        sdk_port: Number(defaultSdkPort),
        username,
        password: password || "configured",
        total_channels: Number(total_channels),
      });

      const connResult = await adapter.testConnection();
      const discovered = await adapter.discoverCameras();
      const updatedStatus = connResult.success ? "online" : "offline";

      // Se não for um DVR default em memória, atualiza no banco PostgreSQL
      if (!dvrId.startsWith("dvr-default") && !dvrId.startsWith("dvr-mock")) {
        if (password && String(password).trim().length > 0) {
          await query(
            `UPDATE public.dvr_devices
                SET name = $1, brand = $2, host = $3, rtsp_port = $4, http_port = $5,
                    sdk_port = $6, username = $7, password_encrypted = $8,
                    total_channels = $9, status = $10, updated_at = CURRENT_TIMESTAMP
              WHERE id = $11`,
            [
              name,
              brand,
              host,
              Number(rtsp_port),
              Number(http_port),
              Number(defaultSdkPort),
              username,
              password,
              Number(total_channels),
              updatedStatus,
              dvrId,
            ]
          );
        } else {
          await query(
            `UPDATE public.dvr_devices
                SET name = $1, brand = $2, host = $3, rtsp_port = $4, http_port = $5,
                    sdk_port = $6, username = $7, total_channels = $8,
                    status = $9, updated_at = CURRENT_TIMESTAMP
              WHERE id = $10`,
            [
              name,
              brand,
              host,
              Number(rtsp_port),
              Number(http_port),
              Number(defaultSdkPort),
              username,
              Number(total_channels),
              updatedStatus,
              dvrId,
            ]
          );
        }

        // Atualiza canais mapeados
        await query(`DELETE FROM public.camera_devices WHERE dvr_id = $1`, [dvrId]);
        for (const cam of discovered) {
          const subUrl = await adapter.getCameraStream(String(cam.channelNumber), "sub");
          await query(
            `INSERT INTO public.camera_devices (
              dvr_id, name, channel_number, stream_url_main, stream_url_sub,
              snapshot_url, resolution_width, resolution_height, fps, is_active, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)`,
            [
              dvrId,
              cam.name,
              cam.channelNumber,
              cam.streamUrl || null,
              subUrl || null,
              cam.snapshotUrl || null,
              cam.resolution?.width || 1920,
              cam.resolution?.height || 1080,
              cam.fps || 12,
              cam.online ? "online" : "offline",
            ]
          );
        }
      }

      streamMonitorService.recordEvent({
        camera_id: dvrId,
        event_type: "connected",
        severity: "info",
        message: `Configurações do DVR '${name}' (${host}:${rtsp_port}) atualizadas pelo gestor`,
        details: { brand, total_channels },
      });

      return res.status(200).json({
        data: {
          id: dvrId,
          name,
          brand,
          host,
          rtsp_port: Number(rtsp_port),
          http_port: Number(http_port),
          sdk_port: Number(defaultSdkPort),
          username,
          total_channels: Number(total_channels),
          status: updatedStatus,
          cameras: discovered.map((c) => ({
            id: c.id,
            dvr_id: dvrId,
            name: c.name,
            channel_number: c.channelNumber,
            stream_url_main: c.streamUrl,
            snapshot_url: c.snapshotUrl,
            fps: c.fps || 12,
            is_active: true,
            status: c.online ? "online" : "offline",
          })),
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao atualizar DVR";
      return res.status(500).json({ error: msg });
    }
  }

  if (req.method === "DELETE") {
    try {
      if (!dvrId.startsWith("dvr-default") && !dvrId.startsWith("dvr-mock")) {
        await query(`DELETE FROM public.dvr_devices WHERE id = $1`, [dvrId]);
      }

      streamMonitorService.recordEvent({
        camera_id: dvrId,
        event_type: "disconnected",
        severity: "warning",
        message: `Dispositivo DVR (${dvrId}) removido do catálogo pelo gestor`,
      });

      return res.status(200).json({ data: { deletedId: dvrId } });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao remover DVR";
      return res.status(500).json({ error: msg });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
