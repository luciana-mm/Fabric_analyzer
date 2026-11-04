import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { streamMonitorService } from "@/lib/dvr-adapters/stream-monitor";
import type { DvrDevice, StreamEvent } from "@/types/dvr";

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
    let dbEvents: StreamEvent[] = [];
    try {
      const evRes = await query(`
        SELECT id, camera_id, event_type, severity, message, details, created_at
        FROM public.stream_events
        ORDER BY created_at DESC
        LIMIT 25
      `);
      dbEvents = evRes.rows;
    } catch {
      // Silencioso caso tabela ainda não migrada
    }

    const memoryEvents = streamMonitorService.getEvents(30);
    const combinedEvents = [...memoryEvents, ...dbEvents].slice(0, 35);

    return res.status(200).json({
      data: {
        states: streamMonitorService.getAllStates(),
        events: combinedEvents,
      },
    });
  }

  if (req.method === "POST") {
    const { action = "check", dvrs = [], dvrId, subtype } = req.body || {};

    if (action === "set_subtype" && dvrId && (subtype === "main" || subtype === "sub")) {
      const updated = streamMonitorService.setStreamSubtype(String(dvrId), subtype);
      return res.status(200).json({
        data: {
          state: updated,
          states: streamMonitorService.getAllStates(),
          events: streamMonitorService.getEvents(30),
        },
      });
    }

    const dvrList: DvrDevice[] = Array.isArray(dvrs) ? dvrs : [];
    for (const dvr of dvrList) {
      const prev = streamMonitorService.getOrInitState(dvr).status;
      const updatedState = await streamMonitorService.checkDvrHealth(dvr);

      // Sincroniza status no banco caso seja um DVR persistido
      if (dvr.id && !dvr.id.startsWith("dvr-default") && !dvr.id.startsWith("dvr-mock")) {
        await query(
          `UPDATE public.dvr_devices
              SET status = $1, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2`,
          [updatedState.status, dvr.id]
        ).catch(() => null);

        await query(
          `UPDATE public.camera_devices
              SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE dvr_id = $2`,
          [updatedState.status === "online" ? "online" : "offline", dvr.id]
        ).catch(() => null);

        if (prev !== updatedState.status && dvr.cameras && dvr.cameras.length > 0) {
          const camId = dvr.cameras[0].id;
          const evType = updatedState.status === "online" ? "connected" : "disconnected";
          const evSeverity =
            updatedState.circuitState === "OPEN"
              ? "critical"
              : updatedState.status === "online"
              ? "info"
              : "warning";

          await query(
            `INSERT INTO public.stream_events (camera_id, event_type, severity, message, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              camId,
              evType,
              evSeverity,
              `Status do DVR '${dvr.name}' mudou para ${updatedState.status.toUpperCase()}`,
              JSON.stringify({
                circuitState: updatedState.circuitState,
                backoffSeconds: updatedState.backoffSeconds,
              }),
            ]
          ).catch(() => null);
        }
      }
    }

    return res.status(200).json({
      data: {
        states: streamMonitorService.getAllStates(),
        events: streamMonitorService.getEvents(30),
      },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
