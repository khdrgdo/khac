import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useIsPWAInstalled } from "@/hooks/useIsPWAInstalled";

export function PasskeyLoginButton() {
  const isPWAInstalled = useIsPWAInstalled();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!isPWAInstalled) return null;

  const handleLogin = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      if (data?.session) {
        toast.success("تم تسجيل الدخول بالبصمة بنجاح!");
        navigate({ to: "/feed" });
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("cancelled")) {
        // User cancelled, don't show an error
        return;
      }
      toast.error((e as Error).message || "فشل تسجيل الدخول بالبصمة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
      onClick={handleLogin}
      disabled={loading}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
      الدخول باستخدام البصمة
    </Button>
  );
}
