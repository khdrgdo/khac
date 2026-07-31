import { formatUnivNumber } from "@/lib/privacy";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  BarChart3,
  History,
  Edit,
  Trash2,
  RotateCcw,
  Search,
  Filter,
  FileText,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import {
  broadcastNotification,
  fetchAdminSentNotifications,
  updateNotificationInDB,
  deleteNotificationFromDB,
  type NotificationPriority,
} from "@/lib/notificationsStore";
import { majorLabel } from "@/lib/college";
import type { Database } from "@/integrations/supabase/types";

type MajorCode = Database["public"]["Enums"]["major_code"];

// Notification Templates
const NOTIFICATION_TEMPLATES = [
  {
    name: "📢 إعلان أكاديمي عاجل",
    title: "تنبيه أكاديمي عاجل لجميع الطلاب 📢",
    body: "نحيط علم جميع الطلاب بضرورة الالتزام بالمواعيد المحددة ومتابعة التحديثات الرسمية في القاعة والتطبيق.",
    category: "announcement" as const,
    priority: "urgent" as const,
    link: "/feed",
  },
  {
    name: "📚 ملخصات ومواد جديدة",
    title: "تم رفع ملخصات ومحتوى تعليمي جديد 📚",
    body: "تم إضافة ملفات وملازم دراسية جديدة في قسم المقررات. يمكنك الاطلاع عليها الآن وتنزيلها.",
    category: "material_added" as const,
    priority: "important" as const,
    link: "/courses",
  },
  {
    name: "⏰ تغيير موعد محاضرة",
    title: "تنبيه: تغيير في موعد المحاضرة ⏰",
    body: "تم تعديل موعد المحاضرة المحددة. يرجى مراجعة جدول المواد والتواجد في الوقت المطلوب.",
    category: "announcement" as const,
    priority: "urgent" as const,
    link: "/feed",
  },
  {
    name: "📝 نتائج ورصد التقييمات",
    title: "إعلان نتائج وتقييمات جديدة 📝",
    body: "تم رصد ونشر نتائج التقييمات والاختبارات الأخيرة. يمكنك مراجعتها من حسابك الشخصي.",
    category: "announcement" as const,
    priority: "important" as const,
    link: "/profile",
  },
  {
    name: "🎯 تذكير بتسليم الواجب",
    title: "تذكير بآخر موعد لتسليم التكليف 🎯",
    body: "تذكير هام: ينتهي الموعد المحدد لتسليم التكليف المطلوب قريباً. نرجو من الجميع الالتزام برفع الملفات في الوقت المحدد.",
    category: "announcement" as const,
    priority: "normal" as const,
    link: "/feed",
  },
];

