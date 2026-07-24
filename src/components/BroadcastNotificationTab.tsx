import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Send,
  Bell,
  Users,
  GraduationCap,
  FileText,
  Megaphone,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { createNotification } from "@/lib/notificationsStore";
import { sendNativeNotification } from "@/lib/pushNotifications";
import { majorLabel } from "@/lib/college";
import type { Database } from "@/integrations/supabase/types";

type MajorCode = Database["public"]["Enums"]["major_code"];

export function BroadcastNotificationTab() {
  const { profile } = useAuth();
  const [targetType, setTargetType] = useState<"all" | "academic" | "user">("academic");

  // Academic Targeting
  const [selectedMajor, setSelectedMajor] = useState<MajorCode | "ALL">("it");
  const [selectedYear, setSelectedYear] = useState<string>("2"); // default year 2

  // Specific User Targeting
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Notification Details
  const [notifCategory, setNotifCategory] = useState<
    "announcement" | "material_added" | "course_added" | "comment_reply"
  >("material_added");
  const [title, setTitle] = useState("تم رفع ملخص جديد لطلاب الصف الثاني IT 📄");
  const [body, setBody] = useState(
    "تم إضافة ملخص المحاضرة الجديدة لمادة الشبكات وقواعد البيانات، يمكنك الاطلاع عليه الآن.",
  );
  const [link, setLink] = useState("/courses");
  const [isSending, setIsSending] = useState(false);

  // Query profiles for specific user target dropdown
  const { data: profiles } = useQuery({
    queryKey: ["all-profiles-for-notifs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, university_number, major, year")
        .order("full_name", { ascending: true })
        .limit(300);
      return data ?? [];
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
      // 1. Determine target recipient IDs
      let targetUserIds: string[] = [];

      if (targetType === "user") {
        if (!selectedUserId) {
          toast.error("يرجى اختيار الطالب المستهدف");
          setIsSending(false);
          return;
        }
        targetUserIds = [selectedUserId];
      } else if (targetType === "academic") {
        // Query users matching major and year
        let query = supabase.from("profiles").select("id");
        if (selectedMajor !== "ALL") {
          query = query.eq("major", selectedMajor);
        }
        if (selectedYear !== "ALL") {
          query = query.eq("year", Number(selectedYear));
        }
        const { data: matched } = await query;
        targetUserIds = (matched ?? []).map((u) => u.id);
      } else {
        // ALL Users
        const { data: allUsers } = await supabase.from("profiles").select("id");
        targetUserIds = (allUsers ?? []).map((u) => u.id);
      }

      if (targetUserIds.length === 0) {
        toast.warning("لم يتم العثور على مستخدمين يطابقون شروط الاستهداف المحددة.");
        setIsSending(false);
        return;
      }

      // 2. Broadcast via Supabase Realtime Channel
      const broadcastChannel = supabase.channel("global_notifications_broadcast");
      await broadcastChannel.subscribe();

      await broadcastChannel.send({
        type: "broadcast",
        event: "targeted_push",
        payload: {
          targetUserIds,
          targetType,
          major: selectedMajor,
          year: selectedYear,
          title,
          body,
          type: notifCategory,
          link,
          actorName: profile?.full_name || "إدارة المنصة الأكاديمية",
          actorAvatar: profile?.avatar_url,
          createdAt: new Date().toISOString(),
        },
      });

      supabase.removeChannel(broadcastChannel);

      // 3. Save notification for each target user in local storage / real-time feed
      targetUserIds.forEach((uid) => {
        createNotification({
          recipientId: uid,
          actorId: profile?.id,
          actorName: profile?.full_name || "إدارة المنصة الأكاديمية",
          actorAvatar: profile?.avatar_url,
          type: notifCategory,
          title,
          body,
          link,
        });
      });

      // 4. Also trigger local native push notification for testing / current device
      sendNativeNotification(title, {
        body,
        url: link,
      });

      toast.success(`تم إرسال الإشعار بنجاح إلى (${targetUserIds.length}) مستخدم مستهدف! 🚀`);

      // Reset form
      setTitle("");
      setBody("");
    } catch (err) {
      console.error("Error sending broadcast notification:", err);
      toast.error("حدث خطأ أثناء إرسال الإشعار");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 dir-rtl">
      <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-border/40 pb-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span>إرسال إشعار فوري وتنبيه للطلاب</span>
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              قم بإرسال إشعارات فورية تظهر في الموقع، التطبيق، وعلى شاشة هاتف المستخدم كـ Native
              Push Notification.
            </p>
          </div>
        </div>

        <form onSubmit={handleSendNotification} className="space-y-6">
          {/* Target Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              1. تحديد المستهدفين بالإشعار
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div
                onClick={() => setTargetType("academic")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                  targetType === "academic"
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                    : "border-border/60 bg-background/50 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  {targetType === "academic" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">صف / تخصص محدد</h4>
                  <p className="text-xs text-muted-foreground">مثال: طلاب الصف الثاني IT</p>
                </div>
              </div>

              <div
                onClick={() => setTargetType("all")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                  targetType === "all"
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                    : "border-border/60 bg-background/50 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Megaphone className="w-5 h-5 text-indigo-500" />
                  {targetType === "all" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">جميع المستخدين</h4>
                  <p className="text-xs text-muted-foreground">إشعار عام لجميع الطلاب والأعضاء</p>
                </div>
              </div>

              <div
                onClick={() => setTargetType("user")}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                  targetType === "user"
                    ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-xs"
                    : "border-border/60 bg-background/50 hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Users className="w-5 h-5 text-purple-500" />
                  {targetType === "user" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">طالب محدد</h4>
                  <p className="text-xs text-muted-foreground">إرسال تنبيه خاص لشخص واحد</p>
                </div>
              </div>
            </div>

            {/* Academic Target Options */}
            {targetType === "academic" && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">التخصص / الكلية</Label>
                  <Select
                    value={selectedMajor}
                    onValueChange={(v) => setSelectedMajor(v as MajorCode | "ALL")}
                  >
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
                  <Label className="text-xs font-semibold">السنة الدراسية (الصف)</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="rounded-xl bg-background">
                      <SelectValue placeholder="اختر السنة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">جميع السنوات</SelectItem>
                      <SelectItem value="1">الصف الأول (السنة الأولى)</SelectItem>
                      <SelectItem value="2">الصف الثاني (السنة الثانية)</SelectItem>
                      <SelectItem value="3">الصف الثالث (السنة الثالثة)</SelectItem>
                      <SelectItem value="4">الصف الرابع (السنة الرابعة)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Specific User Target Dropdown */}
            {targetType === "user" && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-1.5 mt-3">
                <Label className="text-xs font-semibold">اختر الطالب المستهدف</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="rounded-xl bg-background">
                    <SelectValue placeholder="بحث أو اختيار الطالب..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {(profiles ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({p.university_number}) — {p.major || "عام"} (سنة{" "}
                        {p.year || 1})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Notification Details */}
          <div className="space-y-4 pt-2 border-t border-border/40">
            <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              2. تفاصيل ومحتوى الإشعار
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">نوع التنبيه</Label>
                <Select
                  value={notifCategory}
                  onValueChange={(v) =>
                    setNotifCategory(
                      v as "announcement" | "material_added" | "course_added" | "comment_reply",
                    )
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material_added">📄 رفع ملخص / ملف جديد</SelectItem>
                    <SelectItem value="announcement">📢 إعلان / تنبيه هام</SelectItem>
                    <SelectItem value="course_added">📚 مادة / كورس جديد</SelectItem>
                    <SelectItem value="comment_reply">💬 رسالة / إشعار خاص</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رابط الوجهة عند الضغط على الإشعار</Label>
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
                placeholder="مثال: تم رفع ملخص جديد لمادة قواعد البيانات 📚"
                className="rounded-xl font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نص ومحتوى الإشعار</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اكتب تفاصيل التنبيه هنا..."
                rows={3}
                className="rounded-xl leading-relaxed"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSending}
            className="w-full h-12 rounded-2xl text-base font-bold gap-2 bg-primary hover:bg-primary/90 shadow-md transition-all"
          >
            {isSending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري بث الإشعار للطلاب...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                إرسال الإشعار الآن 🚀
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
