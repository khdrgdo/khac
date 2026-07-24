import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Trash2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function PasskeySettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passkeys, setPasskeys] = useState<{ id: string; name?: string; created_at: string }[]>([]);

  useEffect(() => {
    if (open && user) {
      loadPasskeys();
    }
  }, [open, user]);

  const loadPasskeys = async () => {
    try {
      setLoading(true);
      // Use any to bypass TS compilation if list() is missing in some version types, though we know it's there
      const { data, error } = await (
        supabase.auth as Record<
          string,
          {
            list: () => Promise<{ data: any[]; error: any }>;
            delete: (p: { id: string }) => Promise<{ error: any }>;
          }
        >
      ).passkey.list();
      if (error) throw error;
      setPasskeys(data ?? []);
    } catch (e: unknown) {
      // toast.error((e as Error).message || "خطأ");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      toast.success("تم تسجيل البصمة بنجاح");
      loadPasskeys();
    } catch (e: unknown) {
      toast.error((e as Error).message || "حدث خطأ أثناء تسجيل البصمة");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await (
        supabase.auth as Record<
          string,
          {
            list: () => Promise<{ data: any[]; error: any }>;
            delete: (p: { id: string }) => Promise<{ error: any }>;
          }
        >
      ).passkey.delete({ id });
      if (error) throw error;
      toast.success("تم حذف البصمة بنجاح");
      loadPasskeys();
    } catch (e: unknown) {
      toast.error((e as Error).message || "تعذر حذف البصمة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] dir-rtl text-right">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            إدارة البصمة (Passkeys)
          </DialogTitle>
          <DialogDescription>
            يمكنك تسجيل بصمة جهازك أو وجهك لتسجيل الدخول بشكل أسرع وأكثر أماناً في المرات القادمة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/40"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{pk.name || "بصمة مسجلة"}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(pk.created_at).toLocaleDateString("ar-EG")}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(pk.id)}
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {passkeys.length === 0 && !loading && (
              <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-xl">
                لا يوجد بصمات مسجلة حالياً
              </div>
            )}
          </div>

          <Button onClick={handleRegister} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة بصمة جديدة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
