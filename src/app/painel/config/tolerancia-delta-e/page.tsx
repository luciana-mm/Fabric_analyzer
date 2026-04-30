"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import gridBg from "@/assets/grid-bg.jpg";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DeltaE } from "@/components/DeltaE";
import { useAuth } from "@/hooks/useAuth";
import { useOperatorSystemConfig } from "@/hooks/useOperatorSystemConfig";
import type { DeltaEValue } from "@/lib/systemConfig";

function ConfigDeltaEContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { config, persistPatch } = useOperatorSystemConfig(user?.id);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <img src={gridBg.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" width={1920} height={1080} />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6 border-b border-border/20">
        <button
          onClick={() => router.push("/painel/config")}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 border border-border/30 hover:bg-muted/60 hover:border-foreground/30 transition-all font-display text-[10px] tracking-[0.25em] uppercase text-foreground/80"
        >
          <ArrowLeft className="w-3 h-3" />
          Voltar
        </button>
        <div />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-2xl">
          <DeltaE
            onBack={() => router.push("/painel/config")}
            initialDelta={config.deltaE as DeltaEValue}
            onSave={async (value) => {
              if (persistPatch) {
                await persistPatch({ deltaE: value, deltaConfigured: true });
              }
              toast.success("Tolerancia Delta E salva");
            }}
          />
        </div>
      </main>
    </div>
  );
}

export default function ConfigDeltaEPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <ConfigDeltaEContent />
    </ProtectedRoute>
  );
}
