import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageCircle, Plus, Loader2, Users, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

interface ConvRow {
  id: string; is_group: boolean; name: string | null; updated_at: string;
}

function MessagesPage() {
  const { user } = useAuth();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<(ConvRow & { other: { full_name: string; university_number: string } | null })[]> => {
      if (!user) return [];
      const { data: mem } = await supabase.from("conversation_members").select("conversation_id").eq("user_id", user.id);
      const ids = (mem ?? []).map((m: { conversation_id: string }) => m.conversation_id);
      if (ids.length === 0) return [];
      const { data: convs } = await supabase.from("conversations").select("*").in("id", ids).order("updated_at", { ascending: false });
      const convList = (convs ?? []) as ConvRow[];

      const enriched = await Promise.all(convList.map(async (c) => {
        if (!c.is_group) {
          const { data: members } = await supabase.from("conversation_members").select("user_id").eq("conversation_id", c.id);
          const otherId = (members ?? []).map((m: { user_id: string }) => m.user_id).find((uid: string) => uid !== user.id);
          let other: { full_name: string; university_number: string } | null = null;
          if (otherId) {
            const { data: p } = await supabase.from("profiles").select("full_name, university_number").eq("id", otherId).maybeSingle();
            if (p) other = { full_name: (p as { full_name: string }).full_name, university_number: (p as { university_number: string }).university_number };
          }
          return { ...c, other };
        }
        return { ...c, other: null as { full_name: string; university_number: string } | null };
      }));
      return enriched;
    },
  });


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">المحادثات</h1>
            <p className="text-xs text-muted-foreground">راسل زملاءك وأنشئ مجموعات</p>
          </div>
        </div>
        <NewConversationDialog />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !conversations || conversations.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          لا توجد محادثات بعد. ابدأ محادثة جديدة.
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => {
            const title = c.is_group ? c.name ?? "مجموعة" : c.other?.full_name ?? "مستخدم";
            return (
              <Link key={c.id} to="/messages/$id" params={{ id: c.id }}>
                <Card className="hover:border-primary/50 transition">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="w-11 h-11">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {c.is_group ? <Users className="w-5 h-5" /> : title.slice(0,2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: ar })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewConversationDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("dm");
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: results } = useQuery({
    queryKey: ["profile-search", search],
    enabled: search.trim().length > 1,
    queryFn: async () => {
      const like = `%${search.trim()}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, university_number")
        .or(`full_name.ilike.${like},university_number.ilike.${like}`)
        .limit(15);
      return (data ?? []).filter((p: { id: string }) => p.id !== user?.id);
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("جلسة غير صالحة");
      const isGroup = tab === "group";
      if (isGroup) {
        if (!groupName.trim() || selected.size === 0) throw new Error("أدخل اسم المجموعة واختر أعضاء");
        const { data, error } = await supabase.rpc("create_group", {
          _name: groupName.trim(),
          _members: Array.from(selected),
        });
        if (error) throw error;
        return data as string;
      } else {
        if (selected.size !== 1) throw new Error("اختر شخصًا واحدًا");
        const otherId = Array.from(selected)[0];
        const { data, error } = await supabase.rpc("create_dm", { _other: otherId });
        if (error) throw error;
        return data as string;
      }
    },
    onSuccess: (convId) => {
      setOpen(false); setSelected(new Set()); setGroupName(""); setSearch("");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (convId) navigate({ to: "/messages/$id", params: { id: convId } });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر إنشاء المحادثة"),
  });

  function toggle(uid: string) {
    const next = new Set(selected);
    if (tab === "dm") { next.clear(); next.add(uid); }
    else { next.has(uid) ? next.delete(uid) : next.add(uid); }
    setSelected(next);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4" /> جديدة</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>محادثة جديدة</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelected(new Set()); }}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="dm"><UserIcon className="w-4 h-4" /> فردية</TabsTrigger>
            <TabsTrigger value="group"><Users className="w-4 h-4" /> مجموعة</TabsTrigger>
          </TabsList>
          <TabsContent value="group" className="space-y-2 pt-3">
            <Label>اسم المجموعة</Label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </TabsContent>
        </Tabs>
        <div className="space-y-2">
          <Label>ابحث بالاسم أو الرقم الجامعي</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث..." />
          <div className="max-h-64 overflow-auto space-y-1 border rounded-md p-1">
            {(results ?? []).map((p: { id: string; full_name: string; university_number: string }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-start"
              >
                <Checkbox checked={selected.has(p.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{p.university_number}</div>
                </div>
              </button>
            ))}
            {search.length > 1 && (!results || results.length === 0) && (
              <div className="text-xs text-center text-muted-foreground p-2">لا نتائج</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending || selected.size === 0}>
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} بدء المحادثة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
