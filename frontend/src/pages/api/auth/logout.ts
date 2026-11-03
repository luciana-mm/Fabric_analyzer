import type { NextApiRequest, NextApiResponse } from "next";
import { clearSessionCookie, getSessionToken, verifySessionToken } from "@/lib/auth";
import { query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getSessionToken(req);
  const userId = token ? verifySessionToken(token) : null;

  if (userId) {
    try {
      await query(
        `UPDATE operator_configurations
         SET system_step = 'CONFIG',
             active_tissue_code = 'TCD-NOVO',
             delta_e = 3,
             sample_points = 9,
             sample_area_width_percent = 60,
             sample_area_height_percent = 50,
             estampado = false,
             reference_color_hex = '#FFFFFF',
             reference_color_r = 255,
             reference_color_g = 255,
             reference_color_b = 255,
             ambient_light_reference_hex = NULL,
             ambient_light_reference_r = NULL,
             ambient_light_reference_g = NULL,
             ambient_light_reference_b = NULL,
             delta_configured = false,
             analysis_area_configured = false,
             color_configured = false,
             ambient_light_configured = false,
             light_calibrated = false,
             active_view = 'home',
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
    } catch (error) {
      console.error("Failed to reset operator configuration on logout:", error);
    }
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(200).json({ ok: true });
}
