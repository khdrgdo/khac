import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PWADeviceInfo, detectPWADevice } from "@/lib/pwaDetector";
import { Share, PlusSquare, MoreVertical, ExternalLink, Download, FileCheck } from "lucide-react";
import { downloadNEXUSAppFile } from "@/components/InstallPWAButton";

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
      // Always trigger file download
      downloadNEXUSAppFile();
      toast.success("تم تنزيل ملف التطبيق (NEXUS-App-Launcher.html) بنجاح! 📲");

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
          toast.success("تم تثبيت وتنزيل تطبيق NEXUS بنجاح! 🎉");
          localStorage.setItem("nexus_pwa_installed", "true");
          onOpenChange(false);
          setInstalling(false);
          return;
        }
      }

      setShowInstructions(true);
    } catch (err) {
      console.warn("Install error:", err);
      toast.error("عذراً، حدث خطأ أثناء محاولة التنزيل.");
    } finally {
      setInstalling(false);
    }
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
            أنت تستخدم متصفحاً داخل تطبيق ({deviceInfo.inAppBrowserName}). الرجاء فتح الرابط في المتصفح الأساسي لجهازك (مثل Chrome أو Safari) لتتمكن من تنزيل وتثبيت التطبيق.
          </p>
        </div>
      );
    }

    if (typeof window !== "undefined" && window.self !== window.top) {
      return (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-right space-y-3">
          <p className="text-purple-300 font-semibold text-sm flex justify-end items-center gap-2">
            <FileCheck className="w-4 h-4 text-purple-400" /> تم تنزيل ملف المشغل
          </p>
          <p className="text-slate-300 text-sm leading-relaxed">
            تم تنزيل ملف <strong>NEXUS-App-Launcher.html</strong> إلى جهازك. يمكنك إيجاده في مجلد التنزيلات وفتحه وتشغيل التطبيق من خلاله مباشرة، أو فتح التطبيق في نافذة مستقلة لتثبيته.
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

    return (      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-right space-y-4">
        <p className="text-white font-semibold text-sm border-b border-slate-700 pb-2 flex items-center justify-between">
          <span>تم تنزيل ملف التطبيق!</span>
          <Download className="w-4 h-4 text-emerald-400" />
        </p>
        <p className="text-slate-300 text-xs leading-relaxed">
          تم تنزيل ملف تشغيل التطبيق في التنزيلات. كما يمكنك التثبيت المباشر عبر خيارات المتصفح:
        </p>
        <ol className="text-slate-300 text-sm space-y-3 pr-2">
          <li className="flex items-center justify-end gap-2">
            <span>اضغط على قائمة المتصفح (⋮)</span>
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
            {showInstructions ? "تنزيل ملف التطبيق" : "تنزيل تطبيق NEXUS"}
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

        {showInstructions ? (
          <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {renderInstructions()}
          </div>
        ) : null}

        {/* Action Buttons matching native layout */}
        <div className="flex items-center justify-between pt-2">
          {!showInstructions ? (
            <Button
              onClick={handleInstallClick}
              disabled={installing}
              className="rounded-2xl px-7 h-11 font-bold text-sm bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md active:scale-95 gap-2"
            >
              <Download className="w-4 h-4" />
              {installing ? "جاري..." : "تنزيل الآن"}
            </Button>
          ) : (
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-2xl px-7 h-11 font-bold text-sm bg-slate-700 hover:bg-slate-600 text-white transition-all"
            >
              حسناً، فهمت
            </Button>
          )}

          {!showInstructions && (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-2xl px-6 h-11 font-semibold text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              إلغاء
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

