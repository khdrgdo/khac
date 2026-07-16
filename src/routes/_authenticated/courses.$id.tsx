import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { majorLabel } from "@/lib/college";
import { ArrowRight, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/courses/$id")({
  component: CourseDetailPage,
});

function CourseDetailPage() {
  const { id } = useParams({ from: "/_authenticated/courses/$id" });
  const { user, isTeacher, isAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: course } = useQuery({
    queryKey: ["course", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: links } = useQuery({
    queryKey: ["course_links", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_links").select("*").eq("course_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const canEdit = !!user && (isAdmin || isTeacher || course?.created_by === user.id);

  const deleteLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("course_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course_links", id] }),
  });

  if (!course) {
    return <div className="text-center py-10 text-sm text-muted-foreground">جارِ التحميل...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link to="/courses" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowRight className="w-4 h-4" /> العودة إلى الكورسات
      </Link>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{course.name}</h1>
            <div className="flex gap-1.5">
              <Badge variant="secondary">{majorLabel(course.major)}</Badge>
              <Badge variant="outline">السنة {course.year} • فصل {course.semester}</Badge>
            </div>
          </div>
          {course.description && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p>}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">الروابط والمواد</h2>
        {canEdit && <AddLinkDialog courseId={id} />}
      </div>

      {!links || links.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">لا توجد روابط بعد.</div>
      ) : (
        <div className="space-y-2">
          {links.map((l) => (
            <Card key={l.id}>
              <CardContent className="p-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <a href={l.url} target="_blank" rel="noreferrer" className="font-medium hover:underline block truncate">
                    {l.title}
                  </a>
                  <div className="text-xs text-muted-foreground truncate" dir="ltr">{l.url}</div>
                </div>
                {(isAdmin || l.created_by === user?.id) && (
                  <Button size="icon" variant="ghost" onClick={() => deleteLink.mutate(l.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddLinkDialog({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const { user } = useAuth();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("course_links").insert({
        course_id: courseId, title, url, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["course_links", courseId] });
      setOpen(false); setTitle(""); setUrl("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4" /> إضافة رابط</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة رابط للكورس</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>الرابط</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" placeholder="https://..." /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={!title || !url || mut.isPending}>
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
