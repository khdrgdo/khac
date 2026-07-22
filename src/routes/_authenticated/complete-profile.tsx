import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAJORS, YEARS } from "@/lib/college";
import { toast } from "sonner";
import { GraduationCap, Loader2, Sparkles, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/complete-profile")({
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const { profile, user, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [univ, setUniv] = useState("");
  const [name, setName] = useState("");
  const [major, setMajor] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setUniv(profile.university_number?.startsWith("U") ? "" : (profile.university_number ?? ""));
      setName(
        profile.full_name && profile.full_name !== "مستخدم" && profile.full_name !== "مستخدم جديد"
          ? profile.full_name
          : (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ""),
      );
      setMajor(profile.major ?? "");
      setYear(profile.year ? String(profile.year) : "");
    }
  }, [profile, user]);

  async function save() {
    if (!user) return;
    const cleanedUniv = univ.trim();
    if (cleanedUniv.length < 5) {
      toast.error("يرجى إدخال رقم جامعي صحيح (5 أرقام أو أكثر)");
      return;
    }
    if (!name.trim()) {
      toast.error("يرجى كتابة اسمك الكامل");
      return;
    }
    if (!major || !year) {
      toast.error("يرجى اختيار التخصص والسنة الدراسية");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          university_number: cleanedUniv,
          full_name: name.trim(),
          major: major as "it" | "is" | "se",
          year: Number(year),
        })
        .eq("id", user.id);

      if (error) {
        if (error.message.includes("duplicate") || error.message.includes("unique")) {
          toast.error("هذا الرقم الجامعي مضاف لمستخدم آخر مسبقاً");
        } else {
          toast.error(error.message);
        }
        setSaving(false);
        return;
      }

      toast.success("تم حفظ معلوماتك بنجاح!");
      await refreshProfile();
      navigate({ to: "/feed", replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">جاري تحميل البيانات...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-6 px-4">
      <Card className="shadow-lg border-border/80">
        <CardHeader className="text-right space-y-2 pb-4">
          <div className="inline-flex items-center gap-2 text-primary font-semibold text-xs bg-primary/10 px-3 py-1 rounded-full w-fit">
            <Sparkles className="w-3.5 h-3.5" /> خطوة سريعة لمرة واحدة
          </div>
          <CardTitle className="text-xl flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" /> أكمل ملفك الشخصي
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm leading-relaxed">
            أدخل اسمك ورقمك الجامعي لتخصيص حسابك ومتابعة زملائك في الكلية.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 text-right">
          <div className="bg-muted/50 border border-border/60 rounded-xl p-3.5 space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              تذكير هام للمسجلين عبر غوغل:
            </p>
            <p>
              لن تحتاج لكتابة كلمة سر في المرات القادمة! يمكنك الدخول بضغطة زر واحدة عبر حساب غوغل
              نفسه ({user?.email}).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الاسم الكامل</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: أحمد محمد علي"
              className="text-right"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الرقم الجامعي</Label>
            <Input
              value={univ}
              onChange={(e) => setUniv(e.target.value)}
              dir="ltr"
              placeholder="202312345"
              className="text-left font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">التخصص</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر التخصص" />
                </SelectTrigger>
                <SelectContent>
                  {MAJORS.map((m) => (
                    <SelectItem key={m.code} value={m.code}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">السنة الدراسية</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر السنة" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{`السنة ${y}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full mt-2 gap-2" size="lg" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            حفظ البيانات والمتابعة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
