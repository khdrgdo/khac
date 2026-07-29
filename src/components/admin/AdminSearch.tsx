import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Users, BookOpen, FileText, Loader2, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SearchResult {
  type: "user" | "course";
  id: string;
  label: string;
  sublabel: string;
  avatar?: string;
}

export function AdminSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const results: SearchResult[] = [];
      const q = `%${query}%`;
      const [usersRes, coursesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url").or(`full_name.ilike.${q},email.ilike.${q}`).limit(5),
        supabase.from("courses").select("id, name, major").ilike("name", q).limit(5),
      ]);
      (usersRes.data ?? []).forEach((u) => {
        results.push({ type: "user", id: u.id, label: u.full_name || "—", sublabel: u.email || "", avatar: u.avatar_url || undefined });
      });
      (coursesRes.data ?? []).forEach((c) => {
        results.push({ type: "course", id: c.id, label: c.name, sublabel: c.major || "" });
      });
      return results;
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (r.type === "user") navigate({ to: "/admin", search: { tab: "users" } });
    else navigate({ to: "/courses/$id", params: { id: r.id }, search: { tab: undefined } });
  };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث عن مستخدمين أو مقررات..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="pr-9 text-sm bg-muted/30 border-border/50 focus-visible:bg-background"
        />
        {isLoading && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && query.length >= 2 && (
        <Card className="absolute top-full mt-1 right-0 left-0 z-50 shadow-lg border-border/40 rounded-xl max-h-80 overflow-auto">
          <CardContent className="p-2">
            {!data?.length ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد نتائج</p>
            ) : (
              data.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-right transition-colors"
                  onClick={() => handleSelect(r)}
                >
                  {r.type === "user" ? (
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={r.avatar} />
                      <AvatarFallback className="text-[10px]">{(r.label?.[0] || "?").toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs font-medium truncate">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.sublabel}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {r.type === "user" ? <Users className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
