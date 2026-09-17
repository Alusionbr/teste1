import { artifactFromBlob } from "@/src/lib/download";
import { baseName, formatDuration, LIMITS, safeFilename } from "@/src/lib/files";
import { fitMediaWithinLongEdge } from "@/src/lib/media-dimensions";
import { mediaLimitsForStorage } from "@/src/lib/media-limits";
import { canUseExpandedMediaStorage, createTemporaryOutput, type TemporaryOutput } from "@/src/lib/opfs";
import type { Artifact, ProgressUpdate } from "@/src/types";

export type MediaFormat = "mp4" | "webm" | "mp3" | "wav" | "m4a" | "gif";

export type MediaInfo = {
  duration: number;
  width?: number;
  height?: number;
  frameRate?: number;
  audioChannels?: number;
  sampleRate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  canDecodeVideo: boolean;
  canDecodeAudio: boolean;
  expandedStorage: boolean;
  maxBytes: number;
  maxSeconds: number;
};

export type MediaOptions = {
  format: MediaFormat;
  start: number;
  end: number;
  maxWidth: number;
  quality: "high" | "medium" | "low";
  removeAudio: boolean;
  gifFps?: number;
  gifColors?: number;
};

async function openInput(file: File) {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  return { media, input };
}

export async function inspectMedia(file: File): Promise<MediaInfo> {
  const expandedStorage = await canUseExpandedMediaStorage(LIMITS.mediaExtendedBytes);
  const limits = mediaLimitsForStorage(expandedStorage);
  if (file.size > limits.bytes) throw new Error(`A mídia excede o limite local de ${Math.round(limits.bytes / 1024 / 1024)} MB deste navegador.`);
  const { input } = await openInput(file);
  try {
    const duration = await input.computeDuration();
    if (duration > limits.seconds) throw new Error(`A mídia excede o limite local de ${Math.round(limits.seconds / 60)} minutos deste navegador.`);
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    const [width, height, metrics, audioChannels, sampleRate, canDecodeVideo, canDecodeAudio] = await Promise.all([
      video?.getDisplayWidth(),
      video?.getDisplayHeight(),
      video?.computeFrameRateMetrics(),
      audio?.getNumberOfChannels(),
      audio?.getSampleRate(),
      video ? video.canDecode() : Promise.resolve(false),
      audio ? audio.canDecode() : Promise.resolve(false),
    ]);
    return {
      duration,
      width,
      height,
      frameRate: metrics?.bestGuessFrameRate,
      audioChannels,
      sampleRate,
      hasVideo: Boolean(video),
      hasAudio: Boolean(audio),
      canDecodeVideo,
      canDecodeAudio,
      expandedStorage,
      maxBytes: limits.bytes,
      maxSeconds: limits.seconds,
    };
  } finally {
    input.dispose();
  }
}

async function convertVideoToGif(
  file: File,
  options: MediaOptions,
  signal: AbortSignal,
  onProgress: (update: ProgressUpdate) => void,
): Promise<Artifact> {
  if (file.size > LIMITS.gifInputBytes) throw new Error("Para GIF, use um vídeo de até 250 MB.");
  const { media, input } = await openInput(file);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Este arquivo não possui uma faixa de vídeo.");
    if (!(await track.canDecode())) throw new Error("O navegador não consegue decodificar o vídeo para criar o GIF.");
    const duration = await input.computeDuration();
    const start = Math.max(0, options.start || 0);
    const end = Math.min(duration, options.end > 0 ? options.end : duration);
    if (start >= end) throw new Error("O início precisa ser anterior ao fim.");
    if (end - start > LIMITS.gifSeconds) throw new Error(`O GIF aceita trechos de até ${LIMITS.gifSeconds} segundos.`);

    const fps = Math.max(4, Math.min(12, Math.round(options.gifFps ?? 8)));
    const colors = Math.max(32, Math.min(256, Math.round(options.gifColors ?? 128)));
    const [sourceWidth, sourceHeight] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);
    const dimensions = fitMediaWithinLongEdge(sourceWidth, sourceHeight, Math.min(options.maxWidth || 480, 720));
    const frameCount = Math.max(1, Math.ceil((end - start) * fps));
    const timestamps = Array.from({ length: frameCount }, (_, index) => Math.min(end - 0.001, start + index / fps));
    const sink = new media.CanvasSink(track, { ...dimensions, fit: "contain", poolSize: 2, alpha: false });
    const gifModule = await import("gifenc");
    // gifenc exposes named ESM exports in browsers and a CommonJS object in Node.
    // Normalize both shapes because Next resolves a different entry for each target.
    const commonJsApi = typeof gifModule.default === "object" ? gifModule.default : undefined;
    const GIFEncoder = gifModule.GIFEncoder ?? commonJsApi?.GIFEncoder ?? gifModule.default;
    const quantize = gifModule.quantize ?? commonJsApi?.quantize;
    const applyPalette = gifModule.applyPalette ?? commonJsApi?.applyPalette;
    if (typeof GIFEncoder !== "function" || typeof quantize !== "function" || typeof applyPalette !== "function") {
      throw new Error("O codificador de GIF não pôde ser carregado neste navegador.");
    }
    const gif = GIFEncoder({ initialCapacity: Math.min(LIMITS.gifOutputBytes, dimensions.width * dimensions.height) });
    let completed = 0;

    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      if (signal.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
      if (!wrapped) continue;
      const context = wrapped.canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("O navegador não conseguiu ler os frames do vídeo.");
      const rgba = context.getImageData(0, 0, dimensions.width, dimensions.height).data;
      const palette = quantize(rgba, colors, { format: "rgb444" });
      const indexed = applyPalette(rgba, palette, "rgb444");
      gif.writeFrame(indexed, dimensions.width, dimensions.height, {
        palette,
        delay: Math.round(1000 / fps),
        repeat: 0,
      });
      completed += 1;
      if (gif.bytesView().byteLength > LIMITS.gifOutputBytes) throw new Error("O GIF ultrapassou o limite local de 50 MB. Reduza duração, tamanho ou FPS.");
      onProgress({ value: completed / frameCount, label: `Criando GIF · frame ${completed} de ${frameCount}` });
      if (completed % 2 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    if (!completed) throw new Error("Nenhum frame pôde ser extraído desse trecho.");
    gif.finish();
    const bytes = gif.bytes();
    if (bytes.byteLength > LIMITS.gifOutputBytes) throw new Error("O GIF ultrapassou o limite local de 50 MB. Reduza duração, tamanho ou FPS.");
    const blob = new Blob([bytes], { type: "image/gif" });
    return artifactFromBlob(
      `${safeFilename(baseName(file.name))}.gif`,
      blob,
      `${formatDuration(end - start)} · ${dimensions.width} × ${dimensions.height} · ${fps} FPS`,
    );
  } finally {
    input.dispose();
  }
}

export async function getMediaCapabilities(): Promise<{ video: string[]; audio: string[] }> {
  const media = await import("mediabunny");
  const [video, audio] = await Promise.all([
    media.getEncodableVideoCodecs(["avc", "vp9", "vp8", "av1"]),
    media.getEncodableAudioCodecs(["aac", "opus", "mp3", "pcm-s16"]),
  ]);
  return { video, audio };
}

