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
  operator_user_ids: string[];
  total_rows: number;
};

export type BatchDetailsRow = {
  batch_id: string;
  batch_code: string;
  total_fabrics: number;
  approved_count: number;
  rejected_count: number;
  first_analyzed_at: string;
  last_analyzed_at: string;
  operators: Array<{
    user_id: string;
    display_name: string;
  }>;
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
