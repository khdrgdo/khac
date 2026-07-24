// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export async function isUnivNumberHidden(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("hide_university_number")
      .eq("id", userId)
      .single();
    return !!data?.hide_university_number;
  } catch {
    return false;
  }
}

export async function setUnivNumberHidden(userId: string, hidden: boolean): Promise<void> {
  if (!userId) return;
  try {
    await (supabase as any)
      .from("profiles")
      .update({ hide_university_number: hidden })
      .eq("id", userId);
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
