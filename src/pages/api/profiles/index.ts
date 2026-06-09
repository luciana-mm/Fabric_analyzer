import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  const roleFilter = typeof req.query.role === "string" ? req.query.role : null;

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

  const result = await query(sql, params);
  return res.status(200).json({ data: result.rows });
}
