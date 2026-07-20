import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, UserPlus, Loader2, Flag, Users, MessageSquare, FileText, Plus, Minus, Check, X, Trash2, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { majorLabel } from "@/lib/college";
import { RankBadge } from "@/components/RankBadge";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

interface ProfileRow {
  id: string; university_number: string; full_name: string;
  major: string | null; year: number | null; points: number;
  email?: string | null; created_at?: string | null;
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) navigate({ to: "/feed", replace: true }); }, [loading, isAdmin, navigate]);
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
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
          <TabsTrigger value="reports"><Flag className="w-4 h-4" /> البلاغات</TabsTrigger>
          <TabsTrigger value="users"><Users className="w-4 h-4" /> المستخدمون</TabsTrigger>
          <TabsTrigger value="teacher"><UserPlus className="w-4 h-4" /> إضافة أستاذ</TabsTrigger>
          <TabsTrigger value="words"><Shield className="w-4 h-4" /> الكلمات المحظورة</TabsTrigger>
        </TabsList>
        <TabsContent value="reports" className="pt-3"><ReportsTab /></TabsContent>
        <TabsContent value="users" className="pt-3"><UsersTable /></TabsContent>
        <TabsContent value="teacher" className="pt-3"><AddTeacherCard /></TabsContent>
        <TabsContent value="words" className="pt-3"><BannedWordsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function StatsCards() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: users }, { count: posts }, { count: reports }, { count: msgs }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("post_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("messages").select("*", { count: "exact", head: true }),
      ]);
      return { users: users ?? 0, posts: posts ?? 0, reports: reports ?? 0, msgs: msgs ?? 0 };
    },
  });

  const items = [
    { icon: Users, label: "المستخدمون", value: data?.users ?? 0, color: "text-blue-600 bg-blue-500/10" },
    { icon: FileText, label: "المنشورات", value: data?.posts ?? 0, color: "text-emerald-600 bg-emerald-500/10" },
    { icon: Flag, label: "بلاغات معلّقة", value: data?.reports ?? 0, color: "text-red-600 bg-red-500/10" },
    { icon: MessageSquare, label: "الرسائل", value: data?.msgs ?? 0, color: "text-purple-600 bg-purple-500/10" },
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

function ReportsTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data } = await supabase.from("post_reports").select("*").order("created_at", { ascending: false }).limit(100);
      const rows = data ?? [];
      const postIds = Array.from(new Set(rows.map((r) => r.post_id)));
      const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id)));
      const [{ data: posts }, { data: reporters }] = await Promise.all([
        postIds.length ? supabase.from("posts").select("id, content, author_id").in("id", postIds) : Promise.resolve({ data: [] as { id: string; content: string; author_id: string }[] }),
        reporterIds.length ? supabase.from("profiles").select("id, full_name").in("id", reporterIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      ]);
      const pMap = new Map((posts ?? []).map((p) => [p.id, p]));
      const rMap = new Map((reporters ?? []).map((r) => [r.id, r]));
      return rows.map((r) => ({ ...r, post: pMap.get(r.post_id), reporter: rMap.get(r.reporter_id) }));
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "confirmed" | "dismissed" }) => {
      const { error } = await supabase.from("post_reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(
        v.status === "confirmed"
          ? "تم تأكيد البلاغ — تم خصم 20 نقطة من صاحب المنشور وتحديث لوحة المستخدمين"
          : "تم رفض البلاغ",
      );
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["user-details"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حذف المنشور"); qc.invalidateQueries({ queryKey: ["admin-reports"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      {(data ?? []).length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">لا توجد بلاغات</div>
      )}
      {(data ?? []).map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm">
                <span className="text-muted-foreground">من:</span> <b>{r.reporter?.full_name ?? "—"}</b>
              </div>
              <Badge variant={r.status === "pending" ? "default" : r.status === "confirmed" ? "destructive" : "secondary"}>
                {r.status === "pending" ? "معلّق" : r.status === "confirmed" ? "مؤكّد" : "مرفوض"}
              </Badge>
            </div>
            <div className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">
              <div className="text-xs text-muted-foreground mb-1">السبب:</div>{r.reason}
            </div>
            {r.post && (
              <div className="text-sm border rounded p-2">
                <div className="text-xs text-muted-foreground mb-1">المنشور:</div>
                <p className="line-clamp-3 whitespace-pre-wrap">{r.post.content}</p>
              </div>
            )}
            {r.status === "pending" && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="destructive" onClick={() => update.mutate({ id: r.id, status: "confirmed" })}>
                  <Check className="w-4 h-4" /> تأكيد وخصم نقاط
                </Button>
                <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: "dismissed" })}>
                  <X className="w-4 h-4" /> رفض
                </Button>
                {r.post && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.post_id)}>
                    <Trash2 className="w-4 h-4" /> حذف المنشور
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsersTable() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [detailsFor, setDetailsFor] = useState<ProfileRow & { roles: string[] } | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profs } = await supabase.from("profiles").select("*").order("points", { ascending: false }).limit(500);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: { user_id: string; role: string }) => {
        const arr = roleMap.get(r.user_id) ?? []; arr.push(r.role); roleMap.set(r.user_id, arr);
      });
      return (profs ?? []).map((p: ProfileRow) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ uid, isAdmin }: { uid: string; isAdmin: boolean }) => {
      if (isAdmin) await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      else await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    },
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });

  const adjust = useMutation({
    mutationFn: async ({ uid, delta }: { uid: string; delta: number }) => {
      const { error } = await supabase.rpc("admin_adjust_points", { _user: uid, _delta: delta });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.university_number?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-2">
      <Input placeholder="ابحث بالاسم أو الرقم الجامعي" value={search} onChange={(e) => setSearch(e.target.value)} />
      {filtered.map((u) => (
        <Card key={u.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{u.full_name}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{u.university_number}</div>
              </div>
              <RankBadge points={u.points ?? 0} />
              <div className="flex gap-1 flex-wrap">
                {u.major && <Badge variant="outline">{majorLabel(u.major)}</Badge>}
                {u.year && <Badge variant="outline">س{u.year}</Badge>}
                {u.roles.map((r: string) => (
                  <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                    {r === "admin" ? "مشرف" : r === "teacher" ? "أستاذ" : "طالب"}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setDetailsFor(u)}>
                <Eye className="w-3 h-3" /> التفاصيل
              </Button>
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button size="sm" variant="ghost" onClick={() => adjust.mutate({ uid: u.id, delta: -10 })}><Minus className="w-3 h-3" />10</Button>
                <Button size="sm" variant="ghost" onClick={() => adjust.mutate({ uid: u.id, delta: -50 })}><Minus className="w-3 h-3" />50</Button>
                <span className="text-xs text-muted-foreground px-2">نقاط</span>
                <Button size="sm" variant="ghost" onClick={() => adjust.mutate({ uid: u.id, delta: 10 })}><Plus className="w-3 h-3" />10</Button>
                <Button size="sm" variant="ghost" onClick={() => adjust.mutate({ uid: u.id, delta: 50 })}><Plus className="w-3 h-3" />50</Button>
              </div>
              <Button size="sm" variant={u.roles.includes("admin") ? "destructive" : "outline"}
                onClick={() => toggleAdmin.mutate({ uid: u.id, isAdmin: u.roles.includes("admin") })}>
                {u.roles.includes("admin") ? "إزالة الإشراف" : "جعل مشرفًا"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <UserDetailsDialog user={detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)} />
    </div>
  );
}

function UserDetailsDialog({ user, onOpenChange }: { user: (ProfileRow & { roles: string[] }) | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [customDelta, setCustomDelta] = useState("");
  const { data } = useQuery({
    queryKey: ["user-details", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const [{ count: posts }, { count: comments }, { count: reports }, { data: recentPosts }] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("author_id", user.id),
        supabase.from("post_reports").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
        supabase.from("posts").select("id, content, created_at").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      return { posts: posts ?? 0, comments: comments ?? 0, reports: reports ?? 0, recentPosts: recentPosts ?? [] };
    },
  });

  const adjust = useMutation({
    mutationFn: async (delta: number) => {
      if (!user) return;
      const { error } = await supabase.rpc("admin_adjust_points", { _user: user.id, _delta: delta });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["user-details"] }); setCustomDelta(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {user.full_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-xs text-muted-foreground">الرقم الجامعي</div>
                  <div className="font-medium" dir="ltr">{user.university_number}</div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-xs text-muted-foreground">البريد</div>
                  <div className="font-medium truncate" dir="ltr">{user.email ?? "—"}</div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-xs text-muted-foreground">التخصص / السنة</div>
                  <div className="font-medium">{majorLabel(user.major)} · {user.year ?? "—"}</div>
                </div>
                <div className="bg-muted/50 rounded p-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">انضم في</div>
                    <div className="font-medium">{user.created_at ? format(new Date(user.created_at), "yyyy/MM/dd") : "—"}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
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
                    onClick={() => { const n = Number(customDelta); if (Number.isFinite(n) && n !== 0) adjust.mutate(n); }}
                  >
                    تطبيق
                  </Button>
                </div>
              </div>

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
        email: email.trim(), password: pw,
        options: { data: { university_number: uniqueUniv, full_name: name.trim(), role: "teacher", must_change_password: false } },
      });
      if (error) throw error;
      if (!data.user) throw new Error("لم يتم إنشاء الحساب");
    },
    onSuccess: () => {
      toast.success("تم إنشاء حساب الأستاذ");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false); setEmail(""); setName(""); setPw("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-3">أنشئ حساب أستاذ يدخل بالبريد الإلكتروني.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><UserPlus className="w-4 h-4" /> إضافة أستاذ</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>حساب أستاذ جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>الاسم الكامل</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>البريد الإلكتروني</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></div>
              <div className="space-y-1.5"><Label>كلمة السر</Label><Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => mut.mutate()} disabled={!email || !name || !pw || mut.isPending}>
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} إنشاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

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
    onSuccess: () => { setWord(""); qc.invalidateQueries({ queryKey: ["banned-words-admin"] }); qc.invalidateQueries({ queryKey: ["banned-words"] }); toast.success("تمت الإضافة"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("banned_words").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["banned-words-admin"] }); qc.invalidateQueries({ queryKey: ["banned-words"] }); },
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder="أضف كلمة محظورة" />
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4" /> إضافة</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data ?? []).map((w: { id: string; word: string }) => (
            <Badge key={w.id} variant="secondary" className="gap-1">
              {w.word}
              <button onClick={() => del.mutate(w.id)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
