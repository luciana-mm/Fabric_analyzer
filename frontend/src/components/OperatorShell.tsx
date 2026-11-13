"use client";

import type { ReactNode } from "react";
import { LogOut, Microscope, UserRound } from "lucide-react";

interface OperatorShellProps {
  children: ReactNode;
  systemStep?: "CONFIG" | "LIGHT" | "READY";
  operatorName?: string;
  onOpenProfile?: () => void;
  onSignOut?: () => void;
}

export const OperatorShell = ({
  children,
  systemStep = "CONFIG",
  operatorName,
  onOpenProfile,
  onSignOut,
}: OperatorShellProps) => {
  const stepPill =
    systemStep === "READY"
      ? {
          label: "Sistema Pronto",
          classes: "bg-emerald-50 border-emerald-200 text-emerald-700",
          dot: "bg-emerald-500",
        }
      : systemStep === "LIGHT"
      ? {
          label: "Etapa 2: Calibrar Luz",
          classes: "bg-amber-50 border-amber-200 text-amber-800",
          dot: "bg-amber-500",
        }
      : {
          label: "Etapa 1: Configurar",
          classes: "bg-orange-50 border-orange-200 text-orange-800",
          dot: "bg-[#B85D3B]",
        };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F6F3] text-stone-900">
      <header className="bg-white border-b border-stone-200 px-6 md:px-10 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-stone-900 text-white flex items-center justify-center shrink-0">
            <Microscope className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-stone-900 leading-tight">
              META · Estação do Operador
            </h1>
            <p className="text-xs text-stone-500">
              Controle de Qualidade e Colorimetria Têxtil
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${stepPill.classes}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${stepPill.dot}`} />
            <span>{stepPill.label}</span>
          </div>

          {operatorName && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors"
            >
              <UserRound className="w-3.5 h-3.5 text-stone-400" />
              <span>Operador: {operatorName}</span>
            </button>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-medium text-stone-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 md:px-10 py-8">{children}</main>
    </div>
  );
};
