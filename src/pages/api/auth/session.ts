import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { getSessionToken, verifySessionToken } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getSessionToken(req);
  const userId = token ? verifySessionToken(token) : null;
  if (!userId) {
    return res.status(200).json({ user: null });
  }

  const userResult = await query(
    "SELECT id, email FROM users WHERE id = $1",
    [userId],
  );

  const userRow = userResult.rows[0];
  if (!userRow) {
    return res.status(200).json({ user: null });
  }

  const profileResult = await query(
    "SELECT display_name, job_title, shift FROM profiles WHERE user_id = $1",
    [userId],
  );
  const roleResult = await query(
    "SELECT role FROM user_roles WHERE user_id = $1",
    [userId],
  );

  return res.status(200).json({
    user: {
      id: userRow.id,
      email: userRow.email,
      role: roleResult.rows[0]?.role ?? null,
      display_name: profileResult.rows[0]?.display_name ?? null,
      job_title: profileResult.rows[0]?.job_title ?? null,
      shift: profileResult.rows[0]?.shift ?? null,
    },
  });
}