export function BroadcastNotificationTab() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"create" | "history">("create");

  // Form states
  const [targetType, setTargetType] = useState<"all" | "academic" | "user">("academic");
  const [selectedMajor, setSelectedMajor] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<string>("ALL");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const [notifCategory, setNotifCategory] = useState<
    "announcement" | "material_added" | "course_added" | "comment_reply"
  >("announcement");
  const [priority, setPriority] = useState<NotificationPriority>("normal");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/feed");
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Edit modal state
  const [editingNotif, setEditingNotif] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPriority, setEditPriority] = useState<NotificationPriority>("normal");
  const [editLink, setEditLink] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Search filter for history log
  const [historySearch, setHistorySearch] = useState("");

  // Fetch all user profiles for target dropdown
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles-for-notifs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, university_number, major, year")
        .order("full_name", { ascending: true })
        .limit(1000);
      return data ?? [];
    },
  });

  // Calculate target users list dynamically
  const { data: targetUsers = [] } = useQuery({
    queryKey: ["notif-target-users", targetType, selectedMajor, selectedYear, selectedUserId],
    queryFn: async () => {
      if (targetType === "user") {
        return selectedUserId ? [selectedUserId] : [];
      }
      let query = supabase.from("profiles").select("id");
      if (targetType === "academic") {
        if (selectedMajor !== "ALL") {
          query = query.or(`major.eq.${selectedMajor.toLowerCase()},major.eq.${selectedMajor.toUpperCase()}`);
        }
        if (selectedYear !== "ALL") {
          query = query.eq("year", Number(selectedYear));
        }
      }
      const { data } = await query;
      return (data ?? []).map((u) => u.id);
    },
  });

  // Fetch sent broadcast notifications log
  const { data: sentNotifs = [], isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["admin-sent-notifications-log"],
    queryFn: async () => {
      return await fetchAdminSentNotifications();
    },
    enabled: activeTab === "history",
  });

  const handleApplyTemplate = (tpl: typeof NOTIFICATION_TEMPLATES[0]) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    setNotifCategory(tpl.category);
    setPriority(tpl.priority);
    setLink(tpl.link);
    setShowPreview(true);
    toast.info(`تم تطبيق قالب "${tpl.name}" ✨`);
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("يرجى كتابة عنوان ومحتوى الإشعار");
      return;
    }

    if (targetUsers.length === 0) {
      toast.warning("لم يتم العثور على مستخدمين يطابقون شروط الاستهداف المختارة.");
      return;
    }

    setIsSending(true);

    try {
      const sentCount = await broadcastNotification({
        actorId: profile?.id,
        actorName: profile?.full_name || "إدارة المنصة الأكاديمية",
        actorAvatar: profile?.avatar_url,
        type: notifCategory,
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || "/feed",
        targetUserIds: targetUsers,
        priority,
      });

      if (sentCount > 0) {
        toast.success(`تم إرسال الإشعار بنجاح وحفظه لـ ${sentCount} طالب! 🔔`);
        setTitle("");
        setBody("");
        setLink("/feed");
        queryClient.invalidateQueries({ queryKey: ["admin-sent-notifications-log"] });
      } else {
        toast.error("لم يتم العثور على متلقين لإرسال الإشعار إليهم.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "حدث خطأ أثناء إرسال الإشعار");
    } finally {
      setIsSending(false);
    }
  };

  // Open edit dialog
  const handleOpenEdit = (notif: any) => {
    setEditingNotif(notif);
    setEditTitle(notif.title || "");
    setEditBody(notif.body || "");
    setEditPriority(notif.priority || "normal");
    setEditLink(notif.link || "/feed");
  };

  // Save notification update
  const handleSaveEdit = async () => {
    if (!editingNotif) return;
    if (!editTitle.trim() || !editBody.trim()) {
      toast.error("يرجى إدخال العنوان والمحتوى");
      return;
    }
    setIsUpdating(true);
    try {
      const ok = await updateNotificationInDB(editingNotif.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
        priority: editPriority,
        link: editLink.trim(),
      });
      if (ok) {
        toast.success("تم تعديل الإشعار بنجاح في قاعدة البيانات ✔️");
        setEditingNotif(null);
        refetchHistory();
      } else {
        toast.error("فشل تعديل الإشعار");
      }
    } catch (err) {
      toast.error("خطأ أثناء تعديل الإشعار");
    } finally {
      setIsUpdating(false);
    }
  };

  // Retract / Delete single notification
  const handleDeleteNotif = async (id: string) => {
    if (!confirm("هل أنت تأكد من سحب/حذف هذا الإشعار؟ سيتم إزالته من صندوق الطالب.")) return;
    try {
      const ok = await deleteNotificationFromDB(id);
      if (ok) {
        toast.success("تم سحب الإشعار وإزالته بنجاح 🗑️");
        refetchHistory();
      } else {
        toast.error("تعذر حذف الإشعار");
      }
    } catch (e) {
      toast.error("خطأ أثناء الحذف");
    }
  };

  // Duplicate / Resend
  const handleResend = (notif: any) => {
    setTitle(notif.title || "");
    setBody(notif.body || "");
    setPriority(notif.priority || "normal");
    setLink(notif.link || "/feed");
    setActiveTab("create");
    setShowPreview(true);
    toast.info("تم نسخ بيانات الإشعار للنموذج. يمكنك استهدافه وإرساله الآن 🚀");
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

  // Filtered profiles for student selection
  const filteredProfiles = profiles.filter((p) => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.university_number?.toLowerCase().includes(q) ||
      p.major?.toLowerCase().includes(q)
    );
  });

  // Filter history
  const filteredHistory = sentNotifs.filter((n: any) => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (
      n.title?.toLowerCase().includes(q) ||
      n.body?.toLowerCase().includes(q) ||
      n.actor_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 dir-rtl">
      {/* Tab Header Switcher */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span>مركز إشعارات الطلاب</span>
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              إرسال وتخصيص وتعديل وسحب الإشعارات للطلاب في الوقت الفعلي.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-2xl border border-border/50">
          <Button
            type="button"
            variant={activeTab === "create" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("create")}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <Send className="w-3.5 h-3.5" />
            إرسال إشعار
          </Button>
          <Button
            type="button"
            variant={activeTab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className="rounded-xl text-xs font-bold gap-1.5 h-9"
          >
            <History className="w-3.5 h-3.5" />
            السجل والتعديل
          </Button>
        </div>
      </div>

      {/* CREATE TAB */}
      {activeTab === "create" && (
        <div className="space-y-6">
          {/* Quick Preset Templates Bar */}
          <div className="bg-card border border-border/60 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-amber-500" />
                قوالب إشعارات جاهزة بضغطة زر:
              </Label>
              <span className="text-[11px] text-muted-foreground">اضغط لاختيار قالب جاهز للتعديل</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {NOTIFICATION_TEMPLATES.map((tpl, i) => (
                <Button
                  key={i}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyTemplate(tpl)}
                  className="rounded-2xl text-xs font-semibold hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all border-border/60"
                >
                  {tpl.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-xs space-y-6">
            <form onSubmit={handleSendNotification} className="space-y-6">
              {/* STEP 1: Target Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    ١. تحديد الطلاب المستهدفين
                  </Label>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5" />
                    {targetUsers.length} طالب مستهدف
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { key: "academic" as const, icon: <GraduationCap className="w-5 h-5 text-primary" />, title: "تخصص / سنة محددة", desc: "استهداف قسم أو سنة دراسية معينة" },
                    { key: "all" as const, icon: <Megaphone className="w-5 h-5 text-indigo-500" />, title: "جميع الطلاب", desc: "إشعار عام لكافة المسجلين" },
                    { key: "user" as const, icon: <Users className="w-5 h-5 text-purple-500" />, title: "طالب محدد", desc: "رسالة موجهة لطالب واحد" },
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

                {/* Academic Filters */}
                {targetType === "academic" && (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">التخصص الدراسي</Label>
                      <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                        <SelectTrigger className="rounded-xl bg-background">
                          <SelectValue placeholder="اختر التخصص" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">جميع التخصصات</SelectItem>
                          <SelectItem value="it">تقنية المعلومات (IT)</SelectItem>
                          <SelectItem value="is">نظم المعلومات (IS)</SelectItem>
                          <SelectItem value="se">هندسة البرمجيات (SE)</SelectItem>
                          <SelectItem value="cs">علوم الحاسوب (CS)</SelectItem>
                          <SelectItem value="ai">الذكاء الاصطناعي (AI)</SelectItem>
                          <SelectItem value="cyber">الأمن السيبراني (CYBER)</SelectItem>
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

                {/* Single Student Selector with Live Search */}
                {targetType === "user" && (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-3 mt-3">
                    <Label className="text-xs font-semibold">بحث عن طالب بالتكليف أو الرقم الجامعي:</Label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                      <Input
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="اكتب اسم الطالب أو الرقم الجامعي للفلترة..."
                        className="rounded-xl pr-9 bg-background"
                      />
                    </div>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="rounded-xl bg-background">
                        <SelectValue placeholder="اختر الطالب المطلوب..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {filteredProfiles.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name} ({formatUnivNumber(p.university_number, false, true)}) — {majorLabel(p.major)}
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
                  ٢. أولوية ودرجة أهمية الإشعار
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
                  ٣. محتوى ونص الإشعار
                </Label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">تصنيف الإشعار</Label>
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
                    <Label className="text-xs font-semibold">رابط التوجيه عند الضغط على الإشعار</Label>
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
                  <Label className="text-xs font-semibold">تفاصيل ونص الإشعار</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="اكتب تفاصيل الإشعار هنا..."
                    rows={4}
                    className="rounded-xl leading-relaxed"
                  />
                </div>
              </div>

              {/* STEP 4: Live Preview & Send */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-primary" />
                    ٤. معاينة النتيجة والإرسال
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

                {showPreview && (title || body) && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white space-y-2 border border-white/10 shadow-md">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        priority === "urgent" ? "bg-red-500/30 text-red-300" :
                        priority === "important" ? "bg-amber-500/30 text-amber-300" :
                        "bg-blue-500/30 text-blue-300"
                      }`}>
                        {priorityConfig[priority].label}
                      </span>
                      <span className="text-white/50">{categoryIcons[notifCategory]} {notifCategory === "announcement" ? "إعلان" : notifCategory === "material_added" ? "ملف جديد" : notifCategory === "course_added" ? "كورس جديد" : "رسالة"}</span>
                      <span className="text-white/40 mr-auto">{targetUsers.length} مستلم</span>
                    </div>
                    {title && (
                      <h4 className="font-bold text-sm">{categoryIcons[notifCategory]} {title}</h4>
                    )}
                    {body && (
                      <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">{body}</p>
                    )}
                    {link && (
                      <span className="text-[10px] text-white/30 dir-ltr inline-block">{link}</span>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSending || !title.trim() || !body.trim() || targetUsers.length === 0}
                  className="w-full h-12 rounded-2xl text-base font-bold gap-2 bg-primary hover:bg-primary/90 shadow-md transition-all"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري حفظ وإرسال الإشعار...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      إرسال الإشعار إلى {targetUsers.length} طالب الآن
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY & EDIT TAB */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/60">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="البحث في سجل الإشعارات..."
                className="rounded-xl pr-9 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetchHistory()}
              className="rounded-xl text-xs font-semibold gap-1.5 h-9 w-full sm:w-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              تحديث السجل
            </Button>
          </div>

          {isLoadingHistory ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border/60 rounded-3xl p-8">
              <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">لا توجد إشعارات سابقة في السجل</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((notif: any) => (
                <div
                  key={notif.id}
                  className="bg-card border border-border/60 rounded-2xl p-4 transition-all hover:border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        notif.priority === "urgent" ? "bg-red-500/10 text-red-500" :
                        notif.priority === "important" ? "bg-amber-500/10 text-amber-500" :
                        "bg-blue-500/10 text-blue-500"
                      }`}>
                        {notif.priority === "urgent" ? "عاجل" : notif.priority === "important" ? "مهم" : "عام"}
                      </span>
                      <span className="text-[11px] font-semibold text-foreground">
                        {categoryIcons[notif.type]} {notif.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground mr-auto">
                        {new Date(notif.created_at).toLocaleString("ar-SA", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {notif.body}
                    </p>

                    {notif.link && (
                      <span className="text-[10px] text-primary/70 dir-ltr inline-block font-mono">
                        {notif.link}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(notif)}
                      className="rounded-xl text-xs gap-1.5 h-8 font-semibold text-indigo-600 hover:bg-indigo-50 border-indigo-200"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      تعديل
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleResend(notif)}
                      className="rounded-xl text-xs gap-1.5 h-8 font-semibold text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      إعادة إرسال
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteNotif(notif.id)}
                      className="rounded-xl text-xs gap-1.5 h-8 font-semibold text-rose-600 hover:bg-rose-50 border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      سحب الإشعار
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      <Dialog open={!!editingNotif} onOpenChange={(open) => !open && setEditingNotif(null)}>
        <DialogContent className="dir-rtl max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              تعديل الإشعار في صندوق الطالب
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              يمكنك تعديل محتوى الإشعار مباشرة وسينعكس التعديل فوراً في حسابات الطلاب المتلقين.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">عنوان الإشعار</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="rounded-xl font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">تفاصيل ونص الإشعار</Label>
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
                className="rounded-xl leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الأولوية</Label>
                <Select
                  value={editPriority}
                  onValueChange={(v) => setEditPriority(v as NotificationPriority)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">🔴 عاجل</SelectItem>
                    <SelectItem value="important">🟡 مهم</SelectItem>
                    <SelectItem value="normal">🔵 عام</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">رابط الوجهة</Label>
                <Input
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  className="rounded-xl dir-ltr text-left"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingNotif(null)}
              className="rounded-xl text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={handleSaveEdit}
              disabled={isUpdating}
              className="rounded-xl text-xs font-bold gap-1.5 bg-primary"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
