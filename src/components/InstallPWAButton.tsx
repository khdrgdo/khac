import { useEffect, useState, useCallback } from "react";
import { Download, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPWAButtonProps {
  variant?: "menu" | "button";
  className?: string;
}

export function InstallPWAButton({
  variant = "menu",
  className,
}: InstallPWAButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
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
      toast.success("تم تثبيت تطبيق NEXUS بنجاح!");
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
  }, []);

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
        // prompt not supported
      } finally {
        setDeferredPrompt(null);
        delete (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt;
      }
      return;
    }

    toast.info("افتح الموقع في متصفح Chrome ثم اضغط على أيقونة التثبيت ⊕ في شريط العنوان", {
      duration: 8000,
    });
  }, [deferredPrompt]);

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

  if (variant === "menu") {
    return (
      <DropdownMenuItem
        onClick={handleInstall}
        className="rounded-xl cursor-pointer py-2 px-2.5 gap-2 text-xs font-semibold text-primary focus:bg-primary/10 focus:text-primary"
      >
        <Smartphone className="w-4 h-4 text-primary" />
        تثبيت التطبيق
      </DropdownMenuItem>
    );
  }

  return (
    <Button
      onClick={handleInstall}
      variant="default"
      size="sm"
      className={`gap-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      <span>تثبيت التطبيق</span>
    </Button>
  );
}
