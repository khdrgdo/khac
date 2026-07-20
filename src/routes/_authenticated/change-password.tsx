import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("كلمة السر يجب أن تكون 6 أحرف على الأقل");
    if (pw !== pw2) return toast.error("كلمتا السر غير متطابقتين");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      if (profile?.must_change_password) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", profile.id);
      }
      toast.success("تم تحديث كلمة السر");
      navigate({ to: "/feed" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>تغيير كلمة السر</CardTitle>
              <CardDescription>
                {profile?.must_change_password
                  ? "يرجى تغيير كلمة السر الافتراضية"
                  : "اختر كلمة سر جديدة"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
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
        </CardContent>
      </Card>
    </div>
  );
}
