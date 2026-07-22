import type { RankTier } from "@/hooks/useAuth";

export const RANKS: Record<RankTier, { label: string; emoji: string; color: string; min: number }> =
  {
    bronze: {
      label: "برونزي",
      emoji: "🥉",
      color: "bg-amber-700/15 text-amber-700 border-amber-700/30",
      min: 0,
    },
    silver: {
      label: "فضي",
      emoji: "🥈",
      color: "bg-slate-400/15 text-slate-500 border-slate-400/30",
      min: 100,
    },
    gold: {
      label: "ذهبي",
      emoji: "🥇",
      color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
      min: 300,
    },
    platinum: {
      label: "بلاتيني",
      emoji: "💠",
      color: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
      min: 700,
    },
    diamond: {
      label: "ماسي",
      emoji: "💎",
      color: "bg-fuchsia-500/15 text-fuchsia-600 border-fuchsia-500/30",
      min: 1500,
    },
  };

export function nextRankProgress(points: number): {
  next: RankTier | null;
  remaining: number;
  pct: number;
} {
  const order: RankTier[] = ["bronze", "silver", "gold", "platinum", "diamond"];
  for (let i = 0; i < order.length; i++) {
    if (points < RANKS[order[i]].min) {
      const prev = i > 0 ? RANKS[order[i - 1]].min : 0;
      const target = RANKS[order[i]].min;
      return {
        next: order[i],
        remaining: target - points,
        pct: ((points - prev) / (target - prev)) * 100,
      };
    }
  }
  return { next: null, remaining: 0, pct: 100 };
}
