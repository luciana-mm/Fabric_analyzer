"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Lock, Mail, Microscope } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import gridBg from "@/assets/grid-bg.jpg";
import { useAuth, type AuthUser } from "@/hooks/useAuth";
import { clearSystemConfigCache } from "@/lib/systemConfig";

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
  const { user, role, loading: authLoading, applySession } = useAuth();
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
      console.log("Iniciando login...", { email: parsed.data.email });

      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        user?: AuthUser;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Erro ao fazer login");
      }

      if (!payload?.user) {
        throw new Error("Resposta de login invalida");
      }

      clearSystemConfigCache(payload.user.id);
      applySession(payload.user);

      const destination = payload.user.role === "gestor" ? "/gestor" : "/painel";
      console.log("Login bem-sucedido");
      toast.success("Bem-vindo de volta");
      window.location.assign(destination);
    } catch (err: unknown) {
      console.error("Erro no handleSubmit:", err);
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      const friendly = message.includes("Invalid login credentials")
        ? "E-mail ou senha incorretos"
        : message.includes("Failed to fetch")
          ? "Erro de conexão com servidor. Verifique sua internet."
          : message;
      toast.error("Erro no login", {
        description: friendly,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-6 bg-[#050811]">
      <Image
        src={gridBg}
        alt=""
        fill
        className="absolute inset-0 object-cover opacity-25 mix-blend-luminosity"
        sizes="100vw"
        quality={85}
        priority
      />
      <div className="absolute inset-0 industrial-bg" />
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[320px] rounded-full bg-cyan-500/15 blur-[110px]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-400/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <Microscope className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-medium tracking-[0.22em] text-cyan-300 uppercase mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Visão Computacional Têxtil
          </div>
          <h1 className="font-sansserief text-3xl font-bold tracking-[0.18em] text-white leading-tight">
            META
          </h1>
          <p className="text-xs tracking-[0.22em] text-slate-400 uppercase mt-1">
            Inspeção e Classificação de Tecidos
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-xl p-8 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)]">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Acesso ao Sistema</h2>
            <p className="text-xs text-slate-400 mt-1">
              Entre com suas credenciais de Operador ou Gestor.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-medium tracking-wider uppercase text-slate-300"
              >
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@local"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-950/70 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-medium tracking-wider uppercase text-slate-300"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-950/70 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs tracking-[0.18em] uppercase shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:shadow-[0_0_32px_rgba(6,182,212,0.55)] transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Autenticando..." : "Entrar no Painel"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
