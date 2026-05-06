export type DeltaEValue = 1 | 2 | 3;
export type SamplePointsValue = 4 | 9 | 18;
export type SystemStep = "CONFIG" | "LIGHT" | "READY";
export type ConfigView = "home" | "analysis" | "capture" | "delta" | "ambient";

export interface SystemConfig {
  version: 1;
  systemStep: SystemStep;
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
  ambientLightReferenceHex: string;
  ambientLightReferenceRgb: {
    r: number;
    g: number;
    b: number;
  };
  ambientLightConfigured: boolean;
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
  systemStep: "CONFIG",
  deltaE: 3,
  samplePoints: 9,
  sampleAreaWidthPercent: 60,
  sampleAreaHeightPercent: 50,
  referenceColorHex: "#ffffff",
  referenceColorRgb: { r: 255, g: 255, b: 255 },
  ambientLightReferenceHex: "#000000",
  ambientLightReferenceRgb: { r: 0, g: 0, b: 0 },
  ambientLightConfigured: false,
  deltaConfigured: false,
  analysisAreaConfigured: false,
  colorConfigured: false,
  lightCalibrated: false,
  updatedAt: new Date().toISOString(),
};

const systemSteps: SystemStep[] = ["CONFIG", "LIGHT", "READY"];

export const normalizeSystemStep = (value: unknown): SystemStep => {
  return systemSteps.includes(value as SystemStep) ? (value as SystemStep) : "CONFIG";
};

export const getSystemStep = (
  config: Pick<SystemConfig, "systemStep"> | Partial<SystemConfig> | null | undefined,
): SystemStep => {
  return normalizeSystemStep(config?.systemStep);
};

export const areConfigurationFieldsComplete = (config: SystemConfig): boolean => {
  return (
    config.deltaConfigured &&
    config.analysisAreaConfigured &&
    config.colorConfigured &&
    config.ambientLightConfigured
  );
};

export const isConfigurationComplete = (config: SystemConfig): boolean => {
  return getSystemStep(config) !== "CONFIG";
};

export const isLightCalibrated = (config: SystemConfig): boolean => {
  return getSystemStep(config) === "READY";
};

const configurationPatchKeys: Array<keyof SystemConfig> = [
  "deltaE",
  "samplePoints",
  "sampleAreaWidthPercent",
  "sampleAreaHeightPercent",
  "referenceColorHex",
  "referenceColorRgb",
  "ambientLightReferenceHex",
  "ambientLightReferenceRgb",
  "ambientLightConfigured",
  "deltaConfigured",
  "analysisAreaConfigured",
  "colorConfigured",
];

const patchTouchesConfiguration = (value: Partial<SystemConfig>): boolean => {
  return configurationPatchKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
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
  const systemStep = normalizeSystemStep(source.systemStep);

  return {
    version: 1,
    systemStep,
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
    ambientLightReferenceHex:
      typeof source.ambientLightReferenceHex === "string" && /^#[0-9a-fA-F]{6}$/.test(source.ambientLightReferenceHex)
        ? source.ambientLightReferenceHex
        : defaultSystemConfig.ambientLightReferenceHex,
    ambientLightReferenceRgb: {
      r: normalizeNumber(source.ambientLightReferenceRgb?.r, defaultSystemConfig.ambientLightReferenceRgb.r, 0, 255),
      g: normalizeNumber(source.ambientLightReferenceRgb?.g, defaultSystemConfig.ambientLightReferenceRgb.g, 0, 255),
      b: normalizeNumber(source.ambientLightReferenceRgb?.b, defaultSystemConfig.ambientLightReferenceRgb.b, 0, 255),
    },
    ambientLightConfigured: Boolean(source.ambientLightConfigured),
    deltaConfigured: Boolean(source.deltaConfigured),
    analysisAreaConfigured: Boolean(source.analysisAreaConfigured),
    colorConfigured: Boolean(source.colorConfigured),
    lightCalibrated: systemStep === "READY",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
  };
};

export const mergeSystemConfigPatch = (
  currentConfig: SystemConfig,
  value: Partial<SystemConfig>,
): SystemConfig => {
  const systemStep = value.systemStep
    ? normalizeSystemStep(value.systemStep)
    : patchTouchesConfiguration(value)
    ? "CONFIG"
    : currentConfig.systemStep;

  return sanitizeSystemConfig({
    ...currentConfig,
    ...value,
    systemStep,
    updatedAt: new Date().toISOString(),
  });
};

const getScopedStorageKey = (baseKey: string, scopeKey?: string | null): string => {
  return scopeKey ? `${baseKey}:${scopeKey}` : baseKey;
};

export const getSystemConfigStorageKey = (scopeKey?: string | null): string => {
  return getScopedStorageKey(SYSTEM_CONFIG_STORAGE_KEY, scopeKey);
};

export const getSystemConfigViewStorageKey = (scopeKey?: string | null): string => {
  return getScopedStorageKey(SYSTEM_CONFIG_VIEW_STORAGE_KEY, scopeKey);
};

export const loadSystemConfig = (scopeKey?: string | null): SystemConfig => {
  if (typeof window === "undefined") {
    return defaultSystemConfig;
  }

  const raw = window.localStorage.getItem(getSystemConfigStorageKey(scopeKey));
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

export const saveSystemConfig = (value: Partial<SystemConfig>, scopeKey?: string | null): SystemConfig => {
  const currentConfig = loadSystemConfig(scopeKey);
  const nextConfig = mergeSystemConfigPatch(currentConfig, value);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(getSystemConfigStorageKey(scopeKey), JSON.stringify(nextConfig));
  }

  return nextConfig;
};

export const cacheSystemConfig = (config: SystemConfig, scopeKey?: string | null): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getSystemConfigStorageKey(scopeKey), JSON.stringify(sanitizeSystemConfig(config)));
};

export const loadSystemConfigView = (scopeKey?: string | null): ConfigView => {
  if (typeof window === "undefined") {
    return "home";
  }

  const value = window.localStorage.getItem(getSystemConfigViewStorageKey(scopeKey));
  if (
    value === "home" ||
    value === "analysis" ||
    value === "capture" ||
    value === "delta" ||
    value === "ambient"
  ) {
    return value;
  }

  return "home";
};

export const saveSystemConfigView = (view: ConfigView, scopeKey?: string | null): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getSystemConfigViewStorageKey(scopeKey), view);
};
