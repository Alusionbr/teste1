"use client";

import { useMemo, useRef, useState } from "react";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { transformImageBatch, type ImageFormat, type ImageOptions } from "@/src/engines/images";
import type { Artifact, ProgressUpdate } from "@/src/types";

export function ImageStudio({ files, onReset }: { files: File[]; onReset: () => void }) {
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [maxEdge, setMaxEdge] = useState(1920);
  const [quality, setQuality] = useState(82);
  const [rotate, setRotate] = useState<ImageOptions["rotate"]>(0);
  const [crop, setCrop] = useState("none");
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const controller = useRef<AbortController | null>(null);
  const preview = useMemo(() => URL.createObjectURL(files[0]), [files]);

  const run = async () => {
    const abort = new AbortController();
    controller.current = abort;
    setErrors([]); setArtifacts([]); setProgress({ value: 0, label: "Preparando imagens" });
    try {
      const cropAspect = crop === "square" ? 1 : crop === "portrait" ? 4 / 5 : crop === "landscape" ? 16 / 9 : undefined;
      const result = await transformImageBatch(files, { format, maxEdge, quality, rotate, cropAspect, flipHorizontal, flipVertical: false, background: "#ffffff" }, abort.signal, setProgress);
      setArtifacts(result.artifacts); setErrors(result.errors);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setErrors([error instanceof Error ? error.message : "Não foi possível processar as imagens."]);
    } finally { setProgress(null); controller.current = null; }
  };

  if (artifacts.length) return <ResultPanel artifacts={artifacts} onReset={onReset} />;
  return (
    <section className="editor-grid">
      <div className="preview-panel image-preview">
        {/* Blob local: next/image não otimiza nem deve enviar esta prévia. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={`Prévia de ${files[0].name}`} onLoad={() => URL.revokeObjectURL(preview)} />
      </div>
      <div className="controls-panel">
        <div className="control-heading"><div><p className="section-kicker">Saída</p><h3>{files.length > 1 ? `${files.length} imagens em lote` : "Ajuste sua imagem"}</h3></div><span>Metadados removidos</span></div>
        <label className="field"><span>Formato</span><select value={format} onChange={(event) => setFormat(event.target.value as ImageFormat)}><option value="webp">WebP — menor e moderno</option><option value="jpeg">JPG — mais compatível</option><option value="png">PNG — transparência</option></select></label>
        <label className="field"><span>Tamanho máximo</span><select value={maxEdge} onChange={(event) => setMaxEdge(Number(event.target.value))}><option value="800">800 px</option><option value="1200">1200 px</option><option value="1920">1920 px</option><option value="2560">2560 px</option><option value="5000">Manter até 5000 px</option></select></label>
        <label className="field"><span>Crop</span><select value={crop} onChange={(event) => setCrop(event.target.value)}><option value="none">Original</option><option value="square">Quadrado · 1:1</option><option value="portrait">Retrato · 4:5</option><option value="landscape">Paisagem · 16:9</option></select><small>O recorte fica centralizado para manter o lote consistente.</small></label>
        {format !== "png" && <label className="field range-field"><span><span>Qualidade</span><output>{quality}%</output></span><input type="range" min="35" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label>}
        <div className="field"><span>Orientação</span><div className="segmented"><button className={rotate === 0 ? "is-active" : ""} onClick={() => setRotate(0)}>Original</button><button className={rotate === 90 ? "is-active" : ""} onClick={() => setRotate(90)}>↻ 90°</button><button className={rotate === 180 ? "is-active" : ""} onClick={() => setRotate(180)}>180°</button></div></div>
        <label className="check-row"><input type="checkbox" checked={flipHorizontal} onChange={(event) => setFlipHorizontal(event.target.checked)} /><span>Espelhar horizontalmente</span></label>
        {errors.length > 0 && <div className="error-box" role="alert"><strong>{artifacts.length ? "Alguns arquivos falharam" : "Não foi possível concluir"}</strong>{errors.map((error) => <p key={error}>{error}</p>)}</div>}
        {progress ? <ProgressPanel progress={progress} onCancel={() => controller.current?.abort()} /> : <button className="button primary wide" onClick={run}>Processar {files.length > 1 ? `${files.length} imagens` : "imagem"}</button>}
      </div>
    </section>
  );
}
