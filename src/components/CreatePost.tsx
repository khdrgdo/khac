import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send, ShieldAlert } from "lucide-react";

function findBannedWords(text: string, words: string[]): string[] {
  const t = ` ${text.toLowerCase()} `;
  return words.filter((w) => w && t.includes(w.toLowerCase()));
}

export function CreatePost() {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const qc = useQueryClient();

  const { data: bannedList } = useQuery({
    queryKey: ["banned-words"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("banned_words").select("word");
      return (data ?? []).map((r: { word: string }) => r.word);
    },
  });

  const hits = findBannedWords(content, bannedList ?? []);

  const mut = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("no session");
      if (hits.length > 0) throw new Error("المنشور يحتوي على كلمات غير لائقة");
      const { error } = await supabase.from("posts").insert({ author_id: user.id, content: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      toast.success("تم النشر (+5 نقاط)");
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 shrink-0">
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
            {hits.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                يحتوي المنشور على كلمات غير لائقة: {hits.join("، ")}
              </div>
            )}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => mut.mutate(content.trim())}
                disabled={!content.trim() || mut.isPending || hits.length > 0}
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
