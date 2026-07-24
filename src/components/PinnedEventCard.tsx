import { useState, useEffect } from "react";
import { usePinnedCard, PinnedCardTheme, PinnedCardType } from "@/lib/pinnedCardStore";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Sparkles,
  BarChart3,
  Calendar,
  Megaphone,
  Clock,
  CheckCircle2,
  Users,
  EyeOff,
  Eye,
  Settings,
  ArrowLeft,
  Share2,
  PartyPopper,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PinnedEventCardProps {
  isAdminPreview?: boolean;
}

export function PinnedEventCard({ isAdminPreview = false }: PinnedEventCardProps) {
  const { config, castVote, toggleParticipation, toggleEnabled } = usePinnedCard();
  const { profile, isAdmin, isSubAdmin } = useAuth();
  const canManage = isAdmin || isSubAdmin;

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Calculate live countdown
  useEffect(() => {
    if (!config.endDate) {
      setTimeLeft(null);
      return;
    }

    const calculateTime = () => {
      const diff = new Date(config.endDate!).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [config.endDate]);

  // If card is disabled and not in admin preview, don't render anything
  if (!config.enabled && !isAdminPreview) {
    return null;
  }

  // Theme Color Styles
  const themeStyles: Record<
    PinnedCardTheme,
    {
      bg: string;
      border: string;
      badge: string;
      accent: string;
      progress: string;
      glow: string;
    }
  > = {
    royal: {
      bg: "bg-gradient-to-br from-indigo-950/90 via-purple-900/80 to-slate-950/90 text-white",
      border: "border-purple-500/30 shadow-purple-900/20",
      badge: "bg-purple-500/20 text-purple-300 border-purple-400/30",
      accent: "from-purple-500 to-indigo-500",
      progress: "bg-purple-500",
      glow: "shadow-purple-500/10",
    },
    emerald: {
      bg: "bg-gradient-to-br from-emerald-950/90 via-teal-900/80 to-slate-950/90 text-white",
      border: "border-emerald-500/30 shadow-emerald-900/20",
      badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
      accent: "from-emerald-500 to-teal-500",
      progress: "bg-emerald-500",
      glow: "shadow-emerald-500/10",
    },
    amber: {
      bg: "bg-gradient-to-br from-amber-950/90 via-yellow-900/80 to-slate-950/90 text-white",
      border: "border-amber-500/30 shadow-amber-900/20",
      badge: "bg-amber-500/20 text-amber-300 border-amber-400/30",
      accent: "from-amber-500 to-yellow-500",
      progress: "bg-amber-500",
      glow: "shadow-amber-500/10",
    },
    sapphire: {
      bg: "bg-gradient-to-br from-blue-950/90 via-cyan-900/80 to-slate-950/90 text-white",
      border: "border-blue-500/30 shadow-blue-900/20",
      badge: "bg-blue-500/20 text-blue-300 border-blue-400/30",
      accent: "from-blue-500 to-cyan-500",
      progress: "bg-blue-500",
      glow: "shadow-blue-500/10",
    },
    crimson: {
      bg: "bg-gradient-to-br from-rose-950/90 via-red-900/80 to-slate-950/90 text-white",
      border: "border-rose-500/30 shadow-rose-900/20",
      badge: "bg-rose-500/20 text-rose-300 border-rose-400/30",
      accent: "from-rose-500 to-red-500",
      progress: "bg-rose-500",
      glow: "shadow-rose-500/10",
    },
    cyber: {
      bg: "bg-gradient-to-br from-slate-900 via-zinc-900 to-black text-white",
      border: "border-cyan-500/40 shadow-cyan-900/20",
      badge: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
      accent: "from-cyan-500 to-blue-500",
      progress: "bg-cyan-500",
      glow: "shadow-cyan-500/10",
    },
  };

  const currentTheme = themeStyles[config.theme] || themeStyles.royal;

  // Type Icon
  const getTypeIcon = (type: PinnedCardType) => {
    switch (type) {
      case "poll":
        return <BarChart3 className="w-4 h-4 text-cyan-300" />;
      case "contest":
        return <Trophy className="w-4 h-4 text-amber-300 animate-bounce" />;
      case "event":
        return <Calendar className="w-4 h-4 text-emerald-300" />;
      case "announcement":
        return <Megaphone className="w-4 h-4 text-rose-300" />;
    }
  };

  // Poll Vote statistics
  const totalVotes = Object.keys(config.votes || {}).length;
  const userVote = profile?.id ? config.votes?.[profile.id] : undefined;

  const isUserParticipating = profile?.id ? config.participants?.includes(profile.id) : false;
  const participantCount = config.participants?.length || 0;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.origin + "/feed");
    setCopied(true);
    toast.success("تم نسخ رابط الإعلان/الحدث بنجاح!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "relative overflow-hidden rounded-3xl border backdrop-blur-2xl shadow-xl transition-all duration-300 dir-rtl my-3",
        currentTheme.bg,
        currentTheme.border,
        currentTheme.glow,
        !config.enabled && isAdminPreview && "opacity-60 border-dashed border-amber-500/50",
      )}
    >
      {/* Decorative ambient glow background circle */}
      <div className="absolute -top-24 -left-24 w-60 h-60 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

      {/* Admin Control Banner Overlay inside Card */}
      {isAdminPreview && (
        <div className="bg-black/40 backdrop-blur-md px-4 py-2 border-b border-white/10 flex items-center justify-between text-xs text-white/90">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold border-none",
                config.enabled
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/20 text-rose-300",
              )}
            >
              {config.enabled ? "مثبت في التغذية (مرئي للجميع)" : "مخفي حالياً من الطلبة"}
            </Badge>
            {isAdminPreview && (
              <span className="text-[11px] text-white/60">(معاينة لوحة التحكم)</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleEnabled}
              className="h-7 text-xs px-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg gap-1.5 transition-all"
            >
              {config.enabled ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-rose-300" />
                  <span>إخفاء الآن</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-300" />
                  <span>تفعيل وإظهار</span>
                </>
              )}
            </Button>

            <Link to="/admin" search={{ tab: "pinned_card" }}>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg gap-1.5"
              >
                <Settings className="w-3.5 h-3.5 text-amber-300" />
                <span>تعديل الكارد</span>
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-5 md:p-6 space-y-4">
        {/* Header Badges & Pin Icon */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 backdrop-blur-md",
                currentTheme.badge,
              )}
            >
              {getTypeIcon(config.type)}
              <span>{config.badgeText || "منشور مثبت"}</span>
            </Badge>

            <Badge
              variant="outline"
              className="bg-white/10 text-white/90 border-white/15 text-[11px] font-mono rounded-full px-2.5 py-0.5 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>محتوى مميز</span>
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all text-xs flex items-center gap-1 px-2.5"
              title="مشاركة"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{copied ? "تم النسخ!" : "مشاركة"}</span>
            </button>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-lg md:text-xl font-black text-white leading-snug tracking-wide flex items-center gap-2">
            <span>{config.title}</span>
            {config.type === "contest" && (
              <Flame className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            )}
          </h3>

          {config.description && (
            <p className="text-sm text-white/85 leading-relaxed font-normal whitespace-pre-line max-w-2xl">
              {config.description}
            </p>
          )}
        </div>

        {/* Optional Banner Image */}
        {config.imageUrl && (
          <div className="relative rounded-2xl overflow-hidden border border-white/15 max-h-64 my-2">
            <img src={config.imageUrl} alt={config.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Live Countdown Timer if enabled */}
        {timeLeft && (
          <div className="bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <Clock className="w-4 h-4 animate-spin text-amber-300" />
              <span>ينتهي التقديم/الحدث خلال:</span>
            </div>

            <div className="flex items-center gap-2 dir-ltr font-mono font-black text-sm">
              <div className="bg-white/15 px-2.5 py-1 rounded-xl text-center min-w-[42px]">
                <span className="block text-base leading-none text-white">{timeLeft.days}</span>
                <span className="text-[9px] text-white/70 font-sans">يوم</span>
              </div>
              <span className="text-white/60">:</span>
              <div className="bg-white/15 px-2.5 py-1 rounded-xl text-center min-w-[42px]">
                <span className="block text-base leading-none text-white">
                  {String(timeLeft.hours).padStart(2, "0")}
                </span>
                <span className="text-[9px] text-white/70 font-sans">ساعة</span>
              </div>
              <span className="text-white/60">:</span>
              <div className="bg-white/15 px-2.5 py-1 rounded-xl text-center min-w-[42px]">
                <span className="block text-base leading-none text-white">
                  {String(timeLeft.minutes).padStart(2, "0")}
                </span>
                <span className="text-[9px] text-white/70 font-sans">دقيقة</span>
              </div>
              <span className="text-white/60">:</span>
              <div className="bg-white/15 px-2.5 py-1 rounded-xl text-center min-w-[42px] border border-amber-400/40">
                <span className="block text-base leading-none text-amber-300">
                  {String(timeLeft.seconds).padStart(2, "0")}
                </span>
                <span className="text-[9px] text-amber-300/80 font-sans">ثانية</span>
              </div>
            </div>
          </div>
        )}

        {/* TYPE 1: POLL / SURVEY INTERACTION */}
        {config.type === "poll" && config.pollOptions && config.pollOptions.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-white/80 font-semibold mb-1">
              <span>اختر إجابتك أو رأيك:</span>
              <span>مجموع الأصوات: {totalVotes}</span>
            </div>

            <div className="grid gap-2">
              {config.pollOptions.map((opt) => {
                const optionVotes = Object.values(config.votes || {}).filter(
                  (v) => v === opt.id,
                ).length;
                const pct = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                const isSelected = userVote === opt.id;

                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (!profile?.id) {
                        toast.error("يرجى تسجيل الدخول للتصويت");
                        return;
                      }
                      castVote(profile.id, opt.id);
                      toast.success("تم تسجيل تصويتك بنجاح!");
                    }}
                    className={cn(
                      "relative overflow-hidden w-full p-3 rounded-2xl border text-right transition-all duration-200 flex items-center justify-between gap-3 group",
                      isSelected
                        ? "bg-white/20 border-white/50 ring-2 ring-white/30"
                        : "bg-white/10 hover:bg-white/15 border-white/15",
                    )}
                  >
                    {/* Background Progress Fill */}
                    <div
                      className={cn(
                        "absolute inset-y-0 right-0 opacity-25 transition-all duration-500",
                        currentTheme.progress,
                      )}
                      style={{ width: `${pct}%` }}
                    />

                    <div className="relative z-10 flex items-center gap-2.5 text-xs font-bold text-white">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border border-white/40 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                          isSelected && "bg-white text-slate-950 border-white",
                        )}
                      >
                        {isSelected ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                      </div>
                      <span>{opt.text}</span>
                    </div>

                    <div className="relative z-10 flex items-center gap-2 text-xs font-mono font-bold text-white/90">
                      {isSelected && (
                        <Badge className="bg-emerald-500/30 text-emerald-300 border-none text-[10px] px-2 py-0">
                          صوتك
                        </Badge>
                      )}
                      <span>{pct}%</span>
                      <span className="text-[10px] text-white/60">({optionVotes})</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TYPE 2 & 3: CONTEST / EVENT / ANNOUNCEMENT ACTION BUTTON */}
        {(config.type === "contest" ||
          config.type === "event" ||
          config.type === "announcement") && (
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Participants badge or action info */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2 space-x-reverse overflow-hidden">
                <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white/20 bg-primary/40 flex items-center justify-center text-[10px] font-bold text-white">
                  🎓
                </div>
                <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white/20 bg-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-white">
                  ⭐
                </div>
                <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white/20 bg-amber-500/40 flex items-center justify-center text-[10px] font-bold text-white">
                  🏆
                </div>
              </div>
              <span className="text-xs text-white/80 font-medium">
                <strong className="text-white font-bold">{participantCount + 12}</strong> طالب شارك
                في هذا الحدث
              </span>
            </div>

            {/* Main Action Button */}
            <div className="flex items-center gap-2">
              {config.actionButtonUrl ? (
                <a
                  href={config.actionButtonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto"
                >
                  <Button className="w-full sm:w-auto font-black text-xs px-5 py-2.5 h-10 rounded-2xl bg-white text-slate-950 hover:bg-white/90 shadow-lg shadow-black/20 gap-2">
                    <span>{config.actionButtonText || "تفاصيل أكثر"}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </a>
              ) : (
                <Button
                  onClick={() => {
                    if (!profile?.id) {
                      toast.error("يرجى تسجيل الدخول أولاً");
                      return;
                    }
                    toggleParticipation(profile.id);
                    if (!isUserParticipating) {
                      toast.success("تم تسجيل مشاركتك بنجاح! 🎉");
                    } else {
                      toast.info("تم إلغاء المشاركة");
                    }
                  }}
                  className={cn(
                    "w-full sm:w-auto font-black text-xs px-6 py-2.5 h-10 rounded-2xl shadow-lg transition-all duration-300 gap-2",
                    isUserParticipating
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-900/30"
                      : "bg-white text-slate-950 hover:bg-white/90 shadow-black/20",
                  )}
                >
                  {isUserParticipating ? (
                    <>
                      <PartyPopper className="w-4 h-4 text-white animate-bounce" />
                      <span>أنت مسجل بالمسابقة 🟢</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 text-amber-600" />
                      <span>{config.actionButtonText || "سجل مشاركتك الآن"}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
