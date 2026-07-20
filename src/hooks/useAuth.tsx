import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "student" | "teacher" | "admin";
export type RankTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface Profile {
  id: string;
  university_number: string;
  full_name: string;
  major: "it" | "is" | "se" | null;
  year: number | null;
  avatar_url: string | null;
  bio: string | null;
  must_change_password: boolean;
  points: number;
  email: string | null;
  warning_count: number;
  suspended_until: string | null;
  banned: boolean;
}

export function isSuspended(p: Profile | null): boolean {
  if (!p) return false;
  if (p.banned) return true;
  if (p.suspended_until && new Date(p.suspended_until) > new Date()) return true;
  return false;
}

export function computeRank(points: number): RankTier {
  if (points >= 1000) return "diamond";
  if (points >= 400) return "platinum";
  if (points >= 150) return "gold";
  if (points >= 50) return "silver";
  return "bronze";
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isTeacher: boolean;
  rank: RankTier;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Single source of truth for auth/profile state, subscribed once at the app
// root. Every component reads from this same context instead of running its
// own independent Supabase subscription + profile fetch (previously each of
// the ~15 call sites of useAuth() held its own disconnected state, which is
// what caused stale-profile bugs like the complete-profile redirect loop).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadExtras(uid: string) {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (!mounted) return;
      setProfile((p as Profile | null) ?? null);
      setRoles((r ?? []).map((x: { role: AppRole }) => x.role));
      setLoading(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
      sessionRef.current = s;
      setSession(s);
      setUser(s?.user ?? null);
      if (!s) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      } else {
        setTimeout(() => loadExtras(s.user.id), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      sessionRef.current = s;
      setSession(s);
      setUser(s?.user ?? null);
      if (s) loadExtras(s.user.id);
      else setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    const uid = sessionRef.current?.user?.id;
    if (!uid) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (p) setProfile(p as Profile);
  }

  const isAdmin = roles.includes("admin");
  const isTeacher = roles.includes("teacher");
  const rank = profile ? computeRank(profile.points ?? 0) : "bronze";

  const value: AuthContextValue = {
    session, user, profile, roles, isAdmin, isTeacher, rank, loading, refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() must be used within <AuthProvider>. It is mounted once in src/routes/__root.tsx — if you're seeing this, a component is being rendered outside the router tree.");
  }
  return ctx;
}
