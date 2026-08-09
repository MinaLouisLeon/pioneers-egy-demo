import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Session } from "@supabase/supabase-js";

import type { UserRole } from "@pioneers/core/roles";

import { supabase } from "./supabase";

export type SessionProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
};

type SessionContextValue = {
  session: Session | null;
  profile: SessionProfile | null;
  /** True until the stored session has been read from AsyncStorage. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadProfile(userId: string): Promise<SessionProfile | null> {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, phone, is_active")
      .eq("id", userId)
      .single();

    // A deactivated account keeps a valid token until it expires, so the
    // profile flag is what actually decides access — same rule as the web app.
    if (!data || !data.is_active) return null;
    return data as SessionProfile;
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;

      setSession(data.session);
      if (data.session?.user) {
        setProfile(await loadProfile(data.session.user.id));
      }
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setProfile(nextSession?.user ? await loadProfile(nextSession.user.id) : null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      profile,
      isLoading,

      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          return {
            error:
              error.message === "Invalid login credentials"
                ? "Those credentials do not match an account."
                : error.message,
          };
        }

        if (data.user) {
          const nextProfile = await loadProfile(data.user.id);
          if (!nextProfile) {
            // Signed in successfully but the account is deactivated — sign back
            // out so the app never holds a session it cannot use.
            await supabase.auth.signOut();
            return { error: "This account has been deactivated. Contact your administrator." };
          }
          setProfile(nextProfile);
        }

        return { error: null };
      },

      async signOut() {
        await supabase.auth.signOut();
        setProfile(null);
      },

      async refreshProfile() {
        if (session?.user) setProfile(await loadProfile(session.user.id));
      },
    }),
    [session, profile, isLoading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside a SessionProvider.");
  return context;
}
