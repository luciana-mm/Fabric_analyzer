import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { DvrAdapterFactory } from "@/lib/dvr-adapters";
import type { DvrBrand } from "@/types/dvr";
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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    id,
    name = "DVR",
    brand = "hikvision",
    host,
    rtsp_port = 554,
    http_port = 80,
    sdk_port,
    username = "admin",
    total_channels = 1,
  } = req.body || {};

  if (!host) {
    return res.status(400).json({ error: "Host do DVR é obrigatório para descoberta" });
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
      total_channels: Number(total_channels),
    });

    let discovered;
    const pyBrand = brand === "generic" ? "generic_rtsp" : brand;
    const pyResp = await fetch(`${getCameraProxyUrl()}/dvr/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: String(id || "dvr-discover"),
        name,
        brand: pyBrand,
        host,
        rtsp_port: Number(rtsp_port),
        http_port: Number(http_port),
        sdk_port: sdk_port ? Number(sdk_port) : undefined,
        username,
        password: "",
        total_channels: Number(total_channels),
      }),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

    if (pyResp && pyResp.ok) {
      const pyData = await pyResp.json();
      discovered = Array.isArray(pyData?.cameras)
        ? pyData.cameras
        : await adapter.discoverCameras();
    } else {
      discovered = await adapter.discoverCameras();
}
    if (id && !String(id).startsWith("dvr-default") && !String(id).startsWith("dvr-mock-default")) {
      await query(`DELETE FROM public.camera_devices WHERE dvr_id = $1`, [id]).catch(() => null);
      for (const cam of discovered) {
        const subUrl = await adapter.getCameraStream(String(cam.channelNumber), "sub");
        await query(
          `INSERT INTO public.camera_devices (
            dvr_id, name, channel_number, stream_url_main, stream_url_sub,
            snapshot_url, resolution_width, resolution_height, fps, is_active, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)`,
          [
            id,
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
        ).catch(() => null);
      }
    }
    return res.status(200).json({ data: discovered });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro ao descobrir canais";
    return res.status(500).json({ error: msg });
  }
}
