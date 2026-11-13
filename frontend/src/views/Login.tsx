"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Microscope } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#F7F6F3]">
      {/* Painel Esquerdo: Hero Têxtil Terracota */}
      <div
        className="relative hidden lg:flex flex-col justify-end p-12 overflow-hidden text-white"
        style={{
          backgroundColor: "#8C3B2B",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(214, 118, 86, 0.45), transparent 55%), radial-gradient(circle at 80% 75%, rgba(62, 22, 14, 0.65), transparent 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 6px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 2px, transparent 2px, transparent 6px)",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <div className="relative z-10 max-w-md space-y-3">
          <h2 className="text-4xl font-bold tracking-tight leading-tight">
            Cada metro de tecido,
            <br />
            na cor certa.
          </h2>
          <p className="text-sm text-stone-200/90 leading-relaxed">
            Inspeção colorimétrica e detecção de defeitos em tempo real, direto da bancada.
          </p>
        </div>
      </div>

      {/* Painel Direito: Formulário Limpo */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-[#FAF9F6]">
        <div className="w-full max-w-sm space-y-7">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-sm">
              <Microscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900 leading-none">
                META
              </h1>
              <p className="text-xs text-stone-500 mt-1">
                Fabric Analyzer
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-stone-700"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-white border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-stone-700"
              >
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-white border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 flex items-center justify-center gap-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium text-sm shadow-sm transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Autenticando..." : "Acessar Estação"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
