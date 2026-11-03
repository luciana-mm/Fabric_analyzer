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
        "SELECT 1 FROM analysis_records WHERE COALESCE(tissue_batch_code, tissue_type, 'SEM-LOTE') = $1 AND operator_user_id = $2 LIMIT 1",
        [batchId, auth.userId],
      );
      if (accessCheck.rowCount === 0) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const summaryResult = await query(
      `SELECT
          COALESCE(tissue_batch_code, tissue_type, 'SEM-LOTE') AS batch_id,
          COALESCE(tissue_batch_code, tissue_type, 'SEM-LOTE') AS batch_code,
          COUNT(*)::int AS total_fabrics,
          SUM(CASE WHEN result = 'ok' THEN 1 ELSE 0 END)::int AS approved_count,
          SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END)::int AS rejected_count,
          COALESCE(SUM(COALESCE(defect_count, 0)), 0)::int AS total_defects,
          COALESCE(SUM(CASE WHEN COALESCE(is_patterned, false) THEN COALESCE(defect_count, 0) ELSE 0 END), 0)::int AS patterned_defects,
          COALESCE(SUM(CASE WHEN NOT COALESCE(is_patterned, false) THEN COALESCE(defect_count, 0) ELSE 0 END), 0)::int AS plain_defects,
          SUM(CASE WHEN COALESCE(is_patterned, false) THEN 1 ELSE 0 END)::int AS patterned_count,
          SUM(CASE WHEN NOT COALESCE(is_patterned, false) THEN 1 ELSE 0 END)::int AS plain_count,
          BOOL_OR(COALESCE(is_patterned, false)) AS is_patterned,
          ROUND(AVG(precision_percent)::numeric, 2) AS avg_precision,
          ROUND(AVG(delta_e_measured)::numeric, 3) AS avg_delta_e,
          MIN(analyzed_at) AS first_analyzed_at,
          MAX(analyzed_at) AS last_analyzed_at
        FROM analysis_records
        WHERE COALESCE(tissue_batch_code, tissue_type, 'SEM-LOTE') = $1
        GROUP BY COALESCE(tissue_batch_code, tissue_type, 'SEM-LOTE')`,
      [batchId],
    );

    const operatorsResult = await query(
      `SELECT DISTINCT ar.operator_user_id AS user_id, COALESCE(p.display_name, 'Operador') AS display_name
        FROM analysis_records ar
        LEFT JOIN profiles p ON p.user_id = ar.operator_user_id
        WHERE COALESCE(ar.tissue_batch_code, ar.tissue_type, 'SEM-LOTE') = $1`,
      [batchId],
    );

    const recordsResult = await query(
      `SELECT
          ar.id,
          ar.reference_code,
          ar.analyzed_at,
          ar.result,
          ar.failure_reason,
          ar.processing_time_ms,
          COALESCE(ar.defect_count, 0)::int AS defect_count,
          COALESCE(ar.is_patterned, false) AS is_patterned,
          COALESCE(ar.comparison_method, 'CIEDE2000') AS comparison_method,
          ar.delta_e_measured,
          ar.delta_e_threshold,
          ar.precision_percent,
          ar.required_precision_percent,
          ar.reference_color_hex,
          ar.measured_color_hex,
          ar.analysis_type,
          COALESCE(p.display_name, 'Operador') AS operator_name
        FROM analysis_records ar
        LEFT JOIN profiles p ON p.user_id = ar.operator_user_id
        WHERE COALESCE(ar.tissue_batch_code, ar.tissue_type, 'SEM-LOTE') = $1
        ORDER BY ar.analyzed_at DESC
        LIMIT 100`,
      [batchId],
    );

    const summary = summaryResult.rows[0] ?? null;
    if (!summary) {
      return res.status(200).json({ data: null });
    }
    return res.status(200).json({
      data: {
        ...summary,
        operators: operatorsResult.rows,
        records: recordsResult.rows,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Unable to load batch details" });
  }
}
