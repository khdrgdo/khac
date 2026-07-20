import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight, Loader2, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MessagesShell } from "@/components/MessagesShell";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  component: ChatPage,
});

interface Message { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; }
interface Prof { id: string; full_name: string; university_number: string; }

function ChatPage() {
  const { id } = useParams({ from: "/_authenticated/messages/$id" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conv, isLoading: loadingConv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
      if (!data) return null;
      const { data: members } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", id);
      const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, full_name, university_number").in("id", memberIds);
      return { ...data, profiles: (profs ?? []) as Prof[] };
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
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["messages", id] }); qc.invalidateQueries({ queryKey: ["conversations"] }); },
  });

  const profilesMap = new Map((conv?.profiles ?? []).map((p: Prof) => [p.id, p]));
  const title = conv?.is_group
    ? conv?.name ?? "مجموعة"
    : (conv?.profiles ?? []).find((p: Prof) => p.id !== user?.id)?.full_name ?? "محادثة";

  return (
    <MessagesShell activeId={id}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b bg-card">
          <Link to="/messages" className="md:hidden text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Avatar className="w-10 h-10">
            <AvatarFallback className={cn("font-semibold", conv?.is_group ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary")}>
              {conv?.is_group ? <Users className="w-4 h-4" /> : title.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{title}</div>
            {conv?.is_group ? (
              <div className="text-xs text-muted-foreground">{(conv?.profiles ?? []).length} أعضاء</div>
            ) : (
              <div className="text-xs text-muted-foreground">متصل</div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-3 bg-muted/30 space-y-1">
          {loadingConv && (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          )}
          {!loadingConv && !conv && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              تعذّر فتح المحادثة. قد لا تكون عضوًا فيها.
            </div>
          )}
          {(messages ?? []).map((m, i) => {
            const mine = m.sender_id === user?.id;
            const sender = profilesMap.get(m.sender_id);
            const prev = i > 0 ? messages![i-1] : null;
            const showAvatar = !mine && (!prev || prev.sender_id !== m.sender_id);
            const groupWithNext = i < (messages?.length ?? 0) - 1 && messages![i+1].sender_id === m.sender_id;
            return (
              <div key={m.id} className={cn("flex items-end gap-1.5", mine ? "justify-start" : "justify-end")}>
                {!mine && (
                  <div className="w-7 h-7 shrink-0">
                    {showAvatar && (
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {(sender?.full_name ?? "?").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
                <div className={cn(
                  "max-w-[75%] px-3 py-2 text-sm shadow-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-card border",
                  mine
                    ? (groupWithNext ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-bl-md")
                    : (groupWithNext ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-br-md"),
                )}>
                  {!mine && conv?.is_group && showAvatar && (
                    <div className="text-[10px] font-semibold text-primary mb-0.5">{sender?.full_name}</div>
                  )}
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                  <div className={cn("text-[9px] mt-1 text-end", mine ? "opacity-80" : "text-muted-foreground")}>
                    {format(new Date(m.created_at), "HH:mm")}
                  </div>
                </div>
              </div>
            );
          })}
          {!loadingConv && conv && (!messages || messages.length === 0) && (
            <div className="text-center text-sm text-muted-foreground py-10">
              ابدأ المحادثة — أرسل أول رسالة
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="p-2 border-t bg-card">
          <div className="flex items-end gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMut.mutate(); } }}
              placeholder="اكتب رسالة..."
              className="rounded-full bg-muted/60 border-0 focus-visible:ring-1"
              disabled={!conv}
            />
            <Button
              onClick={() => sendMut.mutate()}
              disabled={!text.trim() || sendMut.isPending || !conv}
              size="icon"
              className="rounded-full shrink-0"
            >
              {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </MessagesShell>
  );
}
