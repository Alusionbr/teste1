import { BlobReader, BlobWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import { artifactFromBlob } from "@/src/lib/download";
import { baseName, LIMITS, safeFilename, uniqueName } from "@/src/lib/files";
import type { Artifact, ProgressUpdate } from "@/src/types";

function safeArchivePath(name: string): string {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.split("/").some((part) => part === "..")) {
    throw new Error(`Caminho inseguro no arquivo compactado: ${name}`);
  }
  return normalized
    .split("/")
    .filter((part) => part && part !== ".")
    .map((part) => safeFilename(part))
    .join("/");
}

export async function createZip(files: File[], onProgress?: (update: ProgressUpdate) => void): Promise<Artifact> {
  if (files.length > LIMITS.archiveEntries) throw new Error("O ZIP aceita até 500 itens nesta versão.");
  if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.archiveBytes) {
    throw new Error("Os arquivos somados excedem o limite local de 100 MB.");
  }
  const writer = new ZipWriter(new BlobWriter("application/zip"));
  const names = new Set<string>();
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const name = uniqueName(file.name, names);
      await writer.add(name, new BlobReader(file), { level: 6 });
      onProgress?.({ value: (index + 1) / files.length, label: `Compactando ${file.name}` });
    }
    const blob = await writer.close();
    return artifactFromBlob("file360-arquivos.zip", blob, `${files.length} itens`);
  } catch (error) {
    await writer.close().catch(() => undefined);
    throw error;
  }
}

export async function extractZip(file: File, onProgress?: (update: ProgressUpdate) => void): Promise<Artifact[]> {
  if (file.size > LIMITS.archiveBytes) throw new Error("O ZIP excede o limite local de 100 MB.");
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = await reader.getEntries();
    if (entries.length > LIMITS.archiveEntries) throw new Error("O ZIP contém mais de 500 itens.");
    const artifacts: Artifact[] = [];
    let extractedBytes = 0;
    const names = new Set<string>();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry.directory) continue;
      const safePath = safeArchivePath(entry.filename);
      if (!safePath) continue;
      if (entry.uncompressedSize > LIMITS.extractedBytes) throw new Error(`O item ${safePath} é grande demais para extração local.`);
      extractedBytes += entry.uncompressedSize;
      if (extractedBytes > LIMITS.extractedBytes) throw new Error("O conteúdo extraído ultrapassa 250 MB; possível arquivo-bomba.");
      const blob = await entry.getData?.(new BlobWriter()) as Blob | undefined;
      if (!blob) continue;
      const finalName = uniqueName(safePath.replaceAll("/", "-"), names);
      artifacts.push(artifactFromBlob(finalName, blob));
      onProgress?.({ value: (index + 1) / entries.length, label: `Extraindo ${safePath}` });
    }
    return artifacts;
  } finally {
    await reader.close();
  }
}

export async function createGzip(file: File): Promise<Artifact> {
  if (!("CompressionStream" in window)) throw new Error("Este navegador não oferece compactação GZIP nativa.");
  const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
  const blob = await new Response(stream).blob();
  return artifactFromBlob(`${safeFilename(file.name)}.gz`, new Blob([blob], { type: "application/gzip" }));
}

export async function extractGzip(file: File): Promise<Artifact> {
  if (!("DecompressionStream" in window)) throw new Error("Este navegador não oferece extração GZIP nativa.");
  const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
  const blob = await new Response(stream).blob();
  return artifactFromBlob(safeFilename(baseName(file.name), "arquivo-extraido"), blob);
}
