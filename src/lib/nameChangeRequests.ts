import { supabase } from "@/integrations/supabase/client";

export interface NameChangeRequest {
  id: string;
  user_id: string;
  current_name: string;
  requested_name: string;
  reason: string;
  contact_info: string;
  university_number?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  processed_at?: string;
}

export async function hasUserUsedDirectChange(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("has_used_direct_name_change")
      .eq("id", userId)
      .single();
    if (error) return false;
    return !!data?.has_used_direct_name_change;
  } catch {
    return false;
  }
}

export async function setUserUsedDirectChange(userId: string, used: boolean): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from("profiles").update({ has_used_direct_name_change: used }).eq("id", userId);
  } catch (err) {
    console.error(err);
  }
}

export async function getNameChangeRequests(): Promise<NameChangeRequest[]> {
  try {
    const { data, error } = await supabase
      .from("name_change_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch name change requests:", error);
      return [];
    }
    return (data as NameChangeRequest[]) || [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

export async function submitNameChangeRequest(
  data: Omit<NameChangeRequest, "id" | "created_at" | "status" | "processed_at">,
): Promise<NameChangeRequest | null> {
  try {
    const { data: newReq, error } = await supabase
      .from("name_change_requests")
      .insert([{ ...data, status: "pending" }])
      .select()
      .single();

    if (error) {
      console.error("Error submitting request:", error);
      return null;
    }
    window.dispatchEvent(new Event("name_change_requests_updated"));
    return newReq as NameChangeRequest;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function approveNameChangeRequest(
  requestId: string,
): Promise<NameChangeRequest | null> {
  try {
    // 1. Update status
    const { data: target, error } = await supabase
      .from("name_change_requests")
      .update({ status: "approved", processed_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .single();

    if (error || !target) {
      console.error("Failed to approve request:", error);
      return null;
    }

    // 2. Update full_name in Supabase profiles
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: target.requested_name })
      .eq("id", target.user_id);

    if (profileError) {
      console.error("Failed to update profile name in database", profileError);
    }

    await setUserUsedDirectChange(target.user_id, false);
    window.dispatchEvent(new Event("name_change_requests_updated"));
    return target as NameChangeRequest;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function rejectNameChangeRequest(
  requestId: string,
): Promise<NameChangeRequest | null> {
  try {
    const { data: target, error } = await supabase
      .from("name_change_requests")
      .update({ status: "rejected", processed_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .single();

    if (error || !target) {
      console.error("Failed to reject request:", error);
      return null;
    }

    window.dispatchEvent(new Event("name_change_requests_updated"));
    return target as NameChangeRequest;
  } catch (err) {
    console.error(err);
    return null;
  }
}
