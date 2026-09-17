"use client";

import { useState } from "react";
import { createZip } from "@/src/engines/archive";
import { downloadBlob } from "@/src/lib/download";
import { formatBytes } from "@/src/lib/files";
import type { Artifact } from "@/src/types";

export function ResultPanel({ artifacts, onReset }: { artifacts: Artifact[]; onReset: () => void }) {
  const [zipping, setZipping] = useState(false);
  if (!artifacts.length) return null;

  const downloadAll = async () => {
    setZipping(true);
    try {
      const files = artifacts.map((artifact) => new File([artifact.blob], artifact.name, { type: artifact.blob.type }));
      const zip = await createZip(files);
      downloadBlob(zip.blob, zip.name);
    } finally {
      setZipping(false);
    }
  };

  return (
    <section className="result-panel" aria-labelledby="result-title">
      <div className="result-heading">
        <span className="success-mark" aria-hidden="true">✓</span>
        <div>
          <h2 id="result-title">Processamento concluído</h2>
          <p>{artifacts.length === 1 ? "Seu arquivo está pronto." : `${artifacts.length} arquivos estão prontos.`}</p>
        </div>
      </div>
      <div className="result-list">
        {artifacts.map((artifact) => (
          <div className="result-row" key={artifact.id}>
            <div className="result-copy">
              <strong title={artifact.name}>{artifact.name}</strong>
              <span>{formatBytes(artifact.blob.size)}{artifact.detail ? ` · ${artifact.detail}` : ""}</span>
            </div>
            <button className="button secondary" onClick={() => downloadBlob(artifact.blob, artifact.name)}>Baixar</button>
          </div>
        ))}
      </div>
      <div className="result-actions">
        {artifacts.length > 1 && <button className="button primary" disabled={zipping} onClick={downloadAll}>{zipping ? "Criando ZIP…" : "Baixar tudo em ZIP"}</button>}
        <button className="button quiet" onClick={onReset}>Processar outro</button>
      </div>
    </section>
  );
}
