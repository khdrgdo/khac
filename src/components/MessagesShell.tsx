import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Plus, Search, Users } from "lucide-react";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

interface ConvRow {
  id: string; is_group: boolean; name: string | null; updated_at: string;
  other?: { id: string; full_name: string; university_number: string } | null;
  lastMessage?: { content: string; created_at: string; sender_id: string } | null;
}

export function MessagesShell({ activeId, children }: { activeId?: string; children?: ReactNode }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const inChat = !!activeId;

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ConvRow[]> => {
      if (!user) return [];
      const { data: mem } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
      const ids = (mem ?? []).map((m: { conversation_id: string }) => m.conversation_id);
      if (ids.length === 0) return [];
      const { data: convs } = await supabase.from("conversations").select("*").in("id", ids).order("updated_at", { ascending: false });
      const list = (convs ?? []) as ConvRow[];

      // Fetch last messages + other members in parallel
      const enriched = await Promise.all(list.map(async (c) => {
        const [{ data: members }, { data: lastMsg }] = await Promise.all([
          supabase.from("conversation_members").select("user_id").eq("conversation_id", c.id),
          supabase.from("messages").select("content, created_at, sender_id").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1),
        ]);
        let other: ConvRow["other"] = null;
        if (!c.is_group) {
          const otherId = (members ?? []).map((m: { user_id: string }) => m.user_id).find((uid: string) => uid !== user.id);
          if (otherId) {
            const { data: p } = await supabase.rpc("get_public_profiles", { _ids: [otherId] });
            if (p && p[0]) other = { id: p[0].id, full_name: p[0].full_name, university_number: p[0].university_number } as ConvRow["other"];
          }
        }
        return { ...c, other, lastMessage: (lastMsg && lastMsg[0]) ? lastMsg[0] : null };
      }));
      return enriched;
    },
  });

  const filtered = (conversations ?? []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const title = c.is_group ? (c.name ?? "") : (c.other?.full_name ?? "");
    return title.toLowerCase().includes(q) || (c.other?.university_number ?? "").includes(q);
  });

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex rounded-xl overflow-hidden border bg-card shadow-sm">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col w-full md:w-80 border-e",
        inChat ? "hidden md:flex" : "flex",
      )}>
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" /> المحادثات
            </h1>
            <NewConversationDialog trigger={<Button size="icon" className="rounded-full h-8 w-8"><Plus className="w-4 h-4" /></Button>} />
          </div>
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في المحادثات" className="pr-8 h-9 bg-muted/50 border-0" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {search ? "لا نتائج" : "لا توجد محادثات — ابدأ محادثة جديدة"}
            </div>
          ) : (
            filtered.map((c) => {
              const title = c.is_group ? (c.name ?? "مجموعة") : (c.other?.full_name ?? "مستخدم");
              const isActive = c.id === activeId;
              const preview = c.lastMessage?.content
                ? (c.lastMessage.sender_id === user?.id ? "أنت: " : "") + c.lastMessage.content.slice(0, 40)
                : "لا توجد رسائل بعد";
              return (
                <Link key={c.id} to="/messages/$id" params={{ id: c.id }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition border-b border-border/40",
                    isActive && "bg-primary/10 hover:bg-primary/15",
                  )}>
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarFallback className={cn("font-semibold", c.is_group ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary")}>
                      {c.is_group ? <Users className="w-5 h-5" /> : title.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold truncate text-sm">{title}</div>
                      <div className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(c.lastMessage?.created_at ?? c.updated_at), { addSuffix: false, locale: ar })}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{preview}</div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </aside>

      {/* Main area */}
      <section className={cn("flex-1 flex flex-col min-w-0", !inChat && "hidden md:flex")}>
        {children ?? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
            <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <MessageCircle className="w-10 h-10" />
            </div>
            <h2 className="text-lg font-bold">اختر محادثة</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              اختر محادثة من القائمة على اليمين، أو اضغط زر + لبدء محادثة جديدة.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
