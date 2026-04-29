"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CameraPreviewStatus = "connecting" | "online" | "offline" | "error";

const CAMERA_PROXY_URL = process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ?? "http://127.0.0.1:8090";

const getRetryDelayMs = (failures: number) => {
  const cappedFailures = Math.min(failures, 4);
  return 2000 * Math.pow(2, cappedFailures);
};

export const useCameraPreview = () => {
  const [streamKey, setStreamKey] = useState(0);
  const [status, setStatus] = useState<CameraPreviewStatus>("connecting");
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const failuresRef = useRef(0);

  const runHealthCheck = useCallback(async () => {
    try {
      const response = await fetch(`${CAMERA_PROXY_URL}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Proxy respondeu com status ${response.status}`);
      }

      if (!mountedRef.current) {
        return;
      }

      failuresRef.current = 0;
      setStatus("online");
      setErrorMessage(null);
      setCheckedOnce(true);
    } catch {
      if (!mountedRef.current) {
        return;
      }

      failuresRef.current += 1;
      setStatus("offline");
      setErrorMessage(`Nao foi possivel acessar ${CAMERA_PROXY_URL}`);
      setCheckedOnce(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const schedule = async () => {
      await runHealthCheck();

      if (!mountedRef.current) {
        return;
      }

      const delay = status === "online" ? 5000 : getRetryDelayMs(failuresRef.current);
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
    setStatus("error");
    setErrorMessage(`Falha ao carregar o stream em ${CAMERA_PROXY_URL}`);
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
    return `${CAMERA_PROXY_URL}/stream.mjpg?t=${streamKey}`;
  }, [streamKey]);

  return {
    status,
    checkedOnce,
    errorMessage,
    streamUrl,
    markStreamError,
    retry,
  };
};
