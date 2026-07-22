export function parseTitleAndNote(rawTitle: string): { title: string; note: string | null } {
  if (rawTitle && rawTitle.includes("|||")) {
    const parts = rawTitle.split("|||");
    return { title: parts[0].trim(), note: parts.slice(1).join("|||").trim() };
  }
  return { title: rawTitle || "", note: null };
}

export function formatTitleAndNote(title: string, note?: string | null): string {
  const cleanTitle = title.trim();
  const cleanNote = note?.trim();
  if (cleanNote) {
    return `${cleanTitle}|||${cleanNote}`;
  }
  return cleanTitle;
}

export function getFileTypeInfo(filenameOrUrl: string, linkType: string | null) {
  if (linkType !== "file") {
    return { type: "link", label: "رابط خارجي", color: "amber", isVideo: false };
  }

  const ext = filenameOrUrl.split(".").pop()?.toLowerCase() || "";

  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) {
    return { type: "video", label: "فيديو دراسي", color: "purple", isVideo: true };
  }
  if (["pdf"].includes(ext)) {
    return { type: "pdf", label: "ملف PDF", color: "red", isVideo: false };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return { type: "ppt", label: "عرض تقديمي", color: "orange", isVideo: false };
  }
  if (["doc", "docx"].includes(ext)) {
    return { type: "doc", label: "مستند Word", color: "blue", isVideo: false };
  }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return { type: "image", label: "صورة", color: "emerald", isVideo: false };
  }

  return { type: "file", label: "ملف مرفق", color: "slate", isVideo: false };
}
