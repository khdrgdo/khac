export const MAJORS = [
  { code: "it", label: "تقنية المعلومات (IT)" },
  { code: "is", label: "نظم المعلومات (IS)" },
  { code: "se", label: "هندسة البرمجيات (SE)" },
] as const;

export const YEARS = [1, 2, 3, 4] as const;
export const SEMESTERS = [1, 2] as const;

export const REACTIONS = [
  { type: "like", emoji: "👍", label: "إعجاب" },
  { type: "love", emoji: "❤️", label: "حب" },
  { type: "haha", emoji: "😂", label: "هه" },
  { type: "wow", emoji: "😮", label: "واو" },
  { type: "sad", emoji: "😢", label: "حزن" },
] as const;

export type ReactionType = (typeof REACTIONS)[number]["type"];

export function majorLabel(code: string | null | undefined) {
  return MAJORS.find((m) => m.code === code)?.label ?? "—";
}

// Convert a university number into a synthetic email used only inside auth.
export function universityNumberToEmail(num: string) {
  return `${num.trim()}@college.edu`;
}

export function emailToUniversityNumber(email: string | null | undefined) {
  if (!email) return "";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}
