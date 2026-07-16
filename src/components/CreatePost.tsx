import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

export function CreatePost() {
  const { user, profile } = useAuth();
  const [content, setContent] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("no session");
      const { error } = await supabase.from("posts").insert({ author_id: user.id, content: text });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      toast.success("تم النشر");
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
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => mut.mutate(content.trim())}
                disabled={!content.trim() || mut.isPending}
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
