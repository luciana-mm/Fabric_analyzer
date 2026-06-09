import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const userId = typeof req.query.userId === "string" ? req.query.userId : null;
    const start = typeof req.query.start === "string" ? req.query.start : null;
    const end = typeof req.query.end === "string" ? req.query.end : null;

    const params: unknown[] = [];
    let sql = `SELECT id, operator_user_id, reference_code, tissue_type, result, failure_reason, processing_time_ms, analyzed_at, delta_e_measured, delta_e_threshold, precision_percent, required_precision_percent, comparison_method, reference_color_hex, measured_color_hex, analysis_type, tissue_batch_code
                 FROM analysis_records`;

    const conditions: string[] = [];
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

    sql += " ORDER BY analyzed_at DESC";
    const result = await query(sql, params);
    return res.status(200).json({ data: result.rows });
  }

  if (req.method === "POST") {
    const {
      operator_user_id,
      reference_code,
      tissue_type,
      result: analysisResult,
      failure_reason,
      processing_time_ms,
      delta_e_measured,
      delta_e_threshold,
      precision_percent,
      required_precision_percent,
      comparison_method,
      reference_color_hex,
      measured_color_hex,
      analysis_type,
      tissue_batch_code,
    } = req.body ?? {};

    if (
      typeof operator_user_id !== "string" ||
      typeof reference_code !== "string" ||
      typeof tissue_type !== "string" ||
      typeof analysisResult !== "string"
    ) {
      return res.status(400).json({ error: "Missing required analysis fields" });
    }

    const result = await query(
      `INSERT INTO analysis_records (
         operator_user_id, reference_code, tissue_type, result,
         failure_reason, processing_time_ms, delta_e_measured, delta_e_threshold,
         precision_percent, required_precision_percent, comparison_method,
         reference_color_hex, measured_color_hex, analysis_type, tissue_batch_code,
         analyzed_at, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now()) RETURNING id`,
      [
        operator_user_id,
        reference_code,
        tissue_type,
        analysisResult,
        failure_reason ?? null,
        Number(processing_time_ms) || 0,
        delta_e_measured ?? null,
        delta_e_threshold ?? null,
        precision_percent ?? null,
        required_precision_percent ?? null,
        comparison_method ?? null,
        reference_color_hex ?? null,
        measured_color_hex ?? null,
        analysis_type ?? null,
        tissue_batch_code ?? null,
      ],
    );

    return res.status(201).json({ data: result.rows[0] });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
