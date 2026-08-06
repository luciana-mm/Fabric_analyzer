import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  let userId = typeof req.query.userId === "string" ? req.query.userId : null;
  const roleFilter = typeof req.query.role === "string" ? req.query.role : null;

  if (roleFilter && auth.role !== "gestor") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!userId && auth.role !== "gestor") {
    userId = auth.userId;
  }

  if (userId && auth.role !== "gestor" && userId !== auth.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const params: unknown[] = [];
  let sql = `SELECT p.user_id, p.display_name, p.employee_code, p.shift, p.job_title, p.active
               FROM profiles p`;

  if (roleFilter) {
    sql += ` INNER JOIN user_roles r ON r.user_id = p.user_id`;
  }

  const conditions: string[] = [];
  if (userId) {
    params.push(userId);
    conditions.push(`p.user_id = $${params.length}`);
  }
  if (roleFilter) {
    params.push(roleFilter);
    conditions.push(`r.role = $${params.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += ` ORDER BY p.display_name NULLS LAST`;

  try {
    const result = await query(sql, params);
    return res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load profiles" });
  }
}
