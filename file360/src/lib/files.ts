import type { FileCategory } from "@/src/types";

export const LIMITS = {
  imageBytes: 25 * 1024 * 1024,
  imagePixels: 24_000_000,
  heicBytes: 20 * 1024 * 1024,
  batchCount: 100,
  batchBytes: 250 * 1024 * 1024,
  batchOutputBytes: 100 * 1024 * 1024,
  pdfBytes: 25 * 1024 * 1024,
  pdfPages: 100,
  pdfOutputBytes: 100 * 1024 * 1024,
  mediaBytes: 100 * 1024 * 1024,
  mediaSeconds: 5 * 60,
  archiveBytes: 100 * 1024 * 1024,
  archiveEntries: 500,
  extractedBytes: 250 * 1024 * 1024,
} as const;

const imageExtensions = new Set(["jpg", "jpeg", "png", "webp", "avif", "heic", "heif", "gif"]);
const mediaExtensions = new Set([
  "mp4", "m4v", "mov", "webm", "mkv", "ogg", "ogv", "mp3", "wav", "m4a", "aac", "flac", "opus", "ts",
]);
const archiveExtensions = new Set(["zip", "gz", "gzip"]);

export function extensionOf(name: string): string {
  const value = name.split(".").pop()?.toLowerCase() ?? "";
  return value === name.toLowerCase() ? "" : value;
}

export function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function categoryOf(file: File): FileCategory {
  const ext = extensionOf(file.name);
  if (file.type === "application/pdf" || ext === "pdf") return "pdf";
  if (file.type.startsWith("image/") || imageExtensions.has(ext)) return "image";
  if (file.type.startsWith("video/") || file.type.startsWith("audio/") || mediaExtensions.has(ext)) return "media";
  if (file.type === "application/zip" || file.type === "application/gzip" || archiveExtensions.has(ext)) return "archive";
  return "unknown";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function safeFilename(name: string, fallback = "arquivo"): string {
  const normalized = name
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 180);
  return normalized || fallback;
}

export function uniqueName(name: string, existing: Set<string>): string {
  const safe = safeFilename(name);
  if (!existing.has(safe.toLowerCase())) {
    existing.add(safe.toLowerCase());
    return safe;
  }
  const ext = extensionOf(safe);
  const stem = baseName(safe);
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${stem}-${index}${ext ? `.${ext}` : ""}`;
    if (!existing.has(candidate.toLowerCase())) {
      existing.add(candidate.toLowerCase());
      return candidate;
    }
  }
  throw new Error("Não foi possível criar um nome de arquivo único.");
}

export function assertWithin(value: number, limit: number, message: string): void {
  if (value > limit) throw new Error(message);
}

export function totalBytes(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}
