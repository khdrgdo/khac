import fs from "fs";
const env = fs.readFileSync(".env", "utf8");
const vars = {};
env.split("\n").forEach((line) => {
  if (line.includes("=")) {
    let [k, v] = line.split("=");
    v = v.replace(/"/g, "").trim();
    vars[k.trim()] = v;
  }
});
const SUPABASE_URL = vars["VITE_SUPABASE_URL"];
const SUPABASE_KEY = vars["VITE_SUPABASE_PUBLISHABLE_KEY"];

async function test() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_profiles`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ _ids: [] }),
  });
  const data = await res.json();
  console.log(data);
}
test();
