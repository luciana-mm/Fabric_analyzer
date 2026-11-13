import { useState } from "react";
import { Check, Info } from "lucide-react";
import type { DeltaEValue } from "@/lib/systemConfig";

interface DeltaEProps {
  onBack: () => void;
  initialDelta: DeltaEValue;
  onSave: (value: DeltaEValue) => void;
}

export const DeltaE = ({ onBack, initialDelta, onSave }: DeltaEProps) => {
  const [selectedDelta, setSelectedDelta] = useState<DeltaEValue>(initialDelta);

  const deltaOptions: { value: DeltaEValue; title: string; badge: string; desc: string }[] = [
    {
      value: 1,
      title: "Rigoroso",
      badge: "1.0",
      desc: "Diferença quase imperceptível ao olho humano.",
    },
    {
      value: 2,
      title: "Padrão",
      badge: "2.0",
      desc: "Recomendado para a maioria dos lotes industriais.",
    },
    {
      value: 3,
      title: "Flexível",
      badge: "3.0",
      desc: "Aceita variações visíveis leves.",
    },
  ];

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-7 text-stone-900 shadow-sm space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 text-center">
          <p className="text-xs font-medium text-stone-500">Limite máximo</p>
          <p className="mt-1 font-mono-tech text-3xl font-bold text-stone-900">
            ΔE ≤ {selectedDelta.toFixed(1)}
          </p>
        </div>

        <div className="group relative flex items-center justify-center shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-xs text-stone-600 cursor-pointer hover:border-stone-400">
            <Info size={13} className="text-stone-500" />
            <span>O que é ΔE?</span>
          </div>
          <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-68 p-3.5 bg-white text-xs text-stone-700 rounded-xl shadow-xl border border-stone-200 z-50">
            <p className="font-semibold text-stone-900 mb-1">Distância no espaço CIELAB</p>
            <p className="leading-relaxed">
              Quanto menor o valor de ΔE, mais rigorosa é a exigência de fidelidade em relação à cor padrão capturada.
            </p>
          </div>
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-1.5 px-1">
        <input
          type="range"
          min={1}
          max={3}
          step={1}
          value={selectedDelta}
          onChange={(e) => setSelectedDelta(Number(e.target.value) as DeltaEValue)}
          className="w-full h-2 rounded-lg accent-stone-900 cursor-pointer bg-stone-200"
        />
        <div className="flex justify-between font-mono-tech text-[11px] text-stone-400">
          <span>1.0</span>
          <span>2.0</span>
          <span>3.0</span>
        </div>
      </div>

      {/* 3 Opções */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {deltaOptions.map((option) => {
          const active = selectedDelta === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedDelta(option.value)}
              className={`flex flex-col justify-between p-4 rounded-xl border text-left transition-all ${
                active
                  ? "bg-orange-50/70 border-[#B85D3B] ring-1 ring-[#B85D3B]/30"
                  : "bg-white border-stone-200 hover:border-stone-300"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <p className="text-sm font-semibold text-stone-900">{option.title}</p>
                <span className="font-mono-tech text-xs font-semibold text-stone-700">
                  {option.badge}
                </span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">{option.desc}</p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={async () => {
          await onSave(selectedDelta);
          onBack();
        }}
        className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-sm transition-colors"
      >
        <Check className="w-4 h-4" />
        <span>Confirmar tolerância</span>
      </button>
    </div>
  );
};
