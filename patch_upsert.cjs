const fs = require("fs");
let code = fs.readFileSync("src/lib/pinnedCardStore.ts", "utf8");
code = code.replace(
  /const \{ error \} = await supabase\.from\("pinned_cards"\)\.upsert\(row\);/,
  `// Use update instead of upsert so that regular users can vote without INSERT permissions
  const { error } = await supabase.from("pinned_cards").update(row).eq("id", config.id);`,
);
fs.writeFileSync("src/lib/pinnedCardStore.ts", code);
