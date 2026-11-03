"use client";

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

    if (requireRole && role && role !== requireRole) {
      router.replace(role === "gestor" ? "/gestor" : "/painel");
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

  if (requireRole && role && role !== requireRole) {
    return null;
  }

  return <>{children}</>;
};
