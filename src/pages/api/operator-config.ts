import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (req.method === "GET") {
    const userId =
      typeof req.query.userId === "string" ? req.query.userId : null;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (userId !== auth.userId && auth.role !== "gestor") {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const result = await query(
        `SELECT user_id, active_tissue_code, delta_e, sample_points, sample_area_width_percent, sample_area_height_percent,
                reference_color_hex, reference_color_r, reference_color_g, reference_color_b,
                delta_configured, analysis_area_configured, color_configured, light_calibrated,
                ambient_light_configured, ambient_light_reference_hex,
                ambient_light_reference_r, ambient_light_reference_g, ambient_light_reference_b,
                system_step, active_view, updated_at
           FROM operator_configurations
           WHERE user_id = $1`,
        [userId],
      );

      return res.status(200).json({ data: result.rows[0] ?? null });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ error: "Unable to load operator configuration" });
    }
  }

  if (req.method === "POST") {
    const payload = req.body ?? {};
    const {
      user_id,
      active_tissue_code,
      delta_e,
      sample_points,
      sample_area_width_percent,
      sample_area_height_percent,
      reference_color_hex,
      reference_color_r,
      reference_color_g,
      reference_color_b,
      delta_configured,
      analysis_area_configured,
      color_configured,
      light_calibrated,
      ambient_light_configured,
      ambient_light_reference_hex,
      ambient_light_reference_r,
      ambient_light_reference_g,
      ambient_light_reference_b,
      system_step,
      active_view,
    } = payload;

    if (typeof user_id !== "string") {
      return res.status(400).json({ error: "user_id is required" });
    }

    if (user_id !== auth.userId && auth.role !== "gestor") {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      await query(
        `INSERT INTO operator_configurations (
           user_id, active_tissue_code, delta_e, sample_points,
           sample_area_width_percent, sample_area_height_percent,
           reference_color_hex, reference_color_r, reference_color_g, reference_color_b,
           delta_configured, analysis_area_configured, color_configured, light_calibrated,
           ambient_light_configured, ambient_light_reference_hex,
           ambient_light_reference_r, ambient_light_reference_g, ambient_light_reference_b,
           system_step, active_view, updated_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, now(), now())
         ON CONFLICT (user_id) DO UPDATE SET
           active_tissue_code = EXCLUDED.active_tissue_code,
           delta_e = EXCLUDED.delta_e,
           sample_points = EXCLUDED.sample_points,
           sample_area_width_percent = EXCLUDED.sample_area_width_percent,
           sample_area_height_percent = EXCLUDED.sample_area_height_percent,
           reference_color_hex = EXCLUDED.reference_color_hex,
           reference_color_r = EXCLUDED.reference_color_r,
           reference_color_g = EXCLUDED.reference_color_g,
           reference_color_b = EXCLUDED.reference_color_b,
           delta_configured = EXCLUDED.delta_configured,
           analysis_area_configured = EXCLUDED.analysis_area_configured,
           color_configured = EXCLUDED.color_configured,
           light_calibrated = EXCLUDED.light_calibrated,
           ambient_light_configured = EXCLUDED.ambient_light_configured,
           ambient_light_reference_hex = EXCLUDED.ambient_light_reference_hex,
           ambient_light_reference_r = EXCLUDED.ambient_light_reference_r,
           ambient_light_reference_g = EXCLUDED.ambient_light_reference_g,
           ambient_light_reference_b = EXCLUDED.ambient_light_reference_b,
           system_step = EXCLUDED.system_step,
           active_view = EXCLUDED.active_view,
           updated_at = now()`,
        [
          user_id,
          active_tissue_code ?? null,
          delta_e ?? null,
          sample_points ?? null,
          sample_area_width_percent ?? null,
          sample_area_height_percent ?? null,
          reference_color_hex ?? null,
          reference_color_r ?? null,
          reference_color_g ?? null,
          reference_color_b ?? null,
          delta_configured ?? false,
          analysis_area_configured ?? false,
          color_configured ?? false,
          light_calibrated ?? false,
          ambient_light_configured ?? false,
          ambient_light_reference_hex ?? null,
          ambient_light_reference_r ?? null,
          ambient_light_reference_g ?? null,
          ambient_light_reference_b ?? null,
          system_step ?? null,
          active_view ?? null,
        ],
      );

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ error: "Unable to save operator configuration" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
