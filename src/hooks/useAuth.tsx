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

        // Fetch sub-admin permissions if they are a sub-admin
        const isUserSubAdmin =
          parsedRoles.includes("sub_admin") ||
          p?.university_number?.startsWith("sub_") ||
          p?.email?.endsWith("@subadmin.edu");

        if (isUserSubAdmin && uid) {
          setSubAdminPermissions(getSubAdminPermissions(p as Profile));
        }

        if (uid && sessionRef.current?.user?.email) {
          bindAccountToDevice(uid, sessionRef.current.user.email);
        }
      } catch (err) {
        console.error("Failed to load user profile extras:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (_e === "SIGNED_IN") {
        await queryClient.invalidateQueries();
      } else if (_e === "SIGNED_OUT") {
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
      .catch((err) => {
        console.error("Failed to get session:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
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
        // Refresh subadmin permissions as well if applicable
        if (
          roles.includes("sub_admin") ||
          p.university_number?.startsWith("sub_") ||
          p.email?.endsWith("@subadmin.edu")
        ) {
          setSubAdminPermissions(getSubAdminPermissions(p as Profile));
        }
      }
    } catch (err) {
      console.warn("Failed to refresh profile:", err);
    }
  }, [roles]);

  const isMainAdmin =
    profile?.university_number === "2011099840" ||
    profile?.email?.toLowerCase() === "khdrmamon@gmail.com" ||
    user?.email?.toLowerCase() === "khdrmamon@gmail.com";

  const isSubAdmin =
    roles.includes("sub_admin" as AppRole) ||
    (profile?.university_number
      ? profile.university_number.startsWith("SUBADMIN_") ||
        profile.university_number.toLowerCase().includes("guard")
      : false) ||
    (profile?.email ? profile.email.toLowerCase().includes("@subadmin.") : false) ||
    (user?.email ? user.email.toLowerCase().includes("@subadmin.") : false) ||
    (profile?.full_name ? profile.full_name.toLowerCase().includes("guard") : false);

  const isKnownAdminUser =
    isMainAdmin ||
    isSubAdmin ||
    roles.includes("admin") ||
    (profile?.email ? profile.email.toLowerCase().includes("admin") : false) ||
    (user?.email ? user.email.toLowerCase().includes("admin") : false) ||
    (profile?.full_name
      ? profile.full_name.toLowerCase().includes("أدمن") ||
        profile.full_name.toLowerCase().includes("ادمن") ||
        profile.full_name.toLowerCase().includes("admin") ||
        profile.full_name.toLowerCase().includes("مدير")
      : false);

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
    if (profile.bio.trim().startsWith("{")) {
      const parsed = JSON.parse(profile.bio);
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
  } catch (e) {
    // ignore
  }
  return defaults;
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
