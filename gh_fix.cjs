const https = require("https");
const TOKEN = "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";

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "api.github.com",
      path: urlPath,
      method,
      headers: {
        Authorization: "Bearer " + TOKEN,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "fix-script",
      },
    };
    if (data) {
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = Buffer.byteLength(data);
    }
    const req = https.request(opts, (res) => {
      let b = "";
      res.on("data", (c) => (b += c));
      res.on("end", () => {
        try { resolve({ s: res.statusCode, d: JSON.parse(b) }); }
        catch { resolve({ s: res.statusCode, d: b }); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    // 1. Get current .gitignore
    const r1 = await api("GET", "/repos/khdrgdo/khac/contents/.gitignore");
    const old = Buffer.from(r1.d.content, "base64").toString();
    console.log("OLD .gitignore:");
    console.log(old);

    // Replace .env with .env.local
    const updated = old.replace(/^\.\n$/m, ".env.local\n");
    console.log("NEW .gitignore:");
    console.log(updated);

    const r2 = await api("PUT", "/repos/khdrgdo/khac/contents/.gitignore", {
      message: "fix: stop ignoring .env so Lovable can access VITE_ vars at build time",
      content: Buffer.from(updated).toString("base64"),
      sha: r1.d.sha,
      branch: "main",
    });
    console.log(".gitignore updated:", r2.s, r2.d?.commit?.sha?.substring(0, 7));

    // 2. Check if .env exists
    let envSha = null;
    try {
      const r3 = await api("GET", "/repos/khdrgdo/khac/contents/.env");
      envSha = r3.d.sha;
      console.log(".env already exists");
    } catch {
      console.log(".env not in repo yet");
    }

    // 3. Create/update .env
    const envContent = 'VITE_SUPABASE_URL="https://nzerffnvrvtmlnuqvhkw.supabase.co"\nVITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_CiCJzf7SfP7C-1bsBKuMNQ_IbS0v2K9"\n';
    const payload = {
      message: "fix: add .env with VITE_ Supabase vars for Lovable build",
      content: Buffer.from(envContent).toString("base64"),
      branch: "main",
    };
    if (envSha) payload.sha = envSha;

    const r4 = await api("PUT", "/repos/khdrgdo/khac/contents/.env", payload);
    console.log(".env created:", r4.s, r4.d?.commit?.sha?.substring(0, 7));

    console.log("\nDONE!");
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
})();
