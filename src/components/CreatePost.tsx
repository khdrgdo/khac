import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send, ShieldAlert, ImagePlus, X } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { StorageImage } from "@/components/StorageImage";
import { format } from "date-fns";

function findBannedWords(text: string, words: string[]): string[] {
  const t = ` ${text.toLowerCase()} `;
  return words.filter((w) => w && t.includes(w.toLowerCase()));
}

export function CreatePost() {
  const { user, profile, refreshProfile } = useAuth();
  const [content, setContent] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const suspended = isSuspended(profile);

  const { data: bannedList } = useQuery({
    queryKey: ["banned-words"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("banned_words").select("word");
      return (data ?? []).map((r: { word: string }) => r.word);
    },
  });

  const hits = findBannedWords(content, bannedList ?? []);

  async function handleFiles(files: FileList | null) {
    if (!files || !user) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, 4 - imagePaths.length)) {
        if (!f.type.startsWith("image/")) continue;
        if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name}: أكبر من 5MB`); continue; }
        const path = await uploadFile("post-images", user.id, f);
        uploaded.push(path);
      }
      setImagePaths((p) => [...p, ...uploaded]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("جلسة غير صالحة");
      if (suspended) throw new Error("حسابك موقوف مؤقتًا — لا يمكن النشر");
      if (hits.length > 0) throw new Error(`المنشور يحتوي على كلمات محظورة: ${hits.join("، ")}`);
      if (!content.trim() && imagePaths.length === 0) throw new Error("أضف نصًا أو صورة");
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: content.trim(),
        images: imagePaths,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent(""); setImagePaths([]);
      toast.success("تم النشر (+5 نقاط)");
      qc.invalidateQueries({ queryKey: ["posts"] });
      refreshProfile();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (suspended) {
    const until = profile?.suspended_until;
    return (
      <Card>
        <CardContent className="p-4 flex items-start gap-2 text-sm text-destructive bg-destructive/5">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">حسابك موقوف مؤقتًا</div>
            <div className="text-xs mt-1">
              {profile?.banned
                ? "تم حظر حسابك من قبل الإدارة."
                : until ? `لا يمكن النشر حتى ${format(new Date(until), "yyyy/MM/dd HH:mm")}.` : "راجع الإدارة."}
              {typeof profile?.warning_count === "number" && ` — عدد التحذيرات: ${profile.warning_count}`}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {(profile?.full_name ?? "؟").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="ماذا يدور في ذهنك؟"
              rows={2}
              maxLength={2000}
              className="resize-none"
            />
            {imagePaths.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {imagePaths.map((p) => (
                  <div key={p} className="relative group">
                    <StorageImage bucket="post-images" path={p} className="w-full h-32 object-cover rounded-md" />
                    <button
                      onClick={() => setImagePaths((prev) => prev.filter((x) => x !== p))}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {hits.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                يحتوي المنشور على كلمات محظورة: {hits.join("، ")}
              </div>
            )}
            <div className="flex justify-between items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || imagePaths.length >= 4}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                صورة
              </Button>
              <Button
                size="sm"
                onClick={() => mut.mutate()}
                disabled={(!content.trim() && imagePaths.length === 0) || mut.isPending || hits.length > 0}
              >
                {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                نشر
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
