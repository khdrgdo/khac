import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RankBadge } from "@/components/RankBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { majorLabel } from "@/lib/college";
import {
  Camera,
  Loader2,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Cloud,
  Moon,
  Sun,
  Zap,
  Lock,
  Check,
  Edit3,
  Palette,
  Star,
  Award,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useUnivPrivacy } from "@/hooks/useUnivPrivacy";

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
    minPoints: 250,
    rankName: "الذهبي (250+ نقطة)",
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
    minPoints: 500,
    rankName: "البلاتيني (500+ نقطة)",
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
    minPoints: 1000,
    rankName: "الأسطوري (1000+ نقطة)",
    desc: "سديم مجرة أسطوري مع صواعق فضائية وهالة نجمية متحركة",
    badgeBg: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/50",
    accentBorder: "border-fuchsia-500/80",
    cardBg: "from-purple-950 via-fuchsia-950 to-slate-950",
    glowEffect: "shadow-[0_0_40px_rgba(217,70,239,0.5)]",
    avatarRing: "ring-4 ring-fuchsia-400 shadow-[0_0_35px_rgba(217,70,239,0.8)]",
  },
];

export function getDefaultThemeForPoints(points: number): CardThemeId {
  if (points >= 1000) return "galaxy";
  if (points >= 500) return "sun";
  if (points >= 250) return "moon";
  if (points >= 100) return "clouds";
  return "stars";
}

interface ProfileCardFrameProps {
  profile: {
    id: string;
    full_name: string;
    university_number: string;
    major: "it" | "is" | "se" | null;
    year: number | null;
    points: number;
    bio: string | null;
    banned?: boolean;
    suspended_until?: string | null;
    verified?: boolean;
    avatar_signed: string | null;
    roles: string[];
  };
  isMe: boolean;
  uploading: boolean;
  onPickAvatar: (files: FileList | null) => void;
  onStartChat: () => void;
  isChatPending: boolean;
}

