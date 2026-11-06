import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { streamMonitorService } from "@/lib/dvr-adapters/stream-monitor";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (auth.role !== "gestor") {
    return res.status(403).json({ error: "Acesso restrito a gestores" });
  }

  if (req.method === "PATCH") {
    const {
      cameraId,
      dvrId,
      name,
      is_active,
      action,
      channel,
      brand,
      host,
      rtsp_port,
      http_port,
      username,
    } = req.body || {};

    if (!cameraId) {
      return res.status(400).json({ error: "cameraId é obrigatório" });
    }

    const isSyntheticId =
      String(cameraId).startsWith("cam-default") ||
      String(cameraId).startsWith("cam-mock") ||
      String(cameraId).startsWith("hikvision-") ||
      String(cameraId).startsWith("intelbras-") ||
      String(cameraId).startsWith("onvif-") ||
      String(cameraId).startsWith("droidcam-") ||
      String(cameraId).startsWith("generic-") ||
      String(cameraId).startsWith("mock-");

    // Ação especial: definir qual câmera alimenta o Painel do Operário (/stream.mjpg e IA)
    if (action === "set_operator_camera") {
      try {
        let resolvedName = name || "Câmera Operário";
        let resolvedChannel = String(channel || "1");
        let resolvedBrand = String(brand || "hikvision").toLowerCase();
        let resolvedHost = String(host || process.env.CAMERA_IP || "192.168.1.64");
        let resolvedRtspPort = Number(rtsp_port || (resolvedBrand === "droidcam" ? 4747 : 554));
        let resolvedHttpPort = Number(http_port || (resolvedBrand === "droidcam" ? 4747 : 80));
        let resolvedUsername = String(username || "admin");
        let resolvedPassword = "";

        if (!isSyntheticId) {
          // Marca apenas esta câmera como padrão do operário no PostgreSQL
          await query(
            `UPDATE public.camera_devices
                SET is_operator_default = (id::text = $1),
                    updated_at = CURRENT_TIMESTAMP`,
            [String(cameraId)]
          ).catch(() => null);

          const camLookup = await query(
            `SELECT c.id, c.name AS cam_name, c.channel_number,
                    d.id AS dvr_id, d.brand, d.host, d.rtsp_port, d.http_port,
                    d.username, d.password_encrypted
               FROM public.camera_devices c
               JOIN public.dvr_devices d ON d.id = c.dvr_id
              WHERE c.id::text = $1`,
            [String(cameraId)]
          ).catch(() => null);

          if (camLookup && camLookup.rows.length > 0) {
            const row = camLookup.rows[0];
            resolvedName = row.cam_name || resolvedName;
            resolvedChannel = String(row.channel_number || resolvedChannel);
            resolvedBrand = String(row.brand || resolvedBrand).toLowerCase();
            resolvedHost = row.host || resolvedHost;
            resolvedRtspPort = Number(row.rtsp_port || resolvedRtspPort);
            resolvedHttpPort = Number(row.http_port || resolvedHttpPort);
            resolvedUsername = row.username || resolvedUsername;
            if (
              row.password_encrypted &&
              row.password_encrypted !== "configured" &&
              row.password_encrypted !== "none"
            ) {
              resolvedPassword = row.password_encrypted;
            }
          }
        } else {
          // Caso o gestor escolha uma câmera sintética (ex: Simulador Mock), desmarca as outras no banco
          await query(
            `UPDATE public.camera_devices SET is_operator_default = false`
          ).catch(() => null);
        }

        // Notifica o servidor Python de visão computacional (backend:8090) para chavear o stream ao vivo imediatamente
        const cameraProxyUrl =
          process.env.BACKEND_API_URL ||
          process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ||
          "http://127.0.0.1:8090";

        let backendSwitchInfo: Record<string, unknown> | null = null;
        try {
          const proxyResp = await fetch(`${cameraProxyUrl}/dvr/active-camera`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cameraId: String(cameraId),
              dvrId: String(dvrId || ""),
              cameraName: resolvedName,
              channel: resolvedChannel,
              brand: resolvedBrand === "generic" ? "generic_rtsp" : resolvedBrand,
              host: resolvedHost,
              rtspPort: resolvedRtspPort,
              httpPort: resolvedHttpPort,
              username: resolvedUsername,
              password: resolvedPassword,
            }),
            signal: AbortSignal.timeout(4000),
          });
          if (proxyResp.ok) {
            const json = await proxyResp.json();
            backendSwitchInfo = json.activeCamera || json;
          }
        } catch (proxyErr) {
          console.warn("Aviso ao notificar backend Python da troca de câmera:", proxyErr);
        }

        streamMonitorService.recordEvent({
          camera_id: String(cameraId),
          event_type: "connected",
          severity: "info",
          message: `Câmera '${resolvedName}' (${resolvedBrand.toUpperCase()} - ${resolvedHost}:${resolvedRtspPort}) definida como ATIVA no Painel do Operário`,
        });

        return res.status(200).json({
          data: {
            cameraId,
            name: resolvedName,
            is_operator_default: true,
            activeCamera: backendSwitchInfo,
          },
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Erro ao definir câmera do operário";
        return res.status(500).json({ error: msg });
      }
    }

    try {
      if (!isSyntheticId) {
        if (typeof is_active === "boolean" && name) {
          await query(
            `UPDATE public.camera_devices
                SET name = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
              WHERE id = $3`,
            [name, is_active, cameraId]
          );
        } else if (typeof is_active === "boolean") {
          await query(
            `UPDATE public.camera_devices
                SET is_active = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2`,
            [is_active, cameraId]
          );
        } else if (name) {
          await query(
            `UPDATE public.camera_devices
                SET name = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2`,
            [name, cameraId]
          );
        }
      }

      streamMonitorService.recordEvent({
        camera_id: String(cameraId),
        event_type: is_active === false ? "disconnected" : "connected",
        severity: "info",
        message:
          typeof is_active === "boolean"
            ? `Canal '${name || cameraId}' ${is_active ? "ATIVADO" : "PAUSADO"} no mosaico pelo gestor`
            : `Canal '${cameraId}' atualizado para '${name}'`,
      });

      return res.status(200).json({
        data: {
          cameraId,
          name,
          is_active,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao atualizar canal";
      return res.status(500).json({ error: msg });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
