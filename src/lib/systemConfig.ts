export type DeltaEValue = 1 | 2 | 3;
export type SamplePointsValue = 4 | 9 | 18;
export type ConfigView = "home" | "analysis" | "capture" | "delta";

export interface SystemConfig {
  version: 1;
  deltaE: DeltaEValue;
  samplePoints: SamplePointsValue;
  sampleAreaWidthPercent: number;
  sampleAreaHeightPercent: number;
  referenceColorHex: string;
  referenceColorRgb: {
    r: number;
    g: number;
    b: number;
  };
  deltaConfigured: boolean;
  analysisAreaConfigured: boolean;
  colorConfigured: boolean;
  lightCalibrated: boolean;
  updatedAt: string;
}

export const SYSTEM_CONFIG_STORAGE_KEY = "fabric-analyzer-system-config";
export const SYSTEM_CONFIG_VIEW_STORAGE_KEY = "fabric-analyzer-system-config-view";

export const defaultSystemConfig: SystemConfig = {
  version: 1,
  deltaE: 3,
  samplePoints: 9,
  sampleAreaWidthPercent: 60,
  sampleAreaHeightPercent: 50,
  referenceColorHex: "#ffffff",
  referenceColorRgb: { r: 255, g: 255, b: 255 },
  deltaConfigured: false,
  analysisAreaConfigured: false,
  colorConfigured: false,
  lightCalibrated: false,
  updatedAt: new Date().toISOString(),
};

export const isConfigurationComplete = (config: SystemConfig): boolean => {
  return config.deltaConfigured && config.analysisAreaConfigured && config.colorConfigured;
};

export const isLightCalibrated = (config: SystemConfig): boolean => {
  return config.lightCalibrated && config.colorConfigured;
};

const normalizeNumber = (value: unknown, fallback: number, min = 0, max = 100): number => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
};

const normalizeDeltaE = (value: unknown): DeltaEValue => {
  if (value === 1 || value === 2 || value === 3) return value;
  return defaultSystemConfig.deltaE;
};

const normalizeSamplePoints = (value: unknown): SamplePointsValue => {
  if (value === 4 || value === 9 || value === 18) return value;
  return defaultSystemConfig.samplePoints;
};

export const sanitizeSystemConfig = (value: Partial<SystemConfig> | null | undefined): SystemConfig => {
  const source = value ?? {};

  return {
    version: 1,
    deltaE: normalizeDeltaE(source.deltaE),
    samplePoints: normalizeSamplePoints(source.samplePoints),
    sampleAreaWidthPercent: normalizeNumber(source.sampleAreaWidthPercent, defaultSystemConfig.sampleAreaWidthPercent),
    sampleAreaHeightPercent: normalizeNumber(source.sampleAreaHeightPercent, defaultSystemConfig.sampleAreaHeightPercent),
    referenceColorHex:
      typeof source.referenceColorHex === "string" && /^#[0-9a-fA-F]{6}$/.test(source.referenceColorHex)
        ? source.referenceColorHex
        : defaultSystemConfig.referenceColorHex,
    referenceColorRgb: {
      r: normalizeNumber(source.referenceColorRgb?.r, defaultSystemConfig.referenceColorRgb.r, 0, 255),
      g: normalizeNumber(source.referenceColorRgb?.g, defaultSystemConfig.referenceColorRgb.g, 0, 255),
      b: normalizeNumber(source.referenceColorRgb?.b, defaultSystemConfig.referenceColorRgb.b, 0, 255),
    },
    deltaConfigured: Boolean(source.deltaConfigured),
    analysisAreaConfigured: Boolean(source.analysisAreaConfigured),
    colorConfigured: Boolean(source.colorConfigured),
    lightCalibrated: Boolean(source.lightCalibrated),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
  };
};

export const loadSystemConfig = (): SystemConfig => {
  if (typeof window === "undefined") {
    return defaultSystemConfig;
  }

  const raw = window.localStorage.getItem(SYSTEM_CONFIG_STORAGE_KEY);
  if (!raw) {
    return defaultSystemConfig;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SystemConfig>;
    return sanitizeSystemConfig(parsed);
  } catch {
    return defaultSystemConfig;
  }
};

export const saveSystemConfig = (value: Partial<SystemConfig>): SystemConfig => {
  const nextConfig = sanitizeSystemConfig({
    ...loadSystemConfig(),
    ...value,
    updatedAt: new Date().toISOString(),
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SYSTEM_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
  }

  return nextConfig;
};

export const cacheSystemConfig = (config: SystemConfig): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SYSTEM_CONFIG_STORAGE_KEY, JSON.stringify(sanitizeSystemConfig(config)));
};

export const loadSystemConfigView = (): ConfigView => {
  if (typeof window === "undefined") {
    return "home";
  }

  const value = window.localStorage.getItem(SYSTEM_CONFIG_VIEW_STORAGE_KEY);
  if (value === "home" || value === "analysis" || value === "capture" || value === "delta") {
    return value;
  }

  return "home";
};

export const saveSystemConfigView = (view: ConfigView): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SYSTEM_CONFIG_VIEW_STORAGE_KEY, view);
};
