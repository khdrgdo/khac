import { motion } from "motion/react";
import { Trophy, Zap, ArrowUpRight, Award, Flame, Sparkles } from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface UserRankProgressCardProps {
  points: number;
  userRank: number;
  totalUsers: number;
  onOpenGuide: () => void;
}

export function UserRankProgressCard({
  points,
  userRank,
  totalUsers,
  onOpenGuide,
}: UserRankProgressCardProps) {
  // Rank threshold tiers:
  // Bronze: 0 - 99
  // Silver: 100 - 299
  // Gold: 300 - 699
  // Platinum: 700 - 1499
  // Diamond: 1500+

  let currentRankName = "البرونزية 🥉";
  let nextRankName = "الفضية 🥈";
  let minPoints = 0;
  let targetPoints = 100;

  if (points >= 1500) {
    currentRankName = "الماسية 💎";
    nextRankName = "القمة المطلقة ✨";
    minPoints = 1500;
    targetPoints = 1500;
  } else if (points >= 700) {
    currentRankName = "البلاتينية 💠";
    nextRankName = "الماسية 💎";
    minPoints = 700;
    targetPoints = 1500;
  } else if (points >= 300) {
    currentRankName = "الذهبية 🥇";
    nextRankName = "البلاتينية 💠";
    minPoints = 300;
    targetPoints = 700;
  } else if (points >= 100) {
    currentRankName = "الفضية 🥈";
    nextRankName = "الذهبية 🥇";
    minPoints = 100;
    targetPoints = 300;
  }

  const pointsInTier = points - minPoints;
  const rangeInTier = Math.max(1, targetPoints - minPoints);
  const progressPercent =
    points >= 1500
      ? 100
      : Math.min(100, Math.max(0, Math.round((pointsInTier / rangeInTier) * 100)));
  const pointsNeeded = Math.max(0, targetPoints - points);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 sm:p-5 shadow-sm dir-rtl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Status Overview */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center font-black text-xl shrink-0 shadow-xs">
            #{userRank || "-"}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-foreground">
                مركزك على لوحة الصدارة
              </h3>
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary border-none text-[10px]"
              >
                من أصل {totalUsers} طالب
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground font-medium">رتبتك الحالية:</span>
              <RankBadge points={points} className="text-xs" />
            </div>
          </div>
        </div>

        {/* Right Rank Upgrade Progress */}
        <div className="flex-1 max-w-xs space-y-1.5 sm:text-left">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span className="flex items-center gap-1 text-primary">
              <Zap className="w-3.5 h-3.5" />
              <span>الرتبة التالية: {nextRankName}</span>
            </span>
            <span className="font-mono text-muted-foreground">
              {points} / {targetPoints} نقطة
            </span>
          </div>

          <Progress value={progressPercent} className="h-2.5 rounded-full bg-primary/15" />

          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            {points >= 1500 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> وصلت لأعلى رتبة أكاديمية!
              </span>
            ) : (
              <span>
                متبقي <strong className="text-primary font-black">{pointsNeeded} نقطة</strong>{" "}
                للترقية
              </span>
            )}

            <button
              type="button"
              onClick={onOpenGuide}
              className="text-primary hover:underline text-[10px] font-bold flex items-center gap-0.5"
            >
              <span>كيف أجمع نقاط؟</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
