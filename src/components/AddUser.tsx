import { useState } from "react";
import { Loader2, ShieldCheck, User, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

interface AddUserProps {
  isOpen: boolean;
  isClosed: () => void;
  onSaved?: () => void | Promise<void>;
}

const initialForm = {
  name: "",
  code: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function AddUser({ isOpen, isClosed, onSaved }: AddUserProps) {
  const [form, setForm] = useState(initialForm);
  const [selectedRole, setSelectedRole] = useState<AppRole>("operador");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleClose = () => {
    if (isSaving) return;
    setForm(initialForm);
    setSelectedRole("operador");
    isClosed();
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const code = form.code.trim();
    const email = form.email.trim().toLowerCase();

    if (!name || !code || !email || !form.password || !form.confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (form.password.length < 6) {
      toast.error("Senha muito curta", {
        description: "Use pelo menos 6 caracteres.",
      });
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error("As senhas precisam ser iguais");
      return;
    }

    setIsSaving(true);

    try {
      const { data: currentSession } = await supabase.auth.getSession();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            role: selectedRole,
            display_name: name,
            employee_code: code,
          },
        },
      });

      if (error) throw error;

      const newUserId = data.user?.id;
      if (currentSession.session) {
        await supabase.auth.setSession({
          access_token: currentSession.session.access_token,
          refresh_token: currentSession.session.refresh_token,
        });
      }

      if (!newUserId) {
        toast.success("Convite criado", {
          description: "O usuário deve confirmar o cadastro pelo e-mail.",
        });
        handleClose();
        return;
      }

      const [{ error: profileError }, { error: roleError }] = await Promise.all([
        supabase.from("profiles").upsert({
          user_id: newUserId,
          display_name: name,
          employee_code: code,
          job_title: selectedRole === "gestor" ? "Gestor" : "Operador",
          active: true,
        }),
        supabase.from("user_roles").upsert({
          user_id: newUserId,
          role: selectedRole,
        }),
      ]);

      if (profileError || roleError) {
        throw profileError ?? roleError;
      }

      toast.success(selectedRole === "gestor" ? "Gestor adicionado" : "Operador adicionado");
      await onSaved?.();
      handleClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error("Erro ao adicionar usuário", {
        description: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-black/60 p-4 text-sm">
      <div className="w-full max-w-lg rounded-xl border border-border/30 bg-[#0a0c14] p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-lg">Adicionar usuário</h1>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Tipo de acesso
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["operador", "gestor"] as AppRole[]).map((role) => {
                const Icon = role === "gestor" ? ShieldCheck : User;
                const active = selectedRole === role;

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    disabled={isSaving}
                    className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? "border-foreground/30 bg-foreground/10 text-foreground"
                        : "border-border/30 bg-muted/30 text-muted-foreground hover:border-foreground/20 hover:bg-muted/50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {role === "gestor" ? "Gestor" : "Operador"}
                  </button>
                );
              })}
            </div>
          </div>

          <label htmlFor="employee-name">Nome</label>
          <input
            id="employee-name"
            placeholder="Ex: João Silva"
            type="text"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            className="rounded-[10px] bg-[#1318299c] p-3 outline-none focus:ring-1 focus:ring-foreground/40"
          />

          <label htmlFor="employee-code">Código</label>
          <input
            id="employee-code"
            placeholder="Ex: 33333"
            type="text"
            value={form.code}
            onChange={(event) => updateField("code", event.target.value)}
            className="rounded-[10px] bg-[#1318299c] p-3 outline-none focus:ring-1 focus:ring-foreground/40"
          />

          <label htmlFor="employee-email">E-mail</label>
          <input
            id="employee-email"
            placeholder="Ex: usuario@empresa.com"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="rounded-[10px] bg-[#1318299c] p-3 outline-none focus:ring-1 focus:ring-foreground/40"
          />

          <label htmlFor="employee-password">Senha</label>
          <input
            id="employee-password"
            placeholder="xxxxxx"
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            className="rounded-[10px] bg-[#1318299c] p-3 outline-none focus:ring-1 focus:ring-foreground/40"
          />

          <label htmlFor="employee-confirm-password">Confirmar senha</label>
          <input
            id="employee-confirm-password"
            placeholder="xxxxxx"
            type="password"
            value={form.confirmPassword}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
            className="rounded-[10px] bg-[#1318299c] p-3 outline-none focus:ring-1 focus:ring-foreground/40"
          />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-[10px] bg-gray-700 p-3 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
