import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Trophy,
  Medal,
  Sparkles,
  Flame,
  Award,
  Crown,
  Share2,
  CheckCircle2,
  PartyPopper,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { majorLabel } from "@/lib/college";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface LeaderboardUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  points: number;
  major: string | null;
  year: number | null;
  university_number: string;
  verified: boolean;
  score: number;
  contributions: number;
}

interface CoronationPodiumProps {
  podium: LeaderboardUser[];
  timeframe: "all" | "month" | "week";
  onSelectUser?: (user: LeaderboardUser) => void;
}

export function RoyalCrown({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <div className="relative inline-flex items-center justify-center group/crown">
      {/* Outer ambient aura glow */}
      <div className="absolute -inset-3 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-full blur-md opacity-85 animate-pulse" />
      <svg
        viewBox="0 0 64 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "relative z-10 drop-shadow-[0_4px_16px_rgba(245,158,11,0.8)] transition-transform duration-300 group-hover/crown:scale-110",
          className,
        )}
      >
        <defs>
          <linearGradient
            id="gold-crown-grad"
            x1="0"
            y1="0"
            x2="64"
            y2="48"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="30%" stopColor="#FACC15" />
            <stop offset="70%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#A16207" />
          </linearGradient>
          <linearGradient id="gold-shine" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Crown Base Body */}
        <path
          d="M6 38L10 14L22 26L32 6L42 26L54 14L58 38H6Z"
          fill="url(#gold-crown-grad)"
          stroke="#78350F"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Inner Gloss */}
        <path
          d="M8 36L11 17L22 27L32 10L42 27L53 17L56 36H8Z"
          fill="url(#gold-shine)"
          opacity="0.45"
        />
        {/* Crown Rim Base */}
        <rect
          x="5"
          y="38"
          width="54"
          height="6"
          rx="2"
          fill="url(#gold-crown-grad)"
          stroke="#78350F"
          strokeWidth="1"
        />

        {/* Top Jewels */}
        <circle cx="10" cy="13" r="3.5" fill="#EF4444" stroke="#78350F" strokeWidth="0.8" />
        <circle cx="32" cy="5" r="4.5" fill="#3B82F6" stroke="#78350F" strokeWidth="1" />
        <circle cx="54" cy="13" r="3.5" fill="#EF4444" stroke="#78350F" strokeWidth="0.8" />

        {/* Rim Jewels */}
        <circle cx="18" cy="41" r="2" fill="#10B981" />
        <circle cx="32" cy="41" r="2.5" fill="#EC4899" />
        <circle cx="46" cy="41" r="2" fill="#10B981" />
      </svg>
    </div>
  );
}

