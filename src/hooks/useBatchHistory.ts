"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase.rpc("get_batch_history", {
        p_search: search || null,
        p_user_id: userId || null,
        p_start: startDate?.toISOString() || null,
        p_end: endDate?.toISOString() || null,
        p_limit: pageSize,
        p_offset: pageIndex * pageSize,
      });

      if (error) {
        console.error("Error fetching batch history:", error);
        throw error;
      }

      return (data as BatchHistoryRow[]) || [];
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

      const { data, error } = await supabase.rpc("get_batch_details", {
        p_batch_id: batchId,
      });

      if (error) {
        console.error("Error fetching batch details:", error);
        throw error;
      }

      return (data?.[0] as BatchDetailsRow | undefined) || null;
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
