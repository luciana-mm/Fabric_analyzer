"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCameraProxyUrl } from "@/lib/camera-proxy";

export type CameraPreviewStatus = "connecting" | "online" | "offline" | "error";

const getRetryDelayMs = (failures: number) => {
  const cappedFailures = Math.min(failures, 4);
  return 2000 * Math.pow(2, cappedFailures);
};

export const useCameraPreview = (
  streamPath: string = "/stream.mjpg",
  params: Record<string, string | number> = {}
) => {
  const [streamKey, setStreamKey] = useState(0);
  const [status, setStatus] = useState<CameraPreviewStatus>("connecting");
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeCameraName, setActiveCameraName] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const failuresRef = useRef(0);
  const lastCameraIdRef = useRef<string | null>(null);

  const runHealthCheck = useCallback(async () => {
    const proxyUrl = getCameraProxyUrl();
    try {
      const response = await fetch(`${proxyUrl}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Proxy respondeu com status ${response.status}`);
      }

      const data = await response.json().catch(() => null);
      if (!mountedRef.current) return;

      const newCamId = data?.active_camera?.cameraId || null;
      const newCamName = data?.active_camera?.cameraName || null;
      if (newCamName) {
        setActiveCameraName(newCamName);
      }

      // Se o Gestor trocou a câmera atribuída ao Operário em tempo real,
      // renova o streamKey automaticamente sem que o operário precise dar F5 ou relogar
      if (
        newCamId &&
        lastCameraIdRef.current !== null &&
        lastCameraIdRef.current !== newCamId
      ) {
        lastCameraIdRef.current = newCamId;
        setStreamKey((value) => value + 1);
      } else if (newCamId && lastCameraIdRef.current === null) {
        lastCameraIdRef.current = newCamId;
      }

      failuresRef.current = 0;
      setStatus("online");
      setErrorMessage(null);
      setCheckedOnce(true);
    } catch {
      if (!mountedRef.current) return;

      failuresRef.current += 1;
      setStatus("offline");
      setErrorMessage(`Não foi possível acessar o servidor de câmera (${proxyUrl})`);
      setCheckedOnce(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const schedule = async () => {
      await runHealthCheck();
      if (!mountedRef.current) return;

      const delay = status === "online" ? 3000 : getRetryDelayMs(failuresRef.current);
      timerRef.current = window.setTimeout(() => {
        void schedule();
      }, delay);
    };

    void schedule();

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [runHealthCheck, status]);

  const markStreamError = useCallback(() => {
    const proxyUrl = getCameraProxyUrl();
    setStatus("error");
    setErrorMessage(`Falha ao carregar o stream em ${proxyUrl}`);
  }, []);

  const retry = useCallback(() => {
    failuresRef.current = 0;
    setCheckedOnce(false);
    setStatus("connecting");
    setErrorMessage(null);
    setStreamKey((value) => value + 1);
    void runHealthCheck();
  }, [runHealthCheck]);

  const streamUrl = useMemo(() => {
    const proxyUrl = getCameraProxyUrl();
    const url = new URL(
      streamPath.startsWith("/") ? streamPath : `/${streamPath}`,
      `${proxyUrl}/`
    );
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    url.searchParams.set("t", String(streamKey));
    return url.toString();
  }, [streamKey, streamPath, params]);

  return {
    status,
    checkedOnce,
    errorMessage,
    streamUrl,
    activeCameraName,
    markStreamError,
    retry,
  };
};
