import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { toast } from "sonner";
import { Loader2, Send, ShieldAlert, ImagePlus, X, HelpCircle } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { StorageImage } from "@/components/StorageImage";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

function findBannedWords(text: string, words: string[]): string[] {
  const t = ` ${text.toLowerCase()} `;
  return words.filter((w) => w && t.includes(w.toLowerCase()));
}

export function CreatePost() {
  const { user, profile, refreshProfile, isSubAdmin } = useAuth();
  const [content, setContent] = useState("");
  const [isQuestion, setIsQuestion] = useState(false);
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
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`${f.name}: أكبر من 5MB`);
          continue;
        }
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
        post_type: isQuestion ? "question" : "general",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      setImagePaths([]);
      setIsQuestion(false);
      toast.success("تم النشر (+5 نقاط)");
      qc.invalidateQueries({ queryKey: ["posts"] });
      refreshProfile();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isSubAdmin) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <ShieldAlert className="w-5 h-5 text-muted-foreground shrink-0" />
          <span>
            حساب المشرف المساعد (سب أدمن) مخصص للإشراف والمراقبة فقط من لوحة التحكم، ولا يملك صلاحية
            النشر.
          </span>
        </CardContent>
      </Card>
    );
  }

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
                : until
                  ? `لا يمكن النشر حتى ${format(new Date(until), "yyyy/MM/dd HH:mm")}.`
                  : "راجع الإدارة."}
              {typeof profile?.warning_count === "number" &&
                ` — عدد التحذيرات: ${profile.warning_count}`}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-muted/50 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Top Tabs Header */}
      <div className="flex border-b border-muted/40 bg-muted/10">
        <button
          type="button"
          onClick={() => setIsQuestion(false)}
          className={cn(
            "flex-1 py-3 text-center text-xs font-semibold transition-all relative border-b-2 outline-none",
            !isQuestion
              ? "border-primary text-primary bg-background/50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5",
          )}
        >
          📝 منشور عام
        </button>
        <button
          type="button"
          onClick={() => setIsQuestion(true)}
          className={cn(
            "flex-1 py-3 text-center text-xs font-semibold transition-all relative border-b-2 outline-none",
            isQuestion
              ? "border-primary text-primary bg-background/50"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/5",
          )}
        >
          ❓ سؤال تعليمي
        </button>
      </div>

      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-4">
          <UserAvatar
            avatarUrl={profile?.avatar_url}
            fullName={profile?.full_name ?? "؟"}
            className="w-10 h-10 shrink-0 border shadow-sm"
          />
          <div className="flex-1 space-y-3">
            <div className="min-h-[85px] w-full">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  isQuestion
                    ? "اكتب سؤالك التعليمي هنا بالتفصيل (مثال: مسألة رياضية، استفسار أكاديمي، مشكلة برمجية)..."
                    : "شارك نصيحة، موضوع مفيد، أو منشور عام مع زملائك في الكلية..."
                }
                rows={3}
                maxLength={2000}
                className="resize-none w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-[15px] placeholder:text-muted-foreground/60 leading-relaxed bg-transparent"
              />
            </div>

            {imagePaths.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {imagePaths.map((p) => (
                  <div
                    key={p}
                    className="relative group overflow-hidden rounded-lg border shadow-sm"
                  >
                    <StorageImage
                      bucket="post-images"
                      path={p}
                      className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                    />
                    <button
                      onClick={() => setImagePaths((prev) => prev.filter((x) => x !== p))}
                      className="absolute top-1.5 right-1.5 bg-black/75 text-white rounded-full p-1.5 hover:bg-red-600 transition shadow-md"
                      title="إزالة الصورة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {hits.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded-lg p-2.5 border border-destructive/10 animate-pulse">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                يحتوي المنشور على كلمات غير لائقة: {hits.join("، ")}
              </div>
            )}

            <div className="flex justify-between items-center gap-2 pt-3 border-t border-muted/40">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || imagePaths.length >= 4}
                  className="rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5 transition gap-1.5 h-8 text-xs"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="w-3.5 h-3.5" />
                  )}
                  إرفاق صور
                </Button>

                {content.length > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-muted/65 px-2.5 py-1 rounded-full font-mono">
                    {content.length}/2000
                  </span>
                )}
              </div>

              <Button
                size="sm"
                onClick={() => mut.mutate()}
                disabled={
                  (!content.trim() && imagePaths.length === 0) || mut.isPending || hits.length > 0
                }
                className="rounded-full px-4 gap-1.5 text-xs font-semibold shadow-sm transition"
              >
                {mut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                نشر {isQuestion ? "السؤال" : "المنشور"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
