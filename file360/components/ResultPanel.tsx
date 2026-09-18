"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createZip } from "@/src/engines/archive";
import { downloadBlob } from "@/src/lib/download";
import { baseName, extensionOf, formatBytes, resultFilename, safeFilename } from "@/src/lib/files";
import { canShareFiles, shareFiles } from "@/src/lib/share";
import type { Artifact } from "@/src/types";

type ResultPanelProps = {
  artifacts: Artifact[];
  errors?: string[];
  onAdjust: () => void;
  onReset: () => void;
};

export function ResultPanel({ artifacts, errors = [], onAdjust, onReset }: ResultPanelProps) {
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState("");
  const [unshareableIds, setUnshareableIds] = useState<Set<string>>(() => new Set());
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(artifacts.map((artifact) => [artifact.id, baseName(artifact.name)])));
  const cleaned = useRef(new Set<string>());
  const pendingCleanup = useRef<number | null>(null);
  const artifactsRef = useRef(artifacts);
  const artifactKey = useMemo(() => artifacts.map((artifact) => artifact.id).join("|"), [artifacts]);

  const filenameFor = (artifact: Artifact) => resultFilename(names[artifact.id] ?? baseName(artifact.name), artifact.name);
  const fileFor = (artifact: Artifact) => new File([artifact.blob], filenameFor(artifact), { type: artifact.blob.type });

  const cleanupArtifacts = async (owned: Artifact[]) => {
    await Promise.all(owned.map(async (artifact) => {
      if (cleaned.current.has(artifact.id)) return;
      cleaned.current.add(artifact.id);
      await artifact.cleanup?.();
    }));
  };

  useEffect(() => {
    artifactsRef.current = artifacts;
  }, [artifacts]);

  useEffect(() => {
    if (pendingCleanup.current !== null) {
      window.clearTimeout(pendingCleanup.current);
      pendingCleanup.current = null;
    }
    const owned = artifacts;
    return () => {
      pendingCleanup.current = window.setTimeout(() => void cleanupArtifacts(owned), 0);
    };
  // A chave estável evita limpar o resultado em re-renders do próprio painel.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactKey]);

  useEffect(() => {
    const cleanup = (event: PageTransitionEvent) => {
      if (!event.persisted) void cleanupArtifacts(artifactsRef.current);
    };
    window.addEventListener("pagehide", cleanup);
    return () => {
      window.removeEventListener("pagehide", cleanup);
    };
  // O listener usa artifactsRef para não ser recriado durante a edição do nome.
  }, []);

  if (!artifacts.length) return null;

  const downloadAll = async () => {
    setZipError("");
    setZipping(true);
    try {
      const files = artifacts.map(fileFor);
      const zip = await createZip(files);
      downloadBlob(zip.blob, zip.name);
    } catch (error) {
      setZipError(error instanceof Error ? error.message : "Não foi possível criar o ZIP. Baixe os arquivos individualmente.");
    } finally {
      setZipping(false);
    }
  };

  const share = async (artifact: Artifact) => {
    setShareMessage("");
    setSharing(artifact.id);
    try {
      const result = await shareFiles([fileFor(artifact)]);
      if (result === "shared") setShareMessage("Arquivo compartilhado.");
      else if (result === "unavailable") {
        setUnshareableIds((current) => new Set(current).add(artifact.id));
      }
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : "Não foi possível compartilhar. O download continua disponível.");
    } finally {
      setSharing(null);
    }
  };

  const leaveResult = async (next: () => void) => {
    await cleanupArtifacts(artifacts);
    next();
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
      {shareMessage && <p className="result-message" aria-live="polite">{shareMessage}</p>}
      <div className="result-list">
        {artifacts.map((artifact) => (
          <div className="result-row" key={artifact.id}>
            <div className="result-copy">
              <label className="result-name"><span className="sr-only">Nome do resultado</span><input aria-label={`Nome do resultado ${artifact.name}`} value={names[artifact.id] ?? ""} onChange={(event) => setNames((current) => ({ ...current, [artifact.id]: event.target.value }))} onBlur={() => setNames((current) => ({ ...current, [artifact.id]: safeFilename(current[artifact.id] ?? "", "arquivo") }))} /><span>.{extensionOf(artifact.name)}</span></label>
              <span>{formatBytes(artifact.blob.size)}{artifact.detail ? ` · ${artifact.detail}` : ""}</span>
            </div>
            <div className="result-row-actions">
              {!unshareableIds.has(artifact.id) && canShareFiles([fileFor(artifact)]) && <button className="button secondary" disabled={sharing === artifact.id} onClick={() => void share(artifact)}>{sharing === artifact.id ? "Abrindo…" : "Compartilhar"}</button>}
              <button className="button secondary" onClick={() => downloadBlob(artifact.blob, filenameFor(artifact))}>Baixar</button>
            </div>
          </div>
        ))}
      </div>
      <div className="result-actions">
        {artifacts.length > 1 && <button className="button primary" disabled={zipping} onClick={downloadAll}>{zipping ? "Criando ZIP…" : "Baixar tudo em ZIP"}</button>}
        <button className="button secondary" disabled={sharing !== null} onClick={() => void leaveResult(onAdjust)}>Ajustar novamente</button>
        <button className="button quiet" disabled={sharing !== null} onClick={() => void leaveResult(onReset)}>Processar outro</button>
      </div>
    </section>
  );
}
