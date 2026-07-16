import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, Loader2, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  component: ChatPage,
});

interface Message { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; }

function ChatPage() {
  const { id } = useParams({ from: "/_authenticated/messages/$id" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
      if (!data) return null;
      const { data: members } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", id);
      const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, university_number").in("id", memberIds);
      return { ...data, profiles: profs ?? [] };
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", id],
    queryFn: async (): Promise<Message[]> => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at");
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`conv-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["messages", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const [text, setText] = useState("");
  const sendMut = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return;
      const { error } = await supabase.from("messages").insert({
        conversation_id: id, sender_id: user.id, content: text.trim(),
      });
      if (error) throw error;
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["messages", id] }); },
  });

  const profilesMap = new Map((conv?.profiles ?? []).map((p: { id: string; full_name: string; university_number: string }) => [p.id, p]));
  const title = conv?.is_group
    ? conv?.name ?? "مجموعة"
    : (conv?.profiles ?? []).find((p: { id: string }) => p.id !== user?.id)?.full_name ?? "محادثة";

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2 mb-3">
        <Link to="/messages" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <Avatar className="w-9 h-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            {conv?.is_group ? <Users className="w-4 h-4" /> : title.slice(0,2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{title}</div>
          {conv?.is_group && (
            <div className="text-xs text-muted-foreground">{(conv?.profiles ?? []).length} أعضاء</div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto space-y-2 pb-2">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user?.id;
          const sender = profilesMap.get(m.sender_id) as { full_name: string } | undefined;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                mine ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                {!mine && conv?.is_group && (
                  <div className="text-[10px] font-semibold opacity-70 mb-0.5">{sender?.full_name}</div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div className={cn("text-[10px] mt-1", mine ? "opacity-70" : "text-muted-foreground")}>
                  {format(new Date(m.created_at), "HH:mm")}
                </div>
              </div>
            </div>
          );
        })}
        {(!messages || messages.length === 0) && (
          <div className="text-center text-sm text-muted-foreground py-6">ابدأ المحادثة بإرسال رسالة</div>
        )}
      </div>

      <Card className="mt-2">
        <CardContent className="p-2 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMut.mutate(); } }}
            placeholder="اكتب رسالة..."
          />
          <Button onClick={() => sendMut.mutate()} disabled={!text.trim() || sendMut.isPending} size="icon">
            {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
