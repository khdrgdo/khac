import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { bindAccountToDevice } from "@/lib/deviceGuard";

import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "student" | "teacher" | "admin" | "sub_admin";
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
  if (points >= 1500) return "diamond";
  if (points >= 700) return "platinum";
  if (points >= 300) return "gold";
  if (points >= 100) return "silver";
  return "bronze";
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isAdmin: boolean;
  isMainAdmin: boolean;
  isSubAdmin: boolean;
  isTeacher: boolean;
  rank: RankTier;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  subAdminPermissions: SubAdminPermissions;
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
  const queryClient = useQueryClient();
  const [subAdminPermissions, setSubAdminPermissions] = useState<SubAdminPermissions>({
    can_warn: true,
    can_suspend: true,
    can_courses: true,
    can_reports: true,
    can_words: true,
    can_teachers: true,
  });
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadExtras(uid: string) {
      try {
        const [{ data: initialP }, { data: r }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        if (!mounted) return;

        let p = initialP;
        if (!p && sessionRef.current?.user) {
          const u = sessionRef.current.user;
          const meta = u.user_metadata;
          const tempUniv = "U" + Math.floor(100000 + Math.random() * 900000);
          const { data: createdP } = await supabase
            .from("profiles")
            .upsert({
              id: uid,
              full_name: meta?.full_name || meta?.name || "مستخدم جديد",
              university_number: tempUniv,
              email: u.email || null,
            })
            .select("*")
            .maybeSingle();

          if (createdP) p = createdP;
        }

        const parsedRoles = (r ?? []).map((x: { role: AppRole }) => x.role);
        setProfile((p as Profile | null) ?? null);
        setRoles(parsedRoles);

        // Fetch sub-admin permissions from DB table
        if ((parsedRoles.includes("sub_admin") || parsedRoles.includes("admin")) && uid) {
          const { data: permRow } = await supabase
            .from("subadmin_permissions")
            .select("*")
            .eq("user_id", uid)
            .maybeSingle();
          if (permRow) {
            setSubAdminPermissions({
              can_warn: permRow.can_warn !== false,
              can_suspend: permRow.can_suspend !== false,
              can_courses: permRow.can_courses !== false,
              can_reports: permRow.can_reports !== false,
              can_words: permRow.can_words !== false,
              can_teachers: permRow.can_teachers !== false,
            });
          } else {
            setSubAdminPermissions(getSubAdminPermissions(p as Profile));
          }
        }

        if (uid && sessionRef.current?.user?.email) {
          bindAccountToDevice(uid, sessionRef.current.user.email);
        }
      } catch (err) { /* ignore */ } finally {
        if (mounted) setLoading(false);
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (_e === "SIGNED_OUT") {
        queryClient.clear();
      }
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

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!mounted) return;
        sessionRef.current = s;
        setSession(s);
        setUser(s?.user ?? null);
        if (s) loadExtras(s.user.id);
        else setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const handlePrivacyChange = () => {
      if (sessionRef.current?.user?.id) {
        loadExtras(sessionRef.current.user.id);
      }
    };
    window.addEventListener("univ_privacy_changed", handlePrivacyChange);

    return () => {
      mounted = false;
      window.removeEventListener("univ_privacy_changed", handlePrivacyChange);
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    try {
      const uid = sessionRef.current?.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (p) {
        setProfile(p as Profile);
        // Refresh subadmin permissions from DB table
        if (roles.includes("sub_admin") || roles.includes("admin")) {
          const { data: permRow } = await supabase
            .from("subadmin_permissions")
            .select("*")
            .eq("user_id", uid)
            .maybeSingle();
          if (permRow) {
            setSubAdminPermissions({
              can_warn: permRow.can_warn !== false,
              can_suspend: permRow.can_suspend !== false,
              can_courses: permRow.can_courses !== false,
              can_reports: permRow.can_reports !== false,
              can_words: permRow.can_words !== false,
              can_teachers: permRow.can_teachers !== false,
            });
          } else {
            setSubAdminPermissions(getSubAdminPermissions(p as Profile));
          }
        }
      }
    } catch (err) { /* ignore */ }
  }, [roles]);

  // Main admin is determined ONLY by role in user_roles table
  const isMainAdmin = roles.includes("admin");

  // Sub-admin is determined ONLY by role in user_roles table
  const isSubAdmin = roles.includes("sub_admin" as AppRole);

  const isKnownAdminUser = isMainAdmin || isSubAdmin;

  const isAdmin = isKnownAdminUser;
  const isTeacher = roles.includes("teacher");
  const rank = profile ? computeRank(profile.points ?? 0) : "bronze";

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      roles,
      isAdmin,
      isMainAdmin,
      isSubAdmin,
      isTeacher,
      rank,
      loading,
      refreshProfile,
      subAdminPermissions,
    }),
    [
      session,
      user,
      profile,
      roles,
      isAdmin,
      isMainAdmin,
      isSubAdmin,
      isTeacher,
      rank,
      loading,
      refreshProfile,
      subAdminPermissions,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export interface SubAdminPermissions {
  can_warn: boolean;
  can_suspend: boolean;
  can_courses: boolean;
  can_reports: boolean;
  can_words: boolean;
  can_teachers: boolean;
  [key: string]: boolean;
}

const PERMS_PREFIX = "__PERMS__:";

export function getSubAdminPermissions(profile: Profile | null): SubAdminPermissions {
  const defaults: SubAdminPermissions = {
    can_warn: true,
    can_suspend: true,
    can_courses: true,
    can_reports: true,
    can_words: true,
    can_teachers: true,
  };
  if (!profile || !profile.bio) return defaults;
  try {
    const bio = profile.bio;
    if (bio.startsWith(PERMS_PREFIX)) {
      const jsonStr = bio.slice(PERMS_PREFIX.length);
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") {
        return {
          can_warn: parsed.can_warn !== false,
          can_suspend: parsed.can_suspend !== false,
          can_courses: parsed.can_courses !== false,
          can_reports: parsed.can_reports !== false,
          can_words: parsed.can_words !== false,
          can_teachers: parsed.can_teachers !== false,
        };
      }
    }
  } catch {
    // ignore parse errors
  }
  return defaults;
}

export function serializeSubAdminPermissions(perms: SubAdminPermissions): string {
  return PERMS_PREFIX + JSON.stringify(perms);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "useAuth() must be used within <AuthProvider>. It is mounted once in src/routes/__root.tsx — if you're seeing this, a component is being rendered outside the router tree.",
    );
  }
  return ctx;
}
