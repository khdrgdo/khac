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
import { Shield, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { majorLabel } from "@/lib/college";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

interface ProfileRow {
  id: string; university_number: string; full_name: string;
  major: string | null; year: number | null;
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/feed", replace: true });
  }, [loading, isAdmin, navigate]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">لوحة الإدارة</h1>
          <p className="text-xs text-muted-foreground">إدارة المستخدمين والأدوار</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="teacher">إضافة أستاذ</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="pt-3"><UsersTable /></TabsContent>
        <TabsContent value="teacher" className="pt-3"><AddTeacherCard /></TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTable() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profs } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: { user_id: string; role: string }) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (profs ?? []).map((p: ProfileRow) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ uid, isAdmin }: { uid: string; isAdmin: boolean }) => {
      if (isAdmin) {
        await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      } else {
        await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      }
    },
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      {(data ?? []).map((u) => (
        <Card key={u.id}>
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{u.full_name}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">{u.university_number}</div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {u.major && <Badge variant="outline">{majorLabel(u.major)}</Badge>}
              {u.year && <Badge variant="outline">س{u.year}</Badge>}
              {u.roles.map((r: string) => (
                <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                  {r === "admin" ? "مشرف" : r === "teacher" ? "أستاذ" : "طالب"}
                </Badge>
              ))}
            </div>
            <Button
              size="sm"
              variant={u.roles.includes("admin") ? "destructive" : "outline"}
              onClick={() => toggleAdmin.mutate({ uid: u.id, isAdmin: u.roles.includes("admin") })}
            >
              {u.roles.includes("admin") ? "إزالة الإشراف" : "جعل مشرفًا"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
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
      // Sign up creates the user via public API; profile trigger fills defaults.
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
      return data.user.id;
    },
    onSuccess: () => {
      toast.success("تمت إضافة حساب الأستاذ. يرجى إعطائه البريد وكلمة السر.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false); setEmail(""); setName(""); setPw("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-3">
          أنشئ حساب أستاذ يمكنه الدخول بالبريد الإلكتروني وإضافة الكورسات.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4" /> إضافة أستاذ</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>حساب أستاذ جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>الاسم الكامل</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>البريد الإلكتروني</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></div>
              <div className="space-y-1.5"><Label>كلمة السر المؤقتة</Label>
                <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} /></div>
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
