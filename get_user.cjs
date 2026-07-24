const fs = require("fs");
const env = fs
  .readFileSync(".env", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const [key, ...val] = line.split("=");
    if (key) acc[key] = val.join("=").replace(/"/g, "").replace(/'/g, "");
    return acc;
  }, {});
const url = env.VITE_SUPABASE_URL + "/rest/v1/profiles?email=eq.khdrmamon@gmail.com";
fetch(url, {
  headers: {
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: "Bearer " + env.VITE_SUPABASE_ANON_KEY,
  },
})
  .then((r) => r.json())
  .then(console.log);
