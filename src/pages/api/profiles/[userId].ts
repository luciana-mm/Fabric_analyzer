import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = req.query.userId;
  if (typeof userId !== "string") {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { active } = req.body ?? {};
  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "Active must be a boolean" });
  }

  await query(
    "UPDATE profiles SET active = $1, updated_at = now() WHERE user_id = $2",
    [active, userId],
  );

  return res.status(200).json({ ok: true });
}
