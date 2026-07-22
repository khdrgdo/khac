import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase will place the recovery session automatically. Verify we have one.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Sometimes tokens land in hash; give supabase a tick.
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => setReady(!!d2.session));
        }, 300);
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error("كلمة السر قصيرة");
      return;
    }
    if (pw !== pw2) {
      toast.error("كلمتا السر غير متطابقتين");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث كلمة السر");
    navigate({ to: "/feed", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> إعادة تعيين كلمة السر
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-muted-foreground">
              الرابط غير صالح أو منتهي. عد إلى صفحة الدخول واطلب رابطًا جديدًا.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>كلمة السر الجديدة</Label>
                <Input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label>تأكيد كلمة السر</Label>
                <Input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
