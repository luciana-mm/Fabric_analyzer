import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCameraPreview } from "@/hooks/useCameraPreview";

interface CameraPreviewProps {
  className?: string;
  imageClassName?: string;
  offlineClassName?: string;
  fallbackMessage?: string;
  showRetryButton?: boolean;
  overlay?: React.ReactNode;
}

export const CameraPreview = ({
  className,
  imageClassName,
  offlineClassName,
  fallbackMessage,
  showRetryButton = true,
  overlay,
}: CameraPreviewProps) => {
  const { checkedOnce, status, streamUrl, errorMessage, markStreamError, retry } = useCameraPreview();
  const isOnline = status === "online" || status === "connecting";

  return (
    <div className={className ?? "relative w-full h-full overflow-hidden rounded-xl border border-border/30 bg-black"}>
      {isOnline ? (
          <img
            src={streamUrl}
            alt="Video ao vivo da camera"
            className={imageClassName ?? "w-full h-full object-cover bg-black"}
            onError={markStreamError}
          />
      ) : (
        <div className={offlineClassName ?? "w-full h-full flex items-center justify-center p-6 bg-black/70"}>
          <div className="w-full max-w-lg rounded-2xl border border-border/30 bg-card/70 p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h2 className="font-sansserief text-sm tracking-[0.18em] uppercase text-foreground">
                Camera offline
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {fallbackMessage ?? errorMessage ?? "O servidor local da camera nao respondeu."}
              </p>
              {!checkedOnce && <p className="text-xs text-muted-foreground/80">Conectando...</p>}
            </div>
            {showRetryButton && (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-background font-sansserief text-[10px] tracking-[0.25em] uppercase"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {overlay}
    </div>
  );
};
