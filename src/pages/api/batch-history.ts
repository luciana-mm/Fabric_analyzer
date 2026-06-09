import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const search = typeof req.query.search === "string" ? req.query.search : null;
  const userId = typeof req.query.userId === "string" ? req.query.userId : null;
  const start = typeof req.query.start === "string" ? req.query.start : null;
  const end = typeof req.query.end === "string" ? req.query.end : null;
  const limit = Number(req.query.limit ?? 10);
  const offset = Number(req.query.offset ?? 0);

  const params: unknown[] = [];
  let sql = `SELECT
      batch_id,
      batch_code,
      MIN(analyzed_at) AS first_analyzed_at,
      MAX(analyzed_at) AS last_analyzed_at,
      COUNT(*) AS total_fabrics,
      SUM(CASE WHEN result = 'ok' THEN 1 ELSE 0 END) AS approved_count,
      SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) AS rejected_count,
      ARRAY_AGG(DISTINCT operator_user_id) AS operator_user_ids,
      COUNT(*) OVER() AS total_rows
    FROM analysis_records`;

  const conditions: string[] = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`batch_code ILIKE $${params.length}`);
  }
  if (userId) {
    params.push(userId);
    conditions.push(`operator_user_id = $${params.length}`);
  }
  if (start) {
    params.push(start);
    conditions.push(`analyzed_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    conditions.push(`analyzed_at < $${params.length}`);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  sql += ` GROUP BY batch_id, batch_code ORDER BY last_analyzed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return res.status(200).json({ data: result.rows });
}
