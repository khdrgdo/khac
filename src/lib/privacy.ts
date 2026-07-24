import { supabase } from "@/integrations/supabase/client";

export async function isUnivNumberHidden(userId: string | undefined | null): Promise<boolean> {
  if (!userId) return false;

  if (typeof window !== "undefined") {
    const localVal = localStorage.getItem("unihub_univ_hidden_" + userId);
    if (localVal === "true") return true;
    if (localVal === "false") return false;
  }

  try {
    const { data } = await supabase
      .from("profiles")
      .select("hide_university_number, university_number")
      .eq("id", userId)
      .single();

    const isHiddenInDb =
      data?.hide_university_number || data?.university_number?.startsWith("HIDDEN_") || false;
    if (typeof window !== "undefined") {
      localStorage.setItem("unihub_univ_hidden_" + userId, isHiddenInDb ? "true" : "false");
    }
    return isHiddenInDb;
  } catch {
    return false;
  }
}

export async function setUnivNumberHidden(userId: string, hidden: boolean): Promise<void> {
  if (!userId) return;

  if (typeof window !== "undefined") {
    localStorage.setItem("unihub_univ_hidden_" + userId, hidden ? "true" : "false");
  }

  try {
    const { data } = await supabase
      .from("profiles")
      .select("university_number")
      .eq("id", userId)
      .single();

    if (data) {
      const current = data.university_number || "";
      const clean = current.replace("HIDDEN_", "");
      
      // Update boolean flag and clean corrupted university_number if it contained HIDDEN_
      await supabase
        .from("profiles")
        .update({ 
          hide_university_number: hidden,
          university_number: clean
        })
        .eq("id", userId);
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("univ_privacy_changed", { detail: { userId, hidden } }),
      );
    }
  }
}

export function formatUnivNumber(
  universityNumber: string | null | undefined,
  userId?: string | null | undefined,
  forceHidden: boolean = false,
  isAdmin: boolean = false,
): string {
  if (!universityNumber) return "";

  const cleanNumber = universityNumber.replace("HIDDEN_", "");
  let isHidden = universityNumber.startsWith("HIDDEN_") || forceHidden;

  if (userId && typeof window !== "undefined") {
    const localVal = localStorage.getItem("unihub_univ_hidden_" + userId);
    if (localVal === "true") {
      isHidden = true;
    } else if (localVal === "false" && !universityNumber.startsWith("HIDDEN_")) {
      isHidden = false;
    }
  }

  if (isHidden) {
    if (isAdmin) {
      return cleanNumber + " (مخفي)";
    }
    return "••••••••••";
  }

  return cleanNumber;
}
