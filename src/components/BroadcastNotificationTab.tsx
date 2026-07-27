import { formatUnivNumber } from "@/lib/privacy";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Bell,
  Users,
  GraduationCap,
  Megaphone,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  CircleDot,
  Eye,
  CalendarClock,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { createNotification, broadcastNotification, type NotificationPriority } from "@/lib/notificationsStore";
import { majorLabel } from "@/lib/college";
import type { Database } from "@/integrations/supabase/types";

type MajorCode = Database["public"]["Enums"]["major_code"];

export function BroadcastNotificationTab() {
  const { profile } = useAuth();
  const [targetType, setTargetType] = useState<"all" | "academic" | "user">("academic");
  const [selectedMajor, setSelectedMajor] = useState<MajorCode | "ALL">("it");
  const [selectedYear, setSelectedYear] = useState<string>("2");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [notifCategory, setNotifCategory] = useState<
    "announcement" | "material_added" | "course_added" | "comment_reply"
  >("announcement");
  const [priority, setPriority] = useState<NotificationPriority>("normal");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/feed");
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-for-notifs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, university_number, major, year")
        .order("full_name", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });

  const { data: targetCount, refetch: refetchCount } = useQuery({
    queryKey: ["notif-target-count", targetType, selectedMajor, selectedYear, selectedUserId],
    queryFn: async () => {
      if (targetType === "user") return selectedUserId ? 1 : 0;
      let query = supabase.from("profiles").select("id", { count: "exact", head: true });
      if (targetType === "academic") {
        if (selectedMajor !== "ALL") query = query.eq("major", selectedMajor);
        if (selectedYear !== "ALL") query = query.eq("year", Number(selectedYear));
      }
      const { count } = await query;
      return count || 0;
    },
  });

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("يرجى كتابة عنوان ومحتوى الإشعار");
      return;
    }
    setIsSending(true);

    try {
      let targetUserIds: string[] = [];

      if (targetType === "user") {
        if (!selectedUserId) {
          toast.error("يرجى اختيار الطالب المستهدف");
          setIsSending(false);
          return;
        }
        targetUserIds = [selectedUserId];
      } else if (targetType === "academic") {
        let query = supabase.from("profiles").select("id");
        if (selectedMajor !== "ALL") query = query.eq("major", selectedMajor);
        if (selectedYear !== "ALL") query = query.eq("year", Number(selectedYear));
        const { data: matched } = await query;
        targetUserIds = (matched ?? []).map((u) => u.id);
      } else {
        const { data: allUsers } = await supabase.from("profiles").select("id");
        targetUserIds = (allUsers ?? []).map((u) => u.id);
      }

      if (targetUserIds.length === 0) {
        toast.warning("لم يتم العثور على مستخدمين يطابقون شروط الاستهداف.");
        setIsSending(false);
        return;
      }

      const sentCount = await broadcastNotification({
        actorId: profile?.id,
        actorName: profile?.full_name || "إدارة المنصة الأكاديمية",
        actorAvatar: profile?.avatar_url,
        type: notifCategory,
        title,
        body,
        link,
        targetUserIds,
        priority,
      });

      if (sentCount > 0) {
        toast.success(`تم إرسال الإشعار بنجاح إلى ${sentCount} مستخدم!`);
        setTitle("");
        setBody("");
        setLink("/feed");
      } else {
        toast.error("فشل إرسال الإشعار");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء إرسال الإشعار");
    } finally {
      setIsSending(false);
    }
  };

  const priorityConfig: Record<NotificationPriority, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    urgent: { label: "عاجل 🔴", icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-500", bg: "bg-red-500/10 border-red-500/30" },
    important: { label: "مهم 🟡", icon: <Info className="w-4 h-4" />, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
    normal: { label: "عام 🔵", icon: <CircleDot className="w-4 h-4" />, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30" },
  };

  const categoryIcons: Record<string, string> = {
    material_added: "📄",
    announcement: "📢",
    course_added: "📚",
    comment_reply: "💬",
  };

  return (
    <div className="space-y-6 dir-rtl">
      <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 pb-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span>إرسال إشعار للطلاب</span>
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              إشعارات محفوظة في قاعدة البيانات — تصلك حتى لو كنت غير متصل بالإنترنت.
            </p>
          </div>
        </div>

        <form onSubmit={handleSendNotification} className="space-y-6">
          {/* STEP 1: Target Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                ١. تحديد المستهدفين
              </Label>
              {targetCount !== undefined && targetCount > 0 && (
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full flex items-center gap-1">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {targetCount} مستخدم
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { key: "academic" as const, icon: <GraduationCap className="w-5 h-5 text-primary" />, title: "تخصص / سنة محددة", desc: "استهداف حسب القسم والصف" },
                { key: "all" as const, icon: <Megaphone className="w-5 h-5 text-indigo-500" />, title: "جميع المستخدمين", desc: "إشعار عام للجميع" },
                { key: "user" as const, icon: <Users className="w-5 h-5 text-purple-500" />, title: "طالب محدد", desc: "رسالة خاصة لشخص واحد" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTargetType(opt.key)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 text-right ${
                    targetType === opt.key
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border/60 bg-background/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {opt.icon}
                    {targetType === opt.key && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{opt.title}</h4>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Academic sub-options */}
            {targetType === "academic" && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">التخصص</Label>
                  <Select value={selectedMajor} onValueChange={(v) => setSelectedMajor(v as MajorCode | "ALL")}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="اختر التخصص" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">جميع التخصصات</SelectItem>
                      <SelectItem value="IT">تقنية المعلومات (IT)</SelectItem>
                      <SelectItem value="CS">علوم الحاسوب (CS)</SelectItem>
                      <SelectItem value="SE">هندسة البرمجيات (SE)</SelectItem>
                      <SelectItem value="IS">نظم المعلومات (IS)</SelectItem>
                      <SelectItem value="AI">الذكاء الاصطناعي (AI)</SelectItem>
                      <SelectItem value="CYBER">الأمن السيبراني (CYBER)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">السنة الدراسية</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="اختر السنة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">جميع السنوات</SelectItem>
                      <SelectItem value="1">السنة الأولى</SelectItem>
                      <SelectItem value="2">السنة الثانية</SelectItem>
                      <SelectItem value="3">السنة الثالثة</SelectItem>
                      <SelectItem value="4">السنة الرابعة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* User selector */}
            {targetType === "user" && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1.5 mt-3">
                <Label className="text-xs font-semibold">اختر الطالب</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="rounded-xl bg-background">
                    <SelectValue placeholder="بحث عن طالب..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {(profiles ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({formatUnivNumber(p.university_number, p.id, false, true)}) — {p.major || "عام"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* STEP 2: Priority */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-primary" />
              ٢. أولوية الإشعار
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(priorityConfig) as [NotificationPriority, typeof priorityConfig.normal][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPriority(key)}
                  className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-1.5 ${
                    priority === key
                      ? `${cfg.bg} border-current ${cfg.color}`
                      : "border-border/60 bg-background/50 hover:border-border text-muted-foreground"
                  }`}
                >
                  {cfg.icon}
                  <span className="text-xs font-bold">{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 3: Content */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-primary" />
              ٣. محتوى الإشعار
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نوع الإشعار</Label>
                <Select
                  value={notifCategory}
                  onValueChange={(v) =>
                    setNotifCategory(v as "announcement" | "material_added" | "course_added" | "comment_reply")
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">📢 إعلان / تنبيه هام</SelectItem>
                    <SelectItem value="material_added">📄 رفع ملخص / ملف جديد</SelectItem>
                    <SelectItem value="course_added">📚 مادة / كورس جديد</SelectItem>
                    <SelectItem value="comment_reply">💬 رسالة / إشعار خاص</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رابط الوجهة</Label>
                <Input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="/courses أو /feed"
                  className="rounded-xl dir-ltr text-left"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">عنوان الإشعار</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: إعلان هام لطلاب الصف الثاني IT 📢"
                className="rounded-xl font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نص الإشعار</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اكتب تفاصيل الإشعار هنا..."
                rows={3}
                className="rounded-xl leading-relaxed"
              />
            </div>
          </div>

          {/* STEP 4: Preview + Send */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-primary" />
                ٤. معاينة وإرسال
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-7 text-xs rounded-xl text-muted-foreground"
              >
                {showPreview ? "إخفاء المعاينة" : "معاينة"}
              </Button>
            </div>

            {/* Live Preview */}
            {showPreview && (title || body) && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-2 border border-white/10">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                    priority === "urgent" ? "bg-red-500/30 text-red-300" :
                    priority === "important" ? "bg-amber-500/30 text-amber-300" :
                    "bg-blue-500/30 text-blue-300"
                  }`}>
                    {priorityConfig[priority].label}
                  </span>
                  <span className="text-white/50">{categoryIcons[notifCategory]} {notifCategory === "announcement" ? "إعلان" : notifCategory === "material_added" ? "ملف جديد" : notifCategory === "course_added" ? "كورس جديد" : "رسالة"}</span>
                  {targetCount !== undefined && (
                    <span className="text-white/40 mr-auto">{targetCount} مستلم</span>
                  )}
                </div>
                {title && (
                  <h4 className="font-bold text-sm">{categoryIcons[notifCategory]} {title}</h4>
                )}
                {body && (
                  <p className="text-xs text-white/70 leading-relaxed">{body}</p>
                )}
                {link && (
                  <span className="text-[10px] text-white/30 dir-ltr inline-block">{link}</span>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSending || !title.trim() || !body.trim()}
              className="w-full h-12 rounded-2xl text-base font-bold gap-2 bg-primary hover:bg-primary/90 shadow-md transition-all"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  إرسال الإشعار {targetCount !== undefined && targetCount > 0 ? `إلى ${targetCount} مستخدم` : "الآن"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
