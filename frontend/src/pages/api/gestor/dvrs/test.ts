import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { DvrAdapterFactory } from "@/lib/dvr-adapters";
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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    id,
    name = "DVR Teste",
    host,
    rtsp_port = 554,
    http_port = 80,
    sdk_port,
    username = "admin",
    password = "",
    brand = "generic",
    total_channels = 1,
  } = req.body || {};

  if (!host) {
    return res.status(400).json({ error: "Host é obrigatório" });
  }

  try {
    const adapter = DvrAdapterFactory.create({
      id,
      name,
      brand: brand as DvrBrand,
      host,
      rtsp_port: Number(rtsp_port),
      http_port: Number(http_port),
      sdk_port: sdk_port ? Number(sdk_port) : undefined,
      username,
      password,
      total_channels: Number(total_channels),
    });

    const result = await adapter.testConnection();

    // Atualiza o status no banco caso seja um DVR persistido
    if (id && !String(id).startsWith("dvr-default")) {
      const newStatus = result.success ? "online" : "offline";
      await query(
        `UPDATE public.dvr_devices
            SET status = $1, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2`,
        [newStatus, id]
      ).catch(() => null);
    }

    return res.status(200).json({ data: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro inesperado no adaptador";
    return res.status(200).json({
      data: {
        success: false,
        message: `Erro ao testar conexão com ${host}:${rtsp_port}: ${msg}`,
        latencyMs: 0,
        statusCode: 500,
      },
    });
  }
}
