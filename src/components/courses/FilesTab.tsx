import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { type CourseFile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Download, Play, Trash2, Loader2, FileText, Video, Image as ImageIcon, MessageSquare, Clock } from "lucide-react";
import { parseTitleAndNote, formatTitleAndNote, getFileTypeInfo } from "@/lib/courseUtils";
import { broadcastNotification } from "@/lib/notificationsStore";
import { signedUrl } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

/* Files Component with Video/PDF Support and Teacher Notes */
export function FilesTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [selectedFileNote, setSelectedFileNote] = useState("");
  const [customFileName, setCustomFileName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ["course_files", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_links")
        .select("*")
        .eq("course_id", courseId)
        .eq("link_type", "file")
        .order("created_at", { ascending: false });
      return (data ?? []) as CourseFile[];
    },
  });

  async function handleFileUpload() {
    const fileList = fileRef.current?.files;
    if (!fileList || fileList.length === 0 || !user) return;

    setUploading(true);
    try {
      for (const f of Array.from(fileList)) {
        const isVideo = ["mp4", "mov", "webm", "mkv", "avi"].includes(
          f.name.split(".").pop()?.toLowerCase() || "",
        );

        const maxLimit = isVideo ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
        if (f.size > maxLimit) {
          toast.error(`${f.name}: حجم الملف يتجاوز الحد المسموح (${isVideo ? "100MB" : "25MB"})`);
          continue;
        }

        const path = `${courseId}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("course-files").upload(path, f);
        if (upErr) {
          toast.error(upErr.message);
          continue;
        }

        const baseTitle = customFileName.trim() || f.name;
        const formattedTitle = formatTitleAndNote(baseTitle, selectedFileNote);

        await supabase.from("course_links").insert({
          course_id: courseId,
          title: formattedTitle,
          url: path,
          link_type: "file",
          created_by: user.id,
        });

        if (user) {
          broadcastNotification({
            actorId: user.id,
            actorName: user.user_metadata?.full_name || "الأستاذ",
            type: "material_added",
            title: "تحديث جديد في المقرر 📄",
            body: `تم إضافة ملحق/ملخص جديد (${baseTitle}) في المقرر الدراسي.`,
            link: `/courses/${courseId}`,
            currentUserId: user.id,
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
      toast.success("تم رفع الملف بنجاح مع التعليق");
      setDialogOpen(false);
      setCustomFileName("");
      setSelectedFileNote("");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function downloadOrPreview(f: CourseFile) {
    const url = await signedUrl("course-files", f.url, 600);
    if (!url) {
      toast.error("تعذّر توليد رابط التنزيل");
      return;
    }

    const fileInfo = getFileTypeInfo(f.url, f.link_type);
    if (fileInfo.isVideo) {
      setSelectedVideoUrl(url);
    } else {
      window.open(url, "_blank");
    }
  }

  const del = useMutation({
    mutationFn: async (f: CourseFile) => {
      await supabase.storage.from("course-files").remove([f.url]);
      await supabase.from("course_links").delete().eq("id", f.id);
    },
    onSuccess: () => {
      toast.success("تم حذف الملف بنجاح");
      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
    },
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground">
            رفع ملفات PDF، مذكرات، عروض تقديمة، وفيديوهات قصيرة للمقرر
          </span>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-1">
                <Upload className="w-4 h-4" /> رفع ملف للمقرر
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>رفع ملف أو فيديو دراسي</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">عنوان الملف / التسمية *</Label>
                  <Input
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="مثال: ملخص الفصل الأول PDF، شرح فيديو للمسألة..."
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    اختر الملف (PDF, Word, PPT, Video) *
                  </Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.mkv"
                    className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border rounded-xl p-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    يدعم جميع المستندات حتى 25MB، والفيديوهات حتى 100MB.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">ملاحظة أو تعليق للطلاب (اختياري)</Label>
                  <Textarea
                    value={selectedFileNote}
                    onChange={(e) => setSelectedFileNote(e.target.value)}
                    placeholder="اكتب أية ملاحظات هامّة يجب على الطلاب قراءتها عند تنزيل هذا الملف..."
                    rows={2}
                    className="resize-none rounded-xl"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  onClick={handleFileUpload}
                  disabled={uploading}
                  className="rounded-xl font-semibold w-full"
                >
                  {uploading && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} رفع الملف الآن
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !files || files.length === 0 ? (
        <div className="text-center py-8 border rounded-2xl border-dashed bg-muted/5">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لا توجد ملفات مرفوعة لهذا المقرر بعد</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {files.map((f) => {
            const parsed = parseTitleAndNote(f.title);
            const fileInfo = getFileTypeInfo(f.url, f.link_type);

            return (
              <Card key={f.id} className="hover:border-primary/40 transition">
                <CardContent className="p-3.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        fileInfo.type === "video"
                          ? "bg-purple-500/10 text-purple-600"
                          : fileInfo.type === "pdf"
                            ? "bg-red-500/10 text-red-600"
                            : fileInfo.type === "ppt"
                              ? "bg-orange-500/10 text-orange-600"
                              : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {fileInfo.type === "video" ? (
                        <Video className="w-4 h-4" />
                      ) : fileInfo.type === "pdf" ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <ImageIcon className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-foreground truncate">
                          {parsed.title}
                        </h4>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {fileInfo.label}
                        </Badge>
                      </div>

                      {parsed.note && (
                        <div className="bg-muted/40 border rounded-lg p-2 text-xs text-foreground/90 flex items-start gap-1.5 my-1">
                          <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            <strong className="text-primary font-semibold">ملاحظة الأستاذ:</strong>{" "}
                            {parsed.note}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> تم الرفع:{" "}
                          {formatDistanceToNow(new Date(f.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-8 gap-1 text-xs"
                      onClick={() => downloadOrPreview(f)}
                    >
                      {fileInfo.isVideo ? (
                        <>
                          تشغيل الفيديو{" "}
                          <Play className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
                        </>
                      ) : (
                        <>
                          تحميل/تنزيل <Download className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>

                    {(isAdmin || f.created_by === user?.id) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => del.mutate(f)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Video Modal Player */}
      {selectedVideoUrl && (
        <Dialog open={!!selectedVideoUrl} onOpenChange={() => setSelectedVideoUrl(null)}>
          <DialogContent className="sm:max-w-[700px] p-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-600" /> مشغل الفيديو الشارح
              </DialogTitle>
            </DialogHeader>
            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden mt-2">
              <video src={selectedVideoUrl} controls autoPlay className="w-full h-full" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
