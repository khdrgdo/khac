import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, UserCheck } from "lucide-react";
import { majorLabel } from "@/lib/college";
import { formatUnivNumber } from "@/lib/privacy";

export function UsersTable() {
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, university_number, major, year, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.university_number?.toLowerCase().includes(q) ||
      u.major?.toLowerCase().includes(q)
    );
  });

  return (
    <Card className="p-6 border-border/60 rounded-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-500" />
          قائمة المستخدمين ({filtered.length})
        </h3>
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عن طالب..."
            className="rounded-xl pr-9 h-9 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">جاري التحميل...</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.map((u) => (
            <div key={u.id} className="p-3 rounded-2xl bg-muted/40 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-foreground">{u.full_name}</p>
                <p className="text-muted-foreground">{majorLabel(u.major)} • السنة {u.year ?? 1}</p>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatUnivNumber(u.university_number, u.id, false, true)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
