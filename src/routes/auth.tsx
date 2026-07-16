import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MAJORS, YEARS, universityNumberToEmail } from "@/lib/college";
import { GraduationCap, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-lg">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">منصة الكلية</h1>
          <p className="text-sm text-muted-foreground mt-1">للطلاب والأساتذة</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle>مرحبًا بك</CardTitle>
            <CardDescription>سجّل الدخول بالرقم الجامعي أو أنشئ حسابًا جديدًا</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
              </TabsList>
              <TabsContent value="login"><LoginForm /></TabsContent>
              <TabsContent value="signup"><SignupForm onDone={() => setTab("login")} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-4">
          كلمة السر الافتراضية هي نفس رقمك الجامعي عند أول تسجيل
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [univ, setUniv] = useState("");
  const [password, setPassword] = useState("");
  const [teacherMode, setTeacherMode] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const identifier = teacherMode ? email.trim() : universityNumberToEmail(univ);
      const { error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });
      if (error) throw error;
      toast.success("تم تسجيل الدخول");
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error("فشل تسجيل الدخول: بيانات غير صحيحة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {teacherMode ? (
        <div className="space-y-1.5">
          <Label>البريد الإلكتروني</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required dir="ltr" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>الرقم الجامعي</Label>
          <Input value={univ} onChange={(e) => setUniv(e.target.value)} required dir="ltr" placeholder="مثال: 202312345" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>كلمة السر</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        دخول
      </Button>
      <button type="button" onClick={() => setTeacherMode(!teacherMode)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
        {teacherMode ? "أنا طالب — استخدم الرقم الجامعي" : "أنا أستاذ — استخدم البريد الإلكتروني"}
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [univ, setUniv] = useState("");
  const [name, setName] = useState("");
  const [major, setMajor] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = univ.trim();
    if (cleaned.length < 6) {
      toast.error("الرقم الجامعي قصير جدًا (6 خانات على الأقل)");
      return;
    }
    if (!major || !year) {
      toast.error("اختر التخصص والسنة");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: universityNumberToEmail(cleaned),
        password: cleaned,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            university_number: cleaned,
            full_name: name.trim(),
            major,
            year: Number(year),
            role: "student",
            must_change_password: true,
          },
        },
      });
      if (error) {
        if (error.message.includes("registered")) {
          toast.error("هذا الرقم الجامعي مسجّل مسبقًا");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("تم إنشاء الحساب — كلمة السر هي رقمك الجامعي، سجّل الدخول");
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>الرقم الجامعي</Label>
        <Input value={univ} onChange={(e) => setUniv(e.target.value)} required dir="ltr" placeholder="202312345" />
      </div>
      <div className="space-y-1.5">
        <Label>الاسم الكامل</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>التخصص</Label>
          <Select value={major} onValueChange={setMajor}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {MAJORS.map((m) => <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>السنة</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{`السنة ${y}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        كلمة السر الأولى ستكون نفس الرقم الجامعي — يمكنك تغييرها بعد الدخول.
      </p>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        إنشاء الحساب
      </Button>
    </form>
  );
}
