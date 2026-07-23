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

const STORAGE_KEY = "app_name_change_requests";

export function hasUserUsedDirectChange(userId: string): boolean {
  if (!userId) return false;
  return localStorage.getItem(`name_change_used_${userId}`) === "true";
}

export function setUserUsedDirectChange(userId: string, used: boolean): void {
  if (!userId) return;
  if (used) {
    localStorage.setItem(`name_change_used_${userId}`, "true");
  } else {
    localStorage.removeItem(`name_change_used_${userId}`);
  }
}

export function getNameChangeRequests(): NameChangeRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NameChangeRequest[];
  } catch {
    return [];
  }
}

export function saveNameChangeRequests(list: NameChangeRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("name_change_requests_updated"));
  } catch (e) {
    console.error("Failed to save name change requests", e);
  }
}

export function submitNameChangeRequest(
  data: Omit<NameChangeRequest, "id" | "created_at" | "status">,
): NameChangeRequest {
  const list = getNameChangeRequests();
  const newReq: NameChangeRequest = {
    ...data,
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  list.unshift(newReq);
  saveNameChangeRequests(list);
  return newReq;
}

export async function approveNameChangeRequest(
  requestId: string,
): Promise<NameChangeRequest | null> {
  const list = getNameChangeRequests();
  const index = list.findIndex((r) => r.id === requestId);
  if (index === -1) return null;

  const target = list[index];
  target.status = "approved";
  target.processed_at = new Date().toISOString();

  // 1. Update full_name in Supabase profiles
  try {
    await supabase
      .from("profiles")
      .update({ full_name: target.requested_name })
      .eq("id", target.user_id);
  } catch (e) {
    console.error("Failed to update profile name in database", e);
  }

  // 2. Reset the user's direct change flag so they can change their name again as requested!
  setUserUsedDirectChange(target.user_id, false);

  saveNameChangeRequests(list);
  return target;
}

export function rejectNameChangeRequest(requestId: string): NameChangeRequest | null {
  const list = getNameChangeRequests();
  const index = list.findIndex((r) => r.id === requestId);
  if (index === -1) return null;

  const target = list[index];
  target.status = "rejected";
  target.processed_at = new Date().toISOString();

  saveNameChangeRequests(list);
  return target;
}
