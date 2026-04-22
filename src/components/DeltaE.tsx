import { useState } from "react";
import { LocateFixed, Save } from "lucide-react";

export const DeltaE = ({onBack}) => {

    const[selectedDelta ,setSelectedDelta] = useState(null)
    
        const getPointStyle = (value) => {
        const baseClasses = "flex flex-col text-xs justify-center items-center w-full h-full cursor-pointer transition-colors";
        const activeClasses = "bg-blue-600 text-white";
        const hoverClasses = "hover:bg-slate-700";
        
        return `${baseClasses} ${selectedDelta === value ? activeClasses : hoverClasses}`;
        };

return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-2xl mx-auto text-sm">
      <h2 className="text-center text-xl font-bold mb-10 cursor-default">
        Selecione a tolerância maxima de delta E
      </h2>
      <div className="grid grid-cols-3 border border-slate-700 rounded-[10px] w-[350px] h-[100px] m-auto mb-10 overflow-hidden">
        <section 
            onClick={() => setSelectedDelta(1)}
            className={`${getPointStyle(1)} rounded-tl-[10px] rounded-bl-[10px] border-r border-slate-800`}>
            <LocateFixed/>
            <p>ΔE ≤ 1</p>
        </section>
        <section 
            onClick={() => setSelectedDelta(2)}
            className={`${getPointStyle(2)} border-r border-slate-800`}
            >
            <LocateFixed/>
            <p>ΔE ≤ 2</p>
        </section>
        <section
            onClick={() => setSelectedDelta(3)}
            className={`${getPointStyle(3)} rounded-tr-[10px] rounded-br-[10px]`}>
            <LocateFixed/>
            <p>ΔE ≤ 3</p>
        </section>
      </div>
      <div className="flex justify-end gap-5 mt-10 text-sm ">
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
