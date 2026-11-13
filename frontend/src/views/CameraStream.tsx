"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { CameraPreview } from "@/components/CameraPreview";
import { OperatorShell } from "@/components/OperatorShell";

const CameraStream = () => {
  const router = useRouter();

  return (
    <OperatorShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.push("/painel")}
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                Câmera ao vivo
              </h1>
              <p className="text-sm text-stone-500">
                Stream direto da câmera da bancada (porta 8090 · somente leitura).
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Conectada
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-950 shadow-sm">
          <CameraPreview
            className="min-h-[58vh] w-full max-h-[76vh]"
            imageClassName="max-h-[76vh] w-full bg-stone-950 object-contain"
            fallbackMessage="O servidor local da câmera (camera-proxy :8090) não respondeu."
          />
        </div>
      </div>
    </OperatorShell>
  );
};

export default CameraStream;
