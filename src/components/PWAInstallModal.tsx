import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PWADeviceInfo, detectPWADevice } from "@/lib/pwaDetector";
import { Share, PlusSquare, MoreVertical, ExternalLink, Download } from "lucide-react";
import { downloadNEXUSAppFile } from "@/components/InstallPWAButton";

interface PWAInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceInfo?: PWADeviceInfo;
  onDirectInstall?: () => Promise<boolean>;
  hasDirectPrompt?: boolean;
  onDownloadApp?: () => void;
}

export function PWAInstallModal({
  open,
  onOpenChange,
  onDirectInstall,
  onDownloadApp,
  deviceInfo: initialDeviceInfo,
}: PWAInstallModalProps) {
  const [installing, setInstalling] = useState(false);
  const [domainName, setDomainName] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<PWADeviceInfo | undefined>(initialDeviceInfo);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDomainName(window.location.host || "nexus-app.com");
      if (!deviceInfo) {
        setDeviceInfo(detectPWADevice());
      }
    }
  }, [deviceInfo]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setShowInstructions(false);
      setInstalling(false);
    }
  }, [open]);

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

      // 3. If running inside an iframe (like AI Studio preview), open in new tab
      if (window.self !== window.top) {
        toast.info("جاري فتح التطبيق في نافذة مستقلة لتفعيل التثبيت...");
        window.open(window.location.href, "_blank");
        onOpenChange(false);
        setInstalling(false);
        return;
      }

      // If we reach here, the native prompt is NOT available (e.g. iOS, unsupported browser, or already installed)
      // Show manual instructions instead of a fake success toast
      setShowInstructions(true);
    } catch (err) {
      console.warn("Install error:", err);
      toast.error("عذراً، حدث خطأ أثناء محاولة التثبيت.");
    } finally {
      setInstalling(false);
    }
  };

  const handleDownloadClick = () => {
    downloadNEXUSAppFile();
    setTimeout(() => {
      onOpenChange(false);
    }, 500);
  };

  const renderInstructions = () => {
    const isIOS = deviceInfo?.os === "ios";
    const isInApp = deviceInfo?.isInAppBrowser;

    if (isInApp) {
      return (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-right space-y-3">
          <p className="text-orange-400 font-semibold text-sm flex justify-end items-center gap-2">
            متصفح مدمج غير مدعوم <ExternalLink className="w-4 h-4" />
          </p>
          <p className="text-slate-300 text-sm leading-relaxed">
            أنت تستخدم متصفحاً داخل تطبيق ({deviceInfo.inAppBrowserName}). الرجاء فتح الرابط في المتصفح الأساسي لجهازك (مثل Chrome أو Safari).
          </p>
        </div>
      );
    }

    if (isIOS) {
      return (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-right space-y-4">
          <p className="text-white font-semibold text-sm border-b border-slate-700 pb-2">
            طريقة التثبيت على أجهزة الآيفون (iOS):
          </p>
          <ol className="text-slate-300 text-sm space-y-3 pr-2">
            <li className="flex items-center justify-end gap-2">
              <span>اضغط على زر المشاركة أسفل الشاشة</span>
              <span className="bg-slate-700 p-1.5 rounded-md"><Share className="w-4 h-4 text-blue-400" /></span>
              <span className="font-bold text-slate-500">.1</span>
            </li>
            <li className="flex items-center justify-end gap-2">
              <span>اختر <strong>إضافة للشاشة الرئيسية</strong></span>
              <span className="bg-slate-700 p-1.5 rounded-md"><PlusSquare className="w-4 h-4 text-slate-300" /></span>
              <span className="font-bold text-slate-500">.2</span>
            </li>
          </ol>
        </div>
      );
    }

    return (
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-right space-y-4">
        <p className="text-white font-semibold text-sm border-b border-slate-700 pb-2">
          طريقة التثبيت اليدوي:
        </p>
        <ol className="text-slate-300 text-sm space-y-3 pr-2">
          <li className="flex items-center justify-end gap-2">
            <span>اضغط على خيارات المتصفح</span>
            <span className="bg-slate-700 p-1.5 rounded-md"><MoreVertical className="w-4 h-4 text-slate-300" /></span>
            <span className="font-bold text-slate-500">.1</span>
          </li>
          <li className="flex items-center justify-end gap-2">
            <span>اختر <strong>تثبيت التطبيق</strong> (Install App)</span>
            <span className="font-bold text-slate-500">.2</span>
          </li>
        </ol>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-[28px] dir-rtl p-6 sm:p-7 bg-[#1c1f26] text-white border border-slate-800 shadow-2xl overflow-hidden">
        {/* Title matching native dialog */}
        <div className="text-right">
          <DialogTitle className="text-2xl font-bold text-slate-100 tracking-tight">
            {showInstructions ? "خطوات التثبيت" : "تنزيل تطبيق NEXUS"}
          </DialogTitle>
        </div>

        {/* Center content: Logo + Title + Hostname */}
        <div className="mt-7 mb-6 flex items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
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

        {/* Success Message when file is being downloaded */}
        {showInstructions ? (
          <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {renderInstructions()}
          </div>
        ) : (
          <div className="mb-6 text-right text-sm text-slate-300 leading-relaxed">
            <p>اختر من الخيارات أدناه لتنزيل وتثبيت تطبيق NEXUS على جهازك:</p>
            <p className="text-xs text-slate-400 mt-2">سيتم تنزيل ملف مشغل التطبيق في مجلد التنزيلات الخاص بك</p>
          </div>
        )}

        {/* Action Buttons matching native layout */}
        <div className="flex flex-col gap-3 pt-2">
          {!showInstructions ? (
            <>
              <Button
                onClick={handleDownloadClick}
                disabled={installing}
                className="rounded-2xl px-7 h-11 font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition-all shadow-md active:scale-95 w-full gap-2"
              >
                <Download className="w-4 h-4" />
                {installing ? "جاري التنزيل..." : "تنزيل ملف المشغل"}
              </Button>
              <Button
                onClick={handleInstallClick}
                disabled={installing}
                className="rounded-2xl px-7 h-11 font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md active:scale-95 w-full"
              >
                {installing ? "جاري..." : "تثبيت مباشر"}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-2xl px-7 h-11 font-bold text-sm bg-slate-700 hover:bg-slate-600 text-white transition-all w-full"
            >
              حسناً، فهمت
            </Button>
          )}

          {!showInstructions && (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl px-6 h-11 font-semibold text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors w-full"
            >
              إلغاء
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
