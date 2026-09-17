"use client";

import { useState } from "react";
import { createZip } from "@/src/engines/archive";
import { downloadBlob } from "@/src/lib/download";
import { formatBytes } from "@/src/lib/files";
import type { Artifact } from "@/src/types";

export function ResultPanel({ artifacts, errors = [], onReset }: { artifacts: Artifact[]; errors?: string[]; onReset: () => void }) {
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState("");
  if (!artifacts.length) return null;

  const downloadAll = async () => {
    setZipError("");
    setZipping(true);
    try {
      const files = artifacts.map((artifact) => new File([artifact.blob], artifact.name, { type: artifact.blob.type }));
      const zip = await createZip(files);
      downloadBlob(zip.blob, zip.name);
    } catch (error) {
      setZipError(error instanceof Error ? error.message : "Não foi possível criar o ZIP. Baixe os arquivos individualmente.");
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
          <p>{errors.length ? `${artifacts.length} concluído(s) · ${errors.length} precisa(m) de atenção.` : artifacts.length === 1 ? "Seu arquivo está pronto." : `${artifacts.length} arquivos estão prontos.`}</p>
        </div>
      </div>
      {errors.length > 0 && <div className="error-box" role="alert"><strong>Alguns arquivos não foram concluídos</strong>{errors.map((error, index) => <p key={`${error}-${index}`}>{error}</p>)}</div>}
      {zipError && <div className="error-box" role="alert"><strong>O ZIP não foi criado</strong><p>{zipError}</p><p>Os downloads individuais continuam disponíveis.</p></div>}
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
