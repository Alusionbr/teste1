"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { convertMedia, getMediaCapabilities, inspectMedia, type MediaFormat, type MediaInfo } from "@/src/engines/media";
import { formatDuration } from "@/src/lib/files";
import type { Artifact, ProgressUpdate } from "@/src/types";

export function MediaStudio({ file, onReset }: { file: File; onReset: () => void }) {
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [capabilities, setCapabilities] = useState<{ video: string[]; audio: string[] } | null>(null);
  const [format, setFormat] = useState<MediaFormat>(file.type.startsWith("audio/") ? "mp3" : "mp4");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [maxWidth, setMaxWidth] = useState(1920);
  const [quality, setQuality] = useState<"high" | "medium" | "low">("medium");
  const [removeAudio, setRemoveAudio] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const preview = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    inspectMedia(file).then((value) => { setInfo(value); setEnd(Number(value.duration.toFixed(2))); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Mídia incompatível."));
    getMediaCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
    return () => URL.revokeObjectURL(preview);
  }, [file, preview]);

  const run = async () => {
    const abort = new AbortController(); controller.current = abort; setError(""); setProgress({ value: null, label: "Carregando motor de mídia" });
    try { setArtifact(await convertMedia(file, { format, start, end, maxWidth, quality, removeAudio }, abort.signal, setProgress)); }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Não foi possível converter a mídia."); }
    finally { setProgress(null); controller.current = null; }
  };

  if (artifact) return <ResultPanel artifacts={[artifact]} onReset={onReset} />;
  const duration = info?.duration ?? 1;
  const range = info ? Math.max(0, Math.min(1, (end - start) / duration)) : 1;
  const outputHint = capabilities ? `Saídas detectadas: ${[capabilities.video.includes("avc") && "MP4", capabilities.video.includes("vp9") && "WebM", capabilities.audio.includes("mp3") && "MP3"].filter(Boolean).join(" · ") || "modo compatível"}.` : "As opções são confirmadas pelo navegador ao iniciar.";
  return (
    <section className="editor-grid">
      <div className="preview-panel media-preview">
        {info?.hasVideo ? <video src={preview} controls playsInline preload="metadata" /> : <audio src={preview} controls preload="metadata" />}
        {info && <div className="media-facts"><span>{formatDuration(info.duration)}</span>{info.width && <span>{info.width} × {info.height}</span>}<span>{info.canDecodeVideo || info.canDecodeAudio ? "Compatível" : "Conversão limitada"}</span></div>}
      </div>
      <div className="controls-panel">
        <div className="control-heading"><div><p className="section-kicker">Vídeo e áudio</p><h3>{info ? "Escolha o resultado" : "Lendo codecs"}</h3></div><span>Até 100 MB · 5 min</span></div>
        <label className="field"><span>Formato de saída</span><select value={format} onChange={(event) => setFormat(event.target.value as MediaFormat)}>{info?.hasVideo && <><option value="mp4">MP4 — máxima compatibilidade</option><option value="webm">WebM — web moderno</option></>}<option value="mp3">MP3 — somente áudio</option><option value="m4a">M4A — áudio compacto</option><option value="wav">WAV — áudio sem compressão</option></select></label>
        <div className="field-pair"><label className="field"><span>Início (segundos)</span><input type="number" min="0" step="0.01" value={start} onChange={(event) => setStart(Number(event.target.value))} /></label><label className="field"><span>Fim</span><input type="number" min="0" step="0.01" value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label></div>
        <div className="timeline" aria-label="Intervalo selecionado"><span style={{ left: `${Math.max(0, Math.min(100, start / duration * 100))}%`, width: `${Math.max(1, range * 100)}%` }} /></div>
        <div className="timeline-inputs"><label><span>Início</span><input type="range" min="0" max={duration} step="0.01" value={Math.min(start, duration)} onChange={(event) => setStart(Math.min(Number(event.target.value), Math.max(0, end - 0.01)))} /></label><label><span>Fim</span><input type="range" min="0.01" max={duration} step="0.01" value={Math.min(Math.max(end, start + 0.01), duration)} onChange={(event) => setEnd(Math.max(Number(event.target.value), start + 0.01))} /></label></div>
        {(format === "mp4" || format === "webm") && <><label className="field"><span>Resolução máxima</span><select value={maxWidth} onChange={(event) => setMaxWidth(Number(event.target.value))}><option value="854">480p</option><option value="1280">720p</option><option value="1920">1080p</option><option value="2560">1440p</option><option value="3840">4K (exigente)</option></select></label><label className="check-row"><input type="checkbox" checked={removeAudio} onChange={(event) => setRemoveAudio(event.target.checked)} /><span>Remover áudio</span></label></>}
        <label className="field"><span>Qualidade</span><select value={quality} onChange={(event) => setQuality(event.target.value as "high" | "medium" | "low")}><option value="high">Alta qualidade</option><option value="medium">Equilibrado</option><option value="low">Menor arquivo</option></select></label>
        <p className="capability-note">{outputHint}</p>
        {error && <div className="error-box" role="alert"><strong>Este arquivo precisa de atenção</strong><p>{error}</p></div>}
        {progress ? <ProgressPanel progress={progress} onCancel={() => controller.current?.abort()} /> : <button className="button primary wide" disabled={!info} onClick={run}>Converter arquivo</button>}
      </div>
    </section>
  );
}

