import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { createIsolatedSupabaseClient } from "@/lib/isolatedSupabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  UserPlus,
  Loader2,
  Flag,
  Users,
  MessageSquare,
  FileText,
  Plus,
  Minus,
  Check,
  X,
  Trash2,
  Eye,
  GraduationCap,
  Calendar,
  Ban,
  AlertTriangle,
  ShieldOff,
  ScrollText,
  Clock,
  BadgeCheck,
  MoreVertical,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { majorLabel } from "@/lib/college";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { RankBadge } from "@/components/RankBadge";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AdminActionRow = Database["public"]["Tables"]["admin_actions"]["Row"];
type UserWarningRow = Database["public"]["Tables"]["user_warnings"]["Row"];

function userStatus(
  u: Pick<ProfileRow, "banned" | "suspended_until">,
): "banned" | "suspended" | "active" {
  if (u.banned) return "banned";
  if (u.suspended_until && new Date(u.suspended_until) > new Date()) return "suspended";
  return "active";
}

function StatusBadge({ status }: { status: "banned" | "suspended" | "active" }) {
  if (status === "banned") return <Badge variant="destructive">محظور</Badge>;
  if (status === "suspended")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400">
        موقوف
      </Badge>
    );
  return (
    <Badge
      variant="secondary"
      className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
    >
      نشط
    </Badge>
  );
}

function useSubAdminRestrictions() {
  const { profile, isSubAdmin } = useAuth();
  const currentUserId = profile?.id;

  const selfBan = useMutation({
    mutationFn: async () => {
      if (!currentUserId) return;
      // Ban themselves
      const { error } = await supabase.rpc("admin_ban", {
        _user: currentUserId,
        _reason: "محاولة التعديل على حساب الأدمن الرسمي",
      });
      if (error) {
        // Fallback: manually update if RPC has strict permission rules
        await supabase
          .from("profiles")
          .update({ banned: true, bio: "محظور تلقائياً لمحاولة التعديل على حساب الأدمن الرسمي" })
          .eq("id", currentUserId);
      }
      await supabase.auth.signOut();
      window.location.reload();
    },
  });

  function isTargetMainAdmin(u: { university_number: string; email?: string | null }) {
    return u.university_number === "2011099840" || u.email?.toLowerCase() === "khdrmamon@gmail.com";
  }

  function handleActionCheck(target: { university_number: string; email?: string | null }) {
    if (isSubAdmin && isTargetMainAdmin(target)) {
      toast.error(
        "⚠️ محاولة محظورة! تم رصد محاولة تعديل على حساب الأدمن الرسمي. سيتم حظر حسابك وتسجيل خروجك فوراً.",
      );
      selfBan.mutate();
      throw new Error("Violation: Sub-admin tried to modify main admin");
    }
  }

  return { handleActionCheck, isSubAdmin };
}

