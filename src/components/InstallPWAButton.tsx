import { useEffect, useState, useCallback } from "react";
import { Download, Smartphone, Check, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { detectPWADevice, type PWADeviceInfo } from "@/lib/pwaDetector";
import { PWAInstallModal } from "@/components/PWAInstallModal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPWAButtonProps {
  showBanner?: boolean;
  variant?: "menu" | "button" | "header" | "banner";
  className?: string;
}

export function InstallPWAButton({
  variant = "banner",
  className,
  showBanner = false,
}: InstallPWAButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<PWADeviceInfo>(() => detectPWADevice());
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isBannerVisible, setIsBannerVisible] = useState(true);

  useEffect(() => {
    const currentDevice = detectPWADevice();
    setDeviceInfo(currentDevice);

    if (currentDevice.isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed banner recently in sessionStorage
    if (sessionStorage.getItem("nexus_pwa_banner_dismissed") === "true") {
      setIsBannerVisible(false);
    }

    // Listen for native install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt = promptEvent;
    };

    const handlePromptReady = () => {
      const prompt = (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
      if (prompt) {
        setDeferredPrompt(prompt);
      }
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      localStorage.setItem("nexus_pwa_installed", "true");
      setIsBannerVisible(false);
      setShowModal(false);
      toast.success("تم تثبيت تطبيق NEXUS بنجاح على جهازك! 🎉");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("pwa-prompt-ready", handlePromptReady);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if prompt was captured earlier globally
    if ((window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt) {
      setDeferredPrompt(
        (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt || null,
      );
    }

    // FIXED: Removed duplicate Service Worker registration.
    // SW is now registered once centrally in __root.tsx to avoid conflicts.

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const executeDirectInstall = useCallback(async (): Promise<boolean> => {
    const promptEvent =
      deferredPrompt ||
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;

    if (!promptEvent) return false;

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        localStorage.setItem("nexus_pwa_installed", "true");
        setIsBannerVisible(false);
        toast.success("تم تثبيت تطبيق NEXUS بنجاح!");
        return true;
      }
    } catch (err) {
      console.warn("Error triggering install prompt:", err);
    } finally {
      setDeferredPrompt(null);
      delete (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
    }
    return false;
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast.info("التطبيق مثبّت بالفعل على جهازك وتقوم باستخدامه الآن! 🎉");
      return;
    }

    // Attempt direct native prompt if available
    const promptEvent =
      deferredPrompt ||
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;

    if (promptEvent && !deviceInfo.isInAppBrowser) {
      const installed = await executeDirectInstall();
      if (installed) return;
    }

    // If no direct prompt captured or in-app browser or iOS -> open guide modal
    setShowModal(true);
  };

  const handleDismissBanner = () => {
    setIsBannerVisible(false);
    sessionStorage.setItem("nexus_pwa_banner_dismissed", "true");
  };

  if (isInstalled) {
    if (variant === "menu") {
      return (
        <DropdownMenuItem
          disabled
          className="rounded-xl py-2 px-2.5 gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 opacity-80"
        >
          <Check className="w-4 h-4 text-emerald-500" />
          التطبيق مثبّت على جهازك
        </DropdownMenuItem>
      );
    }
    return null;
  }

  return (
    <>
      {variant === "menu" ? (
        <DropdownMenuItem
          onClick={handleInstallClick}
          className="rounded-xl cursor-pointer py-2 px-2.5 gap-2 text-xs font-semibold text-primary focus:bg-primary/10 focus:text-primary"
        >
          <Smartphone className="w-4 h-4 text-primary animate-pulse" />
          تثبيت التطبيق على هاتفك 📲
        </DropdownMenuItem>
      ) : variant === "banner" ? null : (
        <Button
          onClick={handleInstallClick}
          variant="default"
          size="sm"
          className={`gap-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm ${className}`}
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>تثبيت التطبيق</span>
        </Button>
      )}

      {/* Top Floating Notification Banner for 1-Click Installation */}
      {showBanner && !isInstalled && isBannerVisible && (
        <div className="fixed top-3 inset-x-3 sm:top-4 sm:right-4 sm:left-auto z-50 sm:max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-900 via-purple-900 to-slate-900 border border-purple-500/30 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 dir-rtl text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 text-purple-300">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-right min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black text-white truncate">تثبيت تطبيق NEXUS</h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    مجاني
                  </span>
                </div>
                <p className="text-[11px] text-purple-200/90 truncate mt-0.5">
                  ثبته كتطبيق مستقل بدون شريط المتصفح!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="h-8 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white text-xs font-bold px-3.5 shadow-md gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                تثبيت الآن
              </Button>
              <button
                onClick={handleDismissBanner}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                title="إخفاء"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <PWAInstallModal
        open={showModal}
        onOpenChange={setShowModal}
        deviceInfo={deviceInfo}
        hasDirectPrompt={Boolean(
          deferredPrompt ||
            (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt,
        )}
        onDirectInstall={executeDirectInstall}
      />
    </>
  );
}