export function ProfileCardFrame({
  profile,
  isMe,
  uploading,
  onPickAvatar,
  onStartChat,
  isChatPending,
}: ProfileCardFrameProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Storage key for user's selected frame theme
  const themeStorageKey = `profile_card_theme_${profile.id}`;

  const defaultTheme = getDefaultThemeForPoints(profile.points ?? 0);
  const [selectedThemeId, setSelectedThemeId] = useState<CardThemeId>(() => {
    const saved = localStorage.getItem(themeStorageKey) as CardThemeId | null;
    if (saved && CARD_THEMES.some((t) => t.id === saved)) {
      return saved;
    }
    return defaultTheme;
  });

  const [themeDialogOpen, setThemeDialogOpen] = useState(false);
  const [bioDialogOpen, setBioDialogOpen] = useState(false);
  const [bioText, setBioText] = useState(profile.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);

  const { isHidden: isUnivHidden, togglePrivacy } = useUnivPrivacy(profile.id);

  const handleToggleUnivPrivacy = () => {
    const nextHidden = togglePrivacy();
    if (nextHidden) {
      toast.success("تم إخفاء الرقم الجامعي في جميع أرجاء التطبيق 🔒");
    } else {
      toast.info("تم إظهار الرقم الجامعي 👁️");
    }
  };

  const activeTheme = CARD_THEMES.find((t) => t.id === selectedThemeId) || CARD_THEMES[0];

  const userPoints = profile.points ?? 0;

  const handleSelectTheme = (theme: CardThemeConfig) => {
    if (userPoints < theme.minPoints && !isMe) return;
    if (userPoints < theme.minPoints && isMe) {
      toast.error(`يتطلب إكتمال هذا المظهر ${theme.minPoints} نقطة (رتبة ${theme.rankName})`);
      return;
    }
    setSelectedThemeId(theme.id);
    localStorage.setItem(themeStorageKey, theme.id);
    toast.success(`تم اختيار مظهر "${theme.name}" بنجاح! ✨`);
    setThemeDialogOpen(false);
  };

  const handleSaveBio = async () => {
    if (!isMe) return;
    setSavingBio(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bio: bioText.trim() || null })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("تم تحديث النبذة بنجاح!");
      qc.invalidateQueries({ queryKey: ["profile", profile.id] });
      setBioDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message || "تعذر حفظ النبذة");
    } finally {
      setSavingBio(false);
    }
  };

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 bg-gradient-to-br ${activeTheme.cardBg} text-white border-2 ${activeTheme.accentBorder} ${activeTheme.glowEffect} transition-all duration-500`}
      >
        {/* Decorative Celestial Elements */}
        {activeTheme.id === "stars" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute top-2 left-10 text-amber-300 text-xs animate-pulse">★</div>
            <div className="absolute top-12 right-16 text-amber-200 text-sm animate-ping">✨</div>
            <div className="absolute bottom-6 left-24 text-amber-300 text-xs">✦</div>
            <div className="absolute bottom-12 right-8 text-amber-100 text-[10px]">★</div>
            <div className="absolute top-1/2 right-1/4 text-indigo-300/40 text-lg">✦</div>
          </div>
        )}

        {activeTheme.id === "clouds" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-25">
            <Cloud className="absolute -top-4 -right-4 w-24 h-24 text-cyan-200/40" />
            <Cloud className="absolute -bottom-6 -left-6 w-32 h-32 text-sky-300/30" />
            <div className="absolute top-1/3 left-1/2 w-48 h-12 bg-cyan-300/10 blur-xl rounded-full" />
          </div>
        )}

        {activeTheme.id === "moon" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <Moon className="absolute top-3 left-4 w-12 h-12 text-purple-200/50 filter drop-shadow-[0_0_10px_rgba(216,180,254,0.8)]" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/20 blur-2xl rounded-full" />
            <Sparkles className="absolute top-8 right-12 w-5 h-5 text-purple-300 animate-pulse" />
          </div>
        )}

        {activeTheme.id === "sun" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
            <Sun className="absolute -top-8 -right-8 w-28 h-28 text-amber-400/40 animate-spin-slow filter drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-orange-500/20 blur-2xl rounded-full" />
            <div className="absolute top-1/2 left-10 w-2 h-2 bg-amber-300 rounded-full animate-ping" />
          </div>
        )}

        {activeTheme.id === "galaxy" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-fuchsia-600/30 blur-3xl rounded-full animate-pulse" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-purple-600/30 blur-3xl rounded-full animate-pulse" />
            <Zap className="absolute top-4 right-6 w-6 h-6 text-fuchsia-300 animate-bounce" />
            <Sparkles className="absolute bottom-6 left-12 w-6 h-6 text-cyan-300 animate-spin-slow" />
          </div>
        )}

        {/* Theme Badge & Customizer Trigger */}
        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{activeTheme.icon}</span>
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 font-medium border ${activeTheme.badgeBg} backdrop-blur-md shadow-sm`}
            >
              مظهر {activeTheme.name}
            </Badge>
          </div>

          {isMe && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setThemeDialogOpen(true)}
              className="h-8 gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md shadow-sm transition"
            >
              <Palette className="w-3.5 h-3.5 text-amber-300" />
              تغيير مظهر الكارد
            </Button>
          )}
        </div>

        {/* Profile Details Header */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Avatar Section */}
          <div className="relative shrink-0">
            <Avatar className={`w-20 h-20 sm:w-24 sm:h-24 ${activeTheme.avatarRing}`}>
              <AvatarImage src={profile.avatar_signed ?? undefined} className="object-cover" />
              <AvatarFallback className="text-2xl bg-indigo-900/80 text-amber-200 font-bold">
                {profile.full_name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            {isMe && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickAvatar(e.target.files)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full p-2 shadow-lg transition transform hover:scale-110"
                  title="تغيير الصورة الشخصية"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
              </>
            )}
          </div>

          {/* User Info Section */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
                {profile.full_name}
                {profile.verified && <VerifiedBadge size="md" />}
              </h1>
              <RankBadge points={profile.points ?? 0} />
            </div>

            <div
              className="flex items-center gap-2 text-xs font-mono text-slate-300/90 tracking-wider flex-wrap"
              dir="ltr"
            >
              <span>الرقم الجامعي:</span>
              <span className="font-semibold text-white tracking-widest">
                {isUnivHidden ? "••••••••••" : profile.university_number}
              </span>
              {isMe && (
                <button
                  type="button"
                  onClick={handleToggleUnivPrivacy}
                  className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 transition focus:outline-none flex items-center justify-center"
                  title={isUnivHidden ? "إظهار الرقم الجامعي" : "إخفاء الرقم الجامعي"}
                  aria-label="تبديل إخفاء الرقم الجامعي"
                >
                  {isUnivHidden ? (
                    <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </button>
              )}
              {isUnivHidden && (
                <span className="text-[10px] text-amber-300 font-sans bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/30 font-medium">
                  مخفي 🔒
                </span>
              )}
            </div>

            <div className="flex gap-1.5 pt-1 flex-wrap">
              {profile.roles.map((r: string) => (
                <Badge
                  key={r}
                  className="text-[11px] bg-white/15 text-white border border-white/20 backdrop-blur-sm"
                >
                  {r === "admin" ? "مشرف" : r === "teacher" ? "أستاذ" : "طالب"}
                </Badge>
              ))}
              {profile.major && (
                <Badge className="text-[11px] bg-sky-500/20 text-sky-200 border border-sky-400/30 backdrop-blur-sm">
                  {majorLabel(profile.major)}
                </Badge>
              )}
              {profile.year && (
                <Badge className="text-[11px] bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 backdrop-blur-sm">
                  السنة {profile.year}
                </Badge>
              )}
              {profile.banned && (
                <Badge variant="destructive" className="text-[11px]">
                  <ShieldAlert className="w-3 h-3 ml-1" /> محظور
                </Badge>
              )}
              {!profile.banned &&
                profile.suspended_until &&
                new Date(profile.suspended_until) > new Date() && (
                  <Badge variant="destructive" className="text-[11px]">
                    <ShieldAlert className="w-3 h-3 ml-1" /> موقوف
                  </Badge>
                )}
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="relative z-10 mt-4 pt-3 border-t border-white/15">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300/90 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              نبذة عني
            </span>

            {isMe && (
              <button
                onClick={() => {
                  setBioText(profile.bio ?? "");
                  setBioDialogOpen(true);
                }}
                className="text-xs text-sky-300 hover:text-sky-200 underline flex items-center gap-1 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {profile.bio ? "تعديل النبذة" : "إضافة نبذة"}
              </button>
            )}
          </div>

          {profile.bio ? (
            <p className="mt-1.5 text-sm text-slate-100 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/10 backdrop-blur-sm whitespace-pre-line">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-300/70 italic">
              {isMe
                ? "لم تقم بإضافة نبذة عنك بعد. انقر على 'إضافة نبذة' للتعريف بنفسك للطلاب!"
                : "لا توجد نبذة حالياً."}
            </p>
          )}
        </div>

        {/* Actions for other users */}
        {!isMe && (
          <div className="relative z-10 mt-4 pt-2">
            <Button
              size="sm"
              onClick={onStartChat}
              disabled={isChatPending}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg gap-2"
            >
              <MessageCircle className="w-4 h-4" /> مراسلة
            </Button>
          </div>
        )}
      </div>

      {/* Theme Picker Modal */}
      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Palette className="w-5 h-5 text-amber-500" />
              تحديد مظهر بطاقة الملف الشخصي (Mobile Legends Style)
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            تُفتح المظاهر السماوية الأسطورية تلقائياً حسب ترتيبك ونقاطك. يمكنك اختيار أي مظهر قمت
            بفتحه لتمييز ملفك الشخصي!
          </p>

          <div className="space-y-3 mt-3">
            {CARD_THEMES.map((theme) => {
              const isUnlocked = userPoints >= theme.minPoints;
              const isSelected = selectedThemeId === theme.id;

              return (
                <div
                  key={theme.id}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/5 shadow-md"
                      : isUnlocked
                        ? "border-border hover:border-amber-400/50 bg-card cursor-pointer"
                        : "border-border/50 bg-muted/30 opacity-75"
                  }`}
                  onClick={() => isUnlocked && handleSelectTheme(theme)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl p-2 rounded-xl bg-muted shrink-0">{theme.icon}</div>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          {theme.name}
                          {isSelected && (
                            <Badge className="bg-amber-500 text-slate-950 text-[10px]">
                              مُفعل حالياً
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{theme.desc}</div>
                        <div className="text-[11px] font-semibold text-primary mt-1 flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" />
                          {theme.rankName}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isUnlocked ? (
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTheme(theme);
                          }}
                          className="h-8 gap-1.5 text-xs font-semibold"
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> مُفعل
                            </>
                          ) : (
                            "تفعيل المظهر"
                          )}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                          <Lock className="w-3.5 h-3.5 text-amber-500" />
                          <span>يتطلب {theme.minPoints} نقطة</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar for locked themes */}
                  {!isUnlocked && (
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1 font-mono">
                        <span>التقدم نحو الفتح</span>
                        <span>
                          {userPoints} / {theme.minPoints} نقطة
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (userPoints / theme.minPoints) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Bio Dialog */}
      <Dialog open={bioDialogOpen} onOpenChange={setBioDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Edit3 className="w-4 h-4 text-primary" />
              تعديل النبذة الشخصية
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              اكتب نبذة مختصرة عن نفسك، اهتماماتك الأكاديمية، أو مهاراتك التقنية ليتعرف عليك زملائك
              وأعداء المواد!
            </p>

            <Textarea
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              placeholder="مثال: طالب هندسة برمجيات في السنة الثالثة، مهتم بتطوير الذكاء الاصطناعي وتطبيقات الويب..."
              maxLength={250}
              rows={4}
              className="text-sm resize-none"
            />

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>أقصى عدد: 250 حرف</span>
              <span>{bioText.length} / 250</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBioDialogOpen(false)}
                disabled={savingBio}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveBio}
                disabled={savingBio}
                className="gap-1.5"
              >
                {savingBio && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                حفظ النبذة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
