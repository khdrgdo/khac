import { useEffect, useState, useCallback } from "react";
import { Download, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getDismissKey(userId?: string) {
  return `nexus_pwa_dismissed_${userId || "anon"}`;
}

interface InstallPWAButtonProps {
  variant?: "menu" | "banner";
  userId?: string;
  className?: string;
}

export function InstallPWAButton({
  variant = "banner",
  userId,
  className,
}: InstallPWAButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const dismissedVal = localStorage.getItem(getDismissKey(userId));
    if (dismissedVal) {
      setDismissed(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt = promptEvent;
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const existing = (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
    if (existing) {
      setDeferredPrompt(existing);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [userId]);

  const handleInstall = useCallback(async () => {
    const promptEvent =
      deferredPrompt ||
      (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") {
          setIsInstalled(true);
        }
      } catch {
        // silently fail
      } finally {
        setDeferredPrompt(null);
        delete (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
      }
    }
  }, [deferredPrompt]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(getDismissKey(userId), "1");
    } catch {
      // ignore
    }
  };

  const canInstall = deferredPrompt !== null;

  if (isInstalled || dismissed) {
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

  if (variant === "menu") {
    return (
      <DropdownMenuItem
        onClick={handleInstall}
        className="rounded-xl cursor-pointer py-2 px-2.5 gap-2 text-xs font-semibold text-primary focus:bg-primary/10 focus:text-primary"
      >
        <Download className="w-4 h-4 text-primary" />
        تثبيت التطبيق
      </DropdownMenuItem>
    );
  }

  return (
    <div
      className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 ${className || ""}`}
    >
      <div className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-violet-500/25 border border-violet-400/20 backdrop-blur-sm">
        <button
          onClick={handleDismiss}
          className="shrink-0 w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          aria-label="إخفاء"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <Button
          onClick={handleInstall}
          size="sm"
          className="shrink-0 h-8 rounded-xl bg-white text-violet-700 hover:bg-white/90 text-xs font-bold px-4 gap-1.5 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          {canInstall ? "تثبيت التطبيق" : "تثبيت"}
        </Button>
      </div>
    </div>
  );
}
