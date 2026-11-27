import { createFileRoute } from "@tanstack/react-router";

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function fcmAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const jwt = `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`oauth failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function handle(req: Request): Promise<Response> {
  try {
    const SB_URL = process.env["SUPABASE_URL"]!;
    const SB_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

    const cfg = await fetch(`${SB_URL}/rest/v1/push_config?id=eq.1&select=secret`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const rows = await cfg.json();
    const expected = rows?.[0]?.secret ?? "";
    if (!expected || req.headers.get("X-Nexus-Push-Secret") !== expected) {
      return new Response("forbidden", { status: 403 });
    }

    const body = await req.json();
    const recipients: string[] = body.recipients ?? [];
    if (recipients.length === 0) return new Response("no recipients");

    const saRaw = process.env["FCM_SERVICE_ACCOUNT"];
    if (!saRaw) return new Response("FCM_SERVICE_ACCOUNT not set", { status: 500 });
    const sa = JSON.parse(saRaw);

    const inList = recipients.map((r) => `"${r}"`).join(",");
    const tk = await fetch(
      `${SB_URL}/rest/v1/device_tokens?select=token,user_id&user_id=in.(${encodeURIComponent(inList)})`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
    );
    const tokens: { token: string }[] = await tk.json();
    if (!Array.isArray(tokens) || tokens.length === 0) return new Response("no tokens");

    const isReq = body.type === "dm_request";
    const title = isReq
      ? "طلب مراسلة جديد"
      : body.is_group && body.group_title
        ? body.group_title
        : body.sender_name || "رسالة جديدة";
    const notifBody = isReq ? `${body.sender_name || "مستخدم"} يريد مراسلتك` : body.preview || "";

    const access = await fcmAccessToken(sa);
    const project = sa.project_id;
    const dead: string[] = [];
    let sent = 0;
    for (const t of tokens) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: { title, body: notifBody },
            data: {
              conversation_id: String(body.conversation_id ?? ""),
              type: String(body.type ?? "message"),
            },
            android: { priority: "HIGH", notification: { channel_id: "messages" } },
          },
        }),
      });
      if (res.ok) {
        sent++;
      } else {
        const err = await res.text();
        if (err.includes("UNREGISTERED") || err.includes("NOT_FOUND")) dead.push(t.token);
      }
    }
    for (const d of dead) {
      await fetch(`${SB_URL}/rest/v1/device_tokens?token=eq.${encodeURIComponent(d)}`, {
        method: "DELETE",
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      });
    }
    return new Response(JSON.stringify({ sent, pruned: dead.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(`error: ${e}`, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/send-push")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: () => new Response("method", { status: 405 }),
    },
  },
});
