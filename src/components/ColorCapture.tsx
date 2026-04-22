import { useState } from "react";
import { Camera, Lightbulb, Save } from "lucide-react";

export const ColorCapture = ({onBack}) => {


  return (
    <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-2xl mx-auto">
      <h2 className="text-center text-xl font-bold mb-10 cursor-default">
        Calibrar luz branca
      </h2>
      <div className="grid grid-cols-[1fr_3fr] text-sm gap-6">
        <div className="flex flex-col gap-3">
            <section className="flex-flex-col justify-items-center bg-gray-500 p-2 rounded-[10px] hover:bg-gray-400 cursor-pointer w-[110px]">
                <Camera/>
                <p>Capturar Cor</p>
            </section>
            <section className="flex-flex-col justify-items-center bg-gray-500 p-2 rounded-[10px] hover:bg-gray-400 cursor-pointer w-[110px]">
                <Lightbulb/>
                <p>Calibrar Luz</p>
            </section>
        </div>
        <div className="flex gap-1">
            <p className="flex-1">Representação da cor selecionada:</p>
            <section className="flex-[2] w-[100px] h-[50px] bg-white">
            </section>
        </div>
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
