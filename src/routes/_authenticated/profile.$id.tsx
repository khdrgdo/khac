import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PostList } from "@/components/PostList";
import { RankBadge } from "@/components/RankBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { majorLabel } from "@/lib/college";
import {
  Camera,
  Loader2,
  MessageCircle,
  ShieldAlert,
  Flame,
  Trophy,
  CheckCircle2,
  Bookmark,
  Award,
  Calendar,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { uploadFile, signedUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/profile/$id")({
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = useParams({ from: "/_authenticated/profile/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: p } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const isSelf = user?.id === id;
      let data: Record<string, unknown> | null = null;
      if (isSelf) {
        const { data: row } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        data = row as Record<string, unknown> | null;
      } else {
        const { data: rows } = await supabase.rpc("get_public_profiles", { _ids: [id] });
        data = rows && rows[0] ? (rows[0] as Record<string, unknown>) : null;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", id);
      if (!data) return null;
      const avatarUrl = data.avatar_url as string | null;
      let avatarSigned: string | null = null;
      if (avatarUrl && !avatarUrl.startsWith("http")) {
        avatarSigned = await signedUrl("avatars", avatarUrl, 3600);
      } else {
        avatarSigned = avatarUrl;
      }
      return {
        ...(data as Record<string, unknown>),
        avatar_signed: avatarSigned,
        roles: (roles ?? []).map((r: { role: string }) => r.role),
      } as {
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
    },
  });

  const { data: contributions, isLoading: contribsLoading } = useQuery({
    queryKey: ["profile-contributions", id],
    queryFn: async () => {
      // Fetch posts
      const { data: posts } = await supabase.from("posts").select("created_at").eq("author_id", id);

      // Fetch comments
      const { data: comments } = await supabase
        .from("comments")
        .select("id, created_at")
        .eq("author_id", id);

      // Fetch accepted answers
      let acceptedCount = 0;
      if (comments && comments.length > 0) {
        const commentIds = comments.map((c) => c.id);
        const { data: acceptedPosts } = await supabase
          .from("posts")
          .select("created_at")
          .in("accepted_answer_id", commentIds);
        acceptedCount = acceptedPosts?.length ?? 0;
      }

      // Combine dates
      const dates: string[] = [];
      (posts ?? []).forEach((p) => dates.push(p.created_at.slice(0, 10)));
      (comments ?? []).forEach((c) => dates.push(c.created_at.slice(0, 10)));

      return {
        dates,
        postsCount: posts?.length ?? 0,
        commentsCount: comments?.length ?? 0,
        acceptedCount,
      };
    },
  });

  const getStreaks = () => {
    if (!contributions?.dates || contributions.dates.length === 0)
      return { current: 0, longest: 0 };
    const uniqueDates = Array.from(new Set(contributions.dates)).sort((a, b) => b.localeCompare(a));

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    let current = 0;
    let longest = 0;

    const hasToday = uniqueDates.includes(todayStr);
    const hasYesterday = uniqueDates.includes(yesterdayStr);

    if (hasToday || hasYesterday) {
      const checkDate = hasToday ? new Date() : new Date(Date.now() - 24 * 60 * 60 * 1000);
      while (true) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (uniqueDates.includes(dateStr)) {
          current++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const ascDates = Array.from(new Set(contributions.dates)).sort((a, b) => a.localeCompare(b));
    let prevDate: Date | null = null;
    let currentRun = 0;

    for (const dStr of ascDates) {
      const curDate = new Date(dStr);
      if (prevDate === null) {
        currentRun = 1;
      } else {
        const diffTime = Math.abs(curDate.getTime() - prevDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) {
          currentRun++;
        } else {
          longest = Math.max(longest, currentRun);
          currentRun = 1;
        }
      }
      prevDate = curDate;
    }
    longest = Math.max(longest, currentRun);

    return { current, longest };
  };

  const generateHeatmapDays = () => {
    const days = [];
    const today = new Date();
    const startDate = new Date(today.getTime() - 52 * 7 * 24 * 60 * 60 * 1000);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    for (let i = 0; i < 52 * 7; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      days.push(date);
    }
    return days;
  };

  const { current: currentStreak, longest: longestStreak } = getStreaks();
  const heatmapDays = generateHeatmapDays();

  const datesGrouped: Record<string, number> = {};
  (contributions?.dates ?? []).forEach((d) => {
    datesGrouped[d] = (datesGrouped[d] ?? 0) + 1;
  });

  const weeks = [];
  for (let i = 0; i < 52; i++) {
    weeks.push(heatmapDays.slice(i * 7, (i + 1) * 7));
  }

  const startChat = useMutation({
    mutationFn: async () => {
      if (!user || user.id === id) return null;
      const { data, error } = await supabase.rpc("create_dm", { _other: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (convId) => {
      if (convId) {
        qc.invalidateQueries({ queryKey: ["conversations"] });
        navigate({ to: "/messages/$id", params: { id: convId } });
      }
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر بدء المحادثة"),
  });

  async function onPickAvatar(files: FileList | null) {
    if (!files || !user) return;
    const f = files[0];
    if (!f.type.startsWith("image/")) {
      toast.error("اختر صورة");
      return;
    }
    if (f.size > 3 * 1024 * 1024) {
      toast.error("أكبر من 3MB");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadFile("avatars", user.id, f, "avatar-");
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("تم تحديث الصورة");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      // Force useAuth re-render by dispatching an auth event
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!p)
    return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;

  const isMe = user?.id === id;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={p.avatar_signed ?? undefined} />
                <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                  {p.full_name.slice(0, 2)}
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
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md hover:scale-110 transition"
                    aria-label="تغيير الصورة"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold flex items-center gap-1.5">
                  {p.full_name}
                  {p.verified && <VerifiedBadge size="md" />}
                </h1>
                <RankBadge points={p.points ?? 0} />
              </div>
              <div className="text-sm text-muted-foreground" dir="ltr">
                {p.university_number}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {p.roles.map((r: string) => (
                  <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                    {r === "admin" ? "مشرف" : r === "teacher" ? "أستاذ" : "طالب"}
                  </Badge>
                ))}
                {p.major && <Badge variant="outline">{majorLabel(p.major)}</Badge>}
                {p.year && <Badge variant="outline">السنة {p.year}</Badge>}
                {p.banned && (
                  <Badge variant="destructive">
                    <ShieldAlert className="w-3 h-3" /> محظور
                  </Badge>
                )}
                {!p.banned && p.suspended_until && new Date(p.suspended_until) > new Date() && (
                  <Badge variant="destructive">
                    <ShieldAlert className="w-3 h-3" /> موقوف
                  </Badge>
                )}
              </div>
              {p.bio && <p className="mt-3 text-sm">{p.bio}</p>}
              {user && user.id !== id && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => startChat.mutate()}
                  disabled={startChat.isPending}
                >
                  <MessageCircle className="w-4 h-4" /> مراسلة
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GitHub style Contribution Heatmap, Streaks, and Statistics */}
      <Card className="border-muted/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-1.5 text-foreground">
              <Activity className="w-4 h-4 text-emerald-500" />
              سجل النشاط العلمي والمساهمات
            </h3>
            {contributions && (
              <span className="text-xs text-muted-foreground font-medium">
                {contributions.dates.length} مساهمة في السنة الأخيرة
              </span>
            )}
          </div>

          {/* Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="border bg-card rounded-lg p-2.5 text-center">
              <div className="text-[10px] font-medium text-muted-foreground">الأسئلة المحلولة</div>
              <div className="font-bold text-base text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                {contributions?.acceptedCount ?? 0}
              </div>
            </div>
            <div className="border bg-card rounded-lg p-2.5 text-center">
              <div className="text-[10px] font-medium text-muted-foreground">عدد المنشورات</div>
              <div className="font-bold text-base text-foreground mt-0.5">
                {contributions?.postsCount ?? 0}
              </div>
            </div>
            <div className="border bg-card rounded-lg p-2.5 text-center">
              <div className="text-[10px] font-medium text-muted-foreground">عدد التعليقات</div>
              <div className="font-bold text-base text-foreground mt-0.5">
                {contributions?.commentsCount ?? 0}
              </div>
            </div>
            <div className="border bg-card rounded-lg p-2.5 text-center">
              <div className="text-[10px] font-medium text-muted-foreground">الرتبة العلمية</div>
              <div className="font-bold text-xs text-primary mt-0.5 flex items-center justify-center gap-1">
                <Award className="w-3.5 h-3.5" />
                {p.points >= 500
                  ? "بلاتيني"
                  : p.points >= 250
                    ? "ذهبي"
                    : p.points >= 100
                      ? "فضي"
                      : "برونزي"}
              </div>
            </div>
          </div>

          {/* Streaks row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="border bg-amber-500/5 border-amber-500/10 rounded-lg p-2.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 fill-amber-500" />
              </div>
              <div>
                <div className="text-[10px] font-medium text-muted-foreground">التتابع الحالي</div>
                <div className="font-extrabold text-base text-amber-600 dark:text-amber-400 mt-0.5">
                  {currentStreak} {currentStreak === 1 ? "يوم" : "أيام"}
                </div>
              </div>
            </div>
            <div className="border bg-primary/5 border-primary/10 rounded-lg p-2.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-medium text-muted-foreground">أطول تتابع نشاط</div>
                <div className="font-extrabold text-base text-primary mt-0.5">
                  {longestStreak} {longestStreak === 1 ? "يوم" : "أيام"}
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap Section */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              خريطة المساهمات اليومية (٥٢ أسبوعًا)
            </div>
            <div className="border rounded-lg p-3 bg-muted/20">
              {contribsLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary ml-1.5" />
                  جارِ تحميل خريطة النشاط...
                </div>
              ) : (
                <div className="flex gap-[3px] overflow-x-auto pb-1.5 select-none" dir="ltr">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[3px] shrink-0">
                      {week.map((day) => {
                        const dateStr = day.toISOString().slice(0, 10);
                        const count = datesGrouped[dateStr] ?? 0;
                        let color = "bg-muted-foreground/10 dark:bg-muted-foreground/5";
                        if (count > 0 && count <= 2)
                          color = "bg-emerald-500/25 dark:bg-emerald-500/20";
                        if (count > 2 && count <= 5)
                          color = "bg-emerald-500/55 dark:bg-emerald-500/50";
                        if (count > 5) color = "bg-emerald-500 dark:bg-emerald-400";

                        return (
                          <div
                            key={dateStr}
                            className={`w-2.5 h-2.5 rounded-[1.5px] shrink-0 ${color}`}
                            title={`${dateStr}: ${count} مساهمة`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="font-semibold mt-4">منشورات المستخدم</h2>
      <PostList authorId={id} />
    </div>
  );
}
