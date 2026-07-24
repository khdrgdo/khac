import { useState, useEffect } from "react";
import {
  usePinnedCard,
  PinnedCardConfig,
  PinnedCardType,
  PinnedCardTheme,
} from "@/lib/pinnedCardStore";
import { PinnedEventCard } from "@/components/PinnedEventCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Trophy,
  BarChart3,
  Calendar,
  Megaphone,
  Eye,
  EyeOff,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Users,
  Image as ImageIcon,
  Palette,
  Target,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PinnedCardAdminTab() {
  const { config, updateConfig } = usePinnedCard();

  const [form, setForm] = useState<PinnedCardConfig>(config);
  const [newOptionText, setNewOptionText] = useState("");

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleSave = () => {
    updateConfig(form);
    toast.success("تم حفظ إعدادات الكارد المثبت بنجاح! 🚀");
  };

  const handleResetDefault = () => {
    const defaultDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const resetData: PinnedCardConfig = { ...config, endDate: defaultDate };
    setForm(resetData);
    updateConfig(resetData);
    toast.info("تمت استعادة الإعدادات الافتراضية");
  };

  const handleAddPollOption = () => {
    if (!newOptionText.trim()) return;
    const newOpt = {
      id: `opt_${Date.now()}`,
      text: newOptionText.trim(),
    };
    const updatedOptions = [...form.pollOptions, newOpt];
    setForm({ ...form, pollOptions: updatedOptions });
    setNewOptionText("");
  };

  const handleRemovePollOption = (id: string) => {
    const updatedOptions = form.pollOptions.filter((o) => o.id !== id);
    setForm({ ...form, pollOptions: updatedOptions });
  };

  const handleClearVotes = () => {
    setForm({ ...form, votes: {} });
    updateConfig({ votes: {} });
    toast.success("تم مسح نتائج التصويت بنجاح!");
  };

  const handleClearParticipants = () => {
    setForm({ ...form, participants: [] });
    updateConfig({ participants: [] });
    toast.success("تم إفرغ قائمة المشاركين بنجاح!");
  };

  const themeOptions: { id: PinnedCardTheme; label: string; colorBg: string; text: string }[] = [
    {
      id: "royal",
      label: "بنفسجي ملكي (Royal)",
      colorBg: "bg-purple-600",
      text: "text-purple-400",
    },
    {
      id: "emerald",
      label: "زمردي مشرق (Emerald)",
      colorBg: "bg-emerald-600",
      text: "text-emerald-400",
    },
    { id: "amber", label: "ذهبي فاخر (Amber)", colorBg: "bg-amber-500", text: "text-amber-400" },
    {
      id: "sapphire",
      label: "أزرق ياقتي (Sapphire)",
      colorBg: "bg-blue-600",
      text: "text-blue-400",
    },
    {
      id: "crimson",
      label: "قرمزي متوهج (Crimson)",
      colorBg: "bg-rose-600",
      text: "text-rose-400",
    },
    { id: "cyber", label: "سايبر داكن (Cyber)", colorBg: "bg-cyan-500", text: "text-cyan-400" },
  ];

  const typeOptions: { id: PinnedCardType; label: string; icon: typeof Trophy; desc: string }[] = [
    { id: "contest", label: "مسابقة وتحدي", icon: Trophy, desc: "مسابقة جوائز وحوافز للطلبة" },
    {
      id: "poll",
      label: "استطلاع / سؤال",
      icon: BarChart3,
      desc: "سؤال تفاعلي مع خيارات وتصويت مباشر",
    },
    {
      id: "event",
      label: "حدث / ورشة عمل",
      icon: Calendar,
      desc: "محاضرة أو ورشة عمل مع حجز مقاعد",
    },
    {
      id: "announcement",
      label: "إعلان عام هام",
      icon: Megaphone,
      desc: "تنبيه رسمي مع زر إجراء خارجي",
    },
  ];

  return (
    <div className="space-y-6 dir-rtl max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-slate-900/60 p-5 rounded-3xl border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-black text-foreground">
              إدارة الكارد المثبت والأحداث الرئيسية
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            تخصيص الكارد المميز الثابت في أعلى التغذية للطلبة (مسابقات، استطلاعات رأي، أحداث،
            وإعلانات عاجلة).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 rounded-xl shadow-lg shadow-primary/20"
          >
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات</span>
          </Button>

          <Button
            onClick={handleResetDefault}
            variant="outline"
            className="text-xs gap-1.5 rounded-xl border-border/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>افتراضي</span>
          </Button>
        </div>
      </div>

      {/* Live Card Interactive Preview Section */}
      <Card className="border-border/50 shadow-sm bg-card/60 backdrop-blur-xl overflow-hidden rounded-3xl">
        <CardHeader className="pb-2 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span>معاينة حية للمستخدمين (Live Preview)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              هكذا يظهر الكارد المثبت للطلبة في أعلى التغذية بالمنشورات.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground">حالة العرض:</span>
            <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-xl border border-border/40">
              <Switch
                checked={form.enabled}
                onCheckedChange={(val) => {
                  setForm({ ...form, enabled: val });
                  updateConfig({ enabled: val });
                }}
              />
              <span
                className={cn(
                  "text-xs font-extrabold",
                  form.enabled ? "text-emerald-500" : "text-muted-foreground",
                )}
              >
                {form.enabled ? "مفعل ومثبت 🟢" : "مخفي تماماً ⚪"}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-6 bg-slate-950/20">
          <PinnedEventCard isAdminPreview={true} />
        </CardContent>
      </Card>

      {/* Customization Controls Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column: Basic Details & Theme */}
        <div className="space-y-6">
          {/* Card Type Selector */}
          <Card className="border-border/50 shadow-xs bg-card rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span>1. نوع الحدث الكارد</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2.5">
              {typeOptions.map((t) => {
                const Icon = t.icon;
                const isSelected = form.type === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setForm({ ...form, type: t.id })}
                    className={cn(
                      "p-3 rounded-xl border text-right transition-all flex flex-col gap-1.5",
                      isSelected
                        ? "bg-primary/10 border-primary ring-2 ring-primary/20 text-foreground font-bold"
                        : "bg-muted/30 hover:bg-muted/50 border-border/40 text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "w-4 h-4",
                          isSelected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span className="text-xs font-bold">{t.label}</span>
                    </div>
                    <span className="text-[10px] opacity-80 leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Color Theme Selector */}
          <Card className="border-border/50 shadow-xs bg-card rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-500" />
                <span>2. المظهر والألوان التفاعلية</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {themeOptions.map((tm) => {
                const isSelected = form.theme === tm.id;
                return (
                  <button
                    key={tm.id}
                    onClick={() => setForm({ ...form, theme: tm.id })}
                    className={cn(
                      "p-2.5 rounded-xl border text-right transition-all flex items-center gap-2.5",
                      isSelected
                        ? "bg-primary/10 border-primary ring-2 ring-primary/20 font-bold"
                        : "bg-muted/30 hover:bg-muted/50 border-border/40",
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded-full shrink-0 shadow-xs", tm.colorBg)} />
                    <span className="text-xs font-semibold">{tm.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Content Inputs */}
          <Card className="border-border/50 shadow-xs bg-card rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>3. تفاصيل المحتوى والنصوص</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">شارة الكارد (Badge Text)</Label>
                <Input
                  value={form.badgeText}
                  onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                  placeholder="مثال: 🏆 مسابقة الأسبوع المميزة"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">العنوان الرئيسي للحدث</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="عنوان الكارد المثبت"
                  className="text-xs font-bold rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الوصف والتفاصيل</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="اكتب شرحاً تفصيلياً أو السؤال المطروح للطلبة..."
                  rows={3}
                  className="text-xs rounded-xl resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>رابط صورة إعلانية (اختياري)</span>
                </Label>
                <Input
                  value={form.imageUrl || ""}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                  className="text-xs rounded-xl dir-ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>تاريخ ووقت انتهاء التقديم/الحدث (للعداد التنازلي)</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={form.endDate ? new Date(form.endDate).toISOString().slice(0, 16) : ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      endDate: e.target.value ? new Date(e.target.value).toISOString() : "",
                    })
                  }
                  className="text-xs rounded-xl font-mono"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Dynamic Interactive Controls (Polls or Buttons) */}
        <div className="space-y-6">
          {/* POLL CONFIGURATION (If Type is Poll) */}
          {form.type === "poll" && (
            <Card className="border-border/50 shadow-xs bg-card rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-500" />
                  <span>خيارات الاستطلاع والتصويت</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {Object.keys(form.votes || {}).length} أصوات مسجلة
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">قائمة خيارات الإجابة:</Label>
                  <div className="space-y-2">
                    {form.pollOptions.map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                          {idx + 1}
                        </span>
                        <Input
                          value={opt.text}
                          onChange={(e) => {
                            const updated = form.pollOptions.map((o) =>
                              o.id === opt.id ? { ...o, text: e.target.value } : o,
                            );
                            setForm({ ...form, pollOptions: updated });
                          }}
                          className="text-xs rounded-xl flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemovePollOption(opt.id)}
                          className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      placeholder="إضافة خيار تصويت جديد..."
                      className="text-xs rounded-xl"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPollOption();
                        }
                      }}
                    />
                    <Button
                      onClick={handleAddPollOption}
                      size="sm"
                      className="text-xs gap-1 rounded-xl bg-primary text-primary-foreground font-bold shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة</span>
                    </Button>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    إعادة ضبط وإعادة فتح التصويت:
                  </span>
                  <Button
                    onClick={handleClearVotes}
                    variant="outline"
                    size="sm"
                    className="text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 rounded-xl"
                  >
                    <Trash2 className="w-3.5 h-3.5 ml-1" />
                    تفريغ الأصوات
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ACTION BUTTON & EVENT CONFIG (If Contest, Event, Announcement) */}
          {form.type !== "poll" && (
            <Card className="border-border/50 shadow-xs bg-card rounded-2xl">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>زر التفاعل وحجز المقاعد / المشاركة</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {form.participants?.length || 0} مشارك
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">نص زر التفاعل</Label>
                  <Input
                    value={form.actionButtonText || ""}
                    onChange={(e) => setForm({ ...form, actionButtonText: e.target.value })}
                    placeholder="مثال: سجل في المسابقة الآن / احجز مقعدك"
                    className="text-xs font-bold rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">رابط توجيه خارجي (اختياري)</Label>
                  <Input
                    value={form.actionButtonUrl || ""}
                    onChange={(e) => setForm({ ...form, actionButtonUrl: e.target.value })}
                    placeholder="https://example.com/register (اتركه فارغاً للتسجيل المباشر بالموقع)"
                    className="text-xs rounded-xl dir-ltr"
                  />
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">إعادة ضبط قائمة المسجلين:</span>
                  <Button
                    onClick={handleClearParticipants}
                    variant="outline"
                    size="sm"
                    className="text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 rounded-xl"
                  >
                    <Users className="w-3.5 h-3.5 ml-1" />
                    تفريغ المشاركين
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Action Card */}
          <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>جاهز للنشر على منصة الجامعة؟</span>
            </div>
            <p className="text-xs text-muted-foreground">
              عند الضغط على حفظ التعديلات، سيتم تحديث الكارد المثبت فوراً لجميع الطلاب في الصفحة
              الرئيسية.
            </p>
            <Button
              onClick={handleSave}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl shadow-md gap-2"
            >
              <Save className="w-4 h-4" />
              <span>تطبيق ونشر الكارد الآن</span>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
