const DOCUMENT_EXTENSIONS = new Set(["pdf", "ppt", "pptx", "doc", "docx", "zip", "png", "jpg", "jpeg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv"]);

export function validateCourseFile(file: Pick<File, "name" | "size">): string {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const video = VIDEO_EXTENSIONS.has(extension);
  if (!video && !DOCUMENT_EXTENSIONS.has(extension)) throw new Error("نوع الملف غير مدعوم");
  const limit = (video ? 100 : 25) * 1024 * 1024;
  if (file.size > limit) throw new Error(`حجم الملف يتجاوز الحد المسموح (${video ? "100MB" : "25MB"})`);
  return extension;
}

export function courseFilePath(courseId: string, file: Pick<File, "name" | "size">): string {
  const extension = validateCourseFile(file);
  return `${courseId}/${crypto.randomUUID()}.${extension}`;
}

/** A file is successful only when both the object and its material row exist. */
export async function persistCourseFile(actions: {
  upload: () => Promise<void>;
  save: () => Promise<void>;
  remove: () => Promise<void>;
}): Promise<void> {
  await actions.upload();
  try {
    await actions.save();
  } catch (error) {
    try { await actions.remove(); } catch { /* Preserve the original save error. */ }
    throw error;
  }
}