import { BlobReader, BlobWriter, ZipReader, ZipWriter } from "@zip.js/zip.js";
import { artifactFromBlob } from "@/src/lib/download";
import { baseName, LIMITS, safeFilename, uniqueName } from "@/src/lib/files";
import { streamToBlobWithLimit } from "@/src/lib/streams";
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

export async function createZip(files: File[], onProgress?: (update: ProgressUpdate) => void, signal?: AbortSignal): Promise<Artifact> {
  if (files.length > LIMITS.archiveEntries) throw new Error("O ZIP aceita até 500 itens nesta versão.");
  if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.archiveBytes) {
    throw new Error("Os arquivos somados excedem o limite local de 100 MB.");
  }
  const writer = new ZipWriter(new BlobWriter("application/zip"));
  const names = new Set<string>();
  try {
    for (let index = 0; index < files.length; index += 1) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
      const file = files[index];
      const name = uniqueName(file.name, names);
      await writer.add(name, new BlobReader(file), { level: 6, signal });
      onProgress?.({ value: (index + 1) / files.length, label: `Compactando ${file.name}` });
    }
    const blob = await writer.close();
    if (blob.size > LIMITS.archiveBytes) throw new Error("O ZIP gerado ultrapassou o limite local de 100 MB.");
    return artifactFromBlob("file360-arquivos.zip", blob, `${files.length} itens`);
  } catch (error) {
    await writer.close().catch(() => undefined);
    throw error;
  }
}

export async function extractZip(file: File, onProgress?: (update: ProgressUpdate) => void, signal?: AbortSignal): Promise<Artifact[]> {
  if (file.size > LIMITS.archiveBytes) throw new Error("O ZIP excede o limite local de 100 MB.");
  const reader = new ZipReader(new BlobReader(file));
  try {
    const entries = await reader.getEntries();
    if (entries.length > LIMITS.archiveEntries) throw new Error("O ZIP contém mais de 500 itens.");
    const artifacts: Artifact[] = [];
    let extractedBytes = 0;
    const names = new Set<string>();
    for (let index = 0; index < entries.length; index += 1) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
      const entry = entries[index];
      if (entry.directory) continue;
      const safePath = safeArchivePath(entry.filename);
      if (!safePath) continue;
      if (entry.uncompressedSize > LIMITS.extractedBytes) throw new Error(`O item ${safePath} é grande demais para extração local.`);
      const remainingBytes = LIMITS.extractedBytes - extractedBytes;
      if (entry.uncompressedSize > remainingBytes) throw new Error("O conteúdo extraído ultrapassa 250 MB; possível arquivo-bomba.");
      const localAbort = new AbortController();
      const abortLocal = () => localAbort.abort(signal?.reason);
      signal?.addEventListener("abort", abortLocal, { once: true });
      let limitError: Error | undefined;
      let blob: Blob | undefined;
      try {
        blob = await entry.getData?.(new BlobWriter(), {
          signal: localAbort.signal,
          checkSignature: true,
          checkOverlappingEntry: true,
          onprogress: (writtenBytes: number) => {
            if (writtenBytes > remainingBytes && !localAbort.signal.aborted) {
              limitError = new Error("O conteúdo extraído ultrapassa 250 MB; possível arquivo-bomba.");
              localAbort.abort(limitError);
            }
          },
        }) as Blob | undefined;
      } catch (error) {
        throw limitError ?? error;
      } finally {
        signal?.removeEventListener("abort", abortLocal);
      }
      if (!blob) continue;
      extractedBytes += blob.size;
      if (extractedBytes > LIMITS.extractedBytes) throw new Error("O conteúdo extraído ultrapassa 250 MB; possível arquivo-bomba.");
      const finalName = uniqueName(safePath.replaceAll("/", "-"), names);
      artifacts.push(artifactFromBlob(finalName, blob));
      onProgress?.({ value: (index + 1) / entries.length, label: `Extraindo ${safePath}` });
    }
    return artifacts;
  } finally {
    await reader.close();
  }
}

export async function createGzip(file: File, signal?: AbortSignal): Promise<Artifact> {
  if (!("CompressionStream" in window)) throw new Error("Este navegador não oferece compactação GZIP nativa.");
  if (file.size > LIMITS.archiveBytes) throw new Error("O arquivo excede o limite local de 100 MB.");
  const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
  const blob = await streamToBlobWithLimit(stream, LIMITS.archiveBytes, signal, "application/gzip");
  return artifactFromBlob(`${safeFilename(file.name)}.gz`, blob);
}

export async function extractGzip(file: File, signal?: AbortSignal): Promise<Artifact> {
  if (!("DecompressionStream" in window)) throw new Error("Este navegador não oferece extração GZIP nativa.");
  if (file.size > LIMITS.archiveBytes) throw new Error("O GZIP excede o limite local de 100 MB.");
  const stream = file.stream().pipeThrough(new DecompressionStream("gzip"));
  const blob = await streamToBlobWithLimit(stream, LIMITS.extractedBytes, signal);
  return artifactFromBlob(safeFilename(baseName(file.name), "arquivo-extraido"), blob);
}
