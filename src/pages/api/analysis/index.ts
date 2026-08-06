import type { NextApiRequest, NextApiResponse } from "next";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function parseDateParameter(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : value;
}

function parseNumberParameter(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (req.method === "GET") {
    const requestedUserId = typeof req.query.userId === "string" ? req.query.userId : null;
    const start = parseDateParameter(typeof req.query.start === "string" ? req.query.start : null);
    const end = parseDateParameter(typeof req.query.end === "string" ? req.query.end : null);

    if (typeof req.query.start === "string" && start === null) {
      return res.status(400).json({ error: "Invalid start date" });
    }

    if (typeof req.query.end === "string" && end === null) {
      return res.status(400).json({ error: "Invalid end date" });
    }

    if (requestedUserId && requestedUserId !== auth.userId && auth.role !== "gestor") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const params: unknown[] = [];
    let sql = `SELECT id, operator_user_id, reference_code, tissue_type, result, failure_reason, processing_time_ms, analyzed_at, delta_e_measured, delta_e_threshold, precision_percent, required_precision_percent, comparison_method, reference_color_hex, measured_color_hex, analysis_type, tissue_batch_code
                 FROM analysis_records`;

    const conditions: string[] = [];
    if (requestedUserId) {
      params.push(requestedUserId);
      conditions.push(`operator_user_id = $${params.length}`);
    }

    if (!requestedUserId && auth.role !== "gestor") {
      params.push(auth.userId);
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

    try {
      const result = await query(sql, params);
      return res.status(200).json({ data: result.rows });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Unable to load analysis records" });
    }
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

    if (operator_user_id !== auth.userId && auth.role !== "gestor") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const processingTimeMs = parseNumberParameter(processing_time_ms) ?? 0;
    if (processing_time_ms !== undefined && processing_time_ms !== null && typeof processingTimeMs !== "number") {
      return res.status(400).json({ error: "Invalid processing_time_ms" });
    }

    const optionalNumberFields = {
      delta_e_measured,
      delta_e_threshold,
      precision_percent,
      required_precision_percent,
    } as const;

    const numericValues = Object.entries(optionalNumberFields).reduce<Record<string, number | null>>((acc, [key, value]) => {
      const parsedValue = parseNumberParameter(value);
      if (value !== undefined && value !== null && parsedValue === null) {
        acc[key] = null;
      } else {
        acc[key] = parsedValue;
      }
      return acc;
    }, {});

    if (
      (delta_e_measured !== undefined && delta_e_measured !== null && numericValues.delta_e_measured === null) ||
      (delta_e_threshold !== undefined && delta_e_threshold !== null && numericValues.delta_e_threshold === null) ||
      (precision_percent !== undefined && precision_percent !== null && numericValues.precision_percent === null) ||
      (required_precision_percent !== undefined && required_precision_percent !== null && numericValues.required_precision_percent === null)
    ) {
      return res.status(400).json({ error: "Invalid numeric analysis field" });
    }

    try {
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
          processingTimeMs,
          numericValues.delta_e_measured ?? null,
          numericValues.delta_e_threshold ?? null,
          numericValues.precision_percent ?? null,
          numericValues.required_precision_percent ?? null,
          comparison_method ?? null,
          reference_color_hex ?? null,
          measured_color_hex ?? null,
          analysis_type ?? null,
          tissue_batch_code ?? null,
        ],
      );

      return res.status(201).json({ data: result.rows[0] });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Unable to save analysis record" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
