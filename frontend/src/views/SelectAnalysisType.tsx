"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Package, Shirt } from "lucide-react";
import { OperatorShell } from "@/components/OperatorShell";

const SelectAnalysisType = () => {
  const router = useRouter();

  const handleSelectTecido = () => {
    router.push("/painel/analise/tecido");
  };

  const handleSelectPecas = () => {
    router.push("/painel/analise/pecas");
  };

  return (
    <OperatorShell>
      <div className="space-y-8">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push("/painel")}
            className="mt-0.5 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Modo de Inspeção
            </h1>
            <p className="text-sm text-stone-500">
              Selecione o tipo de material posicionado na bancada.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-6 pt-2">
          <div className="text-center">
            <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-[#B85D3B]">
              Etapa 3 · Iniciar Inspeção
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
              O que será inspecionado agora?
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <button
              onClick={handleSelectTecido}
              className="group flex flex-col items-center justify-center gap-4 rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm transition-all hover:border-[#B85D3B] hover:shadow-md"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-700 transition-colors group-hover:bg-orange-50 group-hover:text-[#B85D3B]">
                <Shirt className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Rolo / Tecido
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
                  Inspeção contínua de tecido com detecção em tempo real (OpenCV para liso ou Anomalib para estampado) e rastreamento de falhas.
                </p>
              </div>
            </button>

            <button
              onClick={handleSelectPecas}
              className="group flex flex-col items-center justify-center gap-4 rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm transition-all hover:border-[#B85D3B] hover:shadow-md"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-700 transition-colors group-hover:bg-orange-50 group-hover:text-[#B85D3B]">
                <Package className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Peças Confeccionadas
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
                  Inspeção pontual de peças prontas ou recortes individuais comparando fidelidade colorimétrica (ΔE).
                </p>
              </div>
            </button>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
            <p className="text-xs leading-relaxed text-stone-500">
              Todas as leituras serão vinculadas automaticamente ao seu turno e ao código de lote configurado.
            </p>
          </div>
        </div>
      </div>
    </OperatorShell>
  );
};

export default SelectAnalysisType;
