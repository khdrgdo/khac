import { RANKS } from "@/lib/ranks";
import { computeRank, type RankTier } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function RankBadge({
  points,
  tier,
  size = "sm",
}: {
  points?: number;
  tier?: RankTier;
  size?: "sm" | "xs";
}) {
  const t = tier ?? computeRank(points ?? 0);
  const r = RANKS[t];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        r.color,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
      )}
    >
      <span>{r.emoji}</span>
      {r.label}
      {typeof points === "number" && <span className="opacity-70">· {points}</span>}
    </span>
  );
}
