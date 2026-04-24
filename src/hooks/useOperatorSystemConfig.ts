"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  cacheSystemConfig,
  defaultSystemConfig,
  loadSystemConfig,
  loadSystemConfigView,
  sanitizeSystemConfig,
  saveSystemConfig,
  saveSystemConfigView,
  type ConfigView,
  type SystemConfig,
} from "@/lib/systemConfig";

type ConfigLoadSource = "supabase" | "local";

type OperatorConfigRow = {
  user_id: string;
  delta_e: number;
  sample_points: number;
  sample_area_width_percent: number;
  sample_area_height_percent: number;
  reference_color_hex: string;
  reference_color_r: number;
  reference_color_g: number;
  reference_color_b: number;
  delta_configured: boolean;
  analysis_area_configured: boolean;
  color_configured: boolean;
  light_calibrated: boolean;
  active_view: ConfigView;
  updated_at: string;
};

const rowToSystemConfig = (row: OperatorConfigRow): SystemConfig => {
  return sanitizeSystemConfig({
    deltaE: row.delta_e as SystemConfig["deltaE"],
    samplePoints: row.sample_points as SystemConfig["samplePoints"],
    sampleAreaWidthPercent: row.sample_area_width_percent,
    sampleAreaHeightPercent: row.sample_area_height_percent,
    referenceColorHex: row.reference_color_hex,
    referenceColorRgb: {
      r: row.reference_color_r,
      g: row.reference_color_g,
      b: row.reference_color_b,
    },
    deltaConfigured: row.delta_configured,
    analysisAreaConfigured: row.analysis_area_configured,
    colorConfigured: row.color_configured,
    lightCalibrated: row.light_calibrated,
    updatedAt: row.updated_at,
  });
};

const systemConfigToRow = (
  userId: string,
  config: SystemConfig,
  activeView: ConfigView,
): Omit<OperatorConfigRow, "updated_at"> => {
  return {
    user_id: userId,
    delta_e: config.deltaE,
    sample_points: config.samplePoints,
    sample_area_width_percent: config.sampleAreaWidthPercent,
    sample_area_height_percent: config.sampleAreaHeightPercent,
    reference_color_hex: config.referenceColorHex,
    reference_color_r: config.referenceColorRgb.r,
    reference_color_g: config.referenceColorRgb.g,
    reference_color_b: config.referenceColorRgb.b,
    delta_configured: config.deltaConfigured,
    analysis_area_configured: config.analysisAreaConfigured,
    color_configured: config.colorConfigured,
    light_calibrated: config.lightCalibrated,
    active_view: activeView,
  };
};

export const useOperatorSystemConfig = (userId: string | null | undefined) => {
  const [config, setConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [activeView, setActiveViewState] = useState<ConfigView>("home");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadSource, setLoadSource] = useState<ConfigLoadSource>("local");

  const saveToSupabase = useCallback(
    async (nextConfig: SystemConfig, nextView: ConfigView) => {
      if (!userId) {
        return;
      }

      const payload = systemConfigToRow(userId, nextConfig, nextView);
      const { error } = await supabase
        .from("operator_configurations")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        throw error;
      }
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);

    const localConfig = loadSystemConfig();
    const localView = loadSystemConfigView();

    if (!userId) {
      setConfig(localConfig);
      setActiveViewState(localView);
      setLoadSource("local");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("operator_configurations")
        .select(
          "user_id, delta_e, sample_points, sample_area_width_percent, sample_area_height_percent, reference_color_hex, reference_color_r, reference_color_g, reference_color_b, delta_configured, analysis_area_configured, color_configured, light_calibrated, active_view, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const hydratedConfig = rowToSystemConfig(data as OperatorConfigRow);
        const hydratedView = (data as OperatorConfigRow).active_view ?? "home";
        setConfig(hydratedConfig);
        setActiveViewState(hydratedView);
        cacheSystemConfig(hydratedConfig);
        saveSystemConfigView(hydratedView);
        setLoadSource("supabase");
      } else {
        setConfig(localConfig);
        setActiveViewState(localView);
        setLoadSource("local");
      }
    } catch {
      setConfig(localConfig);
      setActiveViewState(localView);
      setLoadSource("local");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistPatch = useCallback(
    async (patch: Partial<SystemConfig>) => {
      const nextConfig = sanitizeSystemConfig({
        ...config,
        ...patch,
        updatedAt: new Date().toISOString(),
      });

      setIsSaving(true);

      try {
        await saveToSupabase(nextConfig, activeView);
        setConfig(nextConfig);
        cacheSystemConfig(nextConfig);
        setLoadSource(userId ? "supabase" : "local");
        return { config: nextConfig, savedToSupabase: Boolean(userId) };
      } catch {
        const fallback = saveSystemConfig(nextConfig);
        setConfig(fallback);
        setLoadSource("local");
        return { config: fallback, savedToSupabase: false };
      } finally {
        setIsSaving(false);
      }
    },
    [activeView, config, saveToSupabase, userId],
  );

  const setActiveView = useCallback(
    async (view: ConfigView) => {
      setActiveViewState(view);
      saveSystemConfigView(view);

      if (!userId) {
        return;
      }

      try {
        await saveToSupabase(config, view);
      } catch {
        // Keep local cache when network is unavailable.
      }
    },
    [config, saveToSupabase, userId],
  );

  return useMemo(
    () => ({
      config,
      activeView,
      isLoading,
      isSaving,
      loadSource,
      refresh,
      persistPatch,
      setActiveView,
    }),
    [activeView, config, isLoading, isSaving, loadSource, persistPatch, refresh, setActiveView],
  );
};
