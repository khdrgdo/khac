import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  "https://nzerffnvrvtmlnuqvhkw.supabase.co",
  "sb_publishable_CiCJzf7SfP7C-1bsBKuMNQ_IbS0v2K9",
);
async function run() {
  const { data, error } = await supabase.from("profiles").select("id").limit(1);
  console.log("Error:", error);
}
run();
