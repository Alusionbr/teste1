import { artifactFromBlob } from "@/src/lib/download";
import { baseName, formatDuration, LIMITS, safeFilename } from "@/src/lib/files";
import type { Artifact, ProgressUpdate } from "@/src/types";

export type MediaFormat = "mp4" | "webm" | "mp3" | "wav" | "m4a";

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
};

export type MediaOptions = {
  format: MediaFormat;
  start: number;
  end: number;
  maxWidth: number;
  quality: "high" | "medium" | "low";
  removeAudio: boolean;
};

async function openInput(file: File) {
  const media = await import("mediabunny");
  const input = new media.Input({ source: new media.BlobSource(file), formats: media.ALL_FORMATS });
  return { media, input };
}

export async function inspectMedia(file: File): Promise<MediaInfo> {
  if (file.size > LIMITS.mediaBytes) throw new Error("A mídia excede o limite local de 100 MB.");
  const { input } = await openInput(file);
  try {
    const duration = await input.computeDuration();
    if (duration > LIMITS.mediaSeconds) throw new Error("A mídia excede o limite local de 5 minutos.");
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
    };
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
  const { media, input } = await openInput(file);
  let conversion: import("mediabunny").Conversion | undefined;
  try {
    const duration = await input.computeDuration();
    const start = Math.max(0, options.start || 0);
    const end = Math.min(duration, options.end > 0 ? options.end : duration);
    if (start >= end) throw new Error("O início precisa ser anterior ao fim.");

    let format;
    let mime: string;
    let extension: string;
    let video: Parameters<typeof media.Conversion.init>[0]["video"];
    let audio: Parameters<typeof media.Conversion.init>[0]["audio"];
    const quality = new media.Quality(options.quality);

    switch (options.format) {
      case "mp4":
        format = new media.Mp4OutputFormat({ fastStart: "in-memory" });
        mime = "video/mp4";
        extension = "mp4";
        video = { codec: "avc", quality, width: options.maxWidth || undefined, forceTranscode: true };
        audio = options.removeAudio ? { discard: true } : { codec: "aac", quality };
        break;
      case "webm":
        format = new media.WebMOutputFormat();
        mime = "video/webm";
        extension = "webm";
        video = { codec: "vp9", quality, width: options.maxWidth || undefined, forceTranscode: true };
        audio = options.removeAudio ? { discard: true } : { codec: "opus", quality };
        break;
      case "mp3": {
        if (!(await media.canEncodeAudio("mp3"))) {
          const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
          registerMp3Encoder();
        }
        format = new media.Mp3OutputFormat();
        mime = "audio/mpeg";
        extension = "mp3";
        video = { discard: true };
        audio = { codec: "mp3", quality, forceTranscode: true };
        break;
      }
      case "wav":
        format = new media.WavOutputFormat();
        mime = "audio/wav";
        extension = "wav";
        video = { discard: true };
        audio = { codec: "pcm-s16", sampleFormat: "s16", forceTranscode: true };
        break;
      case "m4a":
        format = new media.Mp4OutputFormat({ fastStart: "in-memory" });
        mime = "audio/mp4";
        extension = "m4a";
        video = { discard: true };
        audio = { codec: "aac", quality, forceTranscode: true };
        break;
    }

    const target = new media.BufferTarget();
    const output = new media.Output({ format, target });
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
    if (!target.buffer) throw new Error("A conversão terminou sem gerar um arquivo.");
    const blob = new Blob([target.buffer], { type: mime });
    if (blob.size > LIMITS.mediaBytes) throw new Error("O resultado excedeu o limite local de 100 MB.");
    const detail = `${formatDuration(end - start)} · ${conversion.discardedTracks.length ? "faixas secundárias ignoradas" : "faixas principais preservadas"}`;
    return artifactFromBlob(`${safeFilename(baseName(file.name))}.${extension}`, blob, detail);
  } finally {
    input.dispose();
  }
}
