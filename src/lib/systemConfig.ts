export type DeltaEValue = 1 | 2 | 3;
export type SamplePointsValue = 4 | 9 | 18;
export type SystemStep = "CONFIG" | "LIGHT" | "READY";
export type ConfigView = "home" | "analysis" | "capture" | "delta" | "ambient";
export type SystemConfigVersion = 2;

export interface SystemConfig {
  version: SystemConfigVersion;
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
  configurationSaved: boolean;
  lightCalibrated: boolean;
  updatedAt: string;
}

export interface SystemFlowState {
  systemStep: SystemStep;
  configuracaoConcluida: boolean;
  luzCalibrada: boolean;
  podeCalibrarLuz: boolean;
  podeIniciar: boolean;
}

export const SYSTEM_CONFIG_STORAGE_KEY = "fabric-analyzer-system-config";
export const SYSTEM_CONFIG_VIEW_STORAGE_KEY = "fabric-analyzer-system-config-view";

export const defaultSystemConfig: SystemConfig = {
  version: 2,
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
  configurationSaved: false,
  lightCalibrated: false,
  updatedAt: new Date().toISOString(),
};

const systemSteps: SystemStep[] = ["CONFIG", "LIGHT", "READY"];

export const normalizeSystemStep = (value: unknown): SystemStep => {
  return systemSteps.includes(value as SystemStep) ? (value as SystemStep) : "CONFIG";
};

export const areConfigurationFieldsComplete = (
  config: Partial<
    Pick<SystemConfig, "deltaConfigured" | "analysisAreaConfigured" | "colorConfigured">
  >,
): boolean => {
  return (
    config.deltaConfigured === true &&
    config.analysisAreaConfigured === true &&
    config.colorConfigured === true
  );
};

export const getSystemStep = (
  config: Partial<SystemConfig> | null | undefined,
): SystemStep => {
  if (!config || config.configurationSaved !== true || !areConfigurationFieldsComplete(config)) {
    return "CONFIG";
  }

  const requestedStep = normalizeSystemStep(config.systemStep);
  if (requestedStep === "CONFIG") {
    return "CONFIG";
  }

  if (requestedStep === "READY" && config.lightCalibrated === true) {
    return "READY";
  }

  return "LIGHT";
};

export const isConfigurationComplete = (config: SystemConfig): boolean => {
  return config.configurationSaved === true && areConfigurationFieldsComplete(config) && getSystemStep(config) !== "CONFIG";
};

export const isLightCalibrated = (config: SystemConfig): boolean => {
  return isConfigurationComplete(config) && config.lightCalibrated === true && getSystemStep(config) === "READY";
};

export const getSystemFlowState = (config: SystemConfig): SystemFlowState => {
  const systemStep = getSystemStep(config);
  const configuracaoConcluida = isConfigurationComplete(config);
  const luzCalibrada = isLightCalibrated(config);

  return {
    systemStep,
    configuracaoConcluida,
    luzCalibrada,
    podeCalibrarLuz: configuracaoConcluida,
    podeIniciar: luzCalibrada,
  };
};

export const getStartBlockedDescription = (config: SystemConfig): string => {
  const configured = isConfigurationComplete(config);
  const calibrated = isLightCalibrated(config);

  if (!calibrated && !configured) {
    return "Conclua as configurações e depois calibre a luz antes de iniciar.";
  }

  if (!calibrated) {
    return "Execute a calibração da luz antes de iniciar.";
  }

  return "Conclua as configurações antes de iniciar.";
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
  const isCurrentVersion = source.version === 2;
  const deltaConfigured = isCurrentVersion && source.deltaConfigured === true;
  const analysisAreaConfigured = isCurrentVersion && source.analysisAreaConfigured === true;
  const colorConfigured = isCurrentVersion && source.colorConfigured === true;
  const ambientLightConfigured = isCurrentVersion && source.ambientLightConfigured === true;
  const configurationSaved = isCurrentVersion && source.configurationSaved === true;
  const systemStep = getSystemStep({
    systemStep: source.systemStep,
    deltaConfigured,
    analysisAreaConfigured,
    colorConfigured,
    configurationSaved,
    lightCalibrated: source.lightCalibrated === true,
  });

  return {
    version: 2,
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
    ambientLightConfigured,
    deltaConfigured,
    analysisAreaConfigured,
    colorConfigured,
    configurationSaved,
    lightCalibrated: systemStep === "READY",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
  };
};

export const mergeSystemConfigPatch = (
  currentConfig: SystemConfig,
  value: Partial<SystemConfig>,
): SystemConfig => {
  const configurationSaved = Object.prototype.hasOwnProperty.call(value, "configurationSaved")
    ? value.configurationSaved === true
    : patchTouchesConfiguration(value)
    ? false
    : currentConfig.configurationSaved;
  const systemStep = value.systemStep
    ? normalizeSystemStep(value.systemStep)
    : patchTouchesConfiguration(value)
    ? "CONFIG"
    : currentConfig.systemStep;

  return sanitizeSystemConfig({
    ...currentConfig,
    ...value,
    configurationSaved,
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
