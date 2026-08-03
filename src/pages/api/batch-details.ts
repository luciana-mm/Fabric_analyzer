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

  const batchId = typeof req.query.batchId === "string" ? req.query.batchId : null;
  if (!batchId) {
    return res.status(400).json({ error: "batchId is required" });
  }

  try {
    if (auth.role !== "gestor") {
      const accessCheck = await query(
        "SELECT 1 FROM analysis_records WHERE batch_id = $1 AND operator_user_id = $2 LIMIT 1",
        [batchId, auth.userId],
      );
      if (accessCheck.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load batch details" });
  }
}
