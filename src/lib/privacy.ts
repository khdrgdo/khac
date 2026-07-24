import { supabase } from "@/integrations/supabase/client";

export async function isUnivNumberHidden(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  try {
    // First try DB
    let isHidden = false;
    const { data, error } = await (supabase as unknown as Record<string, unknown>)
      .from("profiles")
      .select("hide_university_number")
      .eq("id", userId)
      .single();

    if (!error && data) {
      isHidden = !!data.hide_university_number;
    } else {
      // Fallback to user metadata
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && user.id === userId) {
        isHidden = !!user.user_metadata?.hide_university_number;
      }
    }
    return isHidden;

    return !!data?.hide_university_number;
  } catch {
    return false;
  }
}

export async function setUnivNumberHidden(userId: string, hidden: boolean): Promise<void> {
  if (!userId) return;
  try {
    const { error } = await (supabase as unknown as Record<string, unknown>)
      .from("profiles")
      .update({ hide_university_number: hidden })
      .eq("id", userId);

    if (error) {
      // Fallback to auth metadata if DB column doesn't exist
      await supabase.auth.updateUser({
        data: { hide_university_number: hidden },
      });
    }
    window.dispatchEvent(new Event("univ_privacy_changed"));
  } catch (err) {
    console.error(err);
  }
}

export function formatUnivNumber(
  universityNumber: string | null | undefined,
  userId?: string | null | undefined,
  forceHidden: boolean = false,
): string {
  if (!universityNumber) return "";
  if (forceHidden || universityNumber === "••••••••••") {
    return "••••••••••";
  }
  return universityNumber;
}
