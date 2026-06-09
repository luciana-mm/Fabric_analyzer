"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";

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

type UserRoleRow = {
  user_id: string;
  role: "operador" | "gestor";
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
  userId: string;
  name: string;
  role: string;
  active: boolean;
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

export type GlobalReportPeriod =
  | "daily"
  | "weekly"
  | "monthly"
  | "semester"
  | "yearly"
  | "custom";
export type ManagerPerformancePeriod = Exclude<GlobalReportPeriod, "custom">;

export type ManagerDailyStats = {
  activeEmployeesToday: number;
  totalVerified: number;
  totalSuccess: number;
  totalFailure: number;
  successRate: number;
  failureRate: number;
};

export type GlobalReportCustomRange = {
  startDate: string;
  endDate: string;
};

export type GlobalReportStats = {
  verified: number;
  success: number;
  failure: number;
  avgTime: string;
  employeePerformance: Array<{
    userId: string;
    id: string;
    name: string;
    role: string;
    shift: string;
    verified: number;
    success: number;
    failure: number;
    avgTime: string;
  }>;
  errorBreakdown: Array<{
    label: string;
    percentage: number;
  }>;
};

const formatMsToSecondsLabel = (ms: number) =>
  `${(ms / 1000).toFixed(1).replace(".", ",")}s`;

const normalizeFailureReason = (value: string | null) => {
  const label = value?.trim() || "Sem motivo informado";
  return {
    label,
    key: label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase(),
  };
};

const createLocalDateFromInput = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getDateRangeByPeriod = (
  period: GlobalReportPeriod,
  customRange?: GlobalReportCustomRange,
) => {
  if (period === "custom") {
    if (!customRange?.startDate || !customRange.endDate) {
      return null;
    }

    const start = createLocalDateFromInput(customRange.startDate);
    const end = createLocalDateFromInput(customRange.endDate);

    if (end < start) {
      return null;
    }

    end.setDate(end.getDate() + 1);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDay();

  if (period === "daily") {
    return {
      startDate: new Date(year, month, now.getDate()).toISOString(),
      endDate: new Date(year, month, now.getDate() + 1).toISOString(),
    };
  }

  if (period === "weekly") {
    const start = new Date(year, month, now.getDate());
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysSinceMonday);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }

  if (period === "monthly") {
    return {
      startDate: new Date(year, month, 1).toISOString(),
      endDate: new Date(year, month + 1, 1).toISOString(),
    };
  }

  if (period === "semester") {
    const semesterStartMonth = month < 6 ? 0 : 6;

    return {
      startDate: new Date(year, semesterStartMonth, 1).toISOString(),
      endDate: new Date(year, semesterStartMonth + 6, 1).toISOString(),
    };
  }

  return {
    startDate: new Date(year, 0, 1).toISOString(),
    endDate: new Date(year + 1, 0, 1).toISOString(),
  };
};

const buildErrorBreakdown = (records: AnalysisRecord[]) => {
  const failed = records.filter((record) => record.result === "fail");
  if (failed.length === 0) {
    return [] as Array<{ label: string; count: number; percentage: number }>;
  }

  const grouped = failed.reduce<
    Record<string, { label: string; count: number }>
  >((acc, item) => {
    const { key, label } = normalizeFailureReason(item.failure_reason);
    acc[key] = {
      label: acc[key]?.label ?? label,
      count: (acc[key]?.count ?? 0) + 1,
    };
    return acc;
  }, {});

  return Object.values(grouped)
    .map(({ label, count }) => ({
      label,
      count,
      percentage: Number(((count / failed.length) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count);
};

const filterRecordsByRange = (
  records: AnalysisRecord[],
  range: { startDate: string; endDate: string } | null,
) => {
  if (!range) {
    return records;
  }

  const start = new Date(range.startDate).getTime();
  const end = new Date(range.endDate).getTime();

  return records.filter((record) => {
    const analyzedAt = new Date(record.analyzed_at).getTime();
    return analyzedAt >= start && analyzedAt < end;
  });
};

export const useOperatorDashboardData = (userId: string | null | undefined) => {
  const query = useQuery({
    queryKey: ["operator-dashboard", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetchJson<{ data: AnalysisRecord[] }>(
        `/api/analysis?userId=${encodeURIComponent(userId ?? "")}`,
      );
      return response.data ?? [];
    },
  });

  const stats = useMemo<OperatorDashboardStats>(() => {
    const records = query.data ?? [];
    const totalVerified = records.length;
    const totalSuccess = records.filter(
      (record) => record.result === "ok",
    ).length;
    const totalFailure = totalVerified - totalSuccess;
    const successRate =
      totalVerified === 0
        ? 0
        : Number(((totalSuccess / totalVerified) * 100).toFixed(1));
    const failureRate =
      totalVerified === 0
        ? 0
        : Number(((totalFailure / totalVerified) * 100).toFixed(1));

    const averageTimeMs =
      totalVerified === 0
        ? 0
        : Math.round(
            records.reduce(
              (sum, record) => sum + record.processing_time_ms,
              0,
            ) / totalVerified,
          );

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

const emptyGlobalReportStats: GlobalReportStats = {
  verified: 0,
  success: 0,
  failure: 0,
  avgTime: formatMsToSecondsLabel(0),
  employeePerformance: [],
  errorBreakdown: [],
};

export const useGlobalReportData = (
  period: GlobalReportPeriod,
  customRange?: GlobalReportCustomRange,
) => {
  const customStartDate = customRange?.startDate;
  const customEndDate = customRange?.endDate;
  const dateRange = useMemo(
    () =>
      getDateRangeByPeriod(
        period,
        customStartDate && customEndDate
          ? { startDate: customStartDate, endDate: customEndDate }
          : undefined,
      ),
    [customEndDate, customStartDate, period],
  );
  const query = useQuery({
    queryKey: ["global-report", period, customStartDate, customEndDate],
    enabled: Boolean(dateRange),
    queryFn: async () => {
      if (!dateRange) {
        return [] as AnalysisRecord[];
      }

      const response = await fetchJson<{ data: AnalysisRecord[] }>(
        `/api/analysis?start=${encodeURIComponent(dateRange.startDate)}&end=${encodeURIComponent(
          dateRange.endDate,
        )}`,
      );
      return response.data ?? [];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["global-report", "profiles"],
    queryFn: async () => {
      const response = await fetchJson<{ data: ProfileSummary[] }>(
        `/api/profiles`,
      );
      return response.data ?? [];
    },
  });

  const stats = useMemo<GlobalReportStats>(() => {
    if (!dateRange) {
      return emptyGlobalReportStats;
    }

    const records = query.data ?? [];
    const profiles = profilesQuery.data ?? [];
    const profileByUserId = new Map(
      profiles.map((profile) => [profile.user_id, profile]),
    );
    const verified = records.length;
    const success = records.filter((record) => record.result === "ok").length;
    const failure = verified - success;
    const averageTimeMs =
      verified === 0
        ? 0
        : Math.round(
            records.reduce(
              (sum, record) => sum + record.processing_time_ms,
              0,
            ) / verified,
          );
    const groupedRecords = records.reduce<Record<string, AnalysisRecord[]>>(
      (acc, item) => {
        if (!acc[item.operator_user_id]) {
          acc[item.operator_user_id] = [];
        }
        acc[item.operator_user_id].push(item);
        return acc;
      },
      {},
    );
    const employeePerformance = Object.entries(groupedRecords)
      .map(([userId, items]) => {
        const profile = profileByUserId.get(userId);
        const employeeVerified = items.length;
        const employeeSuccess = items.filter(
          (item) => item.result === "ok",
        ).length;
        const employeeFailure = employeeVerified - employeeSuccess;
        const employeeAvgTimeMs =
          employeeVerified === 0
            ? 0
            : Math.round(
                items.reduce((sum, item) => sum + item.processing_time_ms, 0) /
                  employeeVerified,
              );

        return {
          userId,
          id: profile?.employee_code ?? userId.slice(0, 8).toUpperCase(),
          name: profile?.display_name ?? "Sem nome",
          role: profile?.job_title ?? "Funcionario",
          shift: profile?.shift ?? "Nao informado",
          verified: employeeVerified,
          success: employeeSuccess,
          failure: employeeFailure,
          avgTime: formatMsToSecondsLabel(employeeAvgTimeMs),
        };
      })
      .sort((a, b) => b.verified - a.verified);

    return {
      verified,
      success,
      failure,
      avgTime: formatMsToSecondsLabel(averageTimeMs),
      employeePerformance,
      errorBreakdown: buildErrorBreakdown(records).map((entry) => ({
        label: entry.label,
        percentage: entry.percentage,
      })),
    };
  }, [dateRange, profilesQuery.data, query.data]);

  return {
    ...query,
    isError: query.isError || profilesQuery.isError,
    isLoading: query.isLoading || profilesQuery.isLoading,
    stats,
  };
};

export const useManagerDashboardData = (options?: {
  includeManagers?: boolean;
  includeInactive?: boolean;
  period?: ManagerPerformancePeriod;
}) => {
  const period = options?.period ?? "daily";
  const periodRange = useMemo(() => getDateRangeByPeriod(period), [period]);
  const dailyRange = useMemo(() => getDateRangeByPeriod("daily"), []);
  const analysesQuery = useQuery({
    queryKey: ["manager-dashboard", "analyses"],
    queryFn: async () => {
      const response = await fetchJson<{ data: AnalysisRecord[] }>(
        "/api/analysis",
      );
      return response.data ?? [];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["manager-dashboard", "profiles"],
    queryFn: async () => {
      const response = await fetchJson<{ data: ProfileSummary[] }>(
        `/api/profiles`,
      );
      return response.data ?? [];
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["manager-dashboard", "roles"],
    queryFn: async () => {
      const response = await fetchJson<{ data: UserRoleRow[] }>(
        `/api/roles`,
      );
      return response.data ?? [];
    },
  });

  const employees = useMemo<ManagerEmployeeRow[]>(() => {
    const profiles = profilesQuery.data ?? [];
    const records = filterRecordsByRange(analysesQuery.data ?? [], periodRange);
    const roles = rolesQuery.data ?? [];
    const visibleRoles = options?.includeManagers
      ? roles
      : roles.filter((item) => item.role !== "gestor");
    const visibleUserIds = new Set(visibleRoles.map((item) => item.user_id));
    const roleByUserId = new Map(
      roles.map((item) => [item.user_id, item.role]),
    );

    const groupedRecords = records.reduce<Record<string, AnalysisRecord[]>>(
      (acc, item) => {
        if (!acc[item.operator_user_id]) {
          acc[item.operator_user_id] = [];
        }
        acc[item.operator_user_id].push(item);
        return acc;
      },
      {},
    );

    return profiles
      .filter(
        (profile) =>
          visibleUserIds.has(profile.user_id) &&
          (options?.includeInactive ? true : profile.active),
      )
      .map((profile) => {
        const appRole = roleByUserId.get(profile.user_id);
        const items = groupedRecords[profile.user_id] ?? [];
        const verified = items.length;
        const success = items.filter((item) => item.result === "ok").length;
        const failure = verified - success;
        const avgTimeMs =
          verified === 0
            ? 0
            : Math.round(
                items.reduce((sum, item) => sum + item.processing_time_ms, 0) /
                  verified,
              );

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
          id:
            profile.employee_code ?? profile.user_id.slice(0, 8).toUpperCase(),
          userId: profile.user_id,
          name: profile.display_name ?? "Sem nome",
          role:
            profile.job_title ??
            (appRole === "gestor" ? "Gestor" : "Funcionario (Operador)"),
          active: profile.active,
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
  }, [
    options?.includeManagers,
    options?.includeInactive,
    periodRange,
    profilesQuery.data,
    analysesQuery.data,
    rolesQuery.data,
  ]);

  const dailyStats = useMemo<ManagerDailyStats>(() => {
    const profiles = profilesQuery.data ?? [];
    const records = filterRecordsByRange(analysesQuery.data ?? [], dailyRange);
    const roles = rolesQuery.data ?? [];
    const visibleRoles = options?.includeManagers
      ? roles
      : roles.filter((item) => item.role !== "gestor");
    const visibleUserIds = new Set(visibleRoles.map((item) => item.user_id));
    const activeUserIds = new Set(
      profiles
        .filter(
          (profile) => profile.active && visibleUserIds.has(profile.user_id),
        )
        .map((profile) => profile.user_id),
    );
    const activeRecords = records.filter((record) =>
      activeUserIds.has(record.operator_user_id),
    );
    const totalVerified = activeRecords.length;
    const totalSuccess = activeRecords.filter(
      (record) => record.result === "ok",
    ).length;
    const totalFailure = totalVerified - totalSuccess;

    return {
      activeEmployeesToday: activeUserIds.size,
      totalVerified,
      totalSuccess,
      totalFailure,
      successRate:
        totalVerified === 0
          ? 0
          : Number(((totalSuccess / totalVerified) * 100).toFixed(1)),
      failureRate:
        totalVerified === 0
          ? 0
          : Number(((totalFailure / totalVerified) * 100).toFixed(1)),
    };
  }, [
    analysesQuery.data,
    dailyRange,
    options?.includeManagers,
    profilesQuery.data,
    rolesQuery.data,
  ]);

  const loading =
    analysesQuery.isLoading || profilesQuery.isLoading || rolesQuery.isLoading;
  const isError =
    analysesQuery.isError || profilesQuery.isError || rolesQuery.isError;
  const error = analysesQuery.error ?? profilesQuery.error ?? rolesQuery.error;
  const refresh = async () => {
    await Promise.all([
      analysesQuery.refetch(),
      profilesQuery.refetch(),
      rolesQuery.refetch(),
    ]);
  };

  return {
    employees,
    dailyStats,
    loading,
    isError,
    error,
    refresh,
  };
};
