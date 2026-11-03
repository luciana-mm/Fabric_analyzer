"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import { useState, useMemo } from "react";

export type BatchHistoryRow = {
  batch_id: string;
  batch_code: string;
  first_analyzed_at: string;
  last_analyzed_at: string;
  total_fabrics: number;
  approved_count: number;
  rejected_count: number;
  total_defects: number;
  patterned_defects: number;
  is_patterned: boolean;
  operator_user_ids: string[];
  total_rows: number;
};

export type BatchInspectionRecord = {
  id: string;
  reference_code: string;
  analyzed_at: string;
  result: "ok" | "fail";
  failure_reason: string | null;
  processing_time_ms: number;
  defect_count: number;
  is_patterned: boolean;
  comparison_method: string;
  delta_e_measured: number | null;
  delta_e_threshold: number | null;
  precision_percent: number | null;
  required_precision_percent: number | null;
  reference_color_hex: string | null;
  measured_color_hex: string | null;
  analysis_type: string | null;
  operator_name: string;
};

export type BatchDetailsRow = {
  batch_id: string;
  batch_code: string;
  total_fabrics: number;
  approved_count: number;
  rejected_count: number;
  total_defects: number;
  patterned_defects: number;
  plain_defects: number;
  patterned_count: number;
  plain_count: number;
  is_patterned: boolean;
  avg_precision: number | null;
  avg_delta_e: number | null;
  first_analyzed_at: string;
  last_analyzed_at: string;
  operators: Array<{
    user_id: string;
    display_name: string;
  }>;
  records: BatchInspectionRecord[];
};

export const useBatchHistory = (
  search?: string,
  userId?: string,
  startDate?: Date,
  endDate?: Date,
  pageSize: number = 10,
  pageIndex: number = 0
) => {
  const query = useQuery({
    queryKey: [
      "batch-history",
      search,
      userId,
      startDate?.toISOString(),
      endDate?.toISOString(),
      pageSize,
      pageIndex,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (userId) params.append("userId", userId);
      if (startDate) params.append("start", startDate.toISOString());
      if (endDate) params.append("end", endDate.toISOString());
      params.append("limit", String(pageSize));
      params.append("offset", String(pageIndex * pageSize));

      const response = await fetchJson<{ data: BatchHistoryRow[] }>(
        `/api/batch-history?${params.toString()}`,
      );

      return response.data ?? [];
    },
  });

  return {
    batches: query.data || [],
    total: query.data?.[0]?.total_rows || 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};

export const useBatchDetails = (batchId?: string) => {
  const query = useQuery({
    queryKey: ["batch-details", batchId],
    queryFn: async () => {
      if (!batchId) return null;

      const response = await fetchJson<{ data: BatchDetailsRow | null }>(
        `/api/batch-details?batchId=${encodeURIComponent(batchId)}`,
      );

      return response.data ?? null;
    },
    enabled: !!batchId,
  });

  return {
    details: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
};
