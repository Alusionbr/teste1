import type { Artifact } from "@/src/types";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function artifactFromBlob(name: string, blob: Blob, detail?: string): Artifact {
  return { id: crypto.randomUUID(), name, blob, detail };
}
