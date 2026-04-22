import { Scan, SwatchBook, Triangle, Save } from "lucide-react"
import { useState } from "react"
import { AnalysisArea } from "./AnalysisArea"
import { ColorCapture } from "./ColorCapture"
import { DeltaE } from "./DeltaE"


export const Configuration = () => {

  const[activeView, setActiveView] = useState("home")

  if (activeView === "analysis") {
    return <AnalysisArea onBack={() => setActiveView("home")} />;
  }

  if (activeView === "capture") {
    return <ColorCapture onBack={() => setActiveView("home")} />;
  }

  if(activeView === "delta"){
    return <DeltaE onBack={() => setActiveView("home")}/>
  }

    return(
        <div className="bg-[#0a0c14] p-8 rounded-xl border border-slate-800 text-white max-w-2xl mx-auto">
      <h2 className="text-center text-xl font-bold mb-6">Painel de configuração</h2>
      
      <div className="grid grid-cols-3 gap-4">
        <button 
        onClick={() => setActiveView("analysis")}
        className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg flex flex-col items-center gap-2 transition-all ">
        <span className="text-xs text-center">
            <Scan size={35} className="m-auto mb-2"/>
            Área de Análise
        </span>
        </button>
        
        <button 
          onClick={() => setActiveView("capture")}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs">
        <span>
            <SwatchBook size={35} className="m-auto mb-2"/>
            Capturar Cor
        </span>
        </button>
        
        <button 
          onClick={() => setActiveView("delta")}
          className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs">
        <Triangle size={35} className="m-auto mb-2"/>
          Tolerância Delta E
        </button>

        <button className="bg-slate-800/50 hover:bg-slate-700 p-6 rounded-lg text-xs col-start-1">
          <Save size={35} className="m-auto mb-2"/>
          Salvar Configuração
        </button>
      </div>
    </div>
    )
}