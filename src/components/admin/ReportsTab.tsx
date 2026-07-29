import { useState } from "react";
import { renderMarkdownContent } from "@/lib/markdown";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { useSubAdminRestrictions } from "@/components/admin/admin-shared";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Flag, FileText, Plus, Minus, Check, X, Trash2, Ban, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

export function ReportsTab() {
  const qc = useQueryClient();
  const { handleActionCheck, isSubAdmin } = useSubAdminRestrictions();
  const { profile } = useAuth();
  const permissions = getSubAdminPermissions(profile);

  const canWarn = !isSubAdmin || permissions.can_warn;
  const canSuspend = !isSubAdmin || permissions.can_suspend;

  const [reasonFor, setReasonFor] = useState<{
    postId: string;
    authorId: string;
    action: "warn" | "suspend" | "ban";
  } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("post_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = data ?? [];
      const postIds = Array.from(new Set(rows.map((r) => r.post_id)));
      const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id)));
      const [{ data: posts }, { data: reporters }] = await Promise.all([
        postIds.length
          ? supabase.from("posts").select("id, content, author_id").in("id", postIds)
          : Promise.resolve({ data: [] as { id: string; content: string; author_id: string }[] }),
        reporterIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", reporterIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      ]);
      const pMap = new Map((posts ?? []).map((p) => [p.id, p]));
      const rMap = new Map((reporters ?? []).map((r) => [r.id, r]));
      return rows.map((r) => ({
        ...r,
        post: pMap.get(r.post_id),
        reporter: rMap.get(r.reporter_id),
      }));
    },
  });

  function invalidateAfterAction() {
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-log"] });
    qc.invalidateQueries({ queryKey: ["user-details"] });
  }

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("post_reports")
        .update({ status: "dismissed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("╪¬┘à ╪▒┘ü╪╢ ╪º┘ä╪¿┘ä╪º╪║");
      invalidateAfterAction();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async ({ reportId, postId }: { reportId: string; postId: string }) => {
      const { data: postData } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .maybeSingle();

      if (postData?.author_id) {
        const { data: targetProfile } = await supabase
          .from("profiles")
          .select("id, university_number, email")
          .eq("id", postData.author_id)
          .maybeSingle();

        if (targetProfile) {
          handleActionCheck(targetProfile);
        }
      }

      const { error: delErr } = await supabase.from("posts").delete().eq("id", postId);
      if (delErr) throw delErr;
      await supabase.from("post_reports").update({ status: "confirmed" }).eq("id", reportId);
    },
    onSuccess: () => {
      toast.success("╪¬┘à ╪¡╪░┘ü ╪º┘ä┘à┘å╪┤┘ê╪▒");
      invalidateAfterAction();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const consequence = useMutation({
    mutationFn: async ({
      reportId,
      authorId,
      action,
      reason,
      days,
    }: {
      reportId: string;
      authorId: string;
      action: "warn" | "suspend" | "ban";
      reason: string;
      days?: number;
    }) => {
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("id, university_number, email")
        .eq("id", authorId)
        .maybeSingle();

      if (targetProfile) {
        handleActionCheck(targetProfile);
      }

      if (action === "warn") {
        const { error } = await supabase.rpc("admin_warn", { _user: authorId, _reason: reason });
        if (error) throw error;
      } else if (action === "suspend") {
        const { error } = await supabase.rpc("admin_suspend", {
          _user: authorId,
          _days: days ?? 3,
          _reason: reason,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("admin_ban", { _user: authorId, _reason: reason });
        if (error) throw error;
      }
      await supabase.from("post_reports").update({ status: "confirmed" }).eq("id", reportId);
    },
    onSuccess: (_, v) => {
      toast.success(
        v.action === "warn"
          ? "╪¬┘à ╪Ñ╪▒╪│╪º┘ä ╪Ñ┘å╪░╪º╪▒ ┘ä╪╡╪º╪¡╪¿ ╪º┘ä┘à┘å╪┤┘ê╪▒"
          : v.action === "suspend"
            ? "╪¬┘à ╪Ñ┘è┘é╪º┘ü ╪º┘ä┘à╪│╪¬╪«╪»┘à ┘à╪ñ┘é╪¬┘ï╪º"
            : "╪¬┘à ╪¡╪╕╪▒ ╪º┘ä┘à╪│╪¬╪«╪»┘à",
      );
      invalidateAfterAction();
      setReasonFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      {!isLoading && (data ?? []).length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">┘ä╪º ╪¬┘ê╪¼╪» ╪¿┘ä╪º╪║╪º╪¬</div>
      )}
      <Card className="border-border/40 shadow-none bg-card">
        <div className="divide-y divide-border/40">
          {(data ?? []).map((r) => (
            <div key={r.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">╪¿┘ä╪º╪║ ┘à┘å:</span>
                  <span className="font-semibold text-foreground">
                    {r.reporter?.full_name ?? "ΓÇö"}
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    r.status === "pending"
                      ? "bg-amber-500/10 text-amber-600 border-none"
                      : r.status === "confirmed"
                        ? "bg-emerald-500/10 text-emerald-600 border-none"
                        : "bg-muted text-muted-foreground border-none"
                  }
                >
                  {r.status === "pending"
                    ? "┘é┘è╪» ╪º┘ä┘à╪▒╪º╪¼╪╣╪⌐"
                    : r.status === "confirmed"
                      ? "╪¬┘à╪¬ ╪º┘ä┘à╪╣╪º┘ä╪¼╪⌐"
                      : "┘à╪▒┘ü┘ê╪╢"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-sm bg-muted/30 border border-border/40 rounded-lg p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5" /> ╪│╪¿╪¿ ╪º┘ä╪¿┘ä╪º╪║
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/90">{r.reason}</p>
                </div>

                {r.post ? (
                  <div className="text-sm bg-card border border-border/40 shadow-sm rounded-lg p-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> ┘à╪¡╪¬┘ê┘ë ╪º┘ä┘à┘å╪┤┘ê╪▒
                    </div>
                    <div className="line-clamp-3 text-foreground/90">
                      {renderMarkdownContent(r.post.content)}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm bg-muted/30 border border-border/40 rounded-lg p-3 flex items-center text-muted-foreground italic">
                    ╪º┘ä┘à┘å╪┤┘ê╪▒ ┘à╪¡╪░┘ê┘ü ┘à╪│╪¿┘é┘ï╪º
                  </div>
                )}
              </div>

              {r.status === "pending" &&
                r.post &&
                (() => {
                  const post = r.post;
                  return (
                    <div className="flex items-center gap-2 flex-wrap pt-2 mt-2 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:bg-muted"
                        onClick={() => dismiss.mutate(r.id)}
                        disabled={dismiss.isPending}
                      >
                        <X className="w-4 h-4 ml-1.5" /> ╪▒┘ü╪╢ ╪º┘ä╪¿┘ä╪º╪║
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => deletePost.mutate({ reportId: r.id, postId: r.post_id })}
                        disabled={deletePost.isPending}
                      >
                        <Trash2 className="w-4 h-4 ml-1.5" /> ╪¡╪░┘ü ╪º┘ä┘à┘å╪┤┘ê╪▒
                      </Button>
                      {canWarn && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-amber-600 hover:bg-amber-500/10"
                          onClick={() =>
                            setReasonFor({
                              postId: r.post_id,
                              authorId: post.author_id,
                              action: "warn",
                            })
                          }
                        >
                          <AlertTriangle className="w-4 h-4 ml-1.5" /> ╪Ñ┘å╪░╪º╪▒
                        </Button>
                      )}
                      {canSuspend && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-orange-600 hover:bg-orange-500/10"
                          onClick={() =>
                            setReasonFor({
                              postId: r.post_id,
                              authorId: post.author_id,
                              action: "suspend",
                            })
                          }
                        >
                          <Clock className="w-4 h-4 ml-1.5" /> ╪Ñ┘è┘é╪º┘ü
                        </Button>
                      )}
                      {canSuspend && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setReasonFor({
                              postId: r.post_id,
                              authorId: post.author_id,
                              action: "ban",
                            })
                          }
                        >
                          <Ban className="w-4 h-4 ml-1.5" /> ╪¡╪╕╪▒
                        </Button>
                      )}
                    </div>
                  );
                })()}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={!!reasonFor} onOpenChange={(o) => !o && setReasonFor(null)}>
        <DialogContent>
          <ConsequenceForm
            action={reasonFor?.action}
            pending={consequence.isPending}
            onCancel={() => setReasonFor(null)}
            onConfirm={(reason, days) => {
              const target = (data ?? []).find((r) => r.post_id === reasonFor?.postId);
              if (!target || !reasonFor) return;
              consequence.mutate({
                reportId: target.id,
                authorId: reasonFor.authorId,
                action: reasonFor.action,
                reason,
                days,
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsequenceForm({
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  action?: "warn" | "suspend" | "ban";
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, days?: number) => void;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("3");
  if (!action) return null;
  const title =
    action === "warn" ? "╪Ñ╪▒╪│╪º┘ä ╪Ñ┘å╪░╪º╪▒" : action === "suspend" ? "╪Ñ┘è┘é╪º┘ü ┘à╪ñ┘é╪¬" : "╪¡╪╕╪▒ ╪º┘ä┘à╪│╪¬╪«╪»┘à";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>╪º┘ä╪│╪¿╪¿ (┘è╪╕┘ç╪▒ ┘ü┘è ╪│╪¼┘ä ╪º┘ä┘å╪┤╪º╪╖)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="╪º┘â╪¬╪¿ ╪│╪¿╪¿ ╪º┘ä╪Ñ╪¼╪▒╪º╪í"
            rows={3}
          />
        </div>
        {action === "suspend" && (
          <div className="space-y-1.5">
            <Label>╪╣╪»╪» ╪ú┘è╪º┘à ╪º┘ä╪Ñ┘è┘é╪º┘ü</Label>
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              dir="ltr"
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>
          ╪Ñ┘ä╪║╪º╪í
        </Button>
        <Button
          variant={action === "ban" ? "destructive" : "default"}
          disabled={!reason.trim() || pending}
          onClick={() =>
            onConfirm(reason.trim(), action === "suspend" ? Number(days) || 3 : undefined)
          }
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />} ╪¬╪ú┘â┘è╪»
        </Button>
      </DialogFooter>
    </>
  );
}
