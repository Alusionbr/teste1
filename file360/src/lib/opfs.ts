type StorageManagerWithDirectory = StorageManager & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

export type PositionedChunk = {
  type: "write";
  data: Uint8Array<ArrayBuffer>;
  position: number;
};

export type TemporaryOutput = {
  writable: WritableStream<PositionedChunk>;
  getFile: () => Promise<File>;
  cleanup: () => Promise<void>;
};

const DIRECTORY_NAME = "file360-tmp";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type IterableDirectoryHandle = FileSystemDirectoryHandle & {
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

type WritableFile = {
  write: (chunk: PositionedChunk) => Promise<void>;
  close: () => Promise<void>;
  abort: (reason?: unknown) => Promise<void>;
};

function storageManager(): StorageManagerWithDirectory | null {
  if (typeof navigator === "undefined" || !navigator.storage) return null;
  return navigator.storage as StorageManagerWithDirectory;
}

export async function canUseExpandedMediaStorage(requiredBytes = 128 * 1024 * 1024): Promise<boolean> {
  const storage = storageManager();
  if (!storage?.getDirectory) return false;
  try {
    const estimate = await storage.estimate();
    if (estimate.quota == null || estimate.usage == null) return false;
    return estimate.quota - estimate.usage >= requiredBytes;
  } catch {
    return false;
  }
}

export async function createTemporaryOutput(extension: string, maxBytes: number): Promise<TemporaryOutput> {
  const storage = storageManager();
  if (!storage?.getDirectory) throw new Error("O navegador não oferece armazenamento temporário ampliado.");
  const root = await storage.getDirectory();
  const directory = await root.getDirectoryHandle(DIRECTORY_NAME, { create: true });
  return createTemporaryOutputInDirectory(directory, extension, maxBytes);
}

export async function createTemporaryOutputInDirectory(
  directory: FileSystemDirectoryHandle,
  extension: string,
  maxBytes: number,
): Promise<TemporaryOutput> {
  const now = Date.now();
  const iterableDirectory = directory as IterableDirectoryHandle;
  if (typeof iterableDirectory.entries === "function") {
    for await (const [entryName] of iterableDirectory.entries()) {
      const createdAt = Number(/^job-(\d+)-/.exec(entryName)?.[1]);
      if (Number.isFinite(createdAt) && now - createdAt > STALE_AFTER_MS) {
        await directory.removeEntry(entryName).catch(() => undefined);
      }
    }
  }
  const safeExtension = /^[a-z0-9]{2,5}$/i.test(extension) ? extension.toLowerCase() : "bin";
  const filename = `job-${now}-${crypto.randomUUID()}.${safeExtension}`;
  const handle = await directory.getFileHandle(filename, { create: true });
  const fileWritable = await handle.createWritable() as WritableFile;
  let largestEnd = 0;
  let writerSettled = false;
  let cleanupPromise: Promise<void> | null = null;

  const writable = new WritableStream<PositionedChunk>({
    async write(chunk) {
      largestEnd = Math.max(largestEnd, chunk.position + chunk.data.byteLength);
      if (largestEnd > maxBytes) {
        throw new Error(`O resultado ultrapassou o limite local de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      }
      await fileWritable.write(chunk);
    },
    async close() {
      if (writerSettled) return;
      try {
        await fileWritable.close();
      } catch (error) {
        await fileWritable.abort(error).catch(() => undefined);
        throw error;
      } finally {
        writerSettled = true;
      }
    },
    async abort(reason) {
      if (writerSettled) return;
      try {
        await fileWritable.abort(reason);
      } finally {
        writerSettled = true;
      }
    },
  });

  return {
    writable,
    getFile: () => handle.getFile(),
    cleanup: () => {
      cleanupPromise ??= (async () => {
        if (!writerSettled) {
          writerSettled = true;
          await fileWritable.abort(new DOMException("Saída temporária descartada.", "AbortError")).catch(() => undefined);
        }
        await directory.removeEntry(filename).catch(() => undefined);
      })();
      return cleanupPromise;
    },
  };
}
