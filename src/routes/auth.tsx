import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MAJORS, YEARS, universityNumberToEmail } from "@/lib/college";
import {
  GraduationCap,
  Loader2,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  HelpCircle,
  KeyRound,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [prefilledEmail, setPrefilledEmail] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data?.session) navigate({ to: "/feed", replace: true });
      })
      .catch((err) => {
        console.error("Auth session check failed:", err);
      });
  }, [navigate]);

  async function googleSignIn() {
    setLoadingGoogle(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result && "error" in result && result.error) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
        if (error) toast.error("تعذّر تسجيل الدخول بغوغل: " + error.message);
      }
    } catch {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) toast.error("تعذّر تسجيل الدخول بغوغل");
    } finally {
      setLoadingGoogle(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-lg shadow-primary/20">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">منصة الكلية الجامعية</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            البوابة الأكاديمية والتواصل الاجتماعي للطلاب والأساتذة
          </p>
        </div>

        <Card className="shadow-xl border-border/70">
          <CardHeader className="pb-3 text-right">
            <CardTitle className="text-lg">مرحبًا بك</CardTitle>
            <CardDescription className="text-xs">
              اختر طريقة المتابعة المباشرة عبر غوغل أو التسجيل اليدوي
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-right">
            {/* Quick Google Login */}
            <div className="space-y-1.5">
              <Button
                variant="outline"
                className="w-full gap-2.5 h-11 border-primary/30 hover:bg-primary/5 text-foreground font-medium text-xs sm:text-sm shadow-xs transition-all"
                onClick={googleSignIn}
                disabled={loadingGoogle}
              >
                {loadingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                <span>المتابعة السريعة عبر غوغل</span>
              </Button>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>✨ بدون كلمة سر</span>
                <span>دخول أسرع لحسابك</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border/80" />
              <span className="text-xs text-muted-foreground font-medium px-1">
                أو عبر النموذج اليدوي
              </span>
              <div className="flex-1 h-px bg-border/80" />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login" className="text-xs sm:text-sm">
                  تسجيل الدخول
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-xs sm:text-sm">
                  حساب جديد
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <LoginForm initialId={prefilledEmail} />
              </TabsContent>

              <TabsContent value="signup">
                <SignupForm
                  onCreated={(email) => {
                    setPrefilledEmail(email);
                  }}
                  onGoToLogin={() => setTab("login")}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.4 30.2 0 24 0 14.7 0 6.7 5.3 2.8 13.1l7.8 6c1.9-5.6 7.1-9.6 13.4-9.6z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.6c-.5 2.9-2.1 5.4-4.5 7.1l7 5.4c4.1-3.8 6.4-9.4 6.4-17z"
      />
      <path
        fill="#FBBC05"
        d="M10.6 28.6c-.5-1.5-.8-3.1-.8-4.6s.3-3.1.8-4.6l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.8 10.6l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.2 0 11.4-2 15.2-5.5l-7-5.4c-2 1.3-4.5 2-8.2 2-6.3 0-11.5-4-13.4-9.6l-7.8 6C6.7 42.7 14.7 48 24 48z"
      />
    </svg>
  );
}

function LoginForm({ initialId = "" }: { initialId?: string }) {
  const navigate = useNavigate();
  const [id, setId] = useState(initialId);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (initialId) setId(initialId);
  }, [initialId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setUnconfirmedEmail(null);
    try {
      const value = id.trim();
      const email = value.includes("@") ? value : universityNumberToEmail(value);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (
          error.message.toLowerCase().includes("email not confirmed") ||
          error.message.toLowerCase().includes("not verified")
        ) {
          setUnconfirmedEmail(email);
          toast.error("البريد الإلكتروني لم يتفعل بعد. يرجى مراجعة بريدك وتأكيده.");
          return;
        }
        toast.error("البريد الإلكتروني أو الرقم الجامعي أو كلمة السر غير صحيحة");
        return;
      }

      if (data?.session) {
        toast.success("أهلاً بك! تم تسجيل الدخول بنجاح");
        navigate({ to: "/feed" });
      }
    } catch {
      toast.error("حدث خطأ أثناء الاتصال. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3.5 text-right">
        {unconfirmedEmail && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>الحساب يتطلب التفعيل بالبريد الإلكتروني</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              أرسلنا رابط التفعيل إلى:{" "}
              <strong className="text-foreground dir-ltr inline-block">{unconfirmedEmail}</strong>.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              يرجى فتح بريدك والتأكد من الضغط على رابط التفعيل (افحص صندوق الوارد ومجلد Spam).
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">البريد الإلكتروني أو الرقم الجامعي</Label>
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            dir="ltr"
            placeholder="202312345 أو student@example.com"
            className="text-left font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">كلمة السر</Label>
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              نسيت كلمة السر؟
            </button>
          </div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" className="w-full gap-2 mt-1" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <KeyRound className="w-4 h-4" />
          )}
          تسجيل الدخول
        </Button>
      </form>

      {forgotOpen && <ForgotPasswordDialog onClose={() => setForgotOpen(false)} />}
    </>
  );
}

