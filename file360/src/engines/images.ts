import { artifactFromBlob } from "@/src/lib/download";
import { baseName, extensionOf, LIMITS, safeFilename } from "@/src/lib/files";
import type { Artifact, ProgressUpdate } from "@/src/types";

export type ImageFormat = "jpeg" | "png" | "webp";

export type ImageOptions = {
  format: ImageFormat;
  maxEdge: number;
  quality: number;
  rotate: 0 | 90 | 180 | 270;
  cropAspect?: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  background: string;
};

const mimeByFormat: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const extensionByFormat: Record<ImageFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

async function decodeImage(file: File): Promise<ImageBitmap> {
  const ext = extensionOf(file.name);
  if (ext === "heic" || ext === "heif" || file.type === "image/heic" || file.type === "image/heif") {
    if (file.size > LIMITS.heicBytes) throw new Error("HEIC acima de 20 MB não é processado localmente nesta versão.");
    const { heicTo } = await import("heic-to");
    const result = await heicTo({ blob: file, type: "bitmap" });
    if (!(result instanceof ImageBitmap)) throw new Error("O decoder HEIC não retornou uma imagem utilizável.");
    return result;
  }
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("O navegador não conseguiu gerar a imagem."))),
      mime,
      quality,
    );
  });
}

export async function transformImage(file: File, options: ImageOptions): Promise<Artifact> {
  if (file.size > LIMITS.imageBytes) throw new Error("A imagem excede o limite local de 25 MB.");
  const bitmap = await decodeImage(file);
  try {
    const pixels = bitmap.width * bitmap.height;
    if (pixels > LIMITS.imagePixels) throw new Error("A imagem excede 24 megapixels e pode esgotar a memória do dispositivo.");

    const cropAspect = options.cropAspect && Number.isFinite(options.cropAspect) && options.cropAspect > 0 ? options.cropAspect : undefined;
    let cropWidth = bitmap.width;
    let cropHeight = bitmap.height;
    let cropX = 0;
    let cropY = 0;
    if (cropAspect) {
      const sourceAspect = bitmap.width / bitmap.height;
      if (sourceAspect > cropAspect) {
        cropWidth = Math.round(bitmap.height * cropAspect);
        cropX = Math.floor((bitmap.width - cropWidth) / 2);
      } else {
        cropHeight = Math.round(bitmap.width / cropAspect);
        cropY = Math.floor((bitmap.height - cropHeight) / 2);
      }
    }
    const rotated = options.rotate === 90 || options.rotate === 270;
    const sourceWidth = rotated ? cropHeight : cropWidth;
    const sourceHeight = rotated ? cropWidth : cropHeight;
    const scale = Math.min(1, options.maxEdge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: options.format !== "jpeg" });
    if (!context) throw new Error("Canvas 2D não está disponível neste navegador.");

    if (options.format === "jpeg") {
      context.fillStyle = options.background;
      context.fillRect(0, 0, width, height);
    }

    context.translate(width / 2, height / 2);
    context.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
    context.rotate((options.rotate * Math.PI) / 180);
    const drawWidth = rotated ? height : width;
    const drawHeight = rotated ? width : height;
    context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    const requestedMime = mimeByFormat[options.format];
    const blob = await canvasToBlob(canvas, requestedMime, options.quality / 100);
    if (blob.type !== requestedMime) {
      throw new Error(`Este navegador não consegue exportar ${options.format.toUpperCase()} localmente.`);
    }
    const name = `${safeFilename(baseName(file.name))}.${extensionByFormat[options.format]}`;
    return artifactFromBlob(name, blob, `${width} × ${height}`);
  } finally {
    bitmap.close();
  }
}

export async function transformImageBatch(
  files: File[],
  options: ImageOptions,
  signal: AbortSignal,
  onProgress: (update: ProgressUpdate) => void,
): Promise<{ artifacts: Artifact[]; errors: string[] }> {
  if (files.length > LIMITS.batchCount) throw new Error("O lote aceita até 100 imagens.");
  const inputBytes = files.reduce((total, file) => total + file.size, 0);
  if (inputBytes > LIMITS.batchBytes) throw new Error("O lote excede o limite local de 250 MB.");
  const artifacts: Artifact[] = [];
  const errors: string[] = [];
  let outputBytes = 0;

  for (let index = 0; index < files.length; index += 1) {
    if (signal.aborted) throw new DOMException("Processamento cancelado.", "AbortError");
    const file = files[index];
    onProgress({ value: index / files.length, label: `Processando ${index + 1} de ${files.length}: ${file.name}` });
    try {
      const artifact = await transformImage(file, options);
      outputBytes += artifact.blob.size;
      if (outputBytes > LIMITS.batchOutputBytes) {
        throw new Error("Os resultados ultrapassaram o limite acumulado de 100 MB.");
      }
      artifacts.push(artifact);
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "falha desconhecida"}`);
    }
  }
  onProgress({ value: 1, label: `${artifacts.length} imagem(ns) concluída(s)` });
  return { artifacts, errors };
}

export async function imageForPdf(file: File): Promise<{ bytes: Uint8Array; mime: "image/jpeg" | "image/png" }> {
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime: "image/jpeg" };
  }
  if (file.type === "image/png" || /\.png$/i.test(file.name)) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime: "image/png" };
  }
  const artifact = await transformImage(file, {
    format: "jpeg",
    maxEdge: 5000,
    quality: 92,
    rotate: 0,
    flipHorizontal: false,
    flipVertical: false,
    background: "#ffffff",
  });
  return { bytes: new Uint8Array(await artifact.blob.arrayBuffer()), mime: "image/jpeg" };
}
