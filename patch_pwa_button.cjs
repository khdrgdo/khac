const fs = require("fs");
let code = fs.readFileSync("src/components/InstallPWAButton.tsx", "utf8");

code = code.replace(
  /const handleBeforeInstallPrompt = \(e: Event\) => \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*setDeferredPrompt\(e as BeforeInstallPromptEvent\);\s*\n\s*\};\s*\n\s*window\.addEventListener\("beforeinstallprompt", handleBeforeInstallPrompt\);/m,
  `const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    // Check if it was already fired and stored globally
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }`,
);

fs.writeFileSync("src/components/InstallPWAButton.tsx", code);
