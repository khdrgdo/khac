import { useEffect, useState } from "react";
import { Download, Smartphone, Check, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPWAButtonProps {
  variant?: "menu" | "button" | "header";
  className?: string;
}

export function InstallPWAButton({ variant = "menu", className }: InstallPWAButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt on Android/Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if it was already fired and stored globally
    if ((window as unknown as { deferredPrompt: BeforeInstallPromptEvent }).deferredPrompt) {
      setDeferredPrompt(
        (window as unknown as { deferredPrompt: BeforeInstallPromptEvent }).deferredPrompt,
      );
    }

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("PWA Service Worker Registered"))
        .catch((err) => console.warn("SW Registration failed:", err));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers that don't support prompt directly
      alert(
        "لتثبيت التطبيق: افتح خيارات المتصفح واختر 'إضافة إلى الشاشة الرئيسية' أو 'تثبيت التطبيق'.",
      );
    }
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
      ) : (
        <Button
          onClick={handleInstallClick}
          variant="outline"
          size="sm"
          className={`gap-1.5 rounded-xl text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          تثبيت التطبيق
        </Button>
      )}

      {/* iOS Safari Instructions Dialog */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-sm rounded-3xl dir-rtl text-right">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Share className="w-5 h-5 text-primary" />
              تثبيت NEXUS على آيفون (iOS)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-2 space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  1
                </span>
                <span>
                  اضغط على زر <strong>المشاركة (Share)</strong> في أسفل شاشة المتصفح (Safari).
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  2
                </span>
                <span>
                  اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  3
                </span>
                <span>
                  اضغط <strong>إضافة (Add)</strong> في أعلى الزاوية، وسيظهر التطبيق على شاشة هاتفك
                  فوراً!
                </span>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
