const fs = require("fs");

// src/components/InstallPWAButton.tsx
let code = fs.readFileSync("src/components/InstallPWAButton.tsx", "utf8");
code = code.replace(
  /\(window as any\)/g,
  "(window as unknown as { deferredPrompt: BeforeInstallPromptEvent })",
);
fs.writeFileSync("src/components/InstallPWAButton.tsx", code);

// src/routes/__root.tsx
code = fs.readFileSync("src/routes/__root.tsx", "utf8");
code = code.replace(/\(window as any\)/g, "(window as unknown as { deferredPrompt: Event })");
fs.writeFileSync("src/routes/__root.tsx", code);
