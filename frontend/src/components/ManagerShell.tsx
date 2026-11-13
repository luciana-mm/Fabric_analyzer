"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  LogOut,
  Microscope,
  Package,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ManagerShellProps {
  children: ReactNode;
}

const navItems = [
  { label: "Visão geral", href: "/gestor", icon: LayoutGrid },
  { label: "Equipe", href: "/gestor/funcionarios", icon: Users },
  { label: "CFTV & Câmeras", href: "/gestor/cftv", icon: Video },
  { label: "Histórico de Lotes", href: "/gestor/historico", icon: Package },
];

export const ManagerShell = ({ children }: ManagerShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <div className="min-h-screen flex bg-[#F7F6F3] text-stone-900">
      {/* Sidebar Escura Minimalista */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col justify-between bg-[#181715] text-stone-300 border-r border-stone-800">
        <div>
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
            <div className="w-8 h-8 rounded-lg bg-[#B85D3B] text-white flex items-center justify-center shrink-0">
              <Microscope className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-none">META</p>
              <p className="text-[11px] text-stone-400 mt-1 truncate">Painel do Gestor</p>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/gestor"
                  ? pathname === "/gestor"
                  : pathname?.startsWith(item.href);

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-stone-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <p className="text-[11px] text-stone-500">Conectado como</p>
          <p className="text-xs font-medium text-stone-200 truncate mt-0.5">
            {user?.email ?? "gestor@meta.com"}
          </p>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-stone-200 px-6 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold text-stone-900 leading-tight">
              META · Painel do Gestor
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Supervisão Operacional e Qualidade de Lotes
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push("/gestor/cftv")}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors"
            >
              <Video className="w-3.5 h-3.5 text-stone-500" />
              CFTV &amp; Câmeras
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-xs font-medium text-stone-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </header>

        {/* Navegação rápida mobile */}
        <div className="flex md:hidden gap-1.5 overflow-x-auto px-4 py-2.5 bg-white border-b border-stone-200">
          {navItems.map((item) => {
            const isActive =
              item.href === "/gestor"
                ? pathname === "/gestor"
                : pathname?.startsWith(item.href);

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
};
