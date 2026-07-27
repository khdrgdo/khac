import { useState } from "react";
import {
  Share,
  Download,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Globe,
  MoreVertical,
  PlusSquare,
  AlertTriangle,
  Compass,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { detectPWADevice, type PWADeviceInfo } from "@/lib/pwaDetector";

interface PWAInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceInfo: PWADeviceInfo;
  onDirectInstall?: () => Promise<boolean>;
  hasDirectPrompt?: boolean;
}

export function PWAInstallModal({
  open,
  onOpenChange,
  deviceInfo,
  onDirectInstall,
  hasDirectPrompt,
}: PWAInstallModalProps) {
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("تم نسخ رابط التطبيق! الصقه في شريط العنوان وأضغط Enter");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDirectInstallClick = async () => {
    if (!onDirectInstall) return;
    setInstalling(true);
    try {
      const success = await onDirectInstall();
      if (success) {
        onOpenChange(false);
      }
    } catch (err) {
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl dir-rtl text-right p-6 sm:p-7 overflow-y-auto max-h-[90vh] bg-background border-border shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl mx-auto sm:mx-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-black text-foreground tracking-tight">
            تثبيت تطبيق NEXUS
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            احصل على تجربة تطبيق سريعة وملء الشاشة وإشعارات فورية على هاتفك!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* 1. Direct Install Prompt Available */}
          {hasDirectPrompt && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 text-center space-y-3">
              <p className="text-xs font-semibold text-primary">
                متصفحك يدعم التثبيت المباشر بنقرة واحدة!
              </p>
              <Button
                onClick={handleDirectInstallClick}
                disabled={installing}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-all gap-2"
              >
                <Download className="w-4 h-4 animate-bounce" />
                {installing ? "جاري التثبيت..." : "تثبيت التطبيق الآن"}
              </Button>
            </div>
          )}

          {/* 2. In-App Browser Warning (Instagram, Facebook, TikTok, etc.) */}
          {deviceInfo.isInAppBrowser && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>أنت تستخدم متصفحاً داخلياً ({deviceInfo.inAppBrowserName || "تطبيق"})</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                المتصفحات المدمجة داخل التطبيقات مثل إنستغرام وفيسبوك لا تسمح بتثبيت التطبيقات بشكل مباشر.
              </p>
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-bold text-foreground">الخطوات للفتح في المتصفح:</p>
                <ol className="text-[11px] space-y-1.5 list-decimal list-inside text-muted-foreground">
                  <li>اضغط على <strong>النقاط الثلاث (⋮ أو ...)</strong> أو <strong>زر الخيارات</strong> بالأعلى.</li>
                  <li>اختر <strong>الفتح في المتصفح (Open in Chrome / Safari)</strong>.</li>
                </ol>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="w-full text-xs font-bold rounded-xl gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "تم النسخ!" : "نسخ رابط التطبيق"}
                </Button>
              </div>
            </div>
          )}

          {/* 3. iOS Safari Instructions */}
          {deviceInfo.os === "ios" && !deviceInfo.isInAppBrowser && (
            <div className="space-y-3 p-4 rounded-2xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                <Compass className="w-4 h-4 text-primary" />
                <span>طريقة التثبيت على آيفون (Safari):</span>
              </div>
              <div className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5 bg-background p-2.5 rounded-xl border border-border/50">
                  <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                    1
                  </span>
                  <span>
                    اضغط على زر <strong>المشاركة <Share className="w-3.5 h-3.5 inline mx-0.5 text-primary" /></strong> في أسفل شاشة Safari.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-background p-2.5 rounded-xl border border-border/50">
                  <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                    2
                  </span>
                  <span>
                    اسحب القائمة للأسفل واضغط على <strong>إضافة إلى الشاشة الرئيسية <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-primary" /></strong>.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-background p-2.5 rounded-xl border border-border/50">
                  <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                    3
                  </span>
                  <span>
                    اضغط <strong>إضافة (Add)</strong> أعلى الزاوية، وسيظهر التطبيق على شاشتك فوراً!
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. Android / Browser Specific Guide when direct prompt is unavailable */}
          {deviceInfo.os === "android" && !hasDirectPrompt && !deviceInfo.isInAppBrowser && (
            <div className="space-y-3 p-4 rounded-2xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                <Globe className="w-4 h-4 text-primary" />
                <span>خطوات التثبيت اليدوي على أندرويد:</span>
              </div>

              {deviceInfo.browser === "samsung" ? (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>1. اضغط على زر القائمة <strong>(≡)</strong> في أسفل الشاشة.</p>
                  <p>2. اختر <strong>إضافة الصفحة إلى (Add page to)</strong>.</p>
                  <p>3. اختر <strong>الشاشة الرئيسية (Home screen)</strong>.</p>
                </div>
              ) : deviceInfo.browser === "firefox" ? (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>1. اضغط على القائمة <strong>(⋮)</strong> بجانب شريط العنوان.</p>
                  <p>2. اضغط على <strong>تثبيت (Install)</strong>.</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2 bg-background p-2.5 rounded-xl border border-border/50">
                    <MoreVertical className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>1. اضغط على قائمة المتصفح <strong>(النقاط الثلاث ⋮)</strong> بالأعلى.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-background p-2.5 rounded-xl border border-border/50">
                    <Download className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>2. اختر <strong>تثبيت التطبيق (Install app)</strong> أو <strong>الإضافة إلى الشاشة الرئيسية</strong>.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Desktop Guide when direct prompt is unavailable */}
          {!deviceInfo.isMobile && !hasDirectPrompt && (
            <div className="space-y-3 p-4 rounded-2xl bg-muted/50 border border-border">
              <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                <Globe className="w-4 h-4 text-primary" />
                <span>طريقة التثبيت على الكمبيوتر:</span>
              </div>
              <p className="text-xs text-muted-foreground">
                انظر إلى أعلى المتصفح في شريط العنوان 📍 واضغط على أيكونة <strong>التثبيت (⊕ / 🖥️)</strong>، أو اضغط قائمة المتصفح (⋮) واختر <strong>تثبيت NEXUS</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-semibold"
          >
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
