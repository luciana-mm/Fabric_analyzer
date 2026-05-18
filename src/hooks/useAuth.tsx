"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export type AppRole = "operador" | "gestor";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    try {
      const [roleResult, profileResult] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("active")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (roleResult.error) {
        console.error("Erro ao buscar papel:", roleResult.error);
        setRole(null);
        return;
      }

      if (profileResult.error) {
        console.error("Erro ao buscar perfil:", profileResult.error);
      }

      if (profileResult.data?.active === false) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setRole(null);
        if (typeof window !== "undefined") {
          window.location.assign("/");
        }
        return;
      }

      setRole((roleResult.data?.role as AppRole) ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(existing);
      setUser(existing?.user ?? null);

      if (existing?.user) {
        setLoading(true);
        await fetchRole(existing.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(true);
      if (newSession?.user) {
        setTimeout(() => {
          void fetchRole(newSession.user.id);
        }, 0);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    void loadSession();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerInactivitySignOut = async () => {
      await supabase.auth.signOut();
      setRole(null);
      if (typeof window !== "undefined") {
        window.location.assign("/");
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
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