function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!email.includes("@")) {
      toast.error("أدخل بريدًا إلكترونيًا صحيحًا");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم إرسال رابط إعادة تعيين كلمة السر إلى بريدك");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-sm shadow-2xl border-border/80"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="text-right pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> استعادة كلمة السر
          </CardTitle>
          <CardDescription className="text-xs">
            أدخل بريدك الإلكتروني ليصلك رابط إعادة الضبط.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 text-right">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">البريد الإلكتروني</Label>
            <Input
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="text-left font-mono"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              إلغاء
            </Button>
            <Button size="sm" onClick={send} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} إرسال الرابط
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SignupForm({
  onCreated,
  onGoToLogin,
}: {
  onCreated: (email: string) => void;
  onGoToLogin: () => void;
}) {
  const [univ, setUniv] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [major, setMajor] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedUniv = univ.trim();

    if (cleanedUniv.length < 5) {
      toast.error("الرقم الجامعي يجب أن يكون 5 أرقام أو أكثر");
      return;
    }
    if (!email.includes("@")) {
      toast.error("أدخل بريدًا إلكترونيًا صحيحًا");
      return;
    }
    if (!name.trim()) {
      toast.error("أدخل الاسم الكامل");
      return;
    }
    if (role === "student" && (!major || !year)) {
      toast.error("اختر التخصص والسنة الدراسية");
      return;
    }
    if (role === "teacher" && !major) {
      toast.error("اختر التخصص / القسم");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            university_number: cleanedUniv,
            full_name: name.trim(),
            major,
            year: role === "student" ? Number(year) : null,
            role,
            must_change_password: false,
          },
        },
      });

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("User already exists")
        ) {
          toast.error("هذا البريد الإلكتروني مسجّل مسبقًا. يمكنك تسجيل الدخول مباشرة.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      const registered = email.trim();
      setRegisteredEmail(registered);
      onCreated(registered);
      toast.success("تم إنشاء الحساب بنجاح! يلزم تفعيل البريد.");
    } catch {
      toast.error("حدث خطأ أثناء التسجيل. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  // Clear step-by-step verification guide when user registers manually
  if (registeredEmail) {
    return (
      <div className="space-y-4 py-2 text-right">
        {/* Banner */}
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm sm:text-base">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            <span>تم إنشاء حسابك بنجاح! (بانتظار التفعيل)</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            لقد أرسلنا رسالة تحتوي على رابط التفعيل إلى بريدك الإلكتروني:
          </p>
          <div className="p-2 bg-background rounded-lg border border-border/80 font-mono text-center dir-ltr text-xs text-foreground font-semibold">
            {registeredEmail}
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-2.5 bg-muted/40 p-4 rounded-xl border border-border/60 text-xs text-muted-foreground leading-relaxed">
          <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5 pb-1 border-b border-border/50">
            <HelpCircle className="w-4 h-4 text-primary" />
            خطوات بسيطة لتفعيل واستخدام حسابك:
          </h4>
          <ol className="space-y-2.5 pr-1">
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-foreground">افتح تطبيق البريد الإلكتروني:</strong> اذهب إلى
                تطبيق Gmail أو البريد الإلكتروني الخاص بهذا العنوان.
              </div>
            </li>

            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-foreground">افحص صندوق الوارد (Inbox):</strong> ابحث عن
                رسالة عنوانها "تأكيد الحساب" أو "Confirm Email" قادمة من منصة الكلية.
              </div>
            </li>

            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px] shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-foreground">ملاحظة هامة (الرسائل غير المرغوب فيها):</strong>{" "}
                إذا لم تجد الرسالة في الوارد، افتح مجلد{" "}
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Spam / Junk / الرسائل المهملة
                </span>
                .
              </div>
            </li>

            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-foreground">اضغط رابط التفعيل:</strong> افتح الرسالة واضغط
                على زر أو رابط{" "}
                <span className="text-primary font-semibold">"تأكيد البريد الإلكتروني"</span>.
              </div>
            </li>

            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[11px] shrink-0 mt-0.5">
                5
              </span>
              <div>
                <strong className="text-foreground">سجّل دخولك:</strong> عد هنا واضغط "تسجيل الدخول"
                وأدخل بريدك وكلمة السر التي اخترتها.
              </div>
            </li>
          </ol>
        </div>

        {/* Navigation Buttons */}
        <div className="space-y-2 pt-1">
          <Button
            className="w-full gap-2"
            onClick={() => {
              setRegisteredEmail(null);
              onGoToLogin();
            }}
          >
            <span>الذهاب إلى تسجيل الدخول</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Button>

          <Button
            variant="ghost"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setRegisteredEmail(null)}
          >
            إنشاء حساب آخر أو تعديل البريد
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-right">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">الرقم الجامعي</Label>
        <Input
          value={univ}
          onChange={(e) => setUniv(e.target.value)}
          required
          dir="ltr"
          placeholder="202312345"
          className="text-left font-mono"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">البريد الإلكتروني الشخصي</Label>
        <Input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="text-left font-mono"
        />
        <p className="text-[11px] text-muted-foreground">سنرسل لك رابط التفعيل على هذا البريد</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">الاسم الكامل</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="الاسم ثلاثي أو رباعي"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">الصفة في الكلية</Label>
        <Select value={role} onValueChange={(val) => setRole(val as "student" | "teacher")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student">طالب / طالبة</SelectItem>
            <SelectItem value="teacher">أستاذ مقرر / معيد</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {role === "student" ? (
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
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">التخصص / القسم</Label>
          <Select value={major} onValueChange={setMajor}>
            <SelectTrigger>
              <SelectValue placeholder="اختر القسم" />
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
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">كلمة السر</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="6 أحرف أو أرقام على الأقل"
        />
      </div>

      <Button type="submit" className="w-full gap-2 mt-2" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        إنشاء الحساب الآن
      </Button>

      <p className="text-[11px] text-muted-foreground text-center pt-1">
        سيصلك بريد إلكتروني يحتوي على رابط لتأكيد الحساب فور الضغط.
      </p>
    </form>
  );
}