export function CoronationPodium({ podium, timeframe }: CoronationPodiumProps) {
  if (!podium || podium.length === 0) return null;

  const champion = podium[0];
  const runnerUp = podium[1];
  const thirdPlace = podium[2];

  const handleShareBrag = (user: LeaderboardUser, rank: number) => {
    const rankTitle =
      rank === 1 ? "بطل الكلية 👑" : rank === 2 ? "وصيف الصدارة 🥈" : "فارس NEXUS 🥉";
    const text = `🏆 أنا في المركز #${rank} (${rankTitle}) على لوحة صدارة منصة NEXUS الأكاديمية برصيد ${user.score} نقطة! 🚀`;
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ بطاقة الإنجاز! يمكنك مشاركتها الآن 🎉");
  };

  return (
    <div className="relative my-6 dir-rtl">
      {/* Section Title */}
      <div className="flex items-center justify-between px-1 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xs">
            <Crown className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
              <span>منصة التتويج الثلاثية</span>
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono">
                {timeframe === "all"
                  ? "الأفضل تاريخياً"
                  : timeframe === "month"
                    ? "أبطال الشهر"
                    : "فرسان الأسبوع"}
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              NEXUS الشرفية للطلاب الأوائل على مستوى الكلية
            </p>
          </div>
        </div>
      </div>

      {/* 3-STEP PHYSICAL PODIUM STAGE */}
      <div className="relative pt-12 pb-2 px-2 max-w-2xl mx-auto">
        {/* Background Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end relative z-10">
          {/* ================= SECOND PLACE (#2 SILVER) - LEFT/RIGHT STEP ================= */}
          {runnerUp ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center"
            >
              {/* User Standing On Podium Step */}
              <div className="flex flex-col items-center text-center mb-3 group/user">
                <Link
                  to="/profile/$id"
                  params={{ id: runnerUp.id }}
                  className="relative group/avatar cursor-pointer mb-2"
                >
                  <UserAvatar
                    avatarUrl={runnerUp.avatar_url}
                    fullName={runnerUp.full_name}
                    className="w-16 h-16 sm:w-20 sm:h-20 ring-4 ring-slate-300 dark:ring-slate-600 group-hover/avatar:ring-slate-400 transition-all duration-300 shadow-lg"
                  />
                  <div className="absolute -bottom-2.5 right-1/2 translate-x-1/2 bg-slate-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow border border-slate-300 dark:border-slate-800 whitespace-nowrap">
                    وصيف الصدارة
                  </div>
                </Link>

                <Link
                  to="/profile/$id"
                  params={{ id: runnerUp.id }}
                  className="font-extrabold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 max-w-[110px] sm:max-w-[140px] mt-1"
                >
                  {runnerUp.full_name}
                </Link>
                <span className="text-[11px] text-muted-foreground font-medium line-clamp-1">
                  {majorLabel(runnerUp.major)}
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleShareBrag(runnerUp, 2)}
                  className="h-6 text-[10px] gap-1 mt-1 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 dark:text-slate-300"
                >
                  <Share2 className="w-3 h-3" />
                  <span>مشاركة</span>
                </Button>
              </div>

              {/* Physical Podium Block Step #2 */}
              <div className="w-full bg-gradient-to-b from-slate-200 via-slate-300/80 to-slate-400/90 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 border-t-4 border-slate-300 dark:border-slate-600 rounded-t-2xl h-28 sm:h-32 flex flex-col justify-center items-center shadow-lg shadow-slate-900/10 relative overflow-hidden group">
                <div className="absolute top-2 right-2 opacity-10">
                  <Medal className="w-12 h-12 text-slate-400" />
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-400 dark:bg-slate-700 text-slate-900 dark:text-slate-100 flex items-center justify-center font-black text-sm shadow-md mb-1 border border-slate-200/50">
                  2
                </div>

                <div className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200 font-mono">
                  {runnerUp.score}
                </div>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                  نقطة أكاديمية
                </span>
              </div>
            </motion.div>
          ) : (
            <div />
          )}

          {/* ================= CHAMPION (#1 GOLD) - CENTER TALLEST STEP ================= */}
          {champion ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              {/* User Standing On Podium Step */}
              <div className="flex flex-col items-center text-center mb-3 group/user relative z-20">
                {/* MAGNIFICENT CUSTOM ROYAL CROWN ATOP AVATAR */}
                <div className="mb-[-12px] z-30 animate-bounce">
                  <RoyalCrown className="w-12 h-12 sm:w-16 sm:h-16" />
                </div>

                <Link
                  to="/profile/$id"
                  params={{ id: champion.id }}
                  className="relative group/avatar cursor-pointer mb-2"
                >
                  <div className="absolute -inset-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-full blur-sm opacity-80 group-hover/avatar:opacity-100 transition animate-pulse" />
                  <UserAvatar
                    avatarUrl={champion.avatar_url}
                    fullName={champion.full_name}
                    className="w-20 h-20 sm:w-24 sm:h-24 ring-4 ring-amber-400 group-hover/avatar:ring-amber-300 transition-all duration-300 shadow-xl relative z-10"
                  />
                  <div className="absolute -bottom-3 right-1/2 translate-x-1/2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 font-black text-[11px] sm:text-xs px-3 py-0.5 rounded-full shadow-lg border border-yellow-200 z-20 flex items-center gap-1 whitespace-nowrap">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>بطل NEXUS الأكاديمية</span>
                  </div>
                </Link>

                <Link
                  to="/profile/$id"
                  params={{ id: champion.id }}
                  className="font-black text-sm sm:text-base text-foreground hover:text-amber-500 transition-colors line-clamp-1 max-w-[130px] sm:max-w-[160px] mt-2"
                >
                  {champion.full_name}
                </Link>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold line-clamp-1">
                  {majorLabel(champion.major)}
                </span>

                <Button
                  size="sm"
                  onClick={() => handleShareBrag(champion, 1)}
                  className="h-6 text-[10px] gap-1 mt-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold shadow-sm"
                >
                  <PartyPopper className="w-3 h-3" />
                  <span>تهنئة البطل</span>
                </Button>
              </div>

              {/* Physical Podium Block Step #1 (TALLEST STEP) */}
              <div className="w-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 dark:from-amber-600 dark:via-amber-800 dark:to-amber-950 border-t-4 border-yellow-300 dark:border-amber-400 rounded-t-2xl h-36 sm:h-44 flex flex-col justify-center items-center shadow-2xl shadow-amber-500/20 relative overflow-hidden ring-2 ring-amber-400/30">
                {/* Background Sparkles */}
                <div className="absolute top-2 left-2 opacity-20">
                  <Trophy className="w-16 h-16 text-yellow-200 animate-pulse" />
                </div>

                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-200 to-amber-400 text-slate-950 flex items-center justify-center font-black text-base shadow-xl mb-1.5 border-2 border-white">
                  1
                </div>

                <div className="text-lg sm:text-2xl font-black text-slate-950 dark:text-amber-100 font-mono flex items-center gap-1">
                  <span>{champion.score}</span>
                  <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400 animate-pulse" />
                </div>
                <span className="text-[11px] text-slate-900 dark:text-amber-200/90 font-black">
                  نقطة أكاديمية
                </span>
              </div>
            </motion.div>
          ) : (
            <div />
          )}

          {/* ================= THIRD PLACE (#3 BRONZE) - RIGHT/LEFT STEP ================= */}
          {thirdPlace ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col items-center"
            >
              {/* User Standing On Podium Step */}
              <div className="flex flex-col items-center text-center mb-3 group/user">
                <Link
                  to="/profile/$id"
                  params={{ id: thirdPlace.id }}
                  className="relative group/avatar cursor-pointer mb-2"
                >
                  <UserAvatar
                    avatarUrl={thirdPlace.avatar_url}
                    fullName={thirdPlace.full_name}
                    className="w-16 h-16 sm:w-20 sm:h-20 ring-4 ring-amber-700/50 group-hover/avatar:ring-amber-600 transition-all duration-300 shadow-lg"
                  />
                  <div className="absolute -bottom-2.5 right-1/2 translate-x-1/2 bg-amber-800 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow border border-amber-600 whitespace-nowrap">
                    فرسان NEXUS
                  </div>
                </Link>

                <Link
                  to="/profile/$id"
                  params={{ id: thirdPlace.id }}
                  className="font-extrabold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 max-w-[110px] sm:max-w-[140px] mt-1"
                >
                  {thirdPlace.full_name}
                </Link>
                <span className="text-[11px] text-muted-foreground font-medium line-clamp-1">
                  {majorLabel(thirdPlace.major)}
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleShareBrag(thirdPlace, 3)}
                  className="h-6 text-[10px] gap-1 mt-1 rounded-lg bg-amber-800/10 hover:bg-amber-800/20 text-amber-800 dark:text-amber-300"
                >
                  <Share2 className="w-3 h-3" />
                  <span>مشاركة</span>
                </Button>
              </div>

              {/* Physical Podium Block Step #3 */}
              <div className="w-full bg-gradient-to-b from-amber-700/90 via-amber-800 to-amber-950 dark:from-amber-900 dark:via-amber-950 dark:to-slate-950 border-t-4 border-amber-600 rounded-t-2xl h-24 sm:h-28 flex flex-col justify-center items-center shadow-lg relative overflow-hidden group">
                <div className="absolute top-2 left-2 opacity-15">
                  <Medal className="w-12 h-12 text-amber-500" />
                </div>

                <div className="w-8 h-8 rounded-full bg-amber-800 text-amber-100 flex items-center justify-center font-black text-sm shadow-md mb-1 border border-amber-600">
                  3
                </div>

                <div className="text-sm sm:text-base font-black text-amber-200 dark:text-amber-300 font-mono">
                  {thirdPlace.score}
                </div>
                <span className="text-[10px] text-amber-300/80 font-semibold">نقطة أكاديمية</span>
              </div>
            </motion.div>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
