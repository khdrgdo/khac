import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { useSubAdminRestrictions, type ProfileRow, type UserWarningRow, type LastActivityMap, userStatus, StatusBadge } from "@/components/admin/admin-shared";
import { formatUnivNumber } from "@/lib/privacy";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Users,
  Search,
  Check,
  X,
  Trash2,
  Eye,
  GraduationCap,
  Ban,
  AlertTriangle,
  ShieldOff,
  BadgeCheck,
  MoreVertical,
  Plus,
  Minus,
  Calendar,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { majorLabel } from "@/lib/college";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { RankBadge } from "@/components/RankBadge";
import { renderMarkdownContent } from "@/lib/markdown";

// ============ USERS ============

export function UsersTable() {
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
  const [userFilter, setUserFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [majorFilter, setMajorFilter] = useState("all");

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
      if (targetUser) await handleActionCheck(targetUser);
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
      if (targetUser) await handleActionCheck(targetUser);
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
      if (targetUser) await handleActionCheck(targetUser);
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
      if (targetUser) await handleActionCheck(targetUser);
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
      if (targetUser) await handleActionCheck(targetUser);
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
      if (targetUser) await handleActionCheck(targetUser);
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
      if (targetUser) await handleActionCheck(targetUser);
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
      if (targetUser) await handleActionCheck(targetUser);
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

  const searched = (data ?? []).filter((u) => {
    let match = true;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      match = (u.full_name?.toLowerCase().includes(q) ||
        u.university_number?.toLowerCase().includes(q)) as boolean;
    }
    if (match && yearFilter !== "all" && String(u.year) !== yearFilter) {
      match = false;
    }
    return match;
  });

  const filtered = searched.filter((u) => {
    if (userFilter === "all") return true;
    if (userFilter === "students")
      return !u.roles.includes("teacher") && !u.roles.includes("admin");
    if (userFilter === "teachers") return u.roles.includes("teacher");
    if (userFilter === "admins") return u.roles.includes("admin");
    if (userFilter === "banned")
      return u.banned || (u.suspended_until && new Date(u.suspended_until) > new Date());
    return true;
  }).filter((u) => {
    if (majorFilter === "all") return true;
    return u.major === majorFilter;
  });

  const counts = {
    all: searched.length,
    students: searched.filter((u) => !u.roles.includes("teacher") && !u.roles.includes("admin"))
      .length,
    teachers: searched.filter((u) => u.roles.includes("teacher")).length,
    admins: searched.filter((u) => u.roles.includes("admin")).length,
    banned: searched.filter(
      (u) => u.banned || (u.suspended_until && new Date(u.suspended_until) > new Date()),
    ).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          <Button
            variant={userFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("all")}
            className={
              userFilter === "all"
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-card text-muted-foreground"
            }
          >
            الكل{" "}
            <Badge variant="secondary" className="mr-2 bg-black/10 text-current">
              {counts.all}
            </Badge>
          </Button>
          <Button
            variant={userFilter === "students" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("students")}
            className={
              userFilter === "students"
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-card text-muted-foreground"
            }
          >
            الطلاب{" "}
            <Badge variant="secondary" className="mr-2 bg-black/10 text-current">
              {counts.students}
            </Badge>
          </Button>
          <Button
            variant={userFilter === "teachers" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("teachers")}
            className={
              userFilter === "teachers"
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-card text-muted-foreground"
            }
          >
            الأساتذة{" "}
            <Badge variant="secondary" className="mr-2 bg-black/10 text-current">
              {counts.teachers}
            </Badge>
          </Button>
          <Button
            variant={userFilter === "admins" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("admins")}
            className={
              userFilter === "admins"
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-card text-muted-foreground"
            }
          >
            المشرفون{" "}
            <Badge variant="secondary" className="mr-2 bg-black/10 text-current">
              {counts.admins}
            </Badge>
          </Button>
          <Button
            variant={userFilter === "banned" ? "default" : "outline"}
            size="sm"
            onClick={() => setUserFilter("banned")}
            className={
              userFilter === "banned"
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-card text-muted-foreground"
            }
          >
            محظور/موقوف{" "}
            <Badge variant="secondary" className="mr-2 bg-black/10 text-current">
              {counts.banned}
            </Badge>
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[100px] bg-muted/30 border-none shadow-sm rounded-full h-10 text-sm">
              <SelectValue placeholder="السنة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل السنوات</SelectItem>
              <SelectItem value="1">السنة 1</SelectItem>
              <SelectItem value="2">السنة 2</SelectItem>
              <SelectItem value="3">السنة 3</SelectItem>
              <SelectItem value="4">السنة 4</SelectItem>
              <SelectItem value="5">السنة 5</SelectItem>
              <SelectItem value="6">السنة 6</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-[250px]">
            <Input
              placeholder="بحث بالاسم أو الرقم الجامعي..."
              className="pr-10 bg-muted/30 border-none shadow-sm rounded-full h-10 focus-visible:ring-1 focus-visible:ring-indigo-500 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
          </div>
          <Select value={majorFilter} onValueChange={setMajorFilter}>
            <SelectTrigger className="w-[130px] bg-muted/30 border-none shadow-sm rounded-full h-10 text-sm">
              <SelectValue placeholder="التخصص" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التخصصات</SelectItem>
              <SelectItem value="it">تقنية معلومات</SelectItem>
              <SelectItem value="is">نظم معلومات</SelectItem>
              <SelectItem value="se">هندسة برمجيات</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        </div>
      ) : (
        <Card className="border border-border/40 shadow-sm rounded-xl overflow-hidden bg-card">
          {filtered.length > 0 && (
            <div className="hidden sm:grid grid-cols-12 items-center p-4 bg-transparent border-b border-border/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5">اسم المستخدم (Client Name)</div>
              <div className="col-span-3">تاريخ الانضمام (Date)</div>
              <div className="col-span-2">التخصص (Category)</div>
              <div className="col-span-2 text-left pr-4">الحالة (Status)</div>
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
                        {formatUnivNumber(u.university_number, false, true)}
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
      await handleActionCheck(user);
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
                    {formatUnivNumber(user.university_number, false, true)}
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
                        <div className="line-clamp-2">
                          {renderMarkdownContent(p.content)}
                        </div>
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
