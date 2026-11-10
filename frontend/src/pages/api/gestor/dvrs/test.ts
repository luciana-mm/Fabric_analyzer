/**
 * Rota de API (POST /api/gestor/dvrs/test) para teste de conectividade de DVRs e câmeras.
 *
 * - Delega prioritariamente o teste para o backend Python (`/dvr/test-connection`),
 *   garantindo que a validação ocorra no mesmo ambiente de rede do motor de vídeo.
 * - Mantém fallback para o `DvrAdapterFactory` local caso o servidor Python esteja indisponível.
 * - Atualiza o status (`online` / `offline`) e `last_checked_at` do dispositivo no PostgreSQL.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { DvrAdapterFactory } from "@/lib/dvr-adapters";
import { getCameraProxyUrl } from "@/lib/camera-proxy";
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
    let result;
    const pyBrand = brand === "generic" ? "generic_rtsp" : brand;
    const pyResp = await fetch(`${getCameraProxyUrl()}/dvr/test-connection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: String(id || "dvr-test"),
        name,
        brand: pyBrand,
        host,
        rtsp_port: Number(rtsp_port),
        http_port: Number(http_port),
        sdk_port: sdk_port ? Number(sdk_port) : undefined,
        username,
        password,
        total_channels: Number(total_channels),
      }),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

    if (pyResp && pyResp.ok) {
      result = await pyResp.json();
    } else {
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

      result = await adapter.testConnection();
    }

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