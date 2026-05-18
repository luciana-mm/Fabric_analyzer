"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Microscope } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import gridBg from "@/assets/grid-bg.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "E-mail inválido" })
    .max(255, { message: "E-mail muito longo" }),
  password: z
    .string()
    .min(6, { message: "Senha deve ter ao menos 6 caracteres" })
    .max(72, { message: "Senha muito longa" }),
});

const Login = () => {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && role) {
      router.replace(role === "gestor" ? "/gestor" : "/painel");
    }
  }, [user, role, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error("Dados inválidos", {
        description: parsed.error.errors[0].message,
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;
      toast.success("Bem-vindo de volta");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      const friendly = message.includes("Invalid login credentials")
        ? "E-mail ou senha incorretos"
        : message;
      toast.error("Erro no login", {
        description: friendly,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-6">
      <img
        src={gridBg.src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-20"
        width={1920}
        height={1080}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/70" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-foreground/10 flex items-center justify-center mb-4">
            <Microscope className="w-7 h-7 text-foreground" />
          </div>
          <h1 className="font-sansserief text-2xl tracking-[0.15em] text-foreground leading-tight">
            Meta
          </h1>
          <p className="text-[11px] tracking-[0.3em] text-muted-foreground uppercase mt-1">
            Análise de Tecidos
          </p>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="font-sansserief text-[10px] tracking-[0.25em] uppercase text-muted-foreground"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-muted/40 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="font-sansserief text-[10px] tracking-[0.25em] uppercase text-muted-foreground"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-muted/40 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-lg bg-foreground/10 border border-foreground/30 hover:bg-foreground/15 transition-all font-sansserief text-[11px] tracking-[0.3em] uppercase text-foreground glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Aguarde..." : "Entrar"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
