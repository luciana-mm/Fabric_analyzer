import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : null;
  if (!batchId) {
    return res.status(400).json({ error: "batchId is required" });
  }

  const summaryResult = await query(
    `SELECT
        batch_id,
        batch_code,
        COUNT(*) AS total_fabrics,
        SUM(CASE WHEN result = 'ok' THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) AS rejected_count,
        MIN(analyzed_at) AS first_analyzed_at,
        MAX(analyzed_at) AS last_analyzed_at
      FROM analysis_records
      WHERE batch_id = $1
      GROUP BY batch_id, batch_code`,
    [batchId],
  );

  const operatorsResult = await query(
    `SELECT DISTINCT ar.operator_user_id AS user_id, p.display_name
      FROM analysis_records ar
      LEFT JOIN profiles p ON p.user_id = ar.operator_user_id
      WHERE ar.batch_id = $1`,
    [batchId],
  );

  const summary = summaryResult.rows[0] ?? null;
  return res.status(200).json({ data: { ...summary, operators: operatorsResult.rows } });
}
