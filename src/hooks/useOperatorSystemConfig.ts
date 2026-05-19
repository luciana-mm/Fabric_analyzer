"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  cacheSystemConfig,
  defaultSystemConfig,
  loadSystemConfig,
  loadSystemConfigView,
  mergeSystemConfigPatch,
  sanitizeSystemConfig,
  saveSystemConfig,
  saveSystemConfigView,
  type ConfigView,
  type SystemConfig,
  type SystemStep,
} from "@/lib/systemConfig";

type ConfigLoadSource = "supabase" | "local";

type SupabaseErrorLike = {
  code?: string;
  status?: number;
  message?: string;
};

type OperatorConfigRow = {
  user_id: string;
  active_tissue_code: string;
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
  system_step: SystemStep;
  active_view: ConfigView;
  updated_at: string;
};

const rowToSystemConfig = (row: OperatorConfigRow, localConfig: SystemConfig): SystemConfig => {
  return sanitizeSystemConfig({
    systemStep: row.system_step ?? localConfig.systemStep,
    activeTissueCode: row.active_tissue_code ?? localConfig.activeTissueCode,
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
    ambientLightReferenceHex: localConfig.ambientLightReferenceHex,
    ambientLightReferenceRgb: localConfig.ambientLightReferenceRgb,
    ambientLightConfigured: localConfig.ambientLightConfigured,
    deltaConfigured: row.delta_configured,
    analysisAreaConfigured: row.analysis_area_configured,
    colorConfigured: row.color_configured,
    configurationSaved:
      localConfig.configurationSaved ||
      (row.system_step !== "CONFIG" &&
        row.delta_configured &&
        row.analysis_area_configured &&
        row.color_configured &&
        localConfig.ambientLightConfigured),
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
    active_tissue_code: config.activeTissueCode,
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
    system_step: config.systemStep,
    active_view: activeView,
  };
};

const isMissingOperatorConfigurationsError = (error: unknown): boolean => {
  const candidate = error as SupabaseErrorLike | null;
  if (!candidate) {
    return false;
  }

  if (candidate.status === 404) {
    return true;
  }

  if (candidate.code === "PGRST205" || candidate.code === "42P01") {
    return true;
  }

  if (candidate.code === "42703") {
    return true;
  }

  const message = candidate.message?.toLowerCase() ?? "";
  return (
    (message.includes("operator_configurations") && message.includes("not found")) ||
    message.includes("active_tissue_code")
  );
};

export const useOperatorSystemConfig = (userId: string | null | undefined) => {
  const [config, setConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [activeView, setActiveViewState] = useState<ConfigView>("home");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadSource, setLoadSource] = useState<ConfigLoadSource>("local");
  const [isRemoteConfigAvailable, setIsRemoteConfigAvailable] = useState(true);

  const saveToSupabase = useCallback(
    async (nextConfig: SystemConfig, nextView: ConfigView): Promise<boolean> => {
      if (!userId || !isRemoteConfigAvailable) {
        return false;
      }

      const payload = systemConfigToRow(userId, nextConfig, nextView);
      const { error } = await supabase
        .from("operator_configurations")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        if (isMissingOperatorConfigurationsError(error)) {
          setIsRemoteConfigAvailable(false);
          return false;
        }
        throw error;
      }

      return true;
    },
    [isRemoteConfigAvailable, userId],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);

    const localConfig = loadSystemConfig(userId);
    const localView = loadSystemConfigView(userId);

    if (!userId || !isRemoteConfigAvailable) {
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
          "user_id, active_tissue_code, delta_e, sample_points, sample_area_width_percent, sample_area_height_percent, reference_color_hex, reference_color_r, reference_color_g, reference_color_b, delta_configured, analysis_area_configured, color_configured, light_calibrated, system_step, active_view, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        if (isMissingOperatorConfigurationsError(error)) {
          setIsRemoteConfigAvailable(false);
          setConfig(localConfig);
          setActiveViewState(localView);
          setLoadSource("local");
          return;
        }
        throw error;
      }

      if (data) {
        const hydratedConfig = rowToSystemConfig(data as OperatorConfigRow, localConfig);
        const hydratedView = (data as OperatorConfigRow).active_view ?? "home";
        setConfig(hydratedConfig);
        setActiveViewState(hydratedView);
        cacheSystemConfig(hydratedConfig, userId);
        saveSystemConfigView(hydratedView, userId);
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
  }, [isRemoteConfigAvailable, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const persistPatch = useCallback(
    async (patch: Partial<SystemConfig>) => {
      const nextConfig = mergeSystemConfigPatch(config, patch);

      setIsSaving(true);

      try {
        const savedRemotely = await saveToSupabase(nextConfig, activeView);
        setConfig(nextConfig);
        cacheSystemConfig(nextConfig, userId);
        setLoadSource(savedRemotely ? "supabase" : "local");
        return { config: nextConfig, savedToSupabase: savedRemotely };
      } catch {
        const fallback = saveSystemConfig(nextConfig, userId);
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
      saveSystemConfigView(view, userId);

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
      isRemoteConfigAvailable,
      refresh,
      persistPatch,
      setActiveView,
    }),
    [
      activeView,
      config,
      isLoading,
      isSaving,
      loadSource,
      isRemoteConfigAvailable,
      persistPatch,
      refresh,
      setActiveView,
    ],
  );
};
