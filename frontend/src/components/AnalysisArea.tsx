import { useEffect, useState } from "react";
import { ArrowLeft, Check, Scan, Sparkles } from "lucide-react";
import { CameraPreview } from "./CameraPreview";
import type { SamplePointsValue } from "@/lib/systemConfig";

interface AnalysisAreaProps {
  onBack: () => void;
  onSave: (value: {
    samplePoints: SamplePointsValue;
    sampleAreaWidthPercent: number;
    sampleAreaHeightPercent: number;
    estampado: boolean;
  }) => Promise<void> | void;
  initialWidth: number;
  initialHeight: number;
  initialPoints: SamplePointsValue;
  initialEstampado: boolean;
}

export const AnalysisArea = ({
  onBack,
  onSave,
  initialWidth,
  initialHeight,
  initialPoints,
  initialEstampado,
}: AnalysisAreaProps) => {
  const [heightRangeValue, setHeightRangeValue] = useState(initialHeight);
  const [widthRangeValue, setWidthRangeValue] = useState(initialWidth);
  const [selectedPoints, setSelectedPoints] = useState<SamplePointsValue>(initialPoints);
  const [isEstampado, setIsEstampado] = useState(initialEstampado);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setWidthRangeValue(initialWidth);
    setHeightRangeValue(initialHeight);
    setSelectedPoints(initialPoints);
    setIsEstampado(initialEstampado);
  }, [initialWidth, initialHeight, initialPoints, initialEstampado]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </button>
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">
          Área de análise e detector
        </h2>
        <p className="text-xs text-stone-500">
          Posicione a região de leitura sobre o tecido.
        </p>
      </div>

      {/* Layout 2 Colunas: Câmera à esquerda + Controles à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
          <CameraPreview
            className="relative w-full aspect-video bg-stone-900"
            imageClassName="w-full h-full object-contain"
            fallbackMessage="Preview indisponível para a área de análise."
            streamPath={`/stream-analyzed.mjpg?w=${widthRangeValue}&h=${heightRangeValue}&apenas_area=true&estampado=${isEstampado}`}
            overlay={
              <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AO VIVO
              </div>
            }
          />
        </div>

        <div className="lg:col-span-5 rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-5">
          {/* Largura */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-stone-700">Largura</span>
              <span className="font-mono-tech font-semibold text-stone-900">{widthRangeValue}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={widthRangeValue}
              onChange={(e) => setWidthRangeValue(Number(e.target.value))}
              className="w-full h-2 rounded-lg accent-stone-900 cursor-pointer bg-stone-200"
            />
          </div>

          {/* Altura */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-stone-700">Altura</span>
              <span className="font-mono-tech font-semibold text-stone-900">{heightRangeValue}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={heightRangeValue}
              onChange={(e) => setHeightRangeValue(Number(e.target.value))}
              className="w-full h-2 rounded-lg accent-stone-900 cursor-pointer bg-stone-200"
            />
          </div>

          {/* Pontos de leitura */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-700">Pontos de leitura</p>
            <div className="grid grid-cols-3 gap-2">
              {([4, 9, 18] as SamplePointsValue[]).map((pts) => {
                const active = selectedPoints === pts;
                return (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setSelectedPoints(pts)}
                    className={`h-9 rounded-lg border font-mono-tech text-xs font-semibold transition-colors ${
                      active
                        ? "bg-stone-900 border-stone-900 text-white"
                        : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {pts}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-700">Detector</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsEstampado(false)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-all ${
                  !isEstampado
                    ? "bg-orange-50/70 border-[#B85D3B] ring-1 ring-[#B85D3B]/30"
                    : "bg-white border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Scan className="w-4 h-4 text-[#B85D3B] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-stone-900">Tecido Liso</p>
                    <p className="text-[11px] text-stone-500">OpenCV · comparação de cor por ΔE</p>
                  </div>
                </div>
                {!isEstampado && <Check className="w-4 h-4 text-[#B85D3B] shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => setIsEstampado(true)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg border text-left transition-all ${
                  isEstampado
                    ? "bg-orange-50/70 border-[#B85D3B] ring-1 ring-[#B85D3B]/30"
                    : "bg-white border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-stone-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-stone-900">Tecido Estampado</p>
                    <p className="text-[11px] text-stone-500">IA Anomalib · detecção de anomalias</p>
                  </div>
                </div>
                {isEstampado && <Check className="w-4 h-4 text-[#B85D3B] shrink-0" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSave({
                  samplePoints: selectedPoints,
                  sampleAreaWidthPercent: widthRangeValue,
                  sampleAreaHeightPercent: heightRangeValue,
                  estampado: isEstampado,
                });
                onBack();
              } finally {
                setIsSaving(false);
              }
            }}
            className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? "Salvando..." : "Confirmar área"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
