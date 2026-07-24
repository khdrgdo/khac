export interface PWADeviceInfo {
  isStandalone: boolean;
  isInAppBrowser: boolean;
  inAppBrowserName: string | null;
  os: "ios" | "android" | "windows" | "mac" | "linux" | "unknown";
  browser: "chrome" | "safari" | "firefox" | "samsung" | "edge" | "opera" | "other";
  isMobile: boolean;
}

export function detectPWADevice(): PWADeviceInfo {
  if (typeof window === "undefined") {
    return {
      isStandalone: false,
      isInAppBrowser: false,
      inAppBrowserName: null,
      os: "unknown",
      browser: "other",
      isMobile: false,
    };
  }

  const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || "";
  const lowerUA = ua.toLowerCase();

  // 1. Standalone / Installed check
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes("android-app://") ||
    localStorage.getItem("nexus_pwa_installed") === "true";

  // 2. OS Detection
  let os: PWADeviceInfo["os"] = "unknown";
  if (/iphone|ipad|ipod/.test(lowerUA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    os = "ios";
  } else if (/android/.test(lowerUA)) {
    os = "android";
  } else if (/win/.test(lowerUA)) {
    os = "windows";
  } else if (/mac/.test(lowerUA)) {
    os = "mac";
  } else if (/linux/.test(lowerUA)) {
    os = "linux";
  }

  // 3. In-App Browser Detection
  let isInAppBrowser = false;
  let inAppBrowserName: string | null = null;

  if (/instagram/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "إنستغرام (Instagram)";
  } else if (/fbav|fb_iab|messenger/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "فيسبوك / ماسنجر (Facebook)";
  } else if (/tiktok/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "تيك توك (TikTok)";
  } else if (/telegram/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "تيليجرام (Telegram)";
  } else if (/snapchat/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "سناب شات (Snapchat)";
  } else if (/twitter/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "تويتر / X";
  } else if (/line/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "لاين (Line)";
  } else if (/micromessenger/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "ويتشات (WeChat)";
  } else if (/wv|webview/i.test(lowerUA)) {
    isInAppBrowser = true;
    inAppBrowserName = "متصفح مدمج في تطبيق";
  }

  // 4. Browser Detection
  let browser: PWADeviceInfo["browser"] = "other";
  if (/samsungbrowser/i.test(lowerUA)) {
    browser = "samsung";
  } else if (/edg/i.test(lowerUA)) {
    browser = "edge";
  } else if (/opr|opera/i.test(lowerUA)) {
    browser = "opera";
  } else if (/firefox|fxios/i.test(lowerUA)) {
    browser = "firefox";
  } else if (/crios|chrome/i.test(lowerUA) && !/edg|opr|samsungbrowser/i.test(lowerUA)) {
    browser = "chrome";
  } else if (/safari/i.test(lowerUA) && !/chrome|crios|android/i.test(lowerUA)) {
    browser = "safari";
  }

  const isMobile = os === "ios" || os === "android" || /mobile|tablet|android/i.test(lowerUA);

  return {
    isStandalone,
    isInAppBrowser,
    inAppBrowserName,
    os,
    browser,
    isMobile,
  };
}
