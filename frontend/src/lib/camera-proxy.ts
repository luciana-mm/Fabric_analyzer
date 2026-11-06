/**
 * Resolve dinamicamente a URL do servidor Python de visão computacional (porta 8090).
 *
 * - No servidor (rotas de API Next.js dentro do Docker): prioriza `BACKEND_API_URL` (`http://backend:8090`).
 * - No navegador (Cliente / Operário / Gestor em outro PC na mesma rede LAN):
 *   se `NEXT_PUBLIC_CAMERA_PROXY_URL` estiver apontando para `localhost` ou `127.0.0.1`,
 *   substitui automaticamente pelo `window.location.hostname` (IP real do servidor na rede),
 *   garantindo que qualquer computador ou tablet na rede consiga ver a câmera sem erro.
 */
export function getCameraProxyUrl(): string {
  // Execução Server-Side (SSR / API Routes dentro do container Docker)
  if (typeof window === "undefined") {
    return (
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_CAMERA_PROXY_URL ||
      "http://127.0.0.1:8090"
    );
  }

  const configured =
    process.env.NEXT_PUBLIC_CAMERA_PROXY_URL || "http://127.0.0.1:8090";

  try {
    const parsed = new URL(configured);
    const browserHost = window.location.hostname;
    if (
      browserHost &&
      browserHost !== "localhost" &&
      browserHost !== "127.0.0.1" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      parsed.hostname = browserHost;
      return parsed.origin;
    }
    return parsed.origin;
  } catch {
    const host = window.location.hostname || "127.0.0.1";
    return `http://${host}:8090`;
  }
}
