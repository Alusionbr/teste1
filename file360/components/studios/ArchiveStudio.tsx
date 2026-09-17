"use client";

import { useState } from "react";
import { ProgressPanel } from "@/components/ProgressPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { createGzip, createZip, extractGzip, extractZip } from "@/src/engines/archive";
import type { Artifact, ProgressUpdate } from "@/src/types";

type Mode = "zip" | "gzip" | "extract";

export function ArchiveStudio({ files, onReset }: { files: File[]; onReset: () => void }) {
  const extractable = files.length === 1 && /\.(zip|gz|gzip)$/i.test(files[0].name);
  const [mode, setMode] = useState<Mode>(extractable ? "extract" : "zip");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true); setError(""); setProgress({ value: 0, label: "Preparando arquivos" });
    try {
      if (mode === "zip") setArtifacts([await createZip(files, setProgress)]);
      else if (mode === "gzip") setArtifacts([await createGzip(files[0])]);
      else if (/\.zip$/i.test(files[0].name)) setArtifacts(await extractZip(files[0], setProgress));
      else setArtifacts([await extractGzip(files[0])]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível processar o arquivo."); }
    finally { setRunning(false); setProgress(null); }
  };

  if (artifacts.length) return <ResultPanel artifacts={artifacts} onReset={onReset} />;
  return (
    <section className="controls-panel single-panel">
      <div className="control-heading"><div><p className="section-kicker">Arquivos compactados</p><h3>{extractable ? "Extraia ou crie um novo pacote" : `Compacte ${files.length} item${files.length > 1 ? "s" : ""}`}</h3></div><span>Sem upload</span></div>
      <div className="mode-grid">
        <button className={mode === "zip" ? "is-active" : ""} onClick={() => setMode("zip")}><strong>Criar ZIP</strong><span>Um ou vários arquivos</span></button>
        {files.length === 1 && <button className={mode === "gzip" ? "is-active" : ""} onClick={() => setMode("gzip")}><strong>Criar GZIP</strong><span>Um único arquivo</span></button>}
        {extractable && <button className={mode === "extract" ? "is-active" : ""} onClick={() => setMode("extract")}><strong>Extrair</strong><span>Com proteção contra arquivo-bomba</span></button>}
      </div>
      <div className="note-box"><strong>Proteção local</strong><p>Limite de 500 itens e 250 MB extraídos. Caminhos inseguros são bloqueados automaticamente.</p></div>
      {error && <div className="error-box" role="alert"><strong>Não foi possível concluir</strong><p>{error}</p></div>}
      {progress && running ? <ProgressPanel progress={progress} /> : <button className="button primary wide" onClick={run}>{mode === "extract" ? "Extrair conteúdo" : "Compactar arquivos"}</button>}
    </section>
  );
}
