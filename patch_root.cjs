const fs = require("fs");
let code = fs.readFileSync("src/routes/__root.tsx", "utf8");
code = code.replace(
  /const \{ data: sub \} = supabase\.auth\.onAuthStateChange\(/,
  `if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("Global SW Registered"))
        .catch((err) => console.warn("Global SW Registration failed:", err));
    }

    const { data: sub } = supabase.auth.onAuthStateChange(`,
);
fs.writeFileSync("src/routes/__root.tsx", code);
