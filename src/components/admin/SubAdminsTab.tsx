import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { serializeSubAdminPermissions, type SubAdminPermissions } from "@/hooks/useAuth";
import { createIsolatedSupabaseClient } from "@/lib/isolatedSupabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UserPlus, Trash2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { getSubAdminPermissions } from "@/hooks/useAuth";

// ============ SUB-ADMINS MANAGEMENT ============

export function SubAdminsTab() {
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
        throw new Error("┘è╪▒╪¼┘ë ┘à┘ä╪í ╪¼┘à┘è╪╣ ╪º┘ä╪¡┘é┘ê┘ä ╪º┘ä┘à╪╖┘ä┘ê╪¿╪⌐");
      }
      if (password.length < 6) {
        throw new Error("┘è╪¼╪¿ ╪ú┘å ╪¬┘â┘ê┘å ┘â┘ä┘à╪⌐ ╪º┘ä┘à╪▒┘ê╪▒ 6 ╪ú╪¡╪▒┘ü ╪╣┘ä┘ë ╪º┘ä╪ú┘é┘ä");
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
          throw new Error("╪º╪│┘à ╪º┘ä┘à╪│╪¬╪«╪»┘à (╪ú┘ê ╪º┘ä╪¡╪│╪º╪¿) ┘ç╪░╪º ┘à╪│╪¼┘ä ╪¿╪º┘ä┘ü╪╣┘ä. ┘è╪▒╪¼┘ë ╪º╪«╪¬┘è╪º╪▒ ╪º╪│┘à ┘à╪│╪¬╪«╪»┘à ╪ó╪«╪▒.");
        }
        throw signUpError;
      }
      if (!data?.user?.id) throw new Error("╪¬╪╣╪░┘æ╪▒ ╪Ñ┘å╪┤╪º╪í ┘à╪│╪¬╪«╪»┘à ┘ü┘è ┘å╪╕╪º┘à ╪º┘ä┘à╪╡╪º╪»┘é╪⌐");

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
          "╪¬╪╣╪░┘æ╪▒ ╪¬┘ç┘è╪ª╪⌐ ╪º┘ä┘à┘ä┘ü ╪º┘ä╪┤╪«╪╡┘è ┘ä┘ä┘à╪┤╪▒┘ü ╪º┘ä┘à╪│╪º╪╣╪» ┘ü┘è ╪º┘ä┘ê┘é╪¬ ╪º┘ä┘à╪¡╪»╪»╪î ┘è╪▒╪¼┘ë ╪º┘ä┘à╪¡╪º┘ê┘ä╪⌐ ┘à╪▒╪⌐ ╪ú╪«╪▒┘ë.",
        );
      }

      // 5. Update user profile details
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({
          bio: serializeSubAdminPermissions(permissionsObj),
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
      toast.success("╪¬┘à ╪Ñ┘å╪┤╪º╪í ╪¡╪│╪º╪¿ ╪º┘ä┘à╪┤╪▒┘ü ╪º┘ä┘à╪│╪º╪╣╪» (╪│╪¿ ╪ú╪»┘à┘å) ╪¿┘å╪¼╪º╪¡!");
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
      toast.error(e.message || "╪¡╪»╪½ ╪«╪╖╪ú ╪ú╪½┘å╪º╪í ╪Ñ┘å╪┤╪º╪í ╪º┘ä╪¡╪│╪º╪¿");
    },
  });

  const deleteSubAdmin = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.rpc("admin_delete_user", { _user: uid });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("╪¬┘à ╪¡╪░┘ü ╪º┘ä┘à╪┤╪▒┘ü ╪º┘ä┘à╪│╪º╪╣╪» ╪¿┘å╪¼╪º╪¡");
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
        .update({ bio: serializeSubAdminPermissions(updatedPerms as SubAdminPermissions) })
        .eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("╪¬┘à ╪¬╪¡╪»┘è╪½ ╪º┘ä╪╡┘ä╪º╪¡┘è╪⌐ ╪¿┘å╪¼╪º╪¡");
      qc.invalidateQueries({ queryKey: ["sub-admins-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold">╪Ñ╪»╪º╪▒╪⌐ ╪¡╪│╪º╪¿╪º╪¬ ╪│╪¿ ╪ú╪»┘à┘å</h2>
          <p className="text-xs text-muted-foreground">
            ╪Ñ┘å╪┤╪º╪í ┘ê╪¬╪╣╪»┘è┘ä ╪╡┘ä╪º╪¡┘è╪º╪¬ ╪º┘ä┘à╪┤╪▒┘ü┘è┘å ╪º┘ä┘à╪│╪º╪╣╪»┘è┘å ┘ä┘ä┘à┘ê┘é╪╣
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1 text-xs">
              <Plus className="w-4 h-4" /> ╪Ñ╪╢╪º┘ü╪⌐ ╪│╪¿ ╪ú╪»┘à┘å ╪¼╪»┘è╪»
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md text-right">
            <DialogHeader>
              <DialogTitle>╪Ñ┘å╪┤╪º╪í ╪¡╪│╪º╪¿ ┘à╪┤╪▒┘ü ┘à╪│╪º╪╣╪» ╪¼╪»┘è╪»</DialogTitle>
              <DialogDescription className="text-xs">
                ╪│┘è╪¬┘à┘â┘å ┘ç╪░╪º ╪º┘ä╪¡╪│╪º╪¿ ┘à┘å ╪º┘ä╪»╪«┘ê┘ä ┘ä┘ä┘ê╪¡╪⌐ ╪º┘ä╪¬╪¡┘â┘à ╪¿╪╡┘ä╪º╪¡┘è╪º╪¬ ┘à╪«╪╡╪╡╪⌐ ╪¬╪¡╪»╪»┘ç╪º ╪ú╪»┘å╪º┘ç
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="space-y-1.5">
                <Label className="text-xs">╪º┘ä╪▒┘à╪▓ ╪º┘ä╪¬╪╣╪▒┘è┘ü┘è ╪º┘ä┘ü╪▒┘è╪» (ID) ┘ä┘ä╪»╪«┘ê┘ä</Label>
                <Input
                  placeholder="┘à╪½╪º┘ä: a guard 1"
                  value={nameId}
                  onChange={(e) => setNameId(e.target.value)}
                  dir="ltr"
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  ╪│┘è╪│╪¬╪«╪»┘à ┘ç╪░╪º ╪º┘ä╪▒┘à╪▓ ┘ä┘ä╪»╪«┘ê┘ä ╪¿╪»┘ä╪º┘ï ┘à┘å ╪º┘ä╪¿╪▒┘è╪» ╪º┘ä╪Ñ┘ä┘â╪¬╪▒┘ê┘å┘è (╪│┘è╪¬╪¡┘ê┘ä ╪¬┘ä┘é╪º╪ª┘è╪º┘ï ╪Ñ┘ä┘ë ╪¿╪▒┘è╪»
                  ┘ü╪▒┘è╪»)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">╪º┘ä╪º╪│┘à ╪º┘ä┘â╪º┘à┘ä ┘ä┘ä┘à╪┤╪▒┘ü</Label>
                <Input
                  placeholder="┘à╪½╪º┘ä: ╪º┘ä┘à╪┤╪▒┘ü ╪╣┘ä┘è - ╪¡╪º╪▒╪│ ╪º┘ä╪¿┘ê╪º╪¿╪⌐ 1"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">┘â┘ä┘à╪⌐ ╪º┘ä╪│╪▒</Label>
                <Input
                  type="text"
                  placeholder="╪º╪«╪¬╪▒ ┘â┘ä┘à╪⌐ ╪│╪▒ ┘é┘ê┘è╪⌐ (6 ╪ú╪¡╪▒┘ü ╪╣┘ä┘ë ╪º┘ä╪ú┘é┘ä)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2 border rounded-lg p-3">
                <h3 className="text-xs font-bold text-primary mb-2">╪¬╪¡╪»┘è╪» ╪╡┘ä╪º╪¡┘è╪º╪¬ ╪º┘ä╪¡╪│╪º╪¿:</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-reports"
                      checked={canReports}
                      onCheckedChange={(c) => setCanReports(!!c)}
                    />
                    <Label htmlFor="perm-reports" className="text-xs font-normal cursor-pointer">
                      ╪▒╪ñ┘è╪⌐ ┘ê╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä╪¿┘ä╪º╪║╪º╪¬
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-teachers"
                      checked={canTeachers}
                      onCheckedChange={(c) => setCanTeachers(!!c)}
                    />
                    <Label htmlFor="perm-teachers" className="text-xs font-normal cursor-pointer">
                      ╪Ñ╪╢╪º┘ü╪⌐ ┘ê╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä╪ú╪│╪º╪¬╪░╪⌐
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-courses"
                      checked={canCourses}
                      onCheckedChange={(c) => setCanCourses(!!c)}
                    />
                    <Label htmlFor="perm-courses" className="text-xs font-normal cursor-pointer">
                      ╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä┘à┘é╪▒╪▒╪º╪¬ ╪º┘ä╪»╪▒╪º╪│┘è╪⌐
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-warn"
                      checked={canWarn}
                      onCheckedChange={(c) => setCanWarn(!!c)}
                    />
                    <Label htmlFor="perm-warn" className="text-xs font-normal cursor-pointer">
                      ╪Ñ╪▒╪│╪º┘ä ╪Ñ┘å╪░╪º╪▒╪º╪¬ ┘ä┘ä┘à╪│╪¬╪«╪»┘à┘è┘å
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-suspend"
                      checked={canSuspend}
                      onCheckedChange={(c) => setCanSuspend(!!c)}
                    />
                    <Label htmlFor="perm-suspend" className="text-xs font-normal cursor-pointer">
                      ╪¬╪╣┘ä┘è┘é ┘ê╪Ñ┘è┘é╪º┘ü ╪º┘ä╪¡╪│╪º╪¿╪º╪¬ ┘à╪ñ┘é╪¬╪º┘ï
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="perm-words"
                      checked={canWords}
                      onCheckedChange={(c) => setCanWords(!!c)}
                    />
                    <Label htmlFor="perm-words" className="text-xs font-normal cursor-pointer">
                      ╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä┘â┘ä┘à╪º╪¬ ╪º┘ä┘à╪¡╪╕┘ê╪▒╪⌐
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
                ╪¬╪ú┘â┘è╪» ┘ê╪Ñ┘å╪┤╪º╪í ╪º┘ä╪¡╪│╪º╪¿
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
          ┘ä╪º ┘è┘ê╪¼╪» ╪¡╪│╪º╪¿╪º╪¬ ╪│╪¿ ╪ú╪»┘à┘å ╪¡╪º┘ä┘è╪º┘ï. ╪º╪╢╪║╪╖ ╪╣┘ä┘ë ╪º┘ä╪▓╪▒ ╪ú╪╣┘ä╪º┘ç ┘ä╪Ñ╪╢╪º┘ü╪⌐ ╪ú┘ê┘ä ╪¡╪│╪º╪¿.
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
                        ╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä╪¿┘ä╪º╪║╪º╪¬
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
                        ╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä╪ú╪│╪º╪¬╪░╪⌐
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
                        ╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä┘à┘é╪▒╪▒╪º╪¬
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
                        ╪Ñ╪▒╪│╪º┘ä ╪Ñ┘å╪░╪º╪▒╪º╪¬
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
                        ╪¬╪╣┘ä┘è┘é ╪º┘ä╪¡╪│╪º╪¿╪º╪¬
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
                        ╪Ñ╪»╪º╪▒╪⌐ ╪º┘ä┘â┘ä┘à╪º╪¬ ╪º┘ä┘à╪¡╪╕┘ê╪▒╪⌐
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center self-end md:self-center">
                    {deleteConfirmId === sub.id ? (
                      <div className="flex items-center gap-1.5 bg-destructive/5 border border-destructive/20 rounded-lg p-1 animate-in fade-in zoom-in-95 duration-200">
                        <span className="text-[10px] font-bold text-destructive px-1.5">
                          {"┘à╪¬╪ú┘â╪»╪ƒ"}
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
                          ┘å╪╣┘à╪î ╪¡╪░┘ü
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={deleteSubAdmin.isPending}
                        >
                          ╪Ñ┘ä╪║╪º╪í
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
                        <Trash2 className="w-3.5 h-3.5" /> ╪¡╪░┘ü ╪º┘ä╪¡╪│╪º╪¿
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
