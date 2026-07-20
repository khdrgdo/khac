import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { GraduationCap, Loader2 } from "lucide-react";

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
        profile.full_name && profile.full_name !== "مستخدم"
          ? profile.full_name
          : (user?.user_metadata?.full_name ?? ""),
      );
      setMajor(profile.major ?? "");
      setYear(profile.year ? String(profile.year) : "");
    }
  }, [profile, user]);

  async function save() {
    if (!user) return;
    if (univ.trim().length < 6) {
      toast.error("الرقم الجامعي قصير");
      return;
    }
    if (!name.trim()) {
      toast.error("أدخل الاسم");
      return;
    }
    if (!major || !year) {
      toast.error("اختر التخصص والسنة");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          university_number: univ.trim(),
          full_name: name.trim(),
          major: major as "it" | "is" | "se",
          year: Number(year),
        })
        .eq("id", user.id);
      if (error) {
        toast.error(error.message.includes("duplicate") ? "الرقم الجامعي مستخدم" : error.message);
        setSaving(false);
        return;
      }
      toast.success("تم الحفظ");
      await refreshProfile();
      navigate({ to: "/feed", replace: true });
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" /> أكمل ملفك
          </CardTitle>
          <p className="text-sm text-muted-foreground">أدخل معلوماتك لإكمال إنشاء الحساب.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>الرقم الجامعي</Label>
            <Input
              value={univ}
              onChange={(e) => setUniv(e.target.value)}
              dir="ltr"
              placeholder="202312345"
            />
          </div>
          <div className="space-y-1.5">
            <Label>الاسم الكامل</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>التخصص</Label>
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
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
              <Label>السنة</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{`السنة ${y}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ ومتابعة
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
