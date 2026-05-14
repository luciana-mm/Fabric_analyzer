"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const ROLE_FETCH_MAX_RETRIES = 3;
const ROLE_FETCH_RETRY_DELAY_MS = 1000;

export type AppRole = "operador" | "gestor";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchRoleWithRetry = async (userId: string, attempt = 1): Promise<void> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) {
        if (attempt < ROLE_FETCH_MAX_RETRIES) {
          await delay(ROLE_FETCH_RETRY_DELAY_MS * attempt);
          return fetchRoleWithRetry(userId, attempt + 1);
        }

        console.error(`Erro ao buscar role após ${attempt} tentativas:`, fetchError);
        setError("Falha ao carregar papel do usuário");
        setRole(null);
        return;
      }

      setRole((data?.role as AppRole) ?? null);
      setError(null);
    } catch (err) {
      console.error("Exceção ao buscar role:", err);
      if (attempt < ROLE_FETCH_MAX_RETRIES) {
        await delay(ROLE_FETCH_RETRY_DELAY_MS * attempt);
        return fetchRoleWithRetry(userId, attempt + 1);
      }
      setError("Erro inesperado ao carregar papel");
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session: existing },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error("Erro ao carregar sessão:", sessionError);
          setError("Falha ao restaurar sessão");
          setLoading(false);
          return;
        }

        setSession(existing);
        setUser(existing?.user ?? null);

        if (existing?.user) {
          await fetchRoleWithRetry(existing.user.id);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Erro crítico ao carregar sessão:", err);
        setError("Erro ao inicializar autenticação");
      } finally {
        setLoading(false);
      }
    };

    const { data: authData } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(true);
      setError(null);

      if (newSession?.user) {
        void fetchRoleWithRetry(newSession.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    unsubscribeRef.current = () => {
      authData.subscription.unsubscribe();
    };

    void loadSession();

    return () => {
      mounted = false;
      unsubscribeRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerInactivitySignOut = async () => {
      try {
        await supabase.auth.signOut();
        setRole(null);
        if (typeof window !== "undefined") {
          window.location.assign("/");
        }
      } catch (err) {
        console.error("Erro ao fazer logout por inatividade:", err);
        if (typeof window !== "undefined") {
          window.location.assign("/");
        }
      }
    };

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        void triggerInactivitySignOut();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [user]);

  const signOut = async () => {
    try {
      unsubscribeRef.current?.();
      await supabase.auth.signOut();
      setRole(null);
      setError(null);
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
      setError("Falha ao fazer logout");
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
