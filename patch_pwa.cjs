const fs = require("fs");
let code = fs.readFileSync("src/routes/__root.tsx", "utf8");

if (!code.includes("globalDeferredPrompt")) {
  code = code.replace(
    /import \{ useEffect, type ReactNode \} from "react";/,
    `import { useEffect, type ReactNode } from "react";
    
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    (window as any).deferredPrompt = e;
  });
}`,
  );
  fs.writeFileSync("src/routes/__root.tsx", code);
}
