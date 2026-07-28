import { supabase } from "@/integrations/supabase/client";

export async function getOrCreateDM(currentUserId: string, otherUserId: string): Promise<string> {
  if (!currentUserId || !otherUserId) {
    throw new Error("لم يتم تحديد المستخدم بشكل صحيح");
  }

  if (currentUserId === otherUserId) {
    throw new Error("لا يمكنك مراسلة نفسك");
  }

  // 1. Try RPC create_dm
  try {
    const { data, error } = await supabase.rpc("create_dm", { _other: otherUserId });
    if (!error && data && typeof data === "string" && data.length > 0) {
      return data;
    }
  } catch (e) { /* ignore */ }

  // 2. Check if a non-group conversation already exists between currentUserId and otherUserId
  const { data: myConvs } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", currentUserId);

  if (myConvs && myConvs.length > 0) {
    const convIds = myConvs.map((m) => m.conversation_id);

    const { data: otherConvs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", convIds);

    if (otherConvs && otherConvs.length > 0) {
      const matchingIds = otherConvs.map((c) => c.conversation_id);
      const { data: nonGroup } = await supabase
        .from("conversations")
        .select("id")
        .in("id", matchingIds)
        .eq("is_group", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nonGroup?.id) {
        return nonGroup.id;
      }
    }
  }

  // 3. Fallback: Create new conversation manually
  const { data: newConv, error: convErr } = await supabase
    .from("conversations")
    .insert({
      is_group: false,
      created_by: currentUserId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (convErr || !newConv) {
    throw new Error(convErr?.message || "تعذر إنشاء المحادثة في قاعدة البيانات");
  }

  // Insert both users into conversation_members separately to avoid bulk insert policy issues
  await supabase
    .from("conversation_members")
    .insert({ conversation_id: newConv.id, user_id: currentUserId });

  await supabase
    .from("conversation_members")
    .insert({ conversation_id: newConv.id, user_id: otherUserId });

  return newConv.id;
}

