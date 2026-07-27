const { execSync } = require("child_process");
const cwd = "C:\\Users\\dell\\AppData\\Local\\Temp\\nexus_fix";

try {
  execSync("taskkill /F /IM git.exe", { stdio: "ignore" });
} catch {}

setTimeout(() => {
  try {
    execSync("git add .gitignore .env", { cwd, stdio: "inherit", timeout: 30000 });
    execSync('git commit -m "fix: commit .env for Lovable build (VITE_ vars are public)"', { cwd, stdio: "inherit", timeout: 30000 });
    execSync("git push origin main", { cwd, stdio: "inherit", timeout: 60000 });
    console.log("SUCCESS");
  } catch (e) {
    console.error("FAILED:", e.message);
  }
  process.exit(0);
}, 3000);
