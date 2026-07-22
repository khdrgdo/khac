import {
  FileText,
  FileImage,
  FileArchive,
  FileSpreadsheet,
  Presentation,
  File as FileIcon,
  Youtube,
  Video,
  BookOpen,
  Link2,
} from "lucide-react";
import type { ComponentType } from "react";

export interface KindInfo {
  icon: ComponentType<{ className?: string }>;
  color: string; // text color class
  bg: string; // background chip class
  label: string;
}

export function fileKind(name: string): KindInfo {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf")
    return { icon: FileText, color: "text-red-600", bg: "bg-red-500/10", label: "PDF" };
  if (["ppt", "pptx"].includes(ext))
    return {
      icon: Presentation,
      color: "text-orange-600",
      bg: "bg-orange-500/10",
      label: "عرض تقديمي",
    };
  if (["doc", "docx"].includes(ext))
    return { icon: FileText, color: "text-blue-600", bg: "bg-blue-500/10", label: "مستند Word" };
  if (["xls", "xlsx", "csv"].includes(ext))
    return {
      icon: FileSpreadsheet,
      color: "text-emerald-600",
      bg: "bg-emerald-500/10",
      label: "جدول بيانات",
    };
  if (["zip", "rar", "7z"].includes(ext))
    return {
      icon: FileArchive,
      color: "text-purple-600",
      bg: "bg-purple-500/10",
      label: "أرشيف مضغوط",
    };
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext))
    return { icon: FileImage, color: "text-pink-600", bg: "bg-pink-500/10", label: "صورة" };
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext))
    return { icon: Video, color: "text-violet-600", bg: "bg-violet-500/10", label: "فيديو" };
  return { icon: FileIcon, color: "text-muted-foreground", bg: "bg-muted", label: "ملف" };
}

export function linkKind(url: string): KindInfo {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be"))
    return { icon: Youtube, color: "text-red-600", bg: "bg-red-500/10", label: "يوتيوب" };
  if (u.includes("drive.google.com") || u.includes("docs.google.com"))
    return { icon: FileText, color: "text-blue-600", bg: "bg-blue-500/10", label: "Google Drive" };
  if (u.includes("zoom.us") || u.includes("meet.google.com") || u.includes("teams.microsoft.com"))
    return { icon: Video, color: "text-violet-600", bg: "bg-violet-500/10", label: "اجتماع" };
  if (u.includes("classroom.google.com") || u.includes("moodle"))
    return {
      icon: BookOpen,
      color: "text-amber-600",
      bg: "bg-amber-500/10",
      label: "منصة تعليمية",
    };
  return { icon: Link2, color: "text-primary", bg: "bg-primary/10", label: "رابط" };
}

export function isImageFile(name: string): boolean {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
}

export function humanFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
