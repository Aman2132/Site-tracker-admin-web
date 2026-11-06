
import type { SitePhoto } from "@/types/domain";

/**
 * Sanitizes a string for use in a filename or folder name across Windows, Mac and Linux.
 */
export function sanitizeName(name: string, fallback = "unnamed"): string {
  const clean = name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return clean || fallback;
}

/**
 * Generates a sortable filename like:
 * `2026-11-05_103000_Foundation_Inspection_a1b2c3.jpg`
 */
export function generatePhotoFilename(photo: SitePhoto): string {
  const d = new Date(photo.takenAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const taskPart = sanitizeName(photo.task || "photo", "photo");
  const shortId = photo.id.slice(0, 6);
  const ext = photo.mediaType === "video" ? "mp4" : "jpg";
  return `${dateStr}_${taskPart}_${shortId}.${ext}`;
}

/**
 * Triggers an immediate browser download of an individual photo or video file.
 */
export async function downloadPhotoFile(photo: SitePhoto, customFilename?: string): Promise<void> {
  const filename = customFilename || generatePhotoFilename(photo);
  const response = await fetch(photo.fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file (${response.status}): ${response.statusText}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

