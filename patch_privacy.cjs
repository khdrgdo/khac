const fs = require("fs");
let code = fs.readFileSync("src/lib/privacy.ts", "utf8");
code = code.replace(
  /const \{ data \} = await \(supabase as unknown as Record<string, unknown>\)\s*\n\s*\.from\("profiles"\)\s*\n\s*\.select\("hide_university_number"\)\s*\n\s*\.eq\("id", userId\)\s*\n\s*\.single\(\);/,
  `// First try DB
    let isHidden = false;
    const { data, error } = await (supabase as unknown as Record<string, unknown>)
      .from("profiles")
      .select("hide_university_number")
      .eq("id", userId)
      .single();
    
    if (!error && data) {
      isHidden = !!data.hide_university_number;
    } else {
      // Fallback to user metadata
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === userId) {
        isHidden = !!user.user_metadata?.hide_university_number;
      }
    }
    return isHidden;
`,
);

code = code.replace(
  /await \(supabase as unknown as Record<string, unknown>\)\s*\n\s*\.from\("profiles"\)\s*\n\s*\.update\(\{ hide_university_number: hidden \}\)\s*\n\s*\.eq\("id", userId\);/,
  `const { error } = await (supabase as unknown as Record<string, unknown>)
      .from("profiles")
      .update({ hide_university_number: hidden })
      .eq("id", userId);
      
    if (error) {
      // Fallback to auth metadata if DB column doesn't exist
      await supabase.auth.updateUser({
        data: { hide_university_number: hidden }
      });
    }`,
);

fs.writeFileSync("src/lib/privacy.ts", code);
