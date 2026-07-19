import { supabase } from "@/integrations/supabase/client";

export async function signedUrl(bucket: string, path: string | null | undefined, expires = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
  return data?.signedUrl ?? null;
}

export async function signedUrls(bucket: string, paths: string[], expires = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, expires);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: { path: string | null; signedUrl: string | null }) => {
    if (r.path && r.signedUrl) map[r.path] = r.signedUrl;
  });
  return map;
}

export async function uploadFile(bucket: string, userId: string, file: File, prefix = ""): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
