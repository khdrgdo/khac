import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "student" | "teacher" | "admin";

export interface Profile {
  id: string;
  university_number: string;
  full_name: string;
  major: "it" | "is" | "se" | null;
  year: number | null;
  avatar_url: string | null;
  bio: string | null;
  must_change_password: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!mounted) return;
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
      setSession(s);
      setUser(s?.user ?? null);
      if (s) loadExtras(s.user.id);
      else setLoading(false);
    });

    async function loadExtras(uid: string) {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (!mounted) return;
      setProfile(p as Profile | null);
      setRoles((r ?? []).map((x: { role: AppRole }) => x.role));
      setLoading(false);
    }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.includes("admin");
  const isTeacher = roles.includes("teacher");

  return { session, user, profile, roles, isAdmin, isTeacher, loading };
}
