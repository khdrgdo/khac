import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isSuspended } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { majorLabel } from "@/lib/college";
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
  Search,
  MessageSquare,
  ExternalLink,
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
  major?: string | null;
  year?: number | null;
}

function ChatPage() {
  const { id } = useParams({ from: "/_authenticated/messages/$id" });
  const navigate = useNavigate();
  const { user, profile, isSubAdmin } = useAuth();
  const suspended = isSuspended(profile);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [blockedUsers, setBlockedUsers] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("blocked_users");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("محتوى غير لائق أو مسيء");
  const [reportNote, setReportNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [membersOpen, setMembersOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem("blocked_users");
        setBlockedUsers(stored ? JSON.parse(stored) : []);
      } catch (e) {
        console.warn(e);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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

  useEffect(() => {
    const ch = supabase
      .channel(`conv-${id}_${Math.random().toString(36).substring(7)}`)
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
  const isOtherBlocked = otherUser ? blockedUsers.includes(otherUser.id) : false;
  const title = conv?.is_group ? (conv?.name ?? "مجموعة") : (otherUser?.full_name ?? "محادثة");

  const toggleBlock = () => {
    if (!otherUser) return;
    try {
      let nextList = [...blockedUsers];
      if (isOtherBlocked) {
        nextList = nextList.filter((uid) => uid !== otherUser.id);
        toast.success(`تم إلغاء حظر ${otherUser.full_name}`);
      } else {
        nextList.push(otherUser.id);
        toast.success(`تم حظر ${otherUser.full_name}`);
      }
      localStorage.setItem("blocked_users", JSON.stringify(nextList));
      setBlockedUsers(nextList);
      window.dispatchEvent(new Event("storage"));
    } catch {
      toast.error("حدث خطأ أثناء تعديل الحظر");
    }
  };

  const handleReportSubmit = () => {
    if (!otherUser) return;
    setSubmittingReport(true);
    setTimeout(() => {
      setSubmittingReport(false);
      setReportOpen(false);
      setReportNote("");
      toast.success(
        `تم إرسال البلاغ ضد ${otherUser.full_name} بنجاح. سنقوم بمراجعة المحتوى واتخاذ الإجراء اللازم خلال 24 ساعة.`,
      );
    }, 1000);
  };

  const [text, setText] = useState("");
  const sendMut = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return;
      if (suspended) throw new Error("حسابك موقوف مؤقتًا — لا يمكن إرسال الرسائل");
      if (isSubAdmin) throw new Error("حساب المشرف المساعد مخصص للمراقبة فقط ولا يمكنه المراسلة");
      if (isOtherBlocked) throw new Error("لا يمكنك مراسلة مستخدم قمت بحظره");
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
              <button
                onClick={() => setMembersOpen(true)}
                className="text-xs text-muted-foreground hover:text-primary transition flex items-center gap-1 text-right"
              >
                <span>{(conv?.profiles ?? []).length} أعضاء</span>
                <span className="text-[10px] text-primary underline">(عرض الأعضاء)</span>
              </button>
            ) : (
              <div className="text-xs text-muted-foreground">
                {isOtherBlocked ? "محظور" : "طالب"}
              </div>
            )}
          </div>

          {conv?.is_group && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMembersOpen(true)}
              className="h-8 gap-1.5 text-xs rounded-xl font-medium border-primary/20 text-primary hover:bg-primary/5"
            >
              <Users className="w-3.5 h-3.5" />
              <span>أعضاء المجموعـة</span>
            </Button>
          )}

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

      {/* Group Members Modal */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-5">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Users className="w-5 h-5 text-primary" />
              <span>أعضاء المجموعـة ({conv?.profiles?.length ?? 0})</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              قائمة بجميع الطلاب والأشخاص المتواجدين داخل هذه المجموعة
            </DialogDescription>
          </DialogHeader>

          <div className="pt-3 pb-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="البحث عن عضو باسمه..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pr-9 h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
            {(conv?.profiles ?? [])
              .filter((m) =>
                memberSearch.trim()
                  ? m.full_name.toLowerCase().includes(memberSearch.trim().toLowerCase())
                  : true,
              )
              .map((member) => {
                const isMe = member.id === user?.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border bg-card hover:bg-accent/40 transition gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        avatarUrl={member.avatar_url}
                        fullName={member.full_name}
                        className="w-10 h-10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                          <span>{member.full_name}</span>
                          {isMe && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
                              أنت
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          {member.major && <span>{majorLabel(member.major)}</span>}
                          {member.year && <span>• السنة {member.year}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                        title="عرض الملف الشخصي"
                        onClick={() => {
                          setMembersOpen(false);
                          navigate({ to: "/profile/$id", params: { id: member.id } });
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>

                      {!isMe && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 px-2.5 gap-1 text-xs rounded-lg font-medium"
                          onClick={async () => {
                            setMembersOpen(false);
                            try {
                              const { data: convId, error } = await supabase.rpc("create_dm", {
                                _other: member.id,
                              });
                              if (error) throw error;
                              if (convId) {
                                qc.invalidateQueries({ queryKey: ["conversations"] });
                                navigate({
                                  to: "/messages/$id",
                                  params: { id: convId as string },
                                });
                              }
                            } catch (err: unknown) {
                              const message =
                                err instanceof Error ? err.message : "فشل بدء المحادثة";
                              toast.error(message);
                            }
                          }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">مراسلة</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

            {(conv?.profiles ?? []).length === 0 && (
              <p className="text-center py-6 text-xs text-muted-foreground">
                لا يوجد أعضاء في هذه المجموعة.
              </p>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setMembersOpen(false)}
              className="w-full text-xs rounded-xl"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
