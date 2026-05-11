import { useState } from "react";
import { LocateFixed, Save, Info } from "lucide-react";
import type { DeltaEValue } from "@/lib/systemConfig";

interface DeltaEProps {
  onBack: () => void;
  initialDelta: DeltaEValue;
  onSave: (value: DeltaEValue) => void;
}

export const DeltaE = ({ onBack, initialDelta, onSave }: DeltaEProps) => {

  const [selectedDelta, setSelectedDelta] = useState<DeltaEValue>(initialDelta)

  const getPointStyle = (value) => {
    const baseClasses = "flex flex-col text-xs justify-center items-center w-full h-full cursor-pointer transition-colors";
    const activeClasses = "bg-blue-600 text-white";
    const hoverClasses = "hover:bg-slate-700";

    return `${baseClasses} ${selectedDelta === value ? activeClasses : hoverClasses}`;
  };

  return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-2xl mx-auto text-sm">
      <div className="relative flex items-center justify-center mb-10">
        <h2 className="text-xl font-bold cursor-default text-center">
          Selecione a tolerância máxima de delta E
        </h2>
        <div className="absolute right-0">
          <div className="group relative flex items-center justify-center">
            <Info
              size={20}
              className="cursor-pointer text-slate-400 group-hover:text-slate-100 transition-colors"
            />
            <div className="absolute left-full ml-3 hidden group-hover:block w-64 p-3 bg-slate-800 text-xs text-white rounded shadow-lg border border-slate-700 glow-box z-50">
              <p className="mb-1">A tolerância de Delta E define o limite máximo aceitável para a diferença de cor.</p>
              <p className="mb-1">Quanto menor o valor, mais rigorosa é a correspondência de cor exigida.</p>
              <p className="mb-1">Proximidade mínima exigida: nível 1 = 80%, nível 2 = 70%, nível 3 = 60%.</p>
              <ul className="space-y-1 text-[11px] text-slate-300">
                <li><strong className="text-white">ΔE ≤ 1:</strong> Quase imperceptível, ideal para alta precisão.</li>
                <li><strong className="text-white">ΔE ≤ 2:</strong> Perceptível apenas para olhos treinados.</li>
                <li><strong className="text-white">ΔE ≤ 3:</strong> Aceitável para trabalhos menos críticos.</li>
              </ul>

              <div className="absolute top-1/2 -translate-y-1/2 right-full border-8 border-transparent border-r-slate-800"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 border border-slate-700 rounded-[10px] w-[350px] h-[100px] m-auto mb-10 overflow-hidden">
        <section
          onClick={() => setSelectedDelta(1)}
          className={`${getPointStyle(1)} rounded-tl-[10px] rounded-bl-[10px] border-r border-slate-800`}>
          <LocateFixed />
          <p>1 · 80%</p>
        </section>
        <section
          onClick={() => setSelectedDelta(2)}
          className={`${getPointStyle(2)} border-r border-slate-800`}
        >
          <LocateFixed />
          <p>2 · 70%</p>
        </section>
        <section
          onClick={() => setSelectedDelta(3)}
          className={`${getPointStyle(3)} rounded-tr-[10px] rounded-br-[10px]`}>
          <LocateFixed />
          <p>3 · 60%</p>
        </section>
      </div>
      <div className="flex justify-end gap-5 mt-10 text-sm ">
        <button
          onClick={() => {
            onSave(selectedDelta);
            onBack();
          }}
          className="flex-col justify-items-center bg-gray-500 p-2 w-[100px] gap-2 rounded-[10px] hover:bg-gray-400">
          <Save />
          <p>Salvar</p>
        </button>
      </div>
    </div>
  );
};
