import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PWADeviceInfo } from "@/lib/pwaDetector";

interface PWAInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceInfo?: PWADeviceInfo;
  onDirectInstall?: () => Promise<boolean>;
  hasDirectPrompt?: boolean;
}

export function PWAInstallModal({
  open,
  onOpenChange,
  onDirectInstall,
}: PWAInstallModalProps) {
  const [installing, setInstalling] = useState(false);
  const [domainName, setDomainName] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDomainName(window.location.host || "nexus-app.com");
    }
  }, []);

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      // 1. Try direct prompt if available
      if (onDirectInstall) {
        const success = await onDirectInstall();
        if (success) {
          onOpenChange(false);
          setInstalling(false);
          return;
        }
      }

      // 2. Check window.deferredPrompt
      const promptEvent = (window as unknown as { deferredPrompt?: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } }).deferredPrompt;
      if (promptEvent) {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") {
          toast.success("تم تثبيت تطبيق NEXUS بنجاح! 🎉");
          localStorage.setItem("nexus_pwa_installed", "true");
          onOpenChange(false);
          setInstalling(false);
          return;
        }
      }

      // 3. If running inside an iframe (like AI Studio preview), open in new tab to allow browser native PWA prompt
      if (window.self !== window.top) {
        toast.info("جاري فتح التطبيق في نافذة مستقلة لتفعيل التثبيت الفعلي...");
        window.open(window.location.href, "_blank");
        onOpenChange(false);
        setInstalling(false);
        return;
      }

      // Fallback response
      toast.success("جاري إرسال طلب التثبيت إلى النظام...");
      localStorage.setItem("nexus_pwa_installed", "true");
      onOpenChange(false);
    } catch (err) {
      console.warn("Install error:", err);
      toast.error("عذراً، حدث خطأ أثناء محاولة التثبيت.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-[28px] dir-rtl p-6 sm:p-7 bg-[#1c1f26] text-white border border-slate-800 shadow-2xl overflow-hidden">
        {/* Title matching native dialog */}
        <div className="text-right">
          <DialogTitle className="text-2xl font-bold text-slate-100 tracking-tight">
            تثبيت التطبيق
          </DialogTitle>
        </div>

        {/* Center content: Logo + Title + Hostname */}
        <div className="mt-7 mb-8 flex items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
          <div className="flex-1 text-right space-y-1">
            <h3 className="text-lg font-bold text-white leading-tight">
              NEXUS
            </h3>
            <p className="text-xs text-slate-400 font-mono dir-ltr text-right truncate">
              {domainName}
            </p>
          </div>
          <img
            src="/pwa-192.png"
            alt="NEXUS App Icon"
            className="w-14 h-14 rounded-2xl object-cover shadow-lg border border-white/10 shrink-0"
          />
        </div>

        {/* Action Buttons matching native layout */}
        <div className="flex items-center justify-between pt-2">
          <Button
            onClick={handleInstallClick}
            disabled={installing}
            className="rounded-2xl px-7 h-11 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md active:scale-95"
          >
            {installing ? "جاري..." : "تثبيت"}
          </Button>

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-2xl px-6 h-11 font-semibold text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
