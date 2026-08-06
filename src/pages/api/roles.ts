import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (auth.role !== "gestor") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await query(
      "SELECT user_id, role FROM user_roles ORDER BY user_id",
    );
    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load roles" });
  }
}