export async function convertMedia(
  file: File,
  options: MediaOptions,
  signal: AbortSignal,
  onProgress: (update: ProgressUpdate) => void,
): Promise<Artifact> {
  if (signal.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
  if (options.format === "gif") return convertVideoToGif(file, options, signal, onProgress);
  const expandedStorage = await canUseExpandedMediaStorage(LIMITS.mediaExtendedBytes);
  const limits = mediaLimitsForStorage(expandedStorage);
  if (file.size > limits.bytes) throw new Error(`A mídia excede o limite local de ${Math.round(limits.bytes / 1024 / 1024)} MB deste navegador.`);
  const { media, input } = await openInput(file);
  let conversion: import("mediabunny").Conversion | undefined;
  let temporary: TemporaryOutput | undefined;
  let keepTemporary = false;
  try {
    const duration = await input.computeDuration();
    if (duration > limits.seconds) throw new Error(`A mídia excede o limite local de ${Math.round(limits.seconds / 60)} minutos deste navegador.`);
    if (signal.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
    const start = Math.max(0, options.start || 0);
    const end = Math.min(duration, options.end > 0 ? options.end : duration);
    if (start >= end) throw new Error("O início precisa ser anterior ao fim.");

    let format;
    let mime: string;
    let video: Parameters<typeof media.Conversion.init>[0]["video"];
    let audio: Parameters<typeof media.Conversion.init>[0]["audio"];
    const quality = new media.Quality(options.quality);
    const primaryVideo = await input.getPrimaryVideoTrack();
    let targetDimensions: { width: number; height: number } | undefined;
    if (primaryVideo && options.maxWidth > 0) {
      const [sourceWidth, sourceHeight] = await Promise.all([
        primaryVideo.getDisplayWidth(),
        primaryVideo.getDisplayHeight(),
      ]);
      targetDimensions = fitMediaWithinLongEdge(sourceWidth, sourceHeight, options.maxWidth);
    }

    const extension = options.format;
    if (expandedStorage) {
      try {
        temporary = await createTemporaryOutput(extension, limits.bytes);
      } catch (error) {
        if (file.size > LIMITS.mediaBytes) throw error;
      }
    }
    const streaming = Boolean(temporary);

    switch (options.format) {
      case "mp4":
        format = new media.Mp4OutputFormat({ fastStart: streaming ? false : "in-memory" });
        mime = "video/mp4";
        video = { codec: "avc", quality, ...targetDimensions, fit: "contain" };
        audio = options.removeAudio ? { discard: true } : { codec: "aac", quality };
        break;
      case "webm":
        format = new media.WebMOutputFormat();
        mime = "video/webm";
        video = { codec: "vp9", quality, ...targetDimensions, fit: "contain" };
        audio = options.removeAudio ? { discard: true } : { codec: "opus", quality };
        break;
      case "mp3": {
        if (!(await media.canEncodeAudio("mp3"))) {
          const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
          registerMp3Encoder();
        }
        format = new media.Mp3OutputFormat();
        mime = "audio/mpeg";
        video = { discard: true };
        audio = { codec: "mp3", quality, forceTranscode: true };
        break;
      }
      case "wav":
        format = new media.WavOutputFormat();
        mime = "audio/wav";
        video = { discard: true };
        audio = { codec: "pcm-s16", sampleFormat: "s16", forceTranscode: true };
        break;
      case "m4a":
        format = new media.Mp4OutputFormat({ fastStart: streaming ? false : "in-memory" });
        mime = "audio/mp4";
        video = { discard: true };
        audio = { codec: "aac", quality, forceTranscode: true };
        break;
    }

    const target = temporary
      ? new media.StreamTarget(temporary.writable as WritableStream<import("mediabunny").StreamTargetChunk>, { chunked: true, chunkSize: 1024 * 1024 })
      : new media.BufferTarget();
    const output = new media.Output({ format, target });
    if (signal.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
    conversion = await media.Conversion.init({
      input,
      output,
      tracks: "primary",
      video,
      audio,
      trim: { start, end },
      copy: false,
      tags: {},
      showWarnings: false,
    });
    if (signal.aborted) {
      await conversion.cancel();
      throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
    }
    if (!conversion.isValid) {
      throw new Error("O dispositivo não consegue combinar os codecs necessários para essa saída.");
    }
    conversion.onProgress = (value: number) => onProgress({ value, label: `Processando ${Math.round(value * 100)}%` });
    const abort = () => void conversion?.cancel();
    signal.addEventListener("abort", abort, { once: true });
    try {
      await conversion.execute();
    } finally {
      signal.removeEventListener("abort", abort);
    }
    const blob = temporary
      ? await temporary.getFile()
      : target instanceof media.BufferTarget && target.buffer
        ? new Blob([target.buffer], { type: mime })
        : null;
    if (!blob) throw new Error("A conversão terminou sem gerar um arquivo.");
    if (blob.size > limits.bytes) throw new Error(`O resultado excedeu o limite local de ${Math.round(limits.bytes / 1024 / 1024)} MB.`);
    const sizeDetail = targetDimensions && (options.format === "mp4" || options.format === "webm") ? ` · ${targetDimensions.width} × ${targetDimensions.height}` : "";
    const detail = `${formatDuration(end - start)}${sizeDetail} · ${conversion.discardedTracks.length ? "faixas secundárias ignoradas" : "faixas principais preservadas"}`;
    keepTemporary = Boolean(temporary);
    return artifactFromBlob(`${safeFilename(baseName(file.name))}.${extension}`, blob, detail, temporary?.cleanup);
  } finally {
    if (temporary && !keepTemporary) await temporary.cleanup();
    input.dispose();
  }
}
