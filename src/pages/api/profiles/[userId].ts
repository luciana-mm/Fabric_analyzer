import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  const userId = req.query.userId;
  if (typeof userId !== "string") {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (userId !== auth.userId && auth.role !== "gestor") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { active } = req.body ?? {};
  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "Active must be a boolean" });
  }

  try {
    await query(
      "UPDATE profiles SET active = $1, updated_at = now() WHERE user_id = $2",
      [active, userId],
    );
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to update profile" });
  }
}
