
import { supabase } from "@/integrations/supabase/client";

async function checkThemeColumn() {
  const { data, error } = await supabase
    .from("profiles")
    .select("theme")
    .limit(1);

  if (error) {
    console.log("Error selecting theme column (likely does not exist):", error.message);
  } else {
    console.log("Theme column exists! Data:", data);
  }
}

checkThemeColumn();
