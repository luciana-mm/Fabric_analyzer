import { useState } from "react";
import { LocateFixed, Save, Info } from "lucide-react";
import type { DeltaEValue } from "@/lib/systemConfig";

interface DeltaEProps {
  onBack: () => void;
  initialDelta: DeltaEValue;
  onSave: (value: DeltaEValue) => void;
}

export const DeltaE = ({ onBack, initialDelta, onSave }: DeltaEProps) => {
  const [selectedDelta, setSelectedDelta] = useState<DeltaEValue>(initialDelta);

  const deltaOptions: { value: DeltaEValue; title: string; precision: string; desc: string }[] = [
    {
      value: 1,
      title: "ΔE ≤ 1",
      precision: "Precisão ≥ 80%",
      desc: "Rigor máximo. Diferença quase imperceptível ao olho humano.",
    },
    {
      value: 2,
      title: "ΔE ≤ 2",
      precision: "Precisão ≥ 70%",
      desc: "Padrão industrial têxtil. Perceptível apenas sob inspeção próxima.",
    },
    {
      value: 3,
      title: "ΔE ≤ 3",
      precision: "Precisão ≥ 60%",
      desc: "Tolerância comercial para lotes com maior variação aceitável.",
    },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/75 backdrop-blur-xl p-8 text-white max-w-2xl mx-auto text-sm shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8)]">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="font-sansserief text-lg font-bold tracking-[0.14em] uppercase text-white">
            Tolerância Colorimétrica (ΔE)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Selecione o limite máximo aceitável de diferença de cor CIELAB (CIE76 / ΔE) para aprovação.
          </p>
        </div>

        <div className="group relative flex items-center justify-center shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 border border-white/10 text-xs text-slate-300 cursor-pointer hover:border-cyan-400/40">
            <Info size={14} className="text-cyan-400" />
            <span>O que é ΔE?</span>
          </div>
          <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-72 p-4 bg-slate-950/95 text-xs text-white rounded-xl shadow-2xl border border-white/15 z-50 backdrop-blur-xl">
            <p className="font-semibold text-cyan-300 mb-1.5">Distância no espaço CIELAB</p>
            <p className="text-slate-300 mb-2 leading-relaxed">
              Quanto menor o valor de ΔE, mais rigorosa é a exigência de fidelidade em relação à cor padrão capturada.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {deltaOptions.map((option) => {
          const active = selectedDelta === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedDelta(option.value)}
              className={`flex flex-col items-start justify-between p-5 rounded-xl border text-left transition-all duration-200 ${
                active
                  ? "bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_24px_rgba(6,182,212,0.22)]"
                  : "bg-slate-950/60 border-white/10 text-slate-300 hover:bg-slate-900 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                    active
                      ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
                      : "bg-slate-900 border-white/10 text-slate-400"
                  }`}
                >
                  <LocateFixed className="w-5 h-5" />
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-mono-tech text-[11px] font-semibold border ${
                    active
                      ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200"
                      : "bg-slate-900 border-white/10 text-slate-400"
                  }`}
                >
                  {option.precision}
                </span>
              </div>

              <div>
                <p className="font-sansserief text-base font-bold text-white">{option.title}</p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{option.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={async () => {
            await onSave(selectedDelta);
            onBack();
          }}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Tolerância</span>
        </button>
      </div>
    </div>
  );
};
