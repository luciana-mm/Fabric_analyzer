"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type AnalysisRecord = {
  operator_user_id: string;
  reference_code: string;
  tissue_type: string;
  result: "ok" | "fail";
  failure_reason: string | null;
  processing_time_ms: number;
  analyzed_at: string;
};

type ProfileSummary = {
  user_id: string;
  display_name: string | null;
  employee_code: string | null;
  shift: string | null;
  job_title: string | null;
  active: boolean;
};

export type OperatorDashboardStats = {
  totalVerified: number;
  totalSuccess: number;
  totalFailure: number;
  successRate: number;
  failureRate: number;
  averageTimeMs: number;
  recentAnalyses: Array<{
    id: string;
    type: string;
    result: "ok" | "fail";
    analyzedAt: string;
  }>;
  errorBreakdown: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
};

export type ManagerEmployeeRow = {
  id: string;
  name: string;
  role: string;
  verified: number;
  success: number;
  failure: number;
  avgTime: string;
  avgTimeMs: number;
  shift: string;
  recentAnalyses: Array<{
    id: string;
    type: string;
    result: "ok" | "fail";
    analyzedAt: string;
  }>;
  errorBreakdown: Array<{
    label: string;
    percentage: number;
  }>;
};

const formatMsToSecondsLabel = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")}s`;

const buildErrorBreakdown = (records: AnalysisRecord[]) => {
  const failed = records.filter((record) => record.result === "fail");
  if (failed.length === 0) {
    return [] as Array<{ label: string; count: number; percentage: number }>;
  }

  const grouped = failed.reduce<Record<string, number>>((acc, item) => {
    const label = item.failure_reason?.trim() || "Sem motivo informado";
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([label, count]) => ({
      label,
      count,
      percentage: Number(((count / failed.length) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);
};

export const useOperatorDashboardData = (userId: string | null | undefined) => {
  const query = useQuery({
    queryKey: ["operator-dashboard", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_records")
        .select("operator_user_id, reference_code, tissue_type, result, failure_reason, processing_time_ms, analyzed_at")
        .eq("operator_user_id", userId as string)
        .order("analyzed_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as AnalysisRecord[];
    },
  });

  const stats = useMemo<OperatorDashboardStats>(() => {
    const records = query.data ?? [];
    const totalVerified = records.length;
    const totalSuccess = records.filter((record) => record.result === "ok").length;
    const totalFailure = totalVerified - totalSuccess;
    const successRate = totalVerified === 0 ? 0 : Number(((totalSuccess / totalVerified) * 100).toFixed(1));
    const failureRate = totalVerified === 0 ? 0 : Number(((totalFailure / totalVerified) * 100).toFixed(1));

    const averageTimeMs =
      totalVerified === 0
        ? 0
        : Math.round(records.reduce((sum, record) => sum + record.processing_time_ms, 0) / totalVerified);

    const recentAnalyses = records.slice(0, 6).map((record) => ({
      id: record.reference_code,
      type: record.tissue_type,
      result: record.result,
      analyzedAt: record.analyzed_at,
    }));

    return {
      totalVerified,
      totalSuccess,
      totalFailure,
      successRate,
      failureRate,
      averageTimeMs,
      recentAnalyses,
      errorBreakdown: buildErrorBreakdown(records),
    };
  }, [query.data]);

  return {
    ...query,
    stats,
    formatMsToSecondsLabel,
  };
};

export const useManagerDashboardData = () => {
  const analysesQuery = useQuery({
    queryKey: ["manager-dashboard", "analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analysis_records")
        .select("operator_user_id, reference_code, tissue_type, result, failure_reason, processing_time_ms, analyzed_at")
        .order("analyzed_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as AnalysisRecord[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["manager-dashboard", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, employee_code, shift, job_title, active")
        .eq("active", true);

      if (error) {
        throw error;
      }

      return (data ?? []) as ProfileSummary[];
    },
  });

  const employees = useMemo<ManagerEmployeeRow[]>(() => {
    const profiles = profilesQuery.data ?? [];
    const records = analysesQuery.data ?? [];

    const groupedRecords = records.reduce<Record<string, AnalysisRecord[]>>((acc, item) => {
      if (!acc[item.operator_user_id]) {
        acc[item.operator_user_id] = [];
      }
      acc[item.operator_user_id].push(item);
      return acc;
    }, {});

    return profiles
      .map((profile) => {
        const items = groupedRecords[profile.user_id] ?? [];
        const verified = items.length;
        const success = items.filter((item) => item.result === "ok").length;
        const failure = verified - success;
        const avgTimeMs =
          verified === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + item.processing_time_ms, 0) / verified);

        const recentAnalyses = items.slice(0, 5).map((item) => ({
          id: item.reference_code,
          type: item.tissue_type,
          result: item.result,
          analyzedAt: item.analyzed_at,
        }));

        const errorBreakdown = buildErrorBreakdown(items).map((entry) => ({
          label: entry.label,
          percentage: entry.percentage,
        }));

        return {
          id: profile.employee_code ?? profile.user_id.slice(0, 8).toUpperCase(),
          name: profile.display_name ?? "Sem nome",
          role: profile.job_title ?? "Operador",
          verified,
          success,
          failure,
          avgTime: formatMsToSecondsLabel(avgTimeMs),
          avgTimeMs,
          shift: profile.shift ?? "Não informado",
          recentAnalyses,
          errorBreakdown,
        };
      })
      .sort((a, b) => b.verified - a.verified);
  }, [profilesQuery.data, analysesQuery.data]);

  const loading = analysesQuery.isLoading || profilesQuery.isLoading;
  const isError = analysesQuery.isError || profilesQuery.isError;
  const error = analysesQuery.error ?? profilesQuery.error;

  return {
    employees,
    loading,
    isError,
    error,
  };
};
