"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import { getSystemFlowState } from "@/lib/systemConfig";

interface SystemConfigGuardProps {
  children: React.ReactNode;
  requireReady?: boolean; // quando true, exige que o sistema esteja pronto para iniciar
}

export const SystemConfigGuard = ({
  children,
  requireReady = true,
}: SystemConfigGuardProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const { config, isLoading } = useOperatorSystemConfig(user?.id);

  useEffect(() => {
    if (isLoading) return;

    if (!config) {
      router.replace("/painel");
      return;
    }

    if (requireReady) {
      const flow = getSystemFlowState(config);
      if (!flow.podeIniciar) {
        router.replace("/painel");
      }
    }
  }, [config, isLoading, requireReady, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
};

export default SystemConfigGuard;
