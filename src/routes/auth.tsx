import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MAJORS, YEARS, universityNumberToEmail } from "@/lib/college";
import { GraduationCap, Loader2, Mail } from "lucide-react";

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

  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("تعذّر تسجيل الدخول بغوغل");
  }

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
            <CardDescription>سجّل الدخول أو أنشئ حسابًا جديدًا</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full gap-2" onClick={googleSignIn}>
              <GoogleIcon /> المتابعة عبر غوغل
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">أو</span>
              <div className="flex-1 h-px bg-border" />
            </div>

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
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.7 0 6.7 5.3 2.8 13.1l7.8 6c1.9-5.6 7.1-9.6 13.4-9.6z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 2.9-2.1 5.4-4.5 7.1l7 5.4c4.1-3.8 6.4-9.4 6.4-17z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.5-.8-3.1-.8-4.6s.3-3.1.8-4.6l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.8 10.6l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7-5.4c-2 1.3-4.5 2-8.2 2-6.3 0-11.5-4-13.4-9.6l-7.8 6C6.7 42.7 14.7 48 24 48z"/></svg>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const value = id.trim();
      const email = value.includes("@") ? value : universityNumberToEmail(value);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("تم تسجيل الدخول");
      navigate({ to: "/feed" });
    } catch {
      toast.error("بيانات غير صحيحة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>البريد الإلكتروني أو الرقم الجامعي</Label>
          <Input value={id} onChange={(e) => setId(e.target.value)} required dir="ltr" placeholder="you@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label>كلمة السر</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} دخول
        </Button>
        <button type="button" onClick={() => setForgotOpen(true)} className="text-xs text-primary hover:underline w-full text-center">
          نسيت كلمة السر؟
        </button>
      </form>
      {forgotOpen && <ForgotPasswordDialog onClose={() => setForgotOpen(false)} />}
    </>
  );
}

function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  async function send() {
    if (!email.includes("@")) { toast.error("أدخل بريدًا إلكترونيًا صحيحًا"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال رمز التأكيد إلى بريدك");
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> استعادة كلمة السر</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label>البريد الإلكتروني</Label>
          <Input dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button onClick={send} disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin" />} إرسال</Button>
          </div>
          <p className="text-xs text-muted-foreground">سنرسل لك رابط/رمز لإعادة تعيين كلمة السر عبر البريد.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [univ, setUniv] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [major, setMajor] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = univ.trim();
    if (cleaned.length < 6) { toast.error("الرقم الجامعي قصير جدًا"); return; }
    if (!email.includes("@")) { toast.error("أدخل بريدًا صحيحًا"); return; }
    if (!major || !year) { toast.error("اختر التخصص والسنة"); return; }
    if (!password || password.length < 6) {
      toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    const pw = password;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            university_number: cleaned,
            full_name: name.trim(),
            major, year: Number(year),
            role: "student",
            must_change_password: false,
          },
        },
      });
      if (error) {
        toast.error(error.message.includes("registered") ? "هذا البريد مسجّل مسبقًا" : error.message);
        return;
      }
      toast.success("تم إنشاء الحساب — تحقق من بريدك لتأكيد الحساب");
      onDone();
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>الرقم الجامعي</Label>
        <Input value={univ} onChange={(e) => setUniv(e.target.value)} required dir="ltr" placeholder="202312345" />
      </div>
      <div className="space-y-1.5">
        <Label>البريد الإلكتروني</Label>
        <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
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
            <SelectContent>{MAJORS.map((m) => <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>السنة</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{`السنة ${y}`}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>كلمة السر (6 أحرف على الأقل)</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="أدخل كلمة سر خاصة بك" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} إنشاء الحساب
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        سيتم إرسال رسالة تأكيد إلى بريدك الإلكتروني.
      </p>
      <p className="text-xs text-muted-foreground text-center">
        لديك حساب؟ <Link to="/auth" className="text-primary">سجّل الدخول</Link>
      </p>
    </form>
  );
}
