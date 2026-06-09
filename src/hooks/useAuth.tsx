"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { fetchJson } from "@/lib/api-client";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export type AppRole = "operador" | "gestor";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole | null;
  display_name?: string | null;
  job_title?: string | null;
  shift?: string | null;
}

interface AuthContextValue {
  session: null;
  user: AuthUser | null;
  role: AppRole | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const response = await fetchJson<{ user: AuthUser | null }>(
          "/api/auth/session",
        );

        if (!mounted) return;

        setUser(response.user);
        setRole(response.user?.role ?? null);
      } catch (err) {
        console.error("Erro ao carregar sessão:", err);
        if (mounted) {
          setError("Falha ao restaurar sessão");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerInactivitySignOut = async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
        setUser(null);
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
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setRole(null);
      setError(null);
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
      setError("Falha ao fazer logout");
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{ session: null, user, role, loading, error, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
