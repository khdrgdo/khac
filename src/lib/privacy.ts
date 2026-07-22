export function isUnivNumberHidden(userId: string | undefined | null): boolean {
  if (!userId) return false;
  return localStorage.getItem(`hide_univ_num_${userId}`) === "true";
}

export function setUnivNumberHidden(userId: string, hidden: boolean): void {
  localStorage.setItem(`hide_univ_num_${userId}`, hidden ? "true" : "false");
  window.dispatchEvent(new Event("univ_privacy_changed"));
}

export function formatUnivNumber(
  universityNumber: string | null | undefined,
  userId: string | null | undefined,
): string {
  if (!universityNumber) return "";
  if (isUnivNumberHidden(userId)) {
    return "••••••••••";
  }
  return universityNumber;
}
