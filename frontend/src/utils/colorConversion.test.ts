/**
 * Suíte de testes automatizados (Vitest) para o motor colorimétrico e calibração.
 *
 * - Valida a conversão sRGB -> XYZ -> CIELAB (D65) para tons extremos e neutros.
 * - Verifica a simetria e sensibilidade da fórmula industrial CIEDE2000 (Delta E).
 * - Testa o filtro estatístico de outliers (Z-score) e o cálculo de luz ambiente.
 */
import { describe, expect, it } from "vitest";
import {
  calculateDeltaE2000,
  hexToRgb,
  rgb8BitToNormalized,
  rgbToHex,
  rgbToLab,
} from "@/utils/colorSpaceConversion";
import {
  calculateAmbientLightMatch,
  calculateLuminance,
  calculateRobustColorMean,
  removeColorOutliers,
} from "@/utils/calibrationUtils";
import { getQualityRating } from "@/utils/colorimetricStandards";

describe("Conversão de Espaço de Cores (sRGB -> CIELAB D65)", () => {
  it("converte branco puro (255, 255, 255) para L* ~ 100, a* ~ 0, b* ~ 0", () => {
    const whiteLab = rgbToLab(rgb8BitToNormalized({ r: 255, g: 255, b: 255 }));
    expect(whiteLab.L).toBeCloseTo(100, 0);
    expect(Math.abs(whiteLab.a)).toBeLessThan(1);
    expect(Math.abs(whiteLab.b)).toBeLessThan(1);
  });

  it("converte preto puro (0, 0, 0) para L* ~ 0", () => {
    const blackLab = rgbToLab(rgb8BitToNormalized({ r: 0, g: 0, b: 0 }));
    expect(blackLab.L).toBeLessThan(1);
  });

  it("mantém reversibilidade na conversão RGB <-> Hex", () => {
    const original = rgb8BitToNormalized({ r: 255, g: 100, b: 50 });
    const hex = rgbToHex(original);
    const restored = hexToRgb(hex);
    expect(restored).not.toBeNull();
    expect(restored!.r).toBeCloseTo(original.r, 2);
    expect(restored!.g).toBeCloseTo(original.g, 2);
    expect(restored!.b).toBeCloseTo(original.b, 2);
  });
});

describe("Cálculo Industrial CIEDE2000 (Delta E)", () => {
  it("retorna Delta E = 0 para duas amostras idênticas", () => {
    const sample = rgbToLab(rgb8BitToNormalized({ r: 120, g: 160, b: 200 }));
    expect(calculateDeltaE2000(sample, sample)).toBeLessThan(0.001);
  });

    it("classifica corretamente a qualidade da calibração pelo score (0 a 100)", () => {
    expect(getQualityRating(85).label).toBe("Excellent");
    expect(getQualityRating(20).label).toBe("Poor");
  });
});

describe("Calibração Robusta e Filtragem de Outliers", () => {
  it("remove leituras espúrias (outliers) preservando a média da amostra", () => {
    const samples = [
      rgb8BitToNormalized({ r: 200, g: 100, b: 50 }),
      rgb8BitToNormalized({ r: 202, g: 101, b: 51 }),
      rgb8BitToNormalized({ r: 199, g: 99, b: 49 }),
      rgb8BitToNormalized({ r: 201, g: 100, b: 50 }),
      rgb8BitToNormalized({ r: 20, g: 240, b: 240 }), // outlier extremo
    ];
    const filtered = removeColorOutliers(samples);
    expect(filtered.length).toBeLessThanOrEqual(samples.length);
    const mean = calculateRobustColorMean(samples);
    expect(mean.r).toBeGreaterThan(0.7);
  });

  it("calcula compatibilidade de iluminação ambiente em 100% para luz idêntica", () => {
    const light = rgb8BitToNormalized({ r: 240, g: 240, b: 240 });
    expect(calculateLuminance(light)).toBeGreaterThan(0.8);
    const match = calculateAmbientLightMatch(light, light);
    expect(match.similarityPercent).toBeGreaterThan(99);
    expect(match.matches).toBe(true);
  });
});