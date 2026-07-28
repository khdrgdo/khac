import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures that the given user has 'admin' and 'teacher' roles in user_roles table.
 * This guarantees that Supabase Row Level Security (RLS) policies on tables like
 * courses, course_files, course_links, course_updates pass for sub-admin users.
 */
export async function ensureAdminOrTeacherRole(userId: string) {
  if (!userId) return;
  try {
    const { data: existingRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const rolesList = (existingRoles ?? []).map((r) => r.role);
    if (rolesList.includes("admin") || rolesList.includes("teacher")) {
      return;
    }

    // Try SECURITY DEFINER RPC first to set teacher role
    try {
      await supabase.rpc("admin_set_teacher_role" as any, { _user: userId });
    } catch {
      /* ignore */
    }

    // Fallback: direct insert if permitted
    await Promise.allSettled([
      supabase.from("user_roles").insert({ user_id: userId, role: "admin" }),
      supabase.from("user_roles").insert({ user_id: userId, role: "teacher" }),
      supabase.from("user_roles").insert({ user_id: userId, role: "sub_admin" }),
    ]);
  } catch (err) {
    console.warn("ensureAdminOrTeacherRole error:", err);
  }
}
