import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, Download, Play, Trash2, Loader2, FileText, Video, Image as ImageIcon, MessageSquare, Clock, Pencil, Pin } from "lucide-react";
import { parseTitleAndNote, formatTitleAndNote, getFileTypeInfo } from "@/lib/courseUtils";
import { broadcastNotification } from "@/lib/notificationsStore";
import { signedUrl } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

export function FilesTab({ courseId, canEdit }: { courseId: string; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [selectedFileNote, setSelectedFileNote] = useState("");
  const [customFileName, setCustomFileName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<CourseFile | null>(null);
  const [editingFile, setEditingFile] = useState<CourseFile | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");

  const { data: files, isLoading } = useQuery({
    queryKey: ["course_files", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_links")
        .select("*")
        .eq("course_id", courseId)
        .eq("link_type", "file")
        .order("is_important", { ascending: false })
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
          toast.error(`${f.name}: ╪¡╪¼┘à ╪º┘ä┘à┘ä┘ü ┘è╪¬╪¼╪º┘ê╪▓ ╪º┘ä╪¡╪» ╪º┘ä┘à╪│┘à┘ê╪¡ (${isVideo ? "100MB" : "25MB"})`);
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
          const { data: allProfiles } = await supabase.from("profiles").select("id");
          broadcastNotification({
            actorId: user.id,
            actorName: user.user_metadata?.full_name || "╪º┘ä╪ú╪│╪¬╪º╪░",
            type: "material_added",
            title: "╪¬╪¡╪»┘è╪½ ╪¼╪»┘è╪» ┘ü┘è ╪º┘ä┘à┘é╪▒╪▒ ≡ƒôä",
            body: `╪¬┘à ╪Ñ╪╢╪º┘ü╪⌐ ┘à┘ä╪¡┘é/┘à┘ä╪«╪╡ ╪¼╪»┘è╪» (${baseTitle}) ┘ü┘è ╪º┘ä┘à┘é╪▒╪▒ ╪º┘ä╪»╪▒╪º╪│┘è.`,
            link: `/courses/${courseId}`,
            targetUserIds: (allProfiles ?? []).map((p) => p.id),
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
      toast.success("╪¬┘à ╪▒┘ü╪╣ ╪º┘ä┘à┘ä┘ü ╪¿┘å╪¼╪º╪¡ ┘à╪╣ ╪º┘ä╪¬╪╣┘ä┘è┘é");
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
      toast.error("╪¬╪╣╪░┘æ╪▒ ╪¬┘ê┘ä┘è╪» ╪▒╪º╪¿╪╖ ╪º┘ä╪¬┘å╪▓┘è┘ä");
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
      toast.success("╪¬┘à ╪¡╪░┘ü ╪º┘ä┘à┘ä┘ü ╪¿┘å╪¼╪º╪¡");
      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
    },
  });

  const editFile = useMutation({
    mutationFn: async () => {
      if (!editingFile) return;
      const formattedTitle = formatTitleAndNote(editTitle, editNote);
      const { error } = await supabase
        .from("course_links")
        .update({ title: formattedTitle })
        .eq("id", editingFile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("╪¬┘à ╪¬╪╣╪»┘è┘ä ╪º┘ä┘à┘ä┘ü ╪¿┘å╪¼╪º╪¡");
      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
      setEditingFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePin = useMutation({
    mutationFn: async (f: CourseFile) => {
      const { error } = await supabase
        .from("course_links")
        .update({ is_important: !f.is_important })
        .eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course_files", courseId] });
    },
  });

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border">
          <span className="text-xs font-semibold text-muted-foreground">
            ╪▒┘ü╪╣ ┘à┘ä┘ü╪º╪¬ PDF╪î ┘à╪░┘â╪▒╪º╪¬╪î ╪╣╪▒┘ê╪╢ ╪¬┘é╪»┘è┘à┘è╪⌐╪î ┘ê┘ü┘è╪»┘è┘ê┘ç╪º╪¬ ┘é╪╡┘è╪▒╪⌐ ┘ä┘ä┘à┘é╪▒╪▒
          </span>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-1">
                <Upload className="w-4 h-4" /> ╪▒┘ü╪╣ ┘à┘ä┘ü ┘ä┘ä┘à┘é╪▒╪▒
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>╪▒┘ü╪╣ ┘à┘ä┘ü ╪ú┘ê ┘ü┘è╪»┘è┘ê ╪»╪▒╪º╪│┘è</DialogTitle>
              </DialogHeader>

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">╪╣┘å┘ê╪º┘å ╪º┘ä┘à┘ä┘ü / ╪º┘ä╪¬╪│┘à┘è╪⌐ *</Label>
                  <Input
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="┘à╪½╪º┘ä: ┘à┘ä╪«╪╡ ╪º┘ä┘ü╪╡┘ä ╪º┘ä╪ú┘ê┘ä PDF╪î ╪┤╪▒╪¡ ┘ü┘è╪»┘è┘ê ┘ä┘ä┘à╪│╪ú┘ä╪⌐..."
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    ╪º╪«╪¬╪▒ ╪º┘ä┘à┘ä┘ü (PDF, Word, PPT, Video) *
                  </Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.zip,.png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.mkv"
                    className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer border rounded-xl p-1"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ┘è╪»╪╣┘à ╪¼┘à┘è╪╣ ╪º┘ä┘à╪│╪¬┘å╪»╪º╪¬ ╪¡╪¬┘ë 25MB╪î ┘ê╪º┘ä┘ü┘è╪»┘è┘ê┘ç╪º╪¬ ╪¡╪¬┘ë 100MB.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">┘à┘ä╪º╪¡╪╕╪⌐ ╪ú┘ê ╪¬╪╣┘ä┘è┘é ┘ä┘ä╪╖┘ä╪º╪¿ (╪º╪«╪¬┘è╪º╪▒┘è)</Label>
                  <Textarea
                    value={selectedFileNote}
                    onChange={(e) => setSelectedFileNote(e.target.value)}
                    placeholder="╪º┘â╪¬╪¿ ╪ú┘è╪⌐ ┘à┘ä╪º╪¡╪╕╪º╪¬ ┘ç╪º┘à┘æ╪⌐ ┘è╪¼╪¿ ╪╣┘ä┘ë ╪º┘ä╪╖┘ä╪º╪¿ ┘é╪▒╪º╪í╪¬┘ç╪º ╪╣┘å╪» ╪¬┘å╪▓┘è┘ä ┘ç╪░╪º ╪º┘ä┘à┘ä┘ü..."
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
                  {uploading && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} ╪▒┘ü╪╣ ╪º┘ä┘à┘ä┘ü ╪º┘ä╪ó┘å
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
          <p className="text-xs text-muted-foreground">┘ä╪º ╪¬┘ê╪¼╪» ┘à┘ä┘ü╪º╪¬ ┘à╪▒┘ü┘ê╪╣╪⌐ ┘ä┘ç╪░╪º ╪º┘ä┘à┘é╪▒╪▒ ╪¿╪╣╪»</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {files.map((f) => {
            const parsed = parseTitleAndNote(f.title);
            const fileInfo = getFileTypeInfo(f.url, f.link_type);

            return (
              <Card key={f.id} className={`hover:border-primary/40 transition ${f.is_important ? "border-amber-400 bg-amber-500/5" : ""}`}>
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
                        {f.is_important && (
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        )}
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
                            <strong className="text-primary font-semibold">┘à┘ä╪º╪¡╪╕╪⌐ ╪º┘ä╪ú╪│╪¬╪º╪░:</strong>{" "}
                            {parsed.note}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> ╪¬┘à ╪º┘ä╪▒┘ü╪╣:{" "}
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
                          ╪¬╪┤╪║┘è┘ä ╪º┘ä┘ü┘è╪»┘è┘ê{" "}
                          <Play className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
                        </>
                      ) : (
                        <>
                          ╪¬╪¡┘à┘è┘ä/╪¬┘å╪▓┘è┘ä <Download className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>

                    {(isAdmin || f.created_by === user?.id) && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-amber-500 hover:bg-amber-500/10"
                          onClick={() => togglePin.mutate(f)}
                          title={f.is_important ? "╪Ñ┘ä╪║╪º╪í ╪º┘ä╪¬╪½╪¿┘è╪¬" : "╪¬╪½╪¿┘è╪¬ ╪º┘ä┘à┘ä┘ü"}
                        >
                          <Pin className={`w-3.5 h-3.5 ${f.is_important ? "fill-amber-500" : ""}`} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:bg-muted"
                          onClick={() => {
                            setEditingFile(f);
                            setEditTitle(parsed.title);
                            setEditNote(parsed.note ?? "");
                          }}
                          title="╪¬╪╣╪»┘è┘ä ╪º┘ä┘à┘ä┘ü"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => setFileToDelete(f)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit File Dialog */}
      <Dialog open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>╪¬╪╣╪»┘è┘ä ╪º┘ä┘à┘ä┘ü</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">╪╣┘å┘ê╪º┘å ╪º┘ä┘à┘ä┘ü *</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">┘à┘ä╪º╪¡╪╕╪⌐ ╪º┘ä╪ú╪│╪¬╪º╪░ (╪º╪«╪¬┘è╪º╪▒┘è)</Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                className="resize-none rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setEditingFile(null)} className="rounded-xl">
              ╪Ñ┘ä╪║╪º╪í
            </Button>
            <Button
              onClick={() => editFile.mutate()}
              disabled={!editTitle.trim() || editFile.isPending}
              className="rounded-xl font-semibold"
            >
              {editFile.isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />}
              ╪¡┘ü╪╕ ╪º┘ä╪¬╪╣╪»┘è┘ä╪º╪¬
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>╪¡╪░┘ü ╪º┘ä┘à┘ä┘ü</AlertDialogTitle>
            <AlertDialogDescription>
              ╪│┘è╪¬┘à ╪¡╪░┘ü ┘ç╪░╪º ╪º┘ä┘à┘ä┘ü ┘å┘ç╪º╪ª┘è╪º┘ï ┘à┘å ╪º┘ä╪¬╪«╪▓┘è┘å. ┘ä╪º ┘è┘à┘â┘å ╪º┘ä╪¬╪▒╪º╪¼╪╣ ╪╣┘å ┘ç╪░╪º ╪º┘ä╪Ñ╪¼╪▒╪º╪í.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>╪Ñ┘ä╪║╪º╪í</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (fileToDelete) del.mutate(fileToDelete);
                setFileToDelete(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              ╪¡╪░┘ü
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Video Modal Player */}
      {selectedVideoUrl && (
        <Dialog open={!!selectedVideoUrl} onOpenChange={() => setSelectedVideoUrl(null)}>
          <DialogContent className="sm:max-w-[700px] p-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-600" /> ┘à╪┤╪║┘ä ╪º┘ä┘ü┘è╪»┘è┘ê ╪º┘ä╪┤╪º╪▒╪¡
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
