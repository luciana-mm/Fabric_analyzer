/**
 * useCameraRobustCapture Hook
 * Handles robust color capture with multiple samples
 */

import { useState, useCallback } from "react";
import { RgbColor8Bit } from "@/utils/colorSpaceConversion";

export interface CameraRobustCaptureState {
  isCapturing: boolean;
  error: string | null;
  lastCapture: {
    rgb: RgbColor8Bit;
    hex: string;
    samplesUsed: number;
    samplesTotal: number;
    averageLuminance: number;
    stabilityScore: number;
    rawSamples: RgbColor8Bit[];   // <-- NOVO
  } | null;
}

export interface UseCameraRobustCaptureReturn extends CameraRobustCaptureState {
  captureRobustSample: (
    sampleCount?: number,
    intervalMs?: number,
    options?: {
      areaWidthPercent?: number;
      areaHeightPercent?: number;
      samplePoints?: 4 | 9 | 18;
      includeSamples?: boolean;
      pixelPuro?: boolean;
    },
  ) => Promise<{ rgb: RgbColor8Bit; rawSamples: RgbColor8Bit[] } | null>;
}

const CAMERA_PROXY_URL =
  process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://localhost:8090";

export function useCameraRobustCapture(): UseCameraRobustCaptureReturn {
  const [state, setState] = useState<CameraRobustCaptureState>({
    isCapturing: false,
    error: null,
    lastCapture: null,
  });

  /**
   * Capture a robust color sample using multiple acquisitions
   * This method handles the communication with the camera proxy
   */
  const captureRobustSample = useCallback(
    async (
      sampleCount: number = 5,
      intervalMs: number = 200,
      options?: {
        areaWidthPercent?: number;
        areaHeightPercent?: number;
        samplePoints?: 4 | 9 | 18;
        includeSamples?: boolean;
        pixelPuro?: boolean;
      },
    ): Promise<{ rgb: RgbColor8Bit; rawSamples: RgbColor8Bit[] } | null> => {
      setState((prev) => ({
        ...prev,
        isCapturing: true,
        error: null,
      }));

      try {
        const query = new URLSearchParams({
          sample_count: String(sampleCount),
          interval_ms: String(intervalMs),
        });

        if (options?.areaWidthPercent !== undefined) {
          query.set("area_width_percent", String(options.areaWidthPercent));
        }
        if (options?.areaHeightPercent !== undefined) {
          query.set("area_height_percent", String(options.areaHeightPercent));
        }
        if (options?.samplePoints !== undefined) {
          query.set("sample_points", String(options.samplePoints));
        }
        if (options?.includeSamples) {
          query.set("include_samples", "true");
        }
        if (options?.pixelPuro) {
          query.set("pixel_puro", "true");
        }
        const response = await fetch(
          `${CAMERA_PROXY_URL}/capture-robust-sample?${query.toString()}`,
          { method: "POST", headers: { "Content-Type": "application/json" } },
        );


        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail ||
            `Camera error: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();
        if (!data.success || !data.rgb) {
          throw new Error("Invalid response from camera proxy");
        }

        const rawSamples = Array.isArray(data.samples)
          ? data.samples.map(
              (sample: { r: number; g: number; b: number }): RgbColor8Bit => ({
                r: sample.r,
                g: sample.g,
                b: sample.b,
              }),
            )
          : [];

        const capture = {
          rgb: { r: data.rgb.r, g: data.rgb.g, b: data.rgb.b } as RgbColor8Bit,
          hex: data.hex,
          samplesUsed: data.samples_used,
          samplesTotal: data.samples_total,
          averageLuminance: data.average_luminance,
          stabilityScore: data.stability_score,
          rawSamples,
        };

        setState((prev) => ({ ...prev, isCapturing: false, lastCapture: capture }));

        return { rgb: capture.rgb, rawSamples: capture.rawSamples };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";

        setState((prev) => ({
          ...prev,
          isCapturing: false,
          error: errorMessage,
        }));

        return null;
      }
    },
    [],
  );

  return {
    ...state,
    captureRobustSample,
  };
}
