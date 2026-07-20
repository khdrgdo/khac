import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PostList } from "@/components/PostList";
import { RankBadge } from "@/components/RankBadge";
import { majorLabel } from "@/lib/college";
import { Camera, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { uploadFile, signedUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/profile/$id")({
  component: ProfilePage,
});

function ProfilePage() {
  const { id } = useParams({ from: "/_authenticated/profile/$id" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: p } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const isSelf = user?.id === id;
      let data: Record<string, unknown> | null = null;
      if (isSelf) {
        const { data: row } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
        data = row as Record<string, unknown> | null;
      } else {
        const { data: rows } = await supabase.rpc("get_public_profiles", { _ids: [id] });
        data = (rows && rows[0]) ? (rows[0] as Record<string, unknown>) : null;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", id);
      if (!data) return null;
      const avatarUrl = data.avatar_url as string | null;
      let avatarSigned: string | null = null;
      if (avatarUrl && !avatarUrl.startsWith("http")) {
        avatarSigned = await signedUrl("avatars", avatarUrl, 3600);
      } else {
        avatarSigned = avatarUrl;
      }
      return { ...(data as Record<string, unknown>), avatar_signed: avatarSigned, roles: (roles ?? []).map((r: { role: string }) => r.role) } as {
        full_name: string;
        university_number: string;
        major: "it" | "is" | "se" | null;
        year: number | null;
        points: number;
        bio: string | null;
        banned?: boolean;
        suspended_until?: string | null;
        avatar_signed: string | null;
        roles: string[];
      };
    },
  });

  const startChat = useMutation({
    mutationFn: async () => {
      if (!user || user.id === id) return null;
      const { data, error } = await supabase.rpc("create_dm", { _other: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (convId) => {
      if (convId) { qc.invalidateQueries({ queryKey: ["conversations"] }); navigate({ to: "/messages/$id", params: { id: convId } }); }
    },
    onError: (e: Error) => toast.error(e.message || "تعذّر بدء المحادثة"),
  });

  async function onPickAvatar(files: FileList | null) {
    if (!files || !user) return;
    const f = files[0];
    if (!f.type.startsWith("image/")) { toast.error("اختر صورة"); return; }
    if (f.size > 3 * 1024 * 1024) { toast.error("أكبر من 3MB"); return; }
    setUploading(true);
    try {
      const path = await uploadFile("avatars", user.id, f, "avatar-");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      if (error) throw error;
      toast.success("تم تحديث الصورة");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      // Force useAuth re-render by dispatching an auth event
      window.location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!p) return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;

  const isMe = user?.id === id;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={p.avatar_signed ?? undefined} />
                <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                  {p.full_name.slice(0,2)}
                </AvatarFallback>
              </Avatar>
              {isMe && (
                <>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickAvatar(e.target.files)} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md hover:scale-110 transition"
                    aria-label="تغيير الصورة"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{p.full_name}</h1>
                <RankBadge points={p.points ?? 0} />
              </div>
              <div className="text-sm text-muted-foreground" dir="ltr">{p.university_number}</div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {p.roles.map((r: string) => (
                  <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                    {r === "admin" ? "مشرف" : r === "teacher" ? "أستاذ" : "طالب"}
                  </Badge>
                ))}
                {p.major && <Badge variant="outline">{majorLabel(p.major)}</Badge>}
                {p.year && <Badge variant="outline">السنة {p.year}</Badge>}
                {p.banned && <Badge variant="destructive"><ShieldAlert className="w-3 h-3" /> محظور</Badge>}
                {!p.banned && p.suspended_until && new Date(p.suspended_until) > new Date() && (
                  <Badge variant="destructive"><ShieldAlert className="w-3 h-3" /> موقوف</Badge>
                )}
              </div>
              {p.bio && <p className="mt-3 text-sm">{p.bio}</p>}
              {user && user.id !== id && (
                <Button size="sm" className="mt-3" onClick={() => startChat.mutate()} disabled={startChat.isPending}>
                  <MessageCircle className="w-4 h-4" /> مراسلة
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="font-semibold mt-4">منشورات المستخدم</h2>
      <PostList authorId={id} />
    </div>
  );
}
