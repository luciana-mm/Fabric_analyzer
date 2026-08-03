"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/api-client";
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

type ConfigLoadSource = "backend" | "local";

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
  ambient_light_configured: boolean;          // NOVO
  ambient_light_reference_hex: string | null; // NOVO
  ambient_light_reference_r: number | null;   // NOVO
  ambient_light_reference_g: number | null;   // NOVO
  ambient_light_reference_b: number | null;   // NOVO
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
    ambientLightReferenceHex: row.ambient_light_reference_hex ?? localConfig.ambientLightReferenceHex,
    ambientLightReferenceRgb:
      row.ambient_light_reference_r != null &&
      row.ambient_light_reference_g != null &&
      row.ambient_light_reference_b != null
        ? {
            r: row.ambient_light_reference_r,
            g: row.ambient_light_reference_g,
            b: row.ambient_light_reference_b,
          }
        : localConfig.ambientLightReferenceRgb,
    ambientLightConfigured: row.ambient_light_configured ?? localConfig.ambientLightConfigured,
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

const systemConfigToPayload = (
  userId: string,
  config: SystemConfig,
  activeView: ConfigView,
) => ({
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
  ambient_light_configured: config.ambientLightConfigured,
  ambient_light_reference_hex: config.ambientLightReferenceHex ?? null,
  ambient_light_reference_r: config.ambientLightReferenceRgb?.r ?? null,
  ambient_light_reference_g: config.ambientLightReferenceRgb?.g ?? null,
  ambient_light_reference_b: config.ambientLightReferenceRgb?.b ?? null,
  system_step: config.systemStep,
  active_view: activeView,
});

export const useOperatorSystemConfig = (userId: string | null | undefined) => {
  const [config, setConfig] = useState<SystemConfig>(defaultSystemConfig);
  const [activeView, setActiveViewState] = useState<ConfigView>("home");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadSource, setLoadSource] = useState<ConfigLoadSource>("local");
  const [isRemoteConfigAvailable, setIsRemoteConfigAvailable] = useState(true);

  const saveToBackend = useCallback(
    async (nextConfig: SystemConfig, nextView: ConfigView): Promise<boolean> => {
      if (!userId || !isRemoteConfigAvailable) {
        return false;
      }

      await fetchJson<{ ok: boolean }>("/api/operator-config", {
        method: "POST",
        body: JSON.stringify(systemConfigToPayload(userId, nextConfig, nextView)),
      });

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
      const response = await fetchJson<{ data: OperatorConfigRow | null }>(
        `/api/operator-config?userId=${encodeURIComponent(userId)}`,
      );

      if (response.data) {
        const hydratedConfig = rowToSystemConfig(response.data, localConfig);
        const hydratedView = response.data.active_view ?? "home";
        setConfig(hydratedConfig);
        setActiveViewState(hydratedView);
        cacheSystemConfig(hydratedConfig, userId);
        saveSystemConfigView(hydratedView, userId);
        setLoadSource("backend");
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
        const savedRemotely = await saveToBackend(nextConfig, activeView);
        setConfig(nextConfig);
        cacheSystemConfig(nextConfig, userId);
        setLoadSource(savedRemotely ? "backend" : "local");
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
    [activeView, config, saveToBackend, userId],
  );

  const setActiveView = useCallback(
    async (view: ConfigView) => {
      setActiveViewState(view);
      saveSystemConfigView(view, userId);

      if (!userId) {
        return;
      }

      try {
        await saveToBackend(config, view);
      } catch {
        // Keep local cache when network is unavailable.
      }
    },
    [config, saveToBackend, userId],
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
