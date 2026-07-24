import { useEffect, useState, useCallback } from "react";
import { Download, Smartphone, Check } from "lucide-react";
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

    // 1. Listen for native install prompt
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

    // 2. Listen for appinstalled event
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

    // Register Service Worker if supported
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("PWA Service Worker Registered"))
        .catch((err) => console.warn("SW Registration failed:", err));
    }

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

    // Attempt direct native prompt if available and not in-app browser
    const promptEvent =
      deferredPrompt ||
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;

    if (promptEvent && !deviceInfo.isInAppBrowser) {
      const installed = await executeDirectInstall();
      if (installed) return;
    }

    // If no direct prompt or in-app browser or iOS -> open comprehensive guide modal
    setShowModal(true);
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

      {showBanner && !isInstalled && isBannerVisible && (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 md:bottom-6 md:left-auto md:right-6 md:w-96">
          <div className="bg-primary/95 backdrop-blur-xl border border-primary/20 p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-4 dir-rtl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div className="text-right">
                <h4 className="text-sm font-bold text-white leading-tight">تثبيت تطبيق NEXUS</h4>
                <p className="text-[11px] text-white/80 mt-0.5">
                  ثبّت التطبيق للوصول السريع والإشعارات!
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="h-8 rounded-xl bg-white text-primary hover:bg-white/90 text-xs font-bold px-4"
              >
                تثبيت الآن
              </Button>
              <button
                onClick={() => setIsBannerVisible(false)}
                className="text-[10px] text-white/70 hover:text-white text-center font-medium"
              >
                ليس الآن
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

