"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { extractPdfPages, imagesToPdf, inspectPdf, mergePdfs, pdfToImages, splitPdfPages } from "@/src/engines/pdf";
import { parsePageRanges } from "@/src/lib/ranges";
import type { Artifact, ProgressUpdate } from "@/src/types";

type Mode = "merge" | "extract" | "split" | "images" | "to-pdf";

export function PdfStudio({ files, initialOperation, initialFormat, onReset }: { files: File[]; initialOperation?: string; initialFormat?: string; onReset: () => void }) {
  const allImages = files.every((file) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name));
  const requestedMode: Mode | undefined = initialOperation === "to-pdf" || initialOperation === "images" || initialOperation === "merge" || initialOperation === "extract" || initialOperation === "split" ? initialOperation : undefined;
  const [mode, setMode] = useState<Mode>(allImages ? "to-pdf" : requestedMode === "to-pdf" ? "extract" : requestedMode ?? (files.length > 1 ? "merge" : "extract"));
  const [pages, setPages] = useState(0);
  const [ranges, setRanges] = useState("");
  const [rotate, setRotate] = useState(0);
  const [format, setFormat] = useState<"jpeg" | "png">(initialFormat === "png" ? "png" : "jpeg");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (allImages) return;
    const abort = new AbortController();
    inspectPdf(files[0], abort.signal).then((info) => setPages(info.pages)).catch((reason) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "PDF inválido.");
    });
    return () => abort.abort();
  }, [allImages, files]);

  useEffect(() => () => controller.current?.abort(), []);

  const run = async () => {
    const abort = new AbortController(); controller.current = abort; setError(""); setProgress({ value: 0, label: "Lendo arquivos" });
    try {
      let output: Artifact[];
      if (mode === "merge") output = [await mergePdfs(files, setProgress, abort.signal)];
      else if (mode === "to-pdf") output = [await imagesToPdf(files, setProgress, abort.signal)];
      else {
        const selected = parsePageRanges(ranges, pages);
        if (mode === "extract") output = [await extractPdfPages(files[0], selected, rotate, abort.signal)];
        else if (mode === "split") output = await splitPdfPages(files[0], selected, abort.signal);
        else output = await pdfToImages(files[0], selected, format, 144, abort.signal, setProgress);
      }
      setArtifacts(output);
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Não foi possível processar o PDF.");
    } finally { setProgress(null); controller.current = null; }
  };

  if (artifacts.length) return <ResultPanel artifacts={artifacts} onReset={onReset} />;
  return (
    <section className="controls-panel single-panel">
      <div className="control-heading"><div><p className="section-kicker">Organizar PDF</p><h3>{allImages ? "Transforme imagens em PDF" : pages ? `${pages} páginas detectadas` : "Analisando documento"}</h3></div><span>100% local</span></div>
      <div className="mode-grid">
        {allImages ? <button className="is-active" onClick={() => setMode("to-pdf")}><strong>Imagens → PDF</strong><span>Uma página por imagem</span></button> : <>
          {files.length > 1 && <button className={mode === "merge" ? "is-active" : ""} onClick={() => setMode("merge")}><strong>Unir</strong><span>Na ordem acima</span></button>}
          <button className={mode === "extract" ? "is-active" : ""} onClick={() => setMode("extract")}><strong>Extrair</strong><span>Um novo PDF</span></button>
          <button className={mode === "split" ? "is-active" : ""} onClick={() => setMode("split")}><strong>Dividir</strong><span>Um PDF por página</span></button>
          <button className={mode === "images" ? "is-active" : ""} onClick={() => setMode("images")}><strong>PDF → imagens</strong><span>JPG ou PNG</span></button>
        </>}
      </div>
      {!allImages && mode !== "merge" && <label className="field"><span>Páginas</span><input value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder={pages ? `Todas (1-${pages})` : "Ex.: 1-3, 7"} /><small>Use 1-3, 7. Inverta com 5-1 para reorganizar.</small></label>}
      {mode === "extract" && <label className="field"><span>Girar páginas</span><select value={rotate} onChange={(event) => setRotate(Number(event.target.value))}><option value="0">Não girar</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>}
      {mode === "images" && <label className="field"><span>Formato das imagens</span><select value={format} onChange={(event) => setFormat(event.target.value as "jpeg" | "png")}><option value="jpeg">JPG — arquivos menores</option><option value="png">PNG — mais definição</option></select></label>}
      {error && <div className="error-box" role="alert"><strong>Não foi possível concluir</strong><p>{error}</p></div>}
      {progress ? <ProgressPanel progress={progress} onCancel={() => controller.current?.abort()} /> : <button className="button primary wide" disabled={!allImages && !pages && mode !== "merge"} onClick={run}>Processar PDF</button>}
    </section>
  );
}
