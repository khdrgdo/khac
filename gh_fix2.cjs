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
    const r1 = await api("GET", "/repos/khdrgdo/khac/contents/.gitignore");
    const old = Buffer.from(r1.d.content, "base64").toString();
    
    // Replace ".env" line with ".env.local"
    const updated = old.replace(/^\.env$/m, ".env.local");
    console.log("Updated .gitignore:\n" + updated);

    const r2 = await api("PUT", "/repos/khdrgdo/khac/contents/.gitignore", {
      message: "fix: stop ignoring .env for Lovable build (VITE_ vars needed)",
      content: Buffer.from(updated).toString("base64"),
      sha: r1.d.sha,
      branch: "main",
    });
    console.log(".gitignore:", r2.s, r2.d?.commit?.sha?.substring(0, 7));

    // Get .env sha
    const r3 = await api("GET", "/repos/khdrgdo/khac/contents/.env");
    console.log(".env exists, sha:", r3.d.sha);
    
    // Verify .env content
    const envContent = Buffer.from(r3.d.content, "base64").toString();
    console.log(".env content:\n" + envContent);

    console.log("\nDONE!");
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
})();
