import { supabase } from "@/integrations/supabase/client";

export async function isUnivNumberHidden(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("university_number")
      .eq("id", userId)
      .single();

    return data?.university_number?.startsWith("HIDDEN_") || false;
  } catch {
    return false;
  }
}

export async function setUnivNumberHidden(userId: string, hidden: boolean): Promise<void> {
  if (!userId) return;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("university_number")
      .eq("id", userId)
      .single();

    if (!data) return;

    const current = data.university_number || "";
    if (hidden && !current.startsWith("HIDDEN_")) {
      await supabase
        .from("profiles")
        .update({ university_number: "HIDDEN_" + current })
        .eq("id", userId);
    } else if (!hidden && current.startsWith("HIDDEN_")) {
      await supabase
        .from("profiles")
        .update({ university_number: current.replace("HIDDEN_", "") })
        .eq("id", userId);
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
  isAdmin: boolean = false,
): string {
  if (!universityNumber) return "";

  if (universityNumber.startsWith("HIDDEN_")) {
    if (isAdmin) {
      return universityNumber.replace("HIDDEN_", "") + " (مخفي)";
    }
    return "••••••••••";
  }

  if (forceHidden || universityNumber === "••••••••••") {
    return "••••••••••";
  }
  return universityNumber;
}
