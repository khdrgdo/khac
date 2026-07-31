import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Badge as BadgeType } from "lucide-react";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type AdminActionRow = Database["public"]["Tables"]["admin_actions"]["Row"];
export type UserWarningRow = Database["public"]["Tables"]["user_warnings"]["Row"];

export interface LastActivityMap {
  [userId: string]: string;
}

export function userStatus(
  u: Pick<ProfileRow, "banned" | "suspended_until">,
): "banned" | "suspended" | "active" {
  if (u.banned) return "banned";
  if (u.suspended_until && new Date(u.suspended_until) > new Date()) return "suspended";
  return "active";
}

export function StatusBadge({ status }: { status: "banned" | "suspended" | "active" }) {
  if (status === "banned") return <Badge variant="destructive">محظور</Badge>;
  if (status === "suspended")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
        موقوف
      </Badge>
    );
  return (
    <Badge
      variant="secondary"
      className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
    >
      نشط
    </Badge>
  );
}

export function useSubAdminRestrictions() {
  const { profile, isSubAdmin } = useAuth();
  const currentUserId = profile?.id;

  const selfBan = useMutation({
    mutationFn: async () => {
      if (!currentUserId) return;
      const { error } = await supabase.rpc("admin_ban", {
        _user: currentUserId,
        _reason: "محاولة التعديل على حساب الأدمن الرسمي",
      });
      if (error) {
        await supabase
          .from("profiles")
          .update({ banned: true, bio: "محظور تلقائياً لمحاولة التعديل على حساب الأدمن الرسمي" })
          .eq("id", currentUserId);
      }
      await supabase.auth.signOut();
      window.location.reload();
    },
  });

  function isTargetMainAdmin(u: { university_number: string; email?: string | null }) {
    return u.university_number === "2011099840" || u.university_number === "HIDDEN_2011099840" || u.email?.toLowerCase() === "khdrmamon@gmail.com";
  }

  async function handleActionCheck(target: { university_number: string; email?: string | null }) {
    if (isSubAdmin && isTargetMainAdmin(target)) {
      toast.error(
        "⚠️ محاولة محظورة! تم رصد محاولة تعديل على حساب الأدمن الرسمي. سيتم حظر حسابك وتسجيل خروجك فوراً.",
      );
      await selfBan.mutateAsync();
      throw new Error("Violation: Sub-admin tried to modify main admin");
    }
  }

  return { handleActionCheck, isSubAdmin };
}
