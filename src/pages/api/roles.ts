import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const result = await query(
    "SELECT user_id, role FROM user_roles ORDER BY user_id",
  );
  return res.status(200).json({ data: result.rows });
}
