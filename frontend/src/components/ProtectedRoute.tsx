"use client";

/**
 * Componente de guarda de rotas Client-Side (Controle de Acesso Baseado em Papel / RBAC).
 *
 * - Atua como segunda camada de segurança em conjunto com o `middleware.ts`.
 * - Aguarda a restauração da sessão (`useAuth`) exibindo um indicador de carregamento.
 * - Se não houver usuário autenticado, redireciona para a tela de login (`/`).
 * - Quando `requireRole` é informado (`"operador"` ou `"gestor"`), aplica a política
 *   *fail-closed*: qualquer papel diferente do exigido (incluindo `null`) tem a
 *   renderização bloqueada e o usuário é redirecionado para sua área correspondente.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: AppRole;
}

export const ProtectedRoute = ({ children, requireRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/");
      return;
    }

    if (requireRole && role !== requireRole) {
      router.replace(role === "gestor" ? "/gestor" : role === "operador" ? "/painel" : "/");
    }
  }, [loading, user, role, requireRole, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null;

  if (requireRole && role !== requireRole) {
    return null;
  }

  return <>{children}</>;
};
