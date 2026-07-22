import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Users, User as UserIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatUnivNumber } from "@/lib/privacy";
import type { ReactElement } from "react";

export function NewConversationDialog({ trigger }: { trigger?: ReactElement }) {
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
      const { data } = await supabase.rpc("search_public_profiles", { _q: search.trim() });
      return (data ?? []).filter((p: { id: string }) => p.id !== user?.id);
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("جلسة غير صالحة");
      if (tab === "group") {
        if (!groupName.trim() || selected.size === 0)
          throw new Error("أدخل اسم المجموعة واختر أعضاء");
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
      setOpen(false);
      setSelected(new Set());
      setGroupName("");
      setSearch("");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (convId) navigate({ to: "/messages/$id", params: { id: convId } });
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر إنشاء المحادثة"),
  });

  function toggle(uid: string) {
    const next = new Set(selected);
    if (tab === "dm") {
      next.clear();
      next.add(uid);
    } else {
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
    }
    setSelected(next);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="w-4 h-4" /> جديدة
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>محادثة جديدة</DialogTitle>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            setSelected(new Set());
          }}
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="dm">
              <UserIcon className="w-4 h-4" /> فردية
            </TabsTrigger>
            <TabsTrigger value="group">
              <Users className="w-4 h-4" /> مجموعة
            </TabsTrigger>
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
            {(results ?? []).map(
              (p: { id: string; full_name: string; university_number: string }) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-start"
                >
                  <Checkbox checked={selected.has(p.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {formatUnivNumber(p.university_number, p.id)}
                    </div>
                  </div>
                </button>
              ),
            )}
            {search.length > 1 && (!results || results.length === 0) && (
              <div className="text-xs text-center text-muted-foreground p-2">لا نتائج</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || selected.size === 0}
          >
            {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} بدء المحادثة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