function AdminPage() {
  const { isAdmin, isMainAdmin, isSubAdmin, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/feed", replace: true });
  }, [loading, isAdmin, navigate]);

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
      </div>
    );
  if (!isAdmin) return null;

  const permissions = getSubAdminPermissions(profile);

  const showReports = !isSubAdmin || permissions.can_reports;
  const showLog = !isSubAdmin; // Only Main Admin / non-sub-admins see activity logs
  const showTeacher = !isSubAdmin || permissions.can_teachers;
  const showWords = !isSubAdmin || permissions.can_words;
  const showSubAdmins = isMainAdmin; // Only Main Admin can manage sub-admins

  const defaultTab = showReports ? "reports" : "users";

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 pt-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">لوحة الإدارة</h1>
        <p className="text-muted-foreground text-sm">
          {isSubAdmin
            ? "إدارة الصلاحيات المخصصة للمشرف المساعد"
            : "نظرة عامة وإدارة شاملة للنظام الأكاديمي"}
        </p>
      </div>

      <StatsCards />

      {/* Main Layout: Horizontal Tabs */}
      <Tabs defaultValue={defaultTab} className="flex flex-col gap-6 w-full items-start">
        <div className="w-full border-b border-border/40">
          <TabsList className="flex flex-row h-auto w-full justify-start bg-transparent p-0 gap-6 overflow-x-auto shrink-0 pb-px">
            {showReports && (
              <TabsTrigger
                value="reports"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Flag className="w-4 h-4 ml-2" /> البلاغات
              </TabsTrigger>
            )}
            <TabsTrigger
              value="users"
              className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
            >
              <Users className="w-4 h-4 ml-2" /> المستخدمون
            </TabsTrigger>
            {showLog && (
              <TabsTrigger
                value="log"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <ScrollText className="w-4 h-4 ml-2" /> سجل النشاط
              </TabsTrigger>
            )}
            {showTeacher && (
              <TabsTrigger
                value="teacher"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <UserPlus className="w-4 h-4 ml-2" /> إضافة أستاذ
              </TabsTrigger>
            )}
            {showWords && (
              <TabsTrigger
                value="words"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Shield className="w-4 h-4 ml-2" /> الكلمات المحظورة
              </TabsTrigger>
            )}
            {showSubAdmins && (
              <TabsTrigger
                value="subadmins"
                className="relative rounded-none border-b-2 border-transparent bg-transparent px-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none transition-colors"
              >
                <Shield className="w-4 h-4 ml-2" /> حسابات المشرف المساعد
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 w-full min-w-0">
          {showReports && (
            <TabsContent
              value="reports"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <ReportsTab />
            </TabsContent>
          )}
          <TabsContent
            value="users"
            className="mt-0 focus-visible:outline-none focus-visible:ring-0"
          >
            <UsersTable />
          </TabsContent>
          {showLog && (
            <TabsContent
              value="log"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <ActivityLogTab />
            </TabsContent>
          )}
          {showTeacher && (
            <TabsContent
              value="teacher"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <AddTeacherCard />
            </TabsContent>
          )}
          {showWords && (
            <TabsContent
              value="words"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <BannedWordsTab />
            </TabsContent>
          )}
          {showSubAdmins && (
            <TabsContent
              value="subadmins"
              className="mt-0 focus-visible:outline-none focus-visible:ring-0"
            >
              <SubAdminsTab />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

function StatsCards() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: users }, { count: posts }, { count: reports }, { count: msgs }] =
        await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("posts").select("*", { count: "exact", head: true }),
          supabase
            .from("post_reports")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase.from("messages").select("*", { count: "exact", head: true }),
        ]);
      return { users: users ?? 0, posts: posts ?? 0, reports: reports ?? 0, msgs: msgs ?? 0 };
    },
  });

  const items = [
    {
      icon: Users,
      label: "إجمالي المستخدمين",
      value: data?.users ?? 0,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      icon: FileText,
      label: "المنشورات",
      value: data?.posts ?? 0,
      color: "text-indigo-600",
      bg: "bg-indigo-500/10",
    },
    {
      icon: Flag,
      label: "بلاغات قيد المراجعة",
      value: data?.reports ?? 0,
      color: "text-rose-600",
      bg: "bg-rose-500/10",
    },
    {
      icon: MessageSquare,
      label: "الرسائل المتبادلة",
      value: data?.msgs ?? 0,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((it) => (
        <Card key={it.label} className="shadow-none border-border/40 bg-card">
          <CardContent className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium text-muted-foreground">{it.label}</span>
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center ${it.bg} ${it.color}`}
              >
                <it.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReportsTab() {
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
      toast.success("تم رفض البلاغ");
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
      toast.success("تم حذف المنشور");
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
          ? "تم إرسال إنذار لصاحب المنشور"
          : v.action === "suspend"
            ? "تم إيقاف المستخدم مؤقتًا"
            : "تم حظر المستخدم",
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
        <div className="text-sm text-muted-foreground text-center py-8">لا توجد بلاغات</div>
      )}
      <Card className="border-border/40 shadow-none bg-card">
        <div className="divide-y divide-border/40">
          {(data ?? []).map((r) => (
            <div key={r.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm flex items-center gap-2">
                  <span className="text-muted-foreground">بلاغ من:</span>
                  <span className="font-semibold text-foreground">
                    {r.reporter?.full_name ?? "—"}
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
                    ? "قيد المراجعة"
                    : r.status === "confirmed"
                      ? "تمت المعالجة"
                      : "مرفوض"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-sm bg-muted/30 border border-border/40 rounded-lg p-3">
                  <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Flag className="w-3.5 h-3.5" /> سبب البلاغ
                  </div>
                  <p className="whitespace-pre-wrap text-foreground/90">{r.reason}</p>
                </div>

                {r.post ? (
                  <div className="text-sm bg-card border border-border/40 shadow-sm rounded-lg p-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> محتوى المنشور
                    </div>
                    <p className="line-clamp-3 whitespace-pre-wrap text-foreground/90">
                      {r.post.content}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm bg-muted/30 border border-border/40 rounded-lg p-3 flex items-center text-muted-foreground italic">
                    المنشور محذوف مسبقًا
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
                        <X className="w-4 h-4 ml-1.5" /> رفض البلاغ
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => deletePost.mutate({ reportId: r.id, postId: r.post_id })}
                        disabled={deletePost.isPending}
                      >
                        <Trash2 className="w-4 h-4 ml-1.5" /> حذف المنشور
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
                          <AlertTriangle className="w-4 h-4 ml-1.5" /> إنذار
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
                          <Clock className="w-4 h-4 ml-1.5" /> إيقاف
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
                          <Ban className="w-4 h-4 ml-1.5" /> حظر
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
    action === "warn" ? "إرسال إنذار" : action === "suspend" ? "إيقاف مؤقت" : "حظر المستخدم";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>السبب (يظهر في سجل النشاط)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اكتب سبب الإجراء"
            rows={3}
          />
        </div>
        {action === "suspend" && (
          <div className="space-y-1.5">
            <Label>عدد أيام الإيقاف</Label>
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
          إلغاء
        </Button>
        <Button
          variant={action === "ban" ? "destructive" : "default"}
          disabled={!reason.trim() || pending}
          onClick={() =>
            onConfirm(reason.trim(), action === "suspend" ? Number(days) || 3 : undefined)
          }
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />} تأكيد
        </Button>
      </DialogFooter>
    </>
  );
}

// ============ USERS ============

interface LastActivityMap {
  [userId: string]: string;
}

function UsersTable() {
  const qc = useQueryClient();
  const { handleActionCheck, isSubAdmin } = useSubAdminRestrictions();
  const { profile } = useAuth();
  const permissions = getSubAdminPermissions(profile);

  const [search, setSearch] = useState("");
  const [detailsFor, setDetailsFor] = useState<(ProfileRow & { roles: string[] }) | null>(null);
  const [yearDialogFor, setYearDialogFor] = useState<(ProfileRow & { roles: string[] }) | null>(
    null,
  );
  const [actionFor, setActionFor] = useState<{
    user: ProfileRow & { roles: string[] };
    type: "suspend" | "ban" | "delete";
  } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionDays, setActionDays] = useState("3");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("*")
        .order("points", { ascending: false })
        .limit(500);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: { user_id: string; role: string }) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });

      const ids = (profs ?? []).map((p) => p.id);
      const lastActivity: LastActivityMap = {};
      if (ids.length) {
        const [{ data: lastPosts }, { data: lastComments }, { data: lastMsgs }] = await Promise.all(
          [
            supabase
              .from("posts")
              .select("author_id, created_at")
              .in("author_id", ids)
              .order("created_at", { ascending: false }),
            supabase
              .from("comments")
              .select("author_id, created_at")
              .in("author_id", ids)
              .order("created_at", { ascending: false }),
            supabase
              .from("messages")
              .select("sender_id, created_at")
              .in("sender_id", ids)
              .order("created_at", { ascending: false }),
          ],
        );
        const consider = (uid: string, ts: string) => {
          if (!lastActivity[uid] || new Date(ts) > new Date(lastActivity[uid]))
            lastActivity[uid] = ts;
        };
        (lastPosts ?? []).forEach((p) => consider(p.author_id, p.created_at));
        (lastComments ?? []).forEach((c) => consider(c.author_id, c.created_at));
        (lastMsgs ?? []).forEach((m) => consider(m.sender_id, m.created_at));
      }

      return (profs ?? [])
        .map((p) => ({
          ...p,
          roles: roleMap.get(p.id) ?? [],
          lastActivity: lastActivity[p.id] ?? null,
        }))
        .filter((u) => {
          const isSubAdminUser =
            u.roles.includes("sub_admin") ||
            (u.university_number
              ? u.university_number.startsWith("SUBADMIN_") ||
                u.university_number.toLowerCase().includes("guard")
              : false) ||
            (u.email ? u.email.toLowerCase().includes("@subadmin.") : false) ||
            (u.full_name ? u.full_name.toLowerCase().includes("guard") : false);
          return !isSubAdminUser;
        });
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-log"] });
    qc.invalidateQueries({ queryKey: ["user-details"] });
  }

  const toggleAdmin = useMutation({
    mutationFn: async ({ uid, isAdmin }: { uid: string; isAdmin: boolean }) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      if (isSubAdmin) {
        toast.error("غير مسموح للسب أدمن بتعديل رتب الإدارة");
        throw new Error("Unauthorized");
      }
      if (isAdmin)
        await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      else await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      invalidate();
    },
  });

  const adjust = useMutation({
    mutationFn: async ({ uid, delta }: { uid: string; delta: number }) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      if (isSubAdmin) {
        toast.error("لا تملك صلاحية تعديل النقاط كسب أدمن");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.rpc("admin_adjust_points", { _user: uid, _delta: delta });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const suspend = useMutation({
    mutationFn: async ({ uid, days, reason }: { uid: string; days: number; reason: string }) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      if (isSubAdmin && !permissions.can_suspend) {
        toast.error("لا تملك صلاحية إيقاف الحسابات");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.rpc("admin_suspend", {
        _user: uid,
        _days: days,
        _reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الإيقاف المؤقت");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ban = useMutation({
    mutationFn: async ({ uid, reason }: { uid: string; reason: string }) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      if (isSubAdmin && !permissions.can_suspend) {
        toast.error("لا تملك صلاحية حظر الحسابات");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.rpc("admin_ban", { _user: uid, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحظر");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unban = useMutation({
    mutationFn: async (uid: string) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      if (isSubAdmin && !permissions.can_suspend) {
        toast.error("لا تملك صلاحية إلغاء الإيقاف");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.rpc("admin_unban", { _user: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إلغاء الحظر/الإيقاف");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setYear = useMutation({
    mutationFn: async ({ uid, year }: { uid: string; year: number }) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      const { error } = await supabase.rpc("admin_set_year", { _user: uid, _year: year });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث السنة الدراسية");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setVerified = useMutation({
    mutationFn: async ({ uid, verified }: { uid: string; verified: boolean }) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      if (isSubAdmin) {
        toast.error("غير مسموح للسب أدمن بتوثيق الحسابات");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.rpc("admin_set_verified", {
        _user: uid,
        _verified: verified,
      });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.verified ? "تم توثيق الحساب" : "تم إلغاء التوثيق");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (uid: string) => {
      const targetUser = (data ?? []).find((u) => u.id === uid);
      if (targetUser) handleActionCheck(targetUser);
      if (isSubAdmin) {
        toast.error("لا تملك صلاحية حذف الحسابات كسب أدمن");
        throw new Error("Unauthorized");
      }
      const { error } = await supabase.rpc("admin_delete_user", { _user: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المستخدم");
      invalidate();
      setDetailsFor(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.university_number?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Input
            placeholder="بحث بالاسم أو الرقم الجامعي..."
            className="pr-10 bg-card border-border/40 shadow-none focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Users className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        </div>
      ) : (
        <Card className="border-border/40 shadow-none overflow-hidden bg-card">
          {filtered.length > 0 && (
            <div className="hidden sm:flex items-center justify-between p-4 bg-muted/30 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="flex-1">المستخدم</div>
              <div className="w-[300px] flex justify-end gap-12 pr-8">
                <span>الحالة والتخصص</span>
                <span>النقاط</span>
                <span className="w-8"></span>
              </div>
            </div>
          )}
          <div className="divide-y divide-border/40">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                لا توجد نتائج للبحث
              </div>
            )}
            {filtered.map((u) => {
              const status = userStatus(u);
              return (
                <div
                  key={u.id}
                  className="group p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center border border-primary/10">
                      <span className="text-primary font-medium text-sm">
                        {u.full_name?.charAt(0) || "U"}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground truncate max-w-[12rem]">
                          {u.full_name}
                        </span>
                        {u.verified && <VerifiedBadge />}
                        {u.roles.includes("admin") && (
                          <Badge
                            variant="secondary"
                            className="h-5 px-1.5 text-[10px] bg-blue-500/10 text-blue-600 border-none hover:bg-blue-500/20"
                          >
                            مشرف
                          </Badge>
                        )}
                        {u.roles.includes("teacher") && (
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 text-[10px] bg-purple-500/10 text-purple-600 border-none hover:bg-purple-500/20"
                          >
                            أستاذ
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {u.university_number}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto">
                    <div className="hidden lg:flex flex-col items-end gap-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <StatusBadge status={status} />
                        {u.major && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" /> {majorLabel(u.major)}
                          </span>
                        )}
                        {u.year && <span>السنة {u.year}</span>}
                      </div>
                      <div className="flex gap-3 opacity-60">
                        <span>
                          انضم: {u.created_at ? format(new Date(u.created_at), "yyyy/MM/dd") : "—"}
                        </span>
                        <span>
                          نشاط:{" "}
                          {u.lastActivity
                            ? format(new Date(u.lastActivity), "yyyy/MM/dd HH:mm")
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:block">
                        <RankBadge points={u.points ?? 0} />
                      </div>
                      {u.warning_count > 0 && (
                        <Badge
                          variant="destructive"
                          className="h-6 px-2 bg-red-500/10 text-red-600 border-none hover:bg-red-500/20 shadow-none hidden sm:inline-flex"
                        >
                          {u.warning_count} إنذار
                        </Badge>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => setDetailsFor(u)}>
                            <Eye className="w-4 h-4" /> التفاصيل الكاملة
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            النقاط والصلاحيات
                          </DropdownMenuLabel>
                          {!isSubAdmin && (
                            <>
                              <DropdownMenuItem
                                onClick={() => adjust.mutate({ uid: u.id, delta: 10 })}
                              >
                                <Plus className="w-4 h-4" /> +10 نقاط
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => adjust.mutate({ uid: u.id, delta: -10 })}
                              >
                                <Minus className="w-4 h-4" /> -10 نقاط
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => setYearDialogFor(u)}>
                            <Calendar className="w-4 h-4" /> تغيير السنة الدراسية
                          </DropdownMenuItem>
                          {!isSubAdmin && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleAdmin.mutate({
                                    uid: u.id,
                                    isAdmin: u.roles.includes("admin"),
                                  })
                                }
                              >
                                <Shield className="w-4 h-4" />
                                {u.roles.includes("admin") ? "إزالة الإشراف" : "جعل مشرفًا"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setVerified.mutate({ uid: u.id, verified: !u.verified })
                                }
                              >
                                <BadgeCheck className="w-4 h-4" />
                                {u.verified ? "إلغاء التوثيق" : "توثيق الحساب"}
                              </DropdownMenuItem>
                            </>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            إجراءات الإشراف
                          </DropdownMenuLabel>
                          {status === "active" && (!isSubAdmin || permissions.can_suspend) && (
                            <DropdownMenuItem
                              onClick={() => setActionFor({ user: u, type: "suspend" })}
                              className="text-amber-600 focus:text-amber-600 focus:bg-amber-50"
                            >
                              <Clock className="w-4 h-4" /> إيقاف مؤقت
                            </DropdownMenuItem>
                          )}
                          {status !== "banned" && (!isSubAdmin || permissions.can_suspend) && (
                            <DropdownMenuItem
                              onClick={() => setActionFor({ user: u, type: "ban" })}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Ban className="w-4 h-4" /> حظر نهائي
                            </DropdownMenuItem>
                          )}
                          {status !== "active" && (!isSubAdmin || permissions.can_suspend) && (
                            <DropdownMenuItem
                              onClick={() => unban.mutate(u.id)}
                              className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50"
                            >
                              <ShieldOff className="w-4 h-4" /> إلغاء الإيقاف/الحظر
                            </DropdownMenuItem>
                          )}

                          {!isSubAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setActionFor({ user: u, type: "delete" })}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" /> حذف الحساب نهائيًا
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <UserDetailsDialog user={detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)} />

      <Dialog open={!!yearDialogFor} onOpenChange={(o) => !o && setYearDialogFor(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>تغيير السنة الدراسية — {yearDialogFor?.full_name}</DialogTitle>
          </DialogHeader>
          <Select
            value={yearDialogFor?.year ? String(yearDialogFor.year) : undefined}
            onValueChange={(v) => {
              if (yearDialogFor) setYear.mutate({ uid: yearDialogFor.id, year: Number(v) });
              setYearDialogFor(null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر السنة" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((y) => (
                <SelectItem key={y} value={String(y)}>{`السنة ${y}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!actionFor} onOpenChange={(o) => !o && setActionFor(null)}>
        <AlertDialogContent>
          {actionFor && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {actionFor.type === "suspend" && `إيقاف ${actionFor.user.full_name} مؤقتًا؟`}
                  {actionFor.type === "ban" && `حظر ${actionFor.user.full_name} نهائيًا؟`}
                  {actionFor.type === "delete" && `حذف حساب ${actionFor.user.full_name} نهائيًا؟`}
                </AlertDialogTitle>
                {actionFor.type === "delete" && (
                  <AlertDialogDescription>
                    هذا الإجراء لا يمكن التراجع عنه — سيُحذف الحساب بالكامل.
                  </AlertDialogDescription>
                )}
              </AlertDialogHeader>
              {(actionFor.type === "suspend" || actionFor.type === "ban") && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>السبب</Label>
                    <Textarea
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                  {actionFor.type === "suspend" && (
                    <div className="space-y-1.5">
                      <Label>عدد الأيام</Label>
                      <Input
                        type="number"
                        min={1}
                        value={actionDays}
                        onChange={(e) => setActionDays(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setActionFor(null)}>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  disabled={
                    (actionFor.type === "suspend" || actionFor.type === "ban") &&
                    !actionReason.trim()
                  }
                  onClick={() => {
                    if (actionFor.type === "suspend") {
                      suspend.mutate({
                        uid: actionFor.user.id,
                        days: Number(actionDays) || 3,
                        reason: actionReason.trim(),
                      });
                    } else if (actionFor.type === "ban") {
                      ban.mutate({ uid: actionFor.user.id, reason: actionReason.trim() });
                    } else if (actionFor.type === "delete") {
                      deleteUser.mutate(actionFor.user.id);
                    }
                    setActionFor(null);
                    setActionReason("");
                    setActionDays("3");
                  }}
                >
                  تأكيد
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserDetailsDialog({
  user,
  onOpenChange,
}: {
  user: (ProfileRow & { roles: string[] }) | null;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [customDelta, setCustomDelta] = useState("");
  const { data } = useQuery({
    queryKey: ["user-details", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const [{ count: posts }, { count: comments }, { data: recentPosts }, { data: warnings }] =
        await Promise.all([
          supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("author_id", user.id),
          supabase
            .from("comments")
            .select("*", { count: "exact", head: true })
            .eq("author_id", user.id),
          supabase
            .from("posts")
            .select("id, content, created_at")
            .eq("author_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("user_warnings")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
        ]);
      return {
        posts: posts ?? 0,
        comments: comments ?? 0,
        recentPosts: recentPosts ?? [],
        warnings: (warnings ?? []) as UserWarningRow[],
      };
    },
  });

  const { isSubAdmin } = useAuth();
  const { handleActionCheck } = useSubAdminRestrictions();

  const adjust = useMutation({
    mutationFn: async (delta: number) => {
      if (!user) return;
      if (isSubAdmin) {
        toast.error("لا تملك صلاحية تعديل النقاط كسب أدمن");
        throw new Error("Unauthorized");
      }
      handleActionCheck(user);
      const { error } = await supabase.rpc("admin_adjust_points", {
        _user: user.id,
        _delta: delta,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["user-details"] });
      setCustomDelta("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {user.full_name}
                {user.verified && <VerifiedBadge size="md" />}
                <StatusBadge status={userStatus(user)} />
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-xs text-muted-foreground">الرقم الجامعي</div>
                  <div className="font-medium" dir="ltr">
                    {user.university_number}
                  </div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-xs text-muted-foreground">البريد</div>
                  <div className="font-medium truncate" dir="ltr">
                    {user.email ?? "—"}
                  </div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-xs text-muted-foreground">التخصص / السنة</div>
                  <div className="font-medium">
                    {majorLabel(user.major)} · {user.year ?? "—"}
                  </div>
                </div>
                <div className="bg-muted/50 rounded p-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">انضم في</div>
                    <div className="font-medium">
                      {user.created_at ? format(new Date(user.created_at), "yyyy/MM/dd") : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {user.suspended_until && userStatus(user) === "suspended" && (
                <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded p-2">
                  موقوف حتى {format(new Date(user.suspended_until), "yyyy/MM/dd HH:mm")}
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                <div className="border rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">النقاط</div>
                  <div className="font-bold text-lg">{user.points ?? 0}</div>
                </div>
                <div className="border rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">منشورات</div>
                  <div className="font-bold text-lg">{data?.posts ?? 0}</div>
                </div>
                <div className="border rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">تعليقات</div>
                  <div className="font-bold text-lg">{data?.comments ?? 0}</div>
                </div>
                <div className="border rounded p-2 text-center">
                  <div className="text-xs text-muted-foreground">إنذارات</div>
                  <div className="font-bold text-lg">{user.warning_count ?? 0}</div>
                </div>
              </div>

              {!isSubAdmin && (
                <div className="border rounded p-2 space-y-2">
                  <div className="text-xs font-semibold">تعديل النقاط بقيمة مخصصة</div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="مثال: 25 أو -30"
                      value={customDelta}
                      onChange={(e) => setCustomDelta(e.target.value)}
                      dir="ltr"
                    />
                    <Button
                      size="sm"
                      disabled={!customDelta || adjust.isPending}
                      onClick={() => {
                        const n = Number(customDelta);
                        if (Number.isFinite(n) && n !== 0) adjust.mutate(n);
                      }}
                    >
                      تطبيق
                    </Button>
                  </div>
                </div>
              )}

              {(data?.warnings ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold">سجل الإنذارات</div>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {(data?.warnings ?? []).map((w) => (
                      <div
                        key={w.id}
                        className="text-xs bg-amber-500/5 border border-amber-500/20 rounded p-2"
                      >
                        <div>{w.reason}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(w.created_at), "yyyy/MM/dd HH:mm")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(data?.recentPosts ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold">آخر المنشورات</div>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {(data?.recentPosts ?? []).map((p) => (
                      <div key={p.id} className="text-xs bg-muted/40 rounded p-2">
                        <div className="line-clamp-2 whitespace-pre-wrap">{p.content}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(p.created_at), "yyyy/MM/dd HH:mm")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ ACTIVITY LOG ============

function ActivityLogTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-log"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const actions = (rows ?? []) as AdminActionRow[];
      const ids = Array.from(
        new Set([
          ...actions.map((a) => a.admin_id),
          ...actions.map((a) => a.target_user_id).filter((x): x is string => !!x),
        ]),
      );
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return actions.map((a) => ({
        ...a,
        adminName: nameMap.get(a.admin_id) ?? "—",
        targetName: a.target_user_id ? (nameMap.get(a.target_user_id) ?? "مستخدم محذوف") : null,
      }));
    },
  });

  const actionLabel: Record<string, string> = {
    warn: "إنذار",
    suspend: "إيقاف مؤقت",
    ban: "حظر",
    unban: "إلغاء حظر/إيقاف",
    delete_user: "حذف مستخدم",
    set_year: "تغيير السنة",
    verify: "توثيق الحساب",
    unverify: "إلغاء التوثيق",
  };

  return (
    <div className="space-y-2">
      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      {!isLoading && (data ?? []).length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">لا يوجد نشاط إداري بعد</div>
      )}
      <Card className="border-border/40 shadow-none bg-card">
        <div className="divide-y divide-border/40">
          {(data ?? []).map((a) => (
            <div key={a.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs text-primary font-medium shrink-0">
                    {a.adminName?.charAt(0) || "A"}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground">{a.adminName}</span>
                    <span className="text-muted-foreground">أجرى</span>
                    <Badge
                      variant="secondary"
                      className="font-normal text-xs bg-muted text-foreground hover:bg-muted"
                    >
                      {actionLabel[a.action] ?? a.action}
                    </Badge>
                    {a.targetName && (
                      <>
                        <span className="text-muted-foreground">على</span>
                        <span className="font-semibold text-foreground">{a.targetName}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {format(new Date(a.created_at), "yyyy/MM/dd HH:mm")}
                </span>
              </div>
              {a.details &&
                typeof a.details === "object" &&
                "reason" in (a.details as Record<string, unknown>) && (
                  <div className="text-sm text-foreground/90 bg-muted/30 border border-border/40 rounded-md p-2 mt-1 w-full md:w-3/4">
                    <span className="text-xs text-muted-foreground mr-1">السبب:</span>
                    {String((a.details as Record<string, unknown>).reason)}
                  </div>
                )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============ ADD TEACHER ============

function AddTeacherCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: courses } = useQuery({
    queryKey: ["all-courses-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, name");
      return data || [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (pw.length < 6) throw new Error("كلمة السر قصيرة");
      const uniqueUniv = "T" + Date.now().toString().slice(-8);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
        options: {
          data: {
            university_number: uniqueUniv,
            full_name: name.trim(),
            role: "teacher",
            must_change_password: false,
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("لم يتم إنشاء الحساب");

      // Promote user to teacher role securely using RPC, falling back to direct table write if RPC fails
      let roleError;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.rpc("admin_set_teacher_role" as any, {
          _user: data.user.id,
        });
        roleError = error;
      } catch (e) {
        roleError = e;
      }

      if (roleError) {
        console.warn(
          "RPC admin_set_teacher_role failed, trying direct table write fallback...",
          roleError,
        );
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", data.user.id);
        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "teacher",
        });
        if (insertError) throw insertError;
      }

      // Assign selected courses to the teacher
      if (selectedCourses.length > 0) {
        const { error: coursesError } = await supabase
          .from("courses")
          .update({ teacher_id: data.user.id })
          .in("id", selectedCourses);
        if (coursesError) {
          console.error("Failed to assign courses", coursesError);
        }
      }
    },
    onSuccess: () => {
      toast.success("تم إنشاء حساب الأستاذ وتعيين المقررات");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
      setEmail("");
      setName("");
      setPw("");
      setSelectedCourses([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-border/40 shadow-none bg-card">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-3">
          أنشئ حساب أستاذ يدخل بالبريد الإلكتروني، وحدد المقررات التي يدرسها.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4" /> إضافة أستاذ
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>حساب أستاذ جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>الاسم الكامل</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>كلمة السر</Label>
                <Input
                  type="text"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label>المقررات التي يدرسها</Label>
                <ScrollArea className="h-40 border rounded-md p-3">
                  <div className="space-y-2">
                    {courses?.map((course) => (
                      <div key={course.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`course-${course.id}`}
                          checked={selectedCourses.includes(course.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCourses([...selectedCourses, course.id]);
                            } else {
                              setSelectedCourses(selectedCourses.filter((id) => id !== course.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`course-${course.id}`}
                          className="font-normal cursor-pointer text-sm"
                        >
                          {course.name}
                        </Label>
                      </div>
                    ))}
                    {courses?.length === 0 && (
                      <p className="text-sm text-muted-foreground">لا يوجد مقررات متاحة</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => mut.mutate()}
                disabled={!email || !name || !pw || mut.isPending}
              >
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />} إنشاء وتعيين
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============ BANNED WORDS ============

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

// ============ SUB-ADMINS MANAGEMENT ============

function SubAdminsTab() {
  const qc = useQueryClient();
  const [nameId, setNameId] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);

  // Granular Permissions States
  const [canReports, setCanReports] = useState(true);
  const [canTeachers, setCanTeachers] = useState(true);
  const [canCourses, setCanCourses] = useState(true);
  const [canWarn, setCanWarn] = useState(true);
  const [canSuspend, setCanSuspend] = useState(true);
  const [canWords, setCanWords] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch Sub-Admins list
  const { data: subAdmins, isLoading } = useQuery({
    queryKey: ["sub-admins-list"],
    queryFn: async () => {
      // 1. Fetch user_roles for sub_admin
      const { data: subAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "sub_admin");

      const roleSubAdminIds = new Set((subAdminRoles ?? []).map((r) => r.user_id));

      // 2. Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // 3. Filter to sub-admins
      const filteredProfiles = (profiles ?? []).filter(
        (p) =>
          roleSubAdminIds.has(p.id) ||
          p.university_number?.startsWith("sub_") ||
          p.university_number?.startsWith("SUBADMIN_") ||
          p.email?.endsWith("@subadmin.edu") ||
          p.email?.includes("@subadmin.") ||
          p.full_name?.toLowerCase().includes("a guard"),
      );

      if (filteredProfiles.length === 0) return [];

      // Auto-heal missing roles
      for (const p of filteredProfiles) {
        if (!roleSubAdminIds.has(p.id)) {
          console.log(`Auto-healing role for sub-admin ${p.full_name}...`);
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await supabase.rpc("admin_set_user_role" as any, { _user: p.id, _role: "sub_admin" });
          } catch (err) {
            await supabase.from("user_roles").delete().eq("user_id", p.id);
            await supabase.from("user_roles").insert({ user_id: p.id, role: "sub_admin" });
          }
        }
      }

      // Permissions are already in bio, so we just return the profiles
      return filteredProfiles;
    },
  });

  const createSubAdmin = useMutation({
    mutationFn: async () => {
      if (!nameId.trim() || !fullName.trim() || !password.trim()) {
        throw new Error("يرجى ملء جميع الحقول المطلوبة");
      }
      if (password.length < 6) {
        throw new Error("يجب أن تكون كلمة المرور 6 أحرف على الأقل");
      }

      // 1. Create normalized email e.g. "aguard1@subadmin.edu"
      const cleanId = nameId.trim().toLowerCase().replace(/\s+/g, "");
      const normalizedEmail = `${cleanId}@subadmin.edu`;
      const univNumber = `sub_${cleanId}`;

      // 2. Instantiate temporary client with disabled persistence to register the user
      // without logging out the current active Admin session.
      const tempClient = createIsolatedSupabaseClient();

      // 3. Register the sub-admin account
      const { data, error: signUpError } = await tempClient.auth.signUp({
        email: normalizedEmail,
        password: password,
        options: {
          data: {
            full_name: fullName.trim(),
            university_number: univNumber,
            major: "general",
            year: 1,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() || "";
        if (
          msg.includes("already registered") ||
          msg.includes("already exists") ||
          msg.includes("unique constraint")
        ) {
          throw new Error("اسم المستخدم (أو الحساب) هذا مسجل بالفعل. يرجى اختيار اسم مستخدم آخر.");
        }
        throw signUpError;
      }
      if (!data?.user?.id) throw new Error("تعذّر إنشاء مستخدم في نظام المصادقة");

      // 4. Construct granular permissions object
      const permissionsObj = {
        can_reports: canReports,
        can_teachers: canTeachers,
        can_courses: canCourses,
        can_warn: canWarn,
        can_suspend: canSuspend,
        can_words: canWords,
      };

      // 4.5. Wait for the profile row to be created by the AFTER INSERT auth trigger
      let profileExists = false;
      for (let i = 0; i < 15; i++) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();
        if (existingProfile) {
          profileExists = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      if (!profileExists) {
        throw new Error(
          "تعذّر تهيئة الملف الشخصي للمشرف المساعد في الوقت المحدد، يرجى المحاولة مرة أخرى.",
        );
      }

      // 5. Update user profile details
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({
          bio: JSON.stringify(permissionsObj),
          verified: true,
        })
        .eq("id", data.user.id);

      if (updateProfileError) throw updateProfileError;

      // 6. Set user role to 'sub_admin' securely using the RPC, falling back to direct table write if RPC fails
      let roleError;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.rpc("admin_set_user_role" as any, {
          _user: data.user.id,
          _role: "sub_admin",
        });
        roleError = error;
      } catch (e) {
        roleError = e;
      }

      if (roleError) {
        console.warn(
          "RPC admin_set_user_role failed, trying direct table write fallback...",
          roleError,
        );
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", data.user.id);
        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "sub_admin",
        });
        if (insertError) throw insertError;
      }

      // 7. (Removed: store actual permissions in the subadmin_permissions table, rely only on bio)
    },
    onSuccess: () => {
      toast.success("تم إنشاء حساب المشرف المساعد (سب أدمن) بنجاح!");
      setOpen(false);
      setNameId("");
      setFullName("");
      setPassword("");
      // Reset permissions
      setCanReports(true);
      setCanTeachers(true);
      setCanCourses(true);
      setCanWarn(true);
      setCanSuspend(true);
      setCanWords(true);
      qc.invalidateQueries({ queryKey: ["sub-admins-list"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "حدث خطأ أثناء إنشاء الحساب");
    },
  });

  const deleteSubAdmin = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.rpc("admin_delete_user", { _user: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المشرف المساعد بنجاح");
      qc.invalidateQueries({ queryKey: ["sub-admins-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePermission = useMutation({
    mutationFn: async ({
      uid,
      currentPerms,
      key,
    }: {
      uid: string;
      currentPerms: Record<string, boolean>;
      key: string;
    }) => {
      const updatedPerms = {
        ...currentPerms,
        [key]: !currentPerms[key],
      };
      const { error } = await supabase
        .from("profiles")
        .update({ bio: JSON.stringify(updatedPerms) })
        .eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية بنجاح");
      qc.invalidateQueries({ queryKey: ["sub-admins-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold">إدارة حسابات سب أدمن</h2>
          <p className="text-xs text-muted-foreground">
            إنشاء وتعديل صلاحيات المشرفين المساعدين للموقع
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1 text-xs">
              <Plus className="w-4 h-4" /> إضافة سب أدمن جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md text-right">
            <DialogHeader>
              <DialogTitle>إنشاء حساب مشرف مساعد جديد</DialogTitle>
              <DialogDescription className="text-xs">
                سيتمكن هذا الحساب من الدخول للوحة التحكم بصلاحيات مخصصة تحددها أدناه
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-1.5">
                <Label className="text-xs">الرمز التعريفي الفريد (ID) للدخول</Label>
                <Input
                  placeholder="مثال: a guard 1"
                  value={nameId}
                  onChange={(e) => setNameId(e.target.value)}
                  dir="ltr"
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  سيستخدم هذا الرمز للدخول بدلاً من البريد الإلكتروني (سيتحول تلقائياً إلى بريد
                  فريد)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">الاسم الكامل للمشرف</Label>
                <Input
                  placeholder="مثال: المشرف علي - حارس البوابة 1"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">كلمة السر</Label>
                <Input
                  type="text"
                  placeholder="اختر كلمة سر قوية (6 أحرف على الأقل)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2 border rounded-lg p-3">
                <h3 className="text-xs font-bold text-primary mb-2">تحديد صلاحيات الحساب:</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-reports"
                      checked={canReports}
                      onCheckedChange={(c) => setCanReports(!!c)}
                    />
                    <Label htmlFor="perm-reports" className="text-xs font-normal cursor-pointer">
                      رؤية وإدارة البلاغات
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-teachers"
                      checked={canTeachers}
                      onCheckedChange={(c) => setCanTeachers(!!c)}
                    />
                    <Label htmlFor="perm-teachers" className="text-xs font-normal cursor-pointer">
                      إضافة وإدارة الأساتذة
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-courses"
                      checked={canCourses}
                      onCheckedChange={(c) => setCanCourses(!!c)}
                    />
                    <Label htmlFor="perm-courses" className="text-xs font-normal cursor-pointer">
                      إدارة المقررات الدراسية
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-warn"
                      checked={canWarn}
                      onCheckedChange={(c) => setCanWarn(!!c)}
                    />
                    <Label htmlFor="perm-warn" className="text-xs font-normal cursor-pointer">
                      إرسال إنذارات للمستخدمين
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-suspend"
                      checked={canSuspend}
                      onCheckedChange={(c) => setCanSuspend(!!c)}
                    />
                    <Label htmlFor="perm-suspend" className="text-xs font-normal cursor-pointer">
                      تعليق وإيقاف الحسابات مؤقتاً
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-words"
                      checked={canWords}
                      onCheckedChange={(c) => setCanWords(!!c)}
                    />
                    <Label htmlFor="perm-words" className="text-xs font-normal cursor-pointer">
                      إدارة الكلمات المحظورة
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                onClick={() => createSubAdmin.mutate()}
                disabled={createSubAdmin.isPending}
                className="w-full sm:w-auto"
              >
                {createSubAdmin.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />}
                تأكيد وإنشاء الحساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : subAdmins?.length === 0 ? (
        <Card className="border-border/40 shadow-none bg-card p-8 text-center text-muted-foreground text-xs">
          لا يوجد حسابات سب أدمن حالياً. اضغط على الزر أعلاه لإضافة أول حساب.
        </Card>
      ) : (
        <div className="grid gap-3">
          {subAdmins?.map((sub) => {
            const perms = getSubAdminPermissions(sub);
            const userCode =
              sub.university_number?.replace("sub_", "") || sub.email?.split("@")[0] || "";

            return (
              <Card
                key={sub.id}
                className="border-border/40 shadow-none bg-card p-4 hover:shadow-sm transition-all"
              >
                <CardContent className="p-0 flex flex-col md:flex-row md:items-center justify-between gap-3 text-right">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm">{sub.full_name}</span>
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px] bg-primary/10 text-primary"
                      >
                        ID: {userCode}
                      </Badge>
                    </div>

                    {/* Permissions list */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <button
                        onClick={() =>
                          togglePermission.mutate({
                            uid: sub.id,
                            currentPerms: perms,
                            key: "can_reports",
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          perms.can_reports
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                        }`}
                      >
                        إدارة البلاغات
                      </button>
                      <button
                        onClick={() =>
                          togglePermission.mutate({
                            uid: sub.id,
                            currentPerms: perms,
                            key: "can_teachers",
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          perms.can_teachers
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                        }`}
                      >
                        إدارة الأساتذة
                      </button>
                      <button
                        onClick={() =>
                          togglePermission.mutate({
                            uid: sub.id,
                            currentPerms: perms,
                            key: "can_courses",
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          perms.can_courses
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                        }`}
                      >
                        إدارة المقررات
                      </button>
                      <button
                        onClick={() =>
                          togglePermission.mutate({
                            uid: sub.id,
                            currentPerms: perms,
                            key: "can_warn",
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          perms.can_warn
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                        }`}
                      >
                        إرسال إنذارات
                      </button>
                      <button
                        onClick={() =>
                          togglePermission.mutate({
                            uid: sub.id,
                            currentPerms: perms,
                            key: "can_suspend",
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          perms.can_suspend
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                        }`}
                      >
                        تعليق الحسابات
                      </button>
                      <button
                        onClick={() =>
                          togglePermission.mutate({
                            uid: sub.id,
                            currentPerms: perms,
                            key: "can_words",
                          })
                        }
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                          perms.can_words
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground border-transparent line-through opacity-60"
                        }`}
                      >
                        إدارة الكلمات المحظورة
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center self-end md:self-center">
                    {deleteConfirmId === sub.id ? (
                      <div className="flex items-center gap-1.5 bg-destructive/5 border border-destructive/20 rounded-lg p-1 animate-in fade-in zoom-in-95 duration-200">
                        <span className="text-[10px] font-bold text-destructive px-1.5">
                          {"متأكد؟"}
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2.5 text-[10px]"
                          onClick={() => {
                            deleteSubAdmin.mutate(sub.id);
                            setDeleteConfirmId(null);
                          }}
                          disabled={deleteSubAdmin.isPending}
                        >
                          نعم، حذف
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={deleteSubAdmin.isPending}
                        >
                          إلغاء
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/20 hover:bg-destructive/5 text-xs gap-1"
                        onClick={() => setDeleteConfirmId(sub.id)}
                        disabled={deleteSubAdmin.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> حذف الحساب
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
