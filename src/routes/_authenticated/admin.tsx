import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/feed", replace: true });
  }, [loading, isAdmin, navigate]);
  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  if (!isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">لوحة الإدارة</h1>
          <p className="text-xs text-muted-foreground">إدارة كاملة للموقع</p>
        </div>
      </div>

      <StatsCards />

      <Tabs defaultValue="reports">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="reports">
            <Flag className="w-4 h-4" /> البلاغات
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="w-4 h-4" /> المستخدمون
          </TabsTrigger>
          <TabsTrigger value="log">
            <ScrollText className="w-4 h-4" /> سجل النشاط
          </TabsTrigger>
          <TabsTrigger value="teacher">
            <UserPlus className="w-4 h-4" /> إضافة أستاذ
          </TabsTrigger>
          <TabsTrigger value="words">
            <Shield className="w-4 h-4" /> الكلمات المحظورة
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="pt-3">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="users" className="pt-3">
          <UsersTable />
        </TabsContent>
        <TabsContent value="log" className="pt-3">
          <ActivityLogTab />
        </TabsContent>
        <TabsContent value="teacher" className="pt-3">
          <AddTeacherCard />
        </TabsContent>
        <TabsContent value="words" className="pt-3">
          <BannedWordsTab />
        </TabsContent>
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
      label: "المستخدمون",
      value: data?.users ?? 0,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      icon: FileText,
      label: "المنشورات",
      value: data?.posts ?? 0,
      color: "text-emerald-600 bg-emerald-500/10",
    },
    {
      icon: Flag,
      label: "بلاغات معلّقة",
      value: data?.reports ?? 0,
      color: "text-red-600 bg-red-500/10",
    },
    {
      icon: MessageSquare,
      label: "الرسائل",
      value: data?.msgs ?? 0,
      color: "text-purple-600 bg-purple-500/10",
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${it.color}`}>
              <it.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="text-lg font-bold">{it.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============ REPORTS ============

function ReportsTab() {
  const qc = useQueryClient();
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
      {(data ?? []).map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm">
                <span className="text-muted-foreground">من:</span>{" "}
                <b>{r.reporter?.full_name ?? "—"}</b>
              </div>
              <Badge
                variant={
                  r.status === "pending"
                    ? "default"
                    : r.status === "confirmed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {r.status === "pending"
                  ? "معلّق"
                  : r.status === "confirmed"
                    ? "تمت المعالجة"
                    : "مرفوض"}
              </Badge>
            </div>
            <div className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">
              <div className="text-xs text-muted-foreground mb-1">السبب:</div>
              {r.reason}
            </div>
            {r.post ? (
              <div className="text-sm border rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">المنشور:</div>
                <p className="line-clamp-3 whitespace-pre-wrap">{r.post.content}</p>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic">المنشور محذوف مسبقًا</div>
            )}
            {r.status === "pending" &&
              r.post &&
              (() => {
                const post = r.post;
                return (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dismiss.mutate(r.id)}
                      disabled={dismiss.isPending}
                    >
                      <X className="w-4 h-4" /> رفض البلاغ
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => deletePost.mutate({ reportId: r.id, postId: r.post_id })}
                      disabled={deletePost.isPending}
                    >
                      <Trash2 className="w-4 h-4" /> حذف المنشور فقط
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setReasonFor({
                          postId: r.post_id,
                          authorId: post.author_id,
                          action: "warn",
                        })
                      }
                    >
                      <AlertTriangle className="w-4 h-4" /> إنذار الكاتب
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600"
                      onClick={() =>
                        setReasonFor({
                          postId: r.post_id,
                          authorId: post.author_id,
                          action: "suspend",
                        })
                      }
                    >
                      <Clock className="w-4 h-4" /> إيقاف مؤقت
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setReasonFor({ postId: r.post_id, authorId: post.author_id, action: "ban" })
                      }
                    >
                      <Ban className="w-4 h-4" /> حظر الكاتب
                    </Button>
                  </div>
                );
              })()}
          </CardContent>
        </Card>
      ))}

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

      return (profs ?? []).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? [],
        lastActivity: lastActivity[p.id] ?? null,
      }));
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
      const { error } = await supabase.rpc("admin_adjust_points", { _user: uid, _delta: delta });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const suspend = useMutation({
    mutationFn: async ({ uid, days, reason }: { uid: string; days: number; reason: string }) => {
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
    <div className="space-y-2">
      <Input
        placeholder="ابحث بالاسم أو الرقم الجامعي"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      {filtered.map((u) => {
        const status = userStatus(u);
        return (
          <Card key={u.id}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate max-w-[9rem]">
                      {u.full_name}
                    </span>
                    {u.verified && <VerifiedBadge />}
                    <StatusBadge status={status} />
                    {u.roles.includes("admin") && <Badge variant="default">مشرف</Badge>}
                    {u.roles.includes("teacher") && <Badge variant="secondary">أستاذ</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {u.university_number}
                  </div>
                </div>
                <RankBadge points={u.points ?? 0} />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
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
                    <DropdownMenuItem onClick={() => adjust.mutate({ uid: u.id, delta: 10 })}>
                      <Plus className="w-4 h-4" /> +10 نقاط
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => adjust.mutate({ uid: u.id, delta: -10 })}>
                      <Minus className="w-4 h-4" /> -10 نقاط
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setYearDialogFor(u)}>
                      <Calendar className="w-4 h-4" /> تغيير السنة الدراسية
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        toggleAdmin.mutate({ uid: u.id, isAdmin: u.roles.includes("admin") })
                      }
                    >
                      <Shield className="w-4 h-4" />
                      {u.roles.includes("admin") ? "إزالة الإشراف" : "جعل مشرفًا"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setVerified.mutate({ uid: u.id, verified: !u.verified })}
                    >
                      <BadgeCheck className="w-4 h-4" />
                      {u.verified ? "إلغاء التوثيق" : "توثيق الحساب"}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      إجراءات الإشراف
                    </DropdownMenuLabel>
                    {status === "active" && (
                      <DropdownMenuItem
                        onClick={() => setActionFor({ user: u, type: "suspend" })}
                        className="text-amber-600 focus:text-amber-600"
                      >
                        <Clock className="w-4 h-4" /> إيقاف مؤقت
                      </DropdownMenuItem>
                    )}
                    {status !== "banned" && (
                      <DropdownMenuItem
                        onClick={() => setActionFor({ user: u, type: "ban" })}
                        className="text-destructive focus:text-destructive"
                      >
                        <Ban className="w-4 h-4" /> حظر نهائي
                      </DropdownMenuItem>
                    )}
                    {status !== "active" && (
                      <DropdownMenuItem
                        onClick={() => unban.mutate(u.id)}
                        className="text-emerald-600 focus:text-emerald-600"
                      >
                        <ShieldOff className="w-4 h-4" /> إلغاء الإيقاف/الحظر
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setActionFor({ user: u, type: "delete" })}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" /> حذف الحساب نهائيًا
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                {u.major && <span>{majorLabel(u.major)}</span>}
                {u.year && <span>السنة {u.year}</span>}
                {u.warning_count > 0 && (
                  <span className="text-amber-600">{u.warning_count} إنذار</span>
                )}
                <span>
                  انضم: {u.created_at ? format(new Date(u.created_at), "yyyy/MM/dd") : "—"}
                </span>
                <span>
                  آخر نشاط:{" "}
                  {u.lastActivity
                    ? format(new Date(u.lastActivity), "yyyy/MM/dd HH:mm")
                    : "لا يوجد نشاط بعد"}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

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

  const adjust = useMutation({
    mutationFn: async (delta: number) => {
      if (!user) return;
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
      {(data ?? []).map((a) => (
        <Card key={a.id}>
          <CardContent className="p-3 text-sm space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div>
                <b>{a.adminName}</b>
                <span className="text-muted-foreground"> نفّذ </span>
                <Badge variant="outline">{actionLabel[a.action] ?? a.action}</Badge>
                {a.targetName && (
                  <>
                    {" "}
                    <span className="text-muted-foreground">على</span> <b>{a.targetName}</b>
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {format(new Date(a.created_at), "yyyy/MM/dd HH:mm")}
              </span>
            </div>
            {a.details &&
              typeof a.details === "object" &&
              "reason" in (a.details as Record<string, unknown>) && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded p-1.5">
                  {String((a.details as Record<string, unknown>).reason)}
                </div>
              )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============ ADD TEACHER ============

function AddTeacherCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const qc = useQueryClient();

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
    },
    onSuccess: () => {
      toast.success("تم إنشاء حساب الأستاذ");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      setEmail("");
      setName("");
      setPw("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-3">
          أنشئ حساب أستاذ يدخل بالبريد الإلكتروني.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4" /> إضافة أستاذ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>حساب أستاذ جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
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
            </div>
            <DialogFooter>
              <Button
                onClick={() => mut.mutate()}
                disabled={!email || !name || !pw || mut.isPending}
              >
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} إنشاء
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
    <Card>
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
