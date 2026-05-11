import { useState } from "react";
import { Grip, Save, Eye, Info, ArrowLeft } from "lucide-react";
import { MeasurementGridOverlay } from "./PreviewArea";
import { CameraPreview } from "./CameraPreview";
import type { SamplePointsValue } from "@/lib/systemConfig";

interface AnalysisAreaProps {
  onBack: () => void;
  onSave: (value: {
    samplePoints: SamplePointsValue;
    sampleAreaWidthPercent: number;
    sampleAreaHeightPercent: number;
  }) => void;
  initialWidth: number;
  initialHeight: number;
  initialPoints: SamplePointsValue;
}

export const AnalysisArea = ({ onBack, onSave, initialWidth, initialHeight, initialPoints }: AnalysisAreaProps) => {
  const [isVisible, setIsVisible] = useState(true);

  const [heightRangeValue, setHeightRangeValue] = useState(initialHeight);
  const [widthRangeValue, setWidthRangeValue] = useState(initialWidth);
  const [selectedPoints, setSelectedPoints] = useState<SamplePointsValue>(initialPoints);

  const getPointStyle = (value) => {
    const baseClasses =
      "flex flex-col text-xs justify-center items-center w-full h-full cursor-pointer transition-colors";
    const activeClasses = "bg-blue-600 text-white";
    const hoverClasses = "hover:bg-slate-700";

    return `${baseClasses} ${selectedPoints === value ? activeClasses : hoverClasses}`;
  };

  return (
    <div className="fixed inset-0 z-20 overflow-hidden bg-[#0a0c14] flex items-center justify-center">
      <CameraPreview
        className="absolute inset-0 z-0 rounded-none border-0"
        imageClassName="w-full h-full object-cover opacity-55"
        fallbackMessage="Preview indisponivel para a area de analise."
        showRetryButton={false}
      />
      <MeasurementGridOverlay
        width={widthRangeValue}
        height={heightRangeValue}
      />
      {isVisible && (
        <div className="relative z-20 w-full max-w-2xl mx-auto bg-[#0a0c14]/90 backdrop-blur-sm p-8 rounded-xl border border-slate-800 text-white text-sm">
          <div className="mb-6">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/70 hover:bg-slate-600 transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
          </div>
          <div className="relative flex items-center justify-center mb-10">
        <h2 className="text-xl font-bold cursor-default text-center">
          Selecione o n.º de pontos e medidas da área
        </h2>
        <div className="absolute right-0">
          <div className="group relative flex items-center justify-center">
            <Info
              size={20}
              className="cursor-pointer text-slate-400 group-hover:text-slate-100 transition-colors"
            />
            <div className="absolute left-full ml-3 hidden group-hover:block w-64 p-3 bg-slate-800 text-xs text-white rounded shadow-lg border border-slate-700 glow-box z-50">
              <p className="mb-1">Selecione o número de pontos de amostragem e as medidas da área de análise.</p>
              <ul className="space-y-1 text-[11px] text-slate-300">
                <li><strong className="text-white">4 Pontos:</strong> Amostragem básica para análise de cor.</li>
                <li><strong className="text-white">9 Pontos:</strong> Amostragem moderada para análise de cor.</li>
                <li><strong className="text-white">18 Pontos:</strong> Amostragem detalhada para análise de cor.</li>
              </ul>

              <div className="absolute top-1/2 -translate-y-1/2 right-full border-8 border-transparent border-r-slate-800"></div>
            </div>
          </div>
        </div>
      </div>
          <div className="grid grid-cols-3 border border-slate-700 rounded-[10px] w-[350px] h-[100px] m-auto mb-10 overflow-hidden">
            <span
              onClick={() => setSelectedPoints(4)}
              className={`${getPointStyle(4)} rounded-tl-[10px] rounded-bl-[10px] border-r border-slate-800`}
            >
              <Grip />
              <p>4 Pontos</p>
            </span>

            <span
              onClick={() => setSelectedPoints(9)}
              className={`${getPointStyle(9)} border-r border-slate-800`}
            >
              <Grip />
              <p>9 Pontos</p>
            </span>

            <span
              onClick={() => setSelectedPoints(18)}
              className={`${getPointStyle(18)} rounded-tr-[10px] rounded-br-[10px]`}
            >
              <Grip />
              <p>18 Pontos</p>
            </span>
          </div>
          <div className="grid grid-cols-[1fr_4fr_1fr] gap-x-6 gap-y-4 items-center">
            <div className="flex flex-col gap-y-4 text-sm font-medium text-slate-300">
              <span className="h-6 flex items-center cursor-default">
                Largura
              </span>
              <span className="h-6 flex items-center cursor-default">
                Altura
              </span>
            </div>
            <div className="flex flex-col gap-y-4">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={widthRangeValue}
                onChange={(e) => setWidthRangeValue(Number(e.target.value))}
                className="w-full h-6 accent-blue-600 cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={heightRangeValue}
                onChange={(e) => setHeightRangeValue(Number(e.target.value))}
                className="w-full h-6 accent-blue-600 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-y-4 cursor-default">
              <span>{widthRangeValue}%</span>
              <span>{heightRangeValue}%</span>
            </div>
          </div>
          <div className="flex justify-end gap-5 mt-8">
            <button
              onClick={() => setIsVisible(false)}
              className="bg-gray-500 p-2 w-[100px] rounded-[10px] hover:bg-gray-400"
            >
              Esconder
            </button>
            <button
              onClick={() => {
                onSave({
                  samplePoints: selectedPoints,
                  sampleAreaWidthPercent: widthRangeValue,
                  sampleAreaHeightPercent: heightRangeValue,
                });
                onBack();
              }}
              className="flex-col justify-items-center bg-gray-500 p-2 w-[100px] gap-2 rounded-[10px] hover:bg-gray-400"
            >
              <Save />
              <p>Salvar</p>
            </button>
          </div>
        </div>
      )}

      {!isVisible && (
        <div className="absolute bottom-10 z-20 flex gap-10">
          <button
            onClick={onBack}
            className="bg-slate-700 p-2 w-[120px] rounded-[10px] hover:bg-slate-600"
          >
            Voltar
          </button>
          <div className="flex gap-3">
            <div className="flex flex-col gap-y-4 text-sm font-medium text-slate-300">
              <span className="h-6 flex items-center cursor-default">
                Largura
              </span>
              <span className="h-6 flex items-center cursor-default">
                Altura
              </span>
            </div>
            <div className="flex flex-col gap-y-4">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={widthRangeValue}
                onChange={(e) => setWidthRangeValue(Number(e.target.value))}
                className="w-full h-6 accent-blue-600 cursor-pointer"
              />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={heightRangeValue}
                onChange={(e) => setHeightRangeValue(Number(e.target.value))}
                className="w-full h-6 accent-blue-600 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-y-4 cursor-default">
              <span>{widthRangeValue}%</span>
              <span>{heightRangeValue}%</span>
            </div>
          </div>
          <div className="flex">
            <button
              onClick={() => setIsVisible(true)}
              className="bg-gray-500 p-2 w-[150px] rounded-[10px] hover:bg-gray-400 "
            >
              <Eye className="m-auto"/>
              Mostrar Painel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
