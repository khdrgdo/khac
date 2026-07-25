export type CardThemeId = "stars" | "clouds" | "moon" | "sun" | "galaxy";

export interface CardThemeConfig {
  id: CardThemeId;
  name: string;
  icon: string;
  minPoints: number;
  rankName: string;
  desc: string;
  badgeBg: string;
  accentBorder: string;
  cardBg: string;
  glowEffect: string;
  avatarRing: string;
}

export const CARD_THEMES: CardThemeConfig[] = [
  {
    id: "stars",
    name: "النجوم المضيئة",
    icon: "🌟",
    minPoints: 0,
    rankName: "المبتدئ (0+ نقطة)",
    desc: "سماء ليلية مرصعة بالنجوم المضيئة والأبراج اللامعة",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-400/40",
    accentBorder: "border-amber-400/50",
    cardBg: "from-slate-950 via-indigo-950 to-slate-900",
    glowEffect: "shadow-[0_0_20px_rgba(251,191,36,0.25)]",
    avatarRing: "ring-4 ring-amber-400/80 shadow-[0_0_15px_rgba(251,191,36,0.5)]",
  },
  {
    id: "clouds",
    name: "السحاب الهادئ",
    icon: "☁️",
    minPoints: 100,
    rankName: "الفضي (100+ نقطة)",
    desc: "أمواج سحابية فضية مع إطار سماوي أثيري ناعم",
    badgeBg: "bg-sky-500/20 text-sky-300 border-sky-400/40",
    accentBorder: "border-sky-400/50",
    cardBg: "from-sky-950 via-cyan-950 to-slate-900",
    glowEffect: "shadow-[0_0_25px_rgba(56,189,248,0.3)]",
    avatarRing: "ring-4 ring-cyan-300 shadow-[0_0_20px_rgba(103,232,249,0.5)]",
  },
  {
    id: "moon",
    name: "القمر والكسوف",
    icon: "🌙",
    minPoints: 300,
    rankName: "الذهبي (300+ نقطة)",
    desc: "هالة قمرية ساحرة وتوهج فضي أرجواني ساطع",
    badgeBg: "bg-purple-500/20 text-purple-300 border-purple-400/40",
    accentBorder: "border-purple-400/60",
    cardBg: "from-slate-950 via-purple-950 to-indigo-950",
    glowEffect: "shadow-[0_0_30px_rgba(192,132,252,0.35)]",
    avatarRing: "ring-4 ring-purple-300 shadow-[0_0_25px_rgba(192,132,252,0.6)]",
  },
  {
    id: "sun",
    name: "الشمس والوهج الشمسي",
    icon: "☀️",
    minPoints: 700,
    rankName: "البلاتيني (700+ نقطة)",
    desc: "إشعاع شمسي ووهج ناري ذهبي ملكي يمنح هيبة فائقة",
    badgeBg: "bg-orange-500/20 text-orange-300 border-orange-400/40",
    accentBorder: "border-amber-500/70",
    cardBg: "from-amber-950 via-orange-950 to-slate-950",
    glowEffect: "shadow-[0_0_35px_rgba(245,158,11,0.4)]",
    avatarRing: "ring-4 ring-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.7)]",
  },
  {
    id: "galaxy",
    name: "السديم الفضائي والأسطورة",
    icon: "🌌",
    minPoints: 1500,
    rankName: "الماسي (1500+ نقطة)",
    desc: "سديم مجرة أسطوري مع صواعق فضائية وهالة نجمية متحركة",
    badgeBg: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/50",
    accentBorder: "border-fuchsia-500/80",
    cardBg: "from-purple-950 via-fuchsia-950 to-slate-950",
    glowEffect: "shadow-[0_0_40px_rgba(217,70,239,0.5)]",
    avatarRing: "ring-4 ring-fuchsia-400 shadow-[0_0_35px_rgba(217,70,239,0.8)]",
  },
];

export function getDefaultThemeForPoints(points: number): CardThemeId {
  if (points >= 1500) return "galaxy";
  if (points >= 700) return "sun";
  if (points >= 300) return "moon";
  if (points >= 100) return "clouds";
  return "stars";
}
