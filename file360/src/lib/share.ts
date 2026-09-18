export type ShareResult = "shared" | "cancelled" | "unavailable";

type FileShareNavigator = {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
};

function currentNavigator(): FileShareNavigator | null {
  return typeof navigator === "undefined" ? null : navigator;
}

export function canShareFiles(files: File[], target: FileShareNavigator | null = currentNavigator()): boolean {
  if (!target?.share || !target.canShare || files.length === 0) return false;
  try {
    return target.canShare({ files });
  } catch {
    return false;
  }
}

export function isShareCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function shareFiles(files: File[], target: FileShareNavigator | null = currentNavigator()): Promise<ShareResult> {
  if (!canShareFiles(files, target)) return "unavailable";
  try {
    // O share nasce no clique do usuário; não há upload ou preparo assíncrono antes desta chamada.
    await target!.share!({ files });
    return "shared";
  } catch (error) {
    if (isShareCancellation(error)) return "cancelled";
    throw error;
  }
}

