import { useEffect, useState } from "react";
import { Grip, Save, Eye, Info, ArrowLeft } from "lucide-react";
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

export const AnalysisArea = ({ onBack, onSave, initialWidth, initialHeight, initialPoints, initialEstampado }: AnalysisAreaProps) => {
  const [isVisible, setIsVisible] = useState(true);
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

  // Simple local Switch component to avoid external dependency import
  const Switch = ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (v: boolean) => void }) => (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`w-12 h-7 rounded-full p-1 transition-all duration-300 border ${
        checked
          ? "bg-amber-500/30 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
          : "bg-slate-800 border-white/10"
      }`}
    >
      <span
        className={`block w-4.5 h-4.5 rounded-full shadow transform transition-transform duration-300 ${
          checked ? "translate-x-5 bg-amber-300" : "translate-x-0 bg-slate-300"
        }`}
        style={{ width: "18px", height: "18px" }}
      />
    </button>
  );

  const getPointStyle = (value: SamplePointsValue) => {
    const active = selectedPoints === value;
    return `flex flex-col gap-1.5 text-xs font-medium justify-center items-center py-4 px-3 rounded-xl border cursor-pointer transition-all duration-200 ${
      active
        ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
        : "bg-slate-950/60 border-white/10 text-slate-400 hover:bg-slate-900 hover:text-white hover:border-white/20"
    }`;
  };

  return (
    <div className="fixed inset-0 z-20 overflow-hidden bg-[#050811] flex items-center justify-center p-4">
      <CameraPreview
        className="absolute inset-0 z-0 rounded-none border-0"
        imageClassName="w-full h-full object-contain opacity-65"
        fallbackMessage="Preview indisponível para a área de análise."
        showRetryButton={false}
        streamPath={`/stream-analyzed.mjpg?w=${widthRangeValue}&h=${heightRangeValue}&apenas_area=true&estampado=${isEstampado}`}
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/70 via-transparent to-black/50" />

      {isVisible && (
        <div className="relative z-20 w-full max-w-xl mx-auto rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-7 text-white text-sm shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-950/80 border border-white/10 hover:border-cyan-400/40 hover:text-cyan-300 transition-all text-xs font-medium text-slate-200"
            >
              <ArrowLeft size={14} />
              Voltar
            </button>

            <div className="group relative flex items-center justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 border border-white/10 text-xs text-slate-300 cursor-pointer hover:border-cyan-400/40">
                <Info size={14} className="text-cyan-400" />
                <span>Ajuda</span>
              </div>
              <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-72 p-4 bg-slate-950/95 text-xs text-white rounded-xl shadow-2xl border border-white/15 z-50 backdrop-blur-xl">
                <p className="font-semibold text-cyan-300 mb-1.5">Amostragem e ROI</p>
                <p className="text-slate-300 mb-2 leading-relaxed">
                  Defina os pontos de coleta e o tamanho da caixa tracejada (ROI) na câmera:
                </p>
                <ul className="space-y-1 text-[11px] text-slate-300">
                  <li><strong className="text-white">4 Pontos:</strong> Coleta rápida para tecidos uniformes.</li>
                  <li><strong className="text-white">9 Pontos:</strong> Coleta balanceada (recomendado).</li>
                  <li><strong className="text-white">18 Pontos:</strong> Coleta densa de alta precisão.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="font-sansserief text-lg font-bold tracking-[0.12em] uppercase text-white">
              Área de Análise e Detector
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ajuste o recorte espacial da câmera e escolha o motor de visão computacional.
            </p>
          </div>

          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-300 mb-2.5">
              Pontos de Amostragem
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button type="button" onClick={() => setSelectedPoints(4)} className={getPointStyle(4)}>
                <Grip className="w-5 h-5" />
                <span>4 Pontos</span>
              </button>
              <button type="button" onClick={() => setSelectedPoints(9)} className={getPointStyle(9)}>
                <Grip className="w-5 h-5" />
                <span>9 Pontos</span>
              </button>
              <button type="button" onClick={() => setSelectedPoints(18)} className={getPointStyle(18)}>
                <Grip className="w-5 h-5" />
                <span>18 Pontos</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-white/10 bg-slate-950/60 p-4 mb-5">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-300 uppercase tracking-wider">Largura da Área (ROI)</span>
                <span className="font-mono-tech font-semibold text-cyan-300">{widthRangeValue}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                step={1}
                value={widthRangeValue}
                onChange={(e) => setWidthRangeValue(Number(e.target.value))}
                className="w-full h-2 rounded-lg accent-cyan-400 cursor-pointer bg-slate-800"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-300 uppercase tracking-wider">Altura da Área (ROI)</span>
                <span className="font-mono-tech font-semibold text-cyan-300">{heightRangeValue}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                step={1}
                value={heightRangeValue}
                onChange={(e) => setHeightRangeValue(Number(e.target.value))}
                className="w-full h-2 rounded-lg accent-cyan-400 cursor-pointer bg-slate-800"
              />
            </div>
          </div>

          <div
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
              isEstampado
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-cyan-500/30 bg-cyan-500/5"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">
                  Tecido detalhado / estampado
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isEstampado
                      ? "bg-amber-500/25 text-amber-200 border border-amber-400/40"
                      : "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30"
                  }`}
                >
                  {isEstampado ? "Anomalib Ativo" : "OpenCV Ativo"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {isEstampado
                  ? "Usa Anomalib (PatchCore / ResNet18) para aprender o padrão do tecido bom com estampa, xadrez ou textura."
                  : "Tecido liso selecionado: usa segmentação clássica OpenCV (CIE Lab) de alta velocidade."}
              </p>
            </div>
            <Switch checked={isEstampado} onCheckedChange={setIsEstampado} />
          </div>

          <div className="flex items-center justify-end gap-3 mt-7">
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 hover:border-white/25 text-xs font-medium text-slate-200 transition-all"
            >
              <Eye size={16} />
              Ver Câmera Limpa
            </button>
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
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? "Salvando..." : "Salvar Área"}</span>
            </button>
          </div>
        </div>
      )}

      {!isVisible && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-4xl rounded-2xl border border-white/15 bg-slate-900/85 backdrop-blur-xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 text-white">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 hover:border-cyan-400/40 text-xs font-medium text-slate-200"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>

          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs font-semibold text-white">Tecido detalhado / estampado</p>
              <p className="text-[11px] text-slate-400">
                {isEstampado ? "Modo Anomalib ativo" : "Modo OpenCV (liso)"}
              </p>
            </div>
            <Switch checked={isEstampado} onCheckedChange={setIsEstampado} />
          </div>

          <div className="flex items-center gap-4 flex-1 min-w-[220px] max-w-sm">
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Largura: <strong className="text-cyan-300">{widthRangeValue}%</strong></span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={widthRangeValue}
                  onChange={(e) => setWidthRangeValue(Number(e.target.value))}
                  className="w-32 accent-cyan-400 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Altura: <strong className="text-cyan-300">{heightRangeValue}%</strong></span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={heightRangeValue}
                  onChange={(e) => setHeightRangeValue(Number(e.target.value))}
                  className="w-32 accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsVisible(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 text-xs font-semibold"
          >
            <Eye size={16} />
            Mostrar Painel
          </button>
        </div>
      )}
    </div>
  );
};
