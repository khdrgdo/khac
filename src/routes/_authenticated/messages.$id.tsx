import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Loader2,
  Send,
  Users,
  MoreVertical,
  ShieldAlert,
  Flag,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MessagesShell } from "@/components/MessagesShell";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$id")({
  component: ChatPage,
});

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
interface Prof {
  id: string;
  full_name: string;
  university_number: string;
  avatar_url?: string | null;
}

function ChatPage() {
  const { id } = useParams({ from: "/_authenticated/messages/$id" });
  const { user, profile } = useAuth();
  const suspended = isSuspended(profile);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("محتوى غير لائق أو مسيء");
  const [reportNote, setReportNote] = useState("");

  const { data: conv, isLoading: loadingConv } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
      if (!data) return null;
      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", id);
      const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
      const { data: profs } = await supabase.rpc("get_public_profiles", { _ids: memberIds });
      return { ...data, profiles: (profs ?? []) as Prof[] };
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", id],
    queryFn: async (): Promise<Message[]> => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at");
      return (data ?? []) as Message[];
    },
  });

  const otherUserId = (conv?.profiles ?? []).find((p: Prof) => p.id !== user?.id)?.id;

  const { data: blockStatus } = useQuery({
    queryKey: ["block-status", user?.id, otherUserId],
    enabled: !!user && !!otherUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_users")
        .select("blocker_id, blocked_id")
        .or(
          `and(blocker_id.eq.${user!.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${user!.id})`,
        );
      const rows = data ?? [];
      return {
        iBlockedThem: rows.some((r) => r.blocker_id === user!.id),
        theyBlockedMe: rows.some((r) => r.blocker_id === otherUserId),
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`conv-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["messages", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const profilesMap = new Map((conv?.profiles ?? []).map((p: Prof) => [p.id, p]));
  const otherUser = (conv?.profiles ?? []).find((p: Prof) => p.id !== user?.id);
  const isOtherBlocked = blockStatus?.iBlockedThem ?? false;
  const amBlockedByOther = blockStatus?.theyBlockedMe ?? false;
  const title = conv?.is_group ? (conv?.name ?? "مجموعة") : (otherUser?.full_name ?? "محادثة");

  const toggleBlockMut = useMutation({
    mutationFn: async () => {
      if (!user || !otherUser) return;
      if (isOtherBlocked) {
        const { error } = await supabase
          .from("blocked_users")
          .delete()
          .eq("blocker_id", user.id)
          .eq("blocked_id", otherUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("blocked_users")
          .insert({ blocker_id: user.id, blocked_id: otherUser.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        isOtherBlocked ? `تم إلغاء حظر ${otherUser?.full_name}` : `تم حظر ${otherUser?.full_name}`,
      );
      qc.invalidateQueries({ queryKey: ["block-status", user?.id, otherUserId] });
    },
    onError: (e: Error) => toast.error(e.message || "حدث خطأ أثناء تعديل الحظر"),
  });
  const toggleBlock = () => toggleBlockMut.mutate();

  const reportMut = useMutation({
    mutationFn: async () => {
      if (!user || !otherUser) throw new Error("تعذّر تحديد المستخدم المُبلَّغ عنه");
      const { error } = await supabase.from("message_reports").insert({
        reporter_id: user.id,
        reported_user_id: otherUser.id,
        conversation_id: id,
        reason: reportReason,
        note: reportNote.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReportOpen(false);
      setReportNote("");
      toast.success("تم إرسال البلاغ للإدارة، شكرًا لك.");
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر إرسال البلاغ"),
  });
  const handleReportSubmit = () => reportMut.mutate();
  const submittingReport = reportMut.isPending;

  const [text, setText] = useState("");
  const sendMut = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return;
      if (suspended) throw new Error("حسابك موقوف مؤقتًا — لا يمكن إرسال الرسائل");
      if (isOtherBlocked) throw new Error("لا يمكنك مراسلة مستخدم قمت بحظره");
      if (amBlockedByOther) throw new Error("لا يمكنك مراسلة هذا المستخدم");
      const { error } = await supabase.from("messages").insert({
        conversation_id: id,
        sender_id: user.id,
        content: text.trim(),
      });
      if (error) throw error;
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="flex flex-col h-full bg-card">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b bg-card">
          <Link to="/messages" className="md:hidden text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-5 h-5" />
          </Link>
          {conv?.is_group ? (
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
                <Users className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <UserAvatar avatarUrl={otherUser?.avatar_url} fullName={title} className="w-10 h-10" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate flex items-center gap-1.5">
              {title}
              {isOtherBlocked && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                  محظور
                </span>
              )}
            </div>
            {conv?.is_group ? (
              <div className="text-xs text-muted-foreground">
                {(conv?.profiles ?? []).length} أعضاء
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                {isOtherBlocked ? "محظور" : "طالب"}
              </div>
            )}
          </div>

          {!conv?.is_group && otherUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={toggleBlock}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  {isOtherBlocked ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>إلغاء حظر المستخدم</span>
                    </>
                  ) : (
                    <>
                      <UserMinus className="w-4 h-4" />
                      <span>حظر المستخدم</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setReportOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Flag className="w-4 h-4" />
                  <span>إبلاغ عن إساءة</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-3 bg-muted/30 space-y-1">
          {loadingConv && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          {!loadingConv && !conv && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              تعذّر فتح المحادثة. قد لا تكون عضوًا فيها.
            </div>
          )}
          {(messages ?? []).map((m, i) => {
            const mine = m.sender_id === user?.id;
            const sender = profilesMap.get(m.sender_id);
            const prev = i > 0 ? messages![i - 1] : null;
            const showAvatar = !mine && (!prev || prev.sender_id !== m.sender_id);
            const groupWithNext =
              i < (messages?.length ?? 0) - 1 && messages![i + 1].sender_id === m.sender_id;
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-end gap-1.5",
                  mine ? "flex-row-reverse justify-start" : "flex-row justify-start",
                )}
              >
                {!mine && (
                  <div className="w-7 h-7 shrink-0">
                    {showAvatar && (
                      <UserAvatar
                        avatarUrl={sender?.avatar_url}
                        fullName={sender?.full_name ?? "?"}
                        className="w-7 h-7"
                      />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] px-3 py-2 text-sm shadow-sm",
                    mine
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-none"
                      : "bg-card border rounded-2xl rounded-bl-none",
                  )}
                >
                  {!mine && conv?.is_group && showAvatar && (
                    <div className="text-[10px] font-semibold text-primary mb-0.5">
                      {sender?.full_name}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                  <div
                    className={cn(
                      "text-[9px] mt-1 text-end",
                      mine ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
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

        {/* Composer or Block Banner */}
        {isOtherBlocked ? (
          <div className="p-4 border-t bg-destructive/5 text-destructive flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>لقد قمت بحظر هذا المستخدم. لا يمكنك إرسال رسائل إليه الآن.</span>
            </div>
            <Button onClick={toggleBlock} variant="destructive" size="sm" className="shrink-0">
              إلغاء الحظر
            </Button>
          </div>
        ) : amBlockedByOther ? (
          <div className="p-4 border-t bg-muted text-muted-foreground flex items-center gap-2 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>لا يمكنك مراسلة هذا المستخدم حاليًا.</span>
          </div>
        ) : (
          <div className="p-2 border-t bg-card">
            <div className="flex items-end gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMut.mutate();
                  }
                }}
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
                {sendMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" />
              <span>إبلاغ عن مستخدم</span>
            </DialogTitle>
            <DialogDescription>
              سيقوم فريق الإشراف بمراجعة هذا الحساب والمحادثة للتحقق من أي رسائل مسيئة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">سبب الإبلاغ</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  "محتوى غير لائق أو مسيء",
                  "تنمّر أو مضايقة",
                  "رسائل غير مرغوب فيها (Spam)",
                  "انتحال شخصية أخرى",
                  "سبب آخر",
                ].map((reason) => (
                  <div
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50 transition",
                      reportReason === reason ? "border-primary bg-primary/5" : "border-border",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                        reportReason === reason ? "border-primary" : "border-muted-foreground",
                      )}
                    >
                      {reportReason === reason && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-sm">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">تفاصيل إضافية (اختياري)</label>
              <Textarea
                placeholder="يرجى كتابة أي تفاصيل إضافية لمساعدتنا في التحقيق..."
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                rows={3}
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setReportOpen(false)}
              disabled={submittingReport}
            >
              إلغاء
            </Button>
            <Button onClick={handleReportSubmit} disabled={submittingReport} variant="destructive">
              {submittingReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>جاري الإرسال...</span>
                </>
              ) : (
                <span>إرسال البلاغ</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
