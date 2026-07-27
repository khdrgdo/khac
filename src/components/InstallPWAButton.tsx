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

// دالة تنزيل ملف مشغل NEXUS التطبيق
export function downloadNEXUSAppFile() {
  const launcherHTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#6366f1">
    <meta name="description" content="مشغل تطبيق NEXUS PWA - ثبّت التطبيق مباشرة بدون مشاكل المتصفحات المدمجة">
    <title>NEXUS App Launcher</title>
    <link rel="manifest" href="${window.location.origin}/manifest.json">
    <link rel="apple-touch-icon" href="${window.location.origin}/pwa-192.png">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #333;
        }

        .container {
            background: white;
            border-radius: 24px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        }

        .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            font-weight: bold;
            color: white;
        }

        h1 {
            font-size: 28px;
            color: #1f2937;
            margin-bottom: 12px;
            font-weight: 700;
        }

        .description {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .features {
            background: #f3f4f6;
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 32px;
            text-align: right;
        }

        .features ul {
            list-style: none;
        }

        .features li {
            padding: 8px 0;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            color: #374151;
            font-size: 14px;
        }

        .features li::before {
            content: "✓";
            color: #10b981;
            font-weight: bold;
            margin-left: 12px;
            font-size: 18px;
        }

        .button-group {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
        }

        button {
            padding: 14px 28px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            flex: 1;
            min-width: 160px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        .btn-secondary {
            background: #e5e7eb;
            color: #1f2937;
        }

        .btn-secondary:hover {
            background: #d1d5db;
        }

        .status {
            margin-top: 24px;
            padding: 16px;
            background: #ecfdf5;
            border: 1px solid #d1fae5;
            border-radius: 12px;
            color: #065f46;
            font-size: 14px;
            display: none;
        }

        .status.show {
            display: block;
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">NEXUS</div>
        <h1>مشغل تطبيق NEXUS</h1>
        <p class="description">اضغط على الزر أدناه لفتح المنصة والاستمتاع بتطبيق NEXUS مباشرة</p>
        
        <div class="features">
            <ul>
                <li>تطبيق ويب تقدمي (PWA) بسرعة فائقة</li>
                <li>يعمل بدون اتصال بالإنترنت</li>
                <li>توافق كامل مع جميع الأجهزة</li>
                <li>تحديثات تلقائية</li>
            </ul>
        </div>

        <div class="button-group">
            <button class="btn-primary" onclick="launchNEXUS()">🚀 فتح NEXUS الآن</button>
            <button class="btn-secondary" onclick="window.history.back()">العودة</button>
        </div>

        <div class="status" id="status"></div>
    </div>

    <script>
        function launchNEXUS() {
            const baseURL = '${window.location.origin}';
            window.location.href = baseURL;
        }

        function showStatus(message, type = 'success') {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = 'status show';
            statusEl.style.background = type === 'success' ? '#ecfdf5' : '#fee2e2';
            statusEl.style.borderColor = type === 'success' ? '#d1fae5' : '#fecaca';
            statusEl.style.color = type === 'success' ? '#065f46' : '#991b1b';
        }

        // Check if the app is accessible
        window.addEventListener('load', function() {
            console.log('NEXUS App Launcher loaded successfully');
        });
    </script>
</body>
</html>`;

  try {
    const blob = new Blob([launcherHTML], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "NEXUS-App-Launcher.html");
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // تنظيف الذاكرة
    URL.revokeObjectURL(url);
    
    toast.success("✅ تم تنزيل ملف المشغل بنجاح! تفضل بفتحه من مجلد التنزيلات");
  } catch (error) {
    console.error("Error downloading NEXUS app file:", error);
    toast.error("❌ حدث خطأ في تنزيل الملف. يرجى المحاولة مجدداً");
  }
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

  const handleDownloadClick = () => {
    downloadNEXUSAppFile();
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
          تنزيل التطبيق على هاتفك 📲
        </DropdownMenuItem>
      ) : variant === "banner" ? null : (
        <Button
          onClick={handleDownloadClick}
          variant="default"
          size="sm"
          className={`gap-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm ${className}`}
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>تنزيل التطبيق</span>
        </Button>
      )}

      {/* Top Floating Notification Banner for 1-Click Installation */}
      {showBanner && !isInstalled && isBannerVisible && (
        <div className="fixed top-3 inset-x-3 sm:top-4 sm:right-4 sm:left-auto z-50 sm:max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="relative overflow-hidden bg-gradient-to-r from-violet-900 via-purple-900 to-slate-900 border border-purple-500/30 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between">
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
                  ثبّته كتطبيق مستقل بدون شريط المتصفح!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleDownloadClick}
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
        onDownloadApp={handleDownloadClick}
      />
    </>
  );
}
