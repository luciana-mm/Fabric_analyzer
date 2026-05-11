import { describe, expect, it } from "vitest";
import {
  defaultSystemConfig,
  getSystemFlowState,
  mergeSystemConfigPatch,
  sanitizeSystemConfig,
} from "./systemConfig";

describe("systemConfig flow", () => {
  it("starts with configuration pending and blocks light/start", () => {
    expect(getSystemFlowState(defaultSystemConfig)).toEqual({
      systemStep: "CONFIG",
      configuracaoConcluida: false,
      luzCalibrada: false,
      podeCalibrarLuz: false,
      podeIniciar: false,
    });
  });

  it("does not trust a saved step without required saved fields", () => {
    const config = sanitizeSystemConfig({
      ...defaultSystemConfig,
      systemStep: "READY",
      lightCalibrated: true,
    });

    expect(getSystemFlowState(config)).toEqual({
      systemStep: "CONFIG",
      configuracaoConcluida: false,
      luzCalibrada: false,
      podeCalibrarLuz: false,
      podeIniciar: false,
    });
  });

  it("does not trust legacy saved flags from older flow versions", () => {
    const legacyConfig = sanitizeSystemConfig({
      version: 1 as never,
      systemStep: "LIGHT",
      analysisAreaConfigured: true,
      colorConfigured: true,
      deltaConfigured: true,
      configurationSaved: true,
      lightCalibrated: true,
    });

    expect(getSystemFlowState(legacyConfig)).toEqual({
      systemStep: "CONFIG",
      configuracaoConcluida: false,
      luzCalibrada: false,
      podeCalibrarLuz: false,
      podeIniciar: false,
    });
  });

  it("requires the final configuration save before releasing light calibration", () => {
    const withSavedSubsteps = sanitizeSystemConfig({
      ...defaultSystemConfig,
      analysisAreaConfigured: true,
      colorConfigured: true,
      deltaConfigured: true,
      systemStep: "LIGHT",
    });

    expect(getSystemFlowState(withSavedSubsteps).configuracaoConcluida).toBe(false);

    const afterFinalSave = mergeSystemConfigPatch(withSavedSubsteps, {
      systemStep: "CONFIG",
      configurationSaved: true,
    });

    const afterPromotingStep = mergeSystemConfigPatch(afterFinalSave, {
      systemStep: "LIGHT",
      lightCalibrated: false,
    });

    expect(getSystemFlowState(afterPromotingStep)).toMatchObject({
      systemStep: "LIGHT",
      configuracaoConcluida: true,
      luzCalibrada: false,
      podeCalibrarLuz: true,
      podeIniciar: false,
    });
  });

  it("only releases start after successful light calibration", () => {
    const configured = sanitizeSystemConfig({
      ...defaultSystemConfig,
      analysisAreaConfigured: true,
      colorConfigured: true,
      deltaConfigured: true,
      configurationSaved: true,
      systemStep: "LIGHT",
    });
    const calibrated = mergeSystemConfigPatch(configured, {
      lightCalibrated: true,
      systemStep: "READY",
    });

    expect(getSystemFlowState(calibrated)).toEqual({
      systemStep: "READY",
      configuracaoConcluida: true,
      luzCalibrada: true,
      podeCalibrarLuz: true,
      podeIniciar: true,
    });
  });
});
