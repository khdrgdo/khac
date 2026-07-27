import { useEffect, useState, useCallback } from "react";
import { Download, Smartphone, Check, X, Sparkles, FileDown } from "lucide-react";
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

export function downloadNEXUSAppFile() {
  if (typeof window === "undefined") return;
  const currentOrigin = window.location.origin;
  const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NEXUS - المنصة الأكاديمية الذكية</title>
  <meta name="theme-color" content="#8b5cf6">
  <link rel="manifest" href="${currentOrigin}/manifest.json">
  <link rel="icon" href="${currentOrigin}/pwa-192.png">
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #fff; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
    .card { background: #181825; border: 1px solid #313244; padding: 32px 24px; border-radius: 28px; max-width: 380px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .logo { width: 88px; height: 88px; border-radius: 22px; box-shadow: 0 10px 25px rgba(139,92,246,0.4); margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #fff; }
    p { color: #a6adc8; font-size: 13px; line-height: 1.6; margin: 0 0 24px; }
    .btn { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 16px; font-weight: 700; font-size: 15px; display: block; box-shadow: 0 4px 15px rgba(139,92,246,0.3); transition: transform 0.2s; }
    .btn:active { transform: scale(0.97); }
    .badge { display: inline-block; background: rgba(166,227,161,0.15); color: #a6e3a1; border: 1px solid rgba(166,227,161,0.3); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">تطبيق NEXUS المستقل</span>
    <img src="${currentOrigin}/pwa-192.png" class="logo" alt="NEXUS">
    <h1>NEXUS المنصة الأكاديمية</h1>
    <p>انقر على الزر أدناه لفتح وتشغيل تطبيق NEXUS مباشرة على جهازك بدون شريط المتصفح.</p>
    <a id="launchBtn" href="${currentOrigin}" class="btn">فتح التطبيق الآن 🚀</a>
  </div>
  <script>
    setTimeout(() => {
      window.location.href = "${currentOrigin}";
    }, 500);
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "NEXUS-App-Launcher.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

    const checkIsInstalled = () => {
      const installedLocally = localStorage.getItem("nexus_pwa_installed") === "true";
      if (currentDevice.isStandalone || installedLocally) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    if (checkIsInstalled()) return;

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

    if ((window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt) {
      setDeferredPrompt(
        (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt || null,
      );
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
        toast.success("تم تثبيت وتنزيل تطبيق NEXUS بنجاح!");
        return true;
      }
    } catch (err) {
      console.warn("Error triggering install prompt:", err);
    } finally {      setDeferredPrompt(null);
      delete (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
    }
    return false;
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast.info("التطبيق مثبت ومحمل بالفعل على جهازك! 🎉");
      return;
    }

    // Download launcher file immediately
    downloadNEXUSAppFile();

    // Also attempt direct native prompt if available
    const promptEvent =
      deferredPrompt ||
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;

    if (promptEvent && !deviceInfo.isInAppBrowser) {
      const installed = await executeDirectInstall();
      if (installed) return;
    }

    toast.success("تم تنزيل ملف التطبيق (NEXUS-App-Launcher.html) بنجاح! 📲");
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
          التطبيق مثبت على جهازك
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
          <FileDown className="w-4 h-4 text-primary animate-pulse" />
          تنزيل التطبيق على هاتفك 📲
        </DropdownMenuItem>
      ) : variant === "banner" ? null : (
        <Button
          onClick={handleInstallClick}
          variant="default"
          size="sm"
          className={`gap-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm ${className}`}
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>تنزيل التطبيق</span>
        </Button>
      )}

      {/* Top Floating Notification Banner for Downloading App */}
      {showBanner && !isInstalled && isBannerVisible && (
        <div className="fixed top-3 inset-x-3 sm:top-4 sm:right-4 sm:left-auto z-50 sm:max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-900 via-purple-900 to-slate-900 border border-purple-500/30 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 dir-rtl text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 text-purple-300">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-right min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black text-white truncate">تنزيل تطبيق NEXUS</h4>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    مجاني
                  </span>
                </div>
                <p className="text-[11px] text-purple-200/90 truncate mt-0.5">
                  نزّل ملف التطبيق واستخدمه مباشرة بدون شريط المتصفح!
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
                تنزيل الآن
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

