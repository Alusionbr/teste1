"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { convertMedia, getMediaCapabilities, inspectMedia, type MediaFormat, type MediaInfo } from "@/src/engines/media";
import { formatDuration } from "@/src/lib/files";
import { fitMediaWithinLongEdge } from "@/src/lib/media-dimensions";
import type { Artifact, ProgressUpdate } from "@/src/types";

export function MediaStudio({ file, initialFormat, initialOperation, onReset }: { file: File; initialFormat?: string; initialOperation?: string; onReset: () => void }) {
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [capabilities, setCapabilities] = useState<{ video: string[]; audio: string[] } | null>(null);
  const allowedFormat = initialFormat === "mp4" || initialFormat === "webm" || initialFormat === "mp3" || initialFormat === "wav" || initialFormat === "m4a" || initialFormat === "gif" ? initialFormat : undefined;
  const [format, setFormat] = useState<MediaFormat>(allowedFormat ?? (file.type.startsWith("audio/") ? "mp3" : "mp4"));
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [quality, setQuality] = useState<"high" | "medium" | "low">("medium");
  const [removeAudio, setRemoveAudio] = useState(initialOperation === "remove-audio");
  const [gifMaxEdge, setGifMaxEdge] = useState(480);
  const [gifFps, setGifFps] = useState(8);
  const [gifColors, setGifColors] = useState(128);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const preview = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    inspectMedia(file).then((value) => { setInfo(value); setEnd(Number(Math.min(value.duration, allowedFormat === "gif" ? 12 : value.duration).toFixed(2))); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Mídia incompatível."));
    getMediaCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
    return () => { controller.current?.abort(); URL.revokeObjectURL(preview); };
  }, [allowedFormat, file, preview]);

  const run = async () => {
    const abort = new AbortController(); controller.current = abort; setError(""); setProgress({ value: null, label: "Carregando motor de mídia" });
    try { setArtifact(await convertMedia(file, { format, start, end, maxWidth: format === "gif" ? gifMaxEdge : maxWidth, quality, removeAudio, gifFps, gifColors }, abort.signal, setProgress)); }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Não foi possível converter a mídia."); }
    finally { setProgress(null); controller.current = null; }
  };

  if (artifact) return <ResultPanel artifacts={[artifact]} onAdjust={() => setArtifact(null)} onReset={onReset} />;
  const duration = info?.duration ?? 1;
  const range = info ? Math.max(0, Math.min(1, (end - start) / duration)) : 1;
  const outputHint = capabilities ? `Saídas detectadas: ${[capabilities.video.includes("avc") && "MP4", capabilities.video.includes("vp9") && "WebM", capabilities.audio.includes("mp3") && "MP3", info?.hasVideo && info.canDecodeVideo && "GIF"].filter(Boolean).join(" · ") || "modo compatível"}.` : "As opções são confirmadas pelo navegador ao iniciar.";
  const targetDimensions = info?.width && info.height ? fitMediaWithinLongEdge(info.width, info.height, format === "gif" ? gifMaxEdge : maxWidth) : null;
  const selectFormat = (next: MediaFormat) => {
    setFormat(next);
    if (next === "gif" && end - start > 12) setEnd(Math.min(duration, start + 12));
  };
  return (
    <section className="editor-grid">
      <div className="preview-panel media-preview">
        {info?.hasVideo ? <video src={preview} controls playsInline preload="metadata" /> : <audio src={preview} controls preload="metadata" />}
        {info && <div className="media-facts"><span>{formatDuration(info.duration)}</span>{info.width && <span>{info.width} × {info.height}</span>}<span>{info.canDecodeVideo || info.canDecodeAudio ? "Compatível" : "Conversão limitada"}</span></div>}
      </div>
      <div className="controls-panel">
        <div className="control-heading"><div><p className="section-kicker">Vídeo e áudio</p><h3>{info ? "Escolha o resultado" : "Lendo codecs"}</h3></div><span>{info ? format === "gif" ? `Entrada até ${Math.min(250, Math.round(info.maxBytes / 1024 / 1024))} MB · trecho de 12 s` : `Até ${Math.round(info.maxBytes / 1024 / 1024)} MB · ${Math.round(info.maxSeconds / 60)} min` : "Verificando armazenamento"}</span></div>
        {info?.expandedStorage && format !== "gif" && <div className="note-box"><strong>Modo ampliado disponível</strong><p>O resultado é gravado temporariamente no armazenamento privado do navegador para reduzir o uso de memória. Se esse espaço falhar, valem novamente os limites básicos.</p></div>}
        <label className="field"><span>Formato de saída</span><select value={format} onChange={(event) => selectFormat(event.target.value as MediaFormat)}>{info?.hasVideo && <><option value="mp4">MP4 — máxima compatibilidade</option><option value="webm">WebM — web moderno</option><option value="gif">GIF animado — trecho curto</option></>}<option value="mp3">MP3 — somente áudio</option><option value="m4a">M4A — áudio compacto</option><option value="wav">WAV — áudio sem compressão</option></select></label>
        <div className="field-pair"><label className="field"><span>Início (segundos)</span><input type="number" min="0" step="0.01" value={start} onChange={(event) => setStart(Number(event.target.value))} /></label><label className="field"><span>Fim</span><input type="number" min="0" step="0.01" value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label></div>
        <div className="timeline" aria-label="Intervalo selecionado"><span style={{ left: `${Math.max(0, Math.min(100, start / duration * 100))}%`, width: `${Math.max(1, range * 100)}%` }} /></div>
        <div className="timeline-inputs"><label><span>Início</span><input type="range" min="0" max={duration} step="0.01" value={Math.min(start, duration)} onChange={(event) => setStart(Math.min(Number(event.target.value), Math.max(0, end - 0.01)))} /></label><label><span>Fim</span><input type="range" min="0.01" max={duration} step="0.01" value={Math.min(Math.max(end, start + 0.01), duration)} onChange={(event) => setEnd(Math.max(Number(event.target.value), start + 0.01))} /></label></div>
        {(format === "mp4" || format === "webm") && <><label className="field"><span>Maior lado do vídeo</span><select value={maxWidth} onChange={(event) => setMaxWidth(Number(event.target.value))}><option value="854">Até 854 px</option><option value="1280">Até 1280 px</option><option value="1920">Até 1920 px</option><option value="2560">Até 2560 px</option><option value="3840">Até 3840 px (exigente)</option></select>{targetDimensions && <small>Saída prevista: {targetDimensions.width} × {targetDimensions.height}. Vídeos menores não são ampliados.</small>}</label><label className="check-row"><input type="checkbox" checked={removeAudio} onChange={(event) => setRemoveAudio(event.target.checked)} /><span>Remover áudio</span></label></>}
        {format === "gif" && <><div className="field-pair"><label className="field"><span>Maior lado</span><select value={gifMaxEdge} onChange={(event) => setGifMaxEdge(Number(event.target.value))}><option value="360">360 px</option><option value="480">480 px</option><option value="640">640 px</option><option value="720">720 px</option></select></label><label className="field"><span>Frames por segundo</span><select value={gifFps} onChange={(event) => setGifFps(Number(event.target.value))}><option value="5">5 FPS · leve</option><option value="8">8 FPS · equilibrado</option><option value="10">10 FPS</option><option value="12">12 FPS · exigente</option></select></label></div><label className="field"><span>Cores</span><select value={gifColors} onChange={(event) => setGifColors(Number(event.target.value))}><option value="64">64 · menor</option><option value="128">128 · equilibrado</option><option value="256">256 · melhor gradação</option></select>{targetDimensions && <small>Saída prevista: {targetDimensions.width} × {targetDimensions.height}. Entrada de até {Math.min(250, Math.round((info?.maxBytes ?? 0) / 1024 / 1024))} MB neste navegador, trecho máximo de 12 segundos e saída de 50 MB.</small>}</label></>}
        {format !== "gif" && <label className="field"><span>Qualidade</span><select value={quality} onChange={(event) => setQuality(event.target.value as "high" | "medium" | "low")}><option value="high">Alta qualidade</option><option value="medium">Equilibrado</option><option value="low">Menor arquivo</option></select></label>}
        <p className="capability-note">{outputHint}</p>
        {error && <div className="error-box" role="alert"><strong>Este arquivo precisa de atenção</strong><p>{error}</p></div>}
        {progress ? <ProgressPanel progress={progress} onCancel={() => controller.current?.abort()} /> : <button className="button primary wide" disabled={!info} onClick={run}>{format === "gif" ? "Criar GIF" : "Converter arquivo"}</button>}
      </div>
    </section>
  );
}

