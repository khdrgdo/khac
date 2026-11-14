export type CardThemeId = "stars" | "clouds" | "moon" | "sun" | "galaxy";
export interface CardThemeConfig {
  id: CardThemeId; name: string; icon: string; minPoints: number; rankName: string; desc: string;
  imageUrl: string; imagePosition: string; overlay: string; badgeBg: string; accentBorder: string;
  cardBg: string; glowEffect: string; avatarRing: string;
}
export const CARD_THEMES: CardThemeConfig[] = [
  { id:"stars", name:"المدار الليلي", icon:"01", minPoints:0, rankName:"المبتدئ", desc:"سماء ليلية حقيقية فوق سلسلة جبلية", imageUrl:"https://images.unsplash.com/photo-1522124624696-7ea32eb9592c?auto=format&fit=crop&w=1400&q=82", imagePosition:"center 52%", overlay:"from-slate-950/20 via-slate-950/45 to-slate-950/95", badgeBg:"bg-white/10 text-white border-white/25", accentBorder:"border-white/25", cardBg:"from-slate-950 to-slate-900", glowEffect:"shadow-md", avatarRing:"ring-2 ring-amber-100/80 " },
  { id:"clouds", name:"السحب الفضية", icon:"02", minPoints:100, rankName:"الفضي", desc:"سحب غروب كثيفة بطبقات ضوئية", imageUrl:"https://images.unsplash.com/photo-1627668354740-85b334441b5e?auto=format&fit=crop&w=1400&q=82", imagePosition:"center 48%", overlay:"from-slate-950/15 via-slate-900/45 to-slate-950/95", badgeBg:"bg-sky-200/15 text-sky-100 border-sky-100/30", accentBorder:"border-sky-100/30", cardBg:"from-sky-950 to-slate-950", glowEffect:"shadow-md", avatarRing:"ring-2 ring-sky-100/80 " },
  { id:"moon", name:"الخسوف", icon:"03", minPoints:300, rankName:"الذهبي", desc:"قمر مكتمل فوق الأفق", imageUrl:"https://images.unsplash.com/photo-1606373924807-8a1d7bf1bf31?auto=format&fit=crop&w=1400&q=82", imagePosition:"center 46%", overlay:"from-slate-950/15 via-slate-950/35 to-slate-950/95", badgeBg:"bg-orange-100/15 text-orange-100 border-orange-100/30", accentBorder:"border-orange-100/30", cardBg:"from-slate-950 to-indigo-950", glowEffect:"shadow-md", avatarRing:"ring-2 ring-orange-100/80 " },
  { id:"sun", name:"الشروق", icon:"04", minPoints:700, rankName:"البلاتيني", desc:"كثبان ذهبية عند أول ضوء", imageUrl:"https://images.unsplash.com/photo-1647289491458-2803fbc4499c?auto=format&fit=crop&w=1400&q=82", imagePosition:"center 55%", overlay:"from-amber-950/10 via-amber-950/35 to-slate-950/95", badgeBg:"bg-amber-100/15 text-amber-100 border-amber-100/30", accentBorder:"border-amber-100/35", cardBg:"from-amber-950 to-slate-950", glowEffect:"shadow-md", avatarRing:"ring-2 ring-amber-100/80 " },
  { id:"galaxy", name:"السديم", icon:"05", minPoints:1500, rankName:"الماسي", desc:"سماء درب التبانة فوق خط جبلي", imageUrl:"https://images.unsplash.com/photo-1659413151520-bbc015ee3472?auto=format&fit=crop&w=1400&q=82", imagePosition:"center 50%", overlay:"from-slate-950/10 via-indigo-950/45 to-slate-950/95", badgeBg:"bg-indigo-100/15 text-indigo-100 border-indigo-100/30", accentBorder:"border-indigo-100/35", cardBg:"from-indigo-950 to-slate-950", glowEffect:"shadow-md", avatarRing:"ring-2 ring-indigo-100/80 " },
];
export function getDefaultThemeForPoints(points: number): CardThemeId {
  if (points >= 1500) return "galaxy";
  if (points >= 700) return "sun";
  if (points >= 300) return "moon";
  if (points >= 100) return "clouds";
  return "stars";
}
