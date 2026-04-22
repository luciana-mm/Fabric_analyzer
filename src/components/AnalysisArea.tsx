import { useState } from "react";
import { Grip, Save } from "lucide-react";

export const AnalysisArea = ({onBack}) => {

  const[heightRangeValue, setHeightRangeValue] = useState(0)
  const[widthRangeValue, setWidthRangeValue] = useState(0)

  const[selectedPoints ,setSelectedPoints] = useState(null)

  const getPointStyle = (value) => {
    const baseClasses = "flex flex-col text-xs justify-center items-center w-full h-full cursor-pointer transition-colors";
    const activeClasses = "bg-blue-600 text-white";
    const hoverClasses = "hover:bg-slate-700";
    
    return `${baseClasses} ${selectedPoints === value ? activeClasses : hoverClasses}`;
  };

  return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-2xl mx-auto text-sm">
      <h2 className="text-center text-xl font-bold mb-10 cursor-default">
        Selecione o Nº de pontos e medidas da área
      </h2>

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
          <span className="h-6 flex items-center cursor-default">Largura</span>
          <span className="h-6 flex items-center cursor-default">Altura</span>
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
          <span>
            {widthRangeValue}
          </span>
          <span>
            {heightRangeValue}
          </span>
        </div>
      </div>
      <div
        
        className="flex justify-end gap-5 mt-8">
        <button className="bg-gray-500 p-2 w-[100px] rounded-[10px] hover:bg-gray-400">
          Esconder
        </button>
        <button 
          onClick={onBack} 
          className="flex-col justify-items-center bg-gray-500 p-2 w-[100px] gap-2 rounded-[10px] hover:bg-gray-400">
            <Save/>
            <p>Salvar</p>
        </button>
      </div>
    </div>
  );
};
