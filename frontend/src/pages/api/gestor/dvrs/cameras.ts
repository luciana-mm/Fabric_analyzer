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
    const { cameraId, name, is_active } = req.body || {};
    if (!cameraId) {
      return res.status(400).json({ error: "cameraId é obrigatório" });
    }

    try {
      if (
        !String(cameraId).startsWith("cam-default") &&
        !String(cameraId).startsWith("cam-mock") &&
        !String(cameraId).startsWith("hikvision-") &&
        !String(cameraId).startsWith("intelbras-") &&
        !String(cameraId).startsWith("onvif-") &&
        !String(cameraId).startsWith("generic-") &&
        !String(cameraId).startsWith("mock-")
      ) {
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
