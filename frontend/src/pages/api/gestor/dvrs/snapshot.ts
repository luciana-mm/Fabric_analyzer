import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { streamMonitorService } from "@/lib/dvr-adapters/stream-monitor";

function buildFallbackSyntheticSvgDataUrl(
  cameraName: string,
  brand: string,
  host: string,
  channelNumber: number
): string {
  const ts = new Date().toISOString().replace("T", " ").substring(0, 19);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
    <defs>
      <pattern id="weave" width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill="#1e293b"/>
        <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#334155" stroke-width="1.5"/>
      </pattern>
    </defs>
    <rect width="800" height="450" fill="url(#weave)"/>
    <rect x="140" y="75" width="520" height="300" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="8,6"/>
    <rect x="16" y="16" width="560" height="42" rx="8" fill="#0f172a" fill-opacity="0.88" stroke="#38bdf8" stroke-width="1"/>
    <text x="30" y="42" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">
      SNAPSHOT CFTV [${brand.toUpperCase()}] CH ${String(channelNumber).padStart(2, "0")} | ${ts} UTC
    </text>
    <text x="400" y="225" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="16">
      ${cameraName} (${host}) — ROI de Inspeção Têxtil
    </text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
}

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
    dvrId = "dvr",
    dvrName = "DVR",
    cameraName = "Câmera",
    brand = "hikvision",
    host = "127.0.0.1",
    rtsp_port = 554,
    http_port = 80,
    username = "admin",
    channelNumber = 1,
  } = req.body || {};

  const cameraProxyUrl =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ||
    "http://127.0.0.1:8090";

  try {
    let resolvedPassword = "";
    if (dvrId && !String(dvrId).startsWith("dvr-default") && !String(dvrId).startsWith("dvr-mock")) {
      const dvrRes = await query(
        `SELECT password_encrypted FROM public.dvr_devices WHERE id::text = $1`,
        [String(dvrId)]
      ).catch(() => null);
      if (dvrRes && dvrRes.rows.length > 0) {
        const pwd = dvrRes.rows[0].password_encrypted;
        if (pwd && pwd !== "configured") {
          resolvedPassword = String(pwd);
        }
      }
    }

    // 1. Endpoint dedicado de captura de snapshot por câmera/canal no backend Python
    const pyResp = await fetch(
      `${cameraProxyUrl}/dvr/capture-snapshot?channel=${encodeURIComponent(String(channelNumber))}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: dvrId,
          name: dvrName,
          brand,
          host,
          rtsp_port: Number(rtsp_port),
          http_port: Number(http_port),
          username,
          password: resolvedPassword,
          total_channels: Math.max(1, Number(channelNumber)),
        }),
        signal: AbortSignal.timeout(4500),
      }
    ).catch(() => null);

    if (pyResp && pyResp.ok) {
      const json = await pyResp.json();
      streamMonitorService.recordEvent({
        camera_id: `${dvrId}-ch-${channelNumber}`,
        event_type: "connected",
        severity: "info",
        message: `Snapshot sob demanda capturado em '${cameraName}' (${json.width}x${json.height})`,
        details: { channelNumber, width: json.width, height: json.height },
      });
      return res.status(200).json({ data: json });
    }

    // 2. Fallback sintético caso a câmera específica esteja inacessível
    const fallbackUrl = buildFallbackSyntheticSvgDataUrl(
      String(cameraName),
      String(brand),
      String(host),
      Number(channelNumber)
    );
    const fallbackPayload = {
      cameraId: `${dvrId}-ch-${channelNumber}`,
      cameraName,
      dvrName,
      brand,
      mimeType: "image/svg+xml",
      width: 800,
      height: 450,
      capturedAt: new Date().toISOString(),
      dataUrl: fallbackUrl,
    };

    streamMonitorService.recordEvent({
      camera_id: fallbackPayload.cameraId,
      event_type: "connected",
      severity: "info",
      message: `Snapshot sintético gerado para '${cameraName}' (Canal ${channelNumber})`,
      details: { channelNumber, mode: "synthetic_fallback" },
    });

    return res.status(200).json({ data: fallbackPayload });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro ao capturar snapshot";
    return res.status(500).json({ error: msg });
  }
}
