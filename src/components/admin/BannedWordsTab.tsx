import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

function BannedWordsTab() {
  const qc = useQueryClient();
  const [word, setWord] = useState("");
  const { data } = useQuery({
    queryKey: ["banned-words-admin"],
    queryFn: async () => (await supabase.from("banned_words").select("*").order("word")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const w = word.trim().toLowerCase();
      if (!w) throw new Error("أدخل كلمة");
      const { error } = await supabase.from("banned_words").insert({ word: w });
      if (error) throw error;
    },
    onSuccess: () => {
      setWord("");
      qc.invalidateQueries({ queryKey: ["banned-words-admin"] });
      qc.invalidateQueries({ queryKey: ["banned-words"] });
      toast.success("تمت الإضافة");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("banned_words").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["banned-words-admin"] });
      qc.invalidateQueries({ queryKey: ["banned-words"] });
    },
  });

  return (
    <Card className="border-border/40 shadow-none bg-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="أضف كلمة محظورة"
          />
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            <Plus className="w-4 h-4" /> إضافة
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data ?? []).map((w: { id: string; word: string }) => (
            <Badge key={w.id} variant="secondary" className="gap-1">
              {w.word}
              <button onClick={() => del.mutate(w.id)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
