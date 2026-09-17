"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { FileDropzone } from "@/components/FileDropzone";
import { FileList } from "@/components/FileList";
import { categoryOf } from "@/src/lib/files";
import type { FileCategory } from "@/src/types";

const tools: Array<{ id: Exclude<FileCategory, "unknown">; label: string; detail: string; accept?: string }> = [
  { id: "image", label: "Imagem", detail: "Converter, redimensionar e comprimir", accept: "image/*,.heic,.heif" },
  { id: "pdf", label: "PDF", detail: "Unir, dividir, extrair e criar", accept: "application/pdf,image/*,.heic,.heif" },
  { id: "media", label: "Vídeo e áudio", detail: "Converter, cortar e extrair áudio", accept: "video/*,audio/*,.mkv,.mov,.m4v,.avi,.flac,.ogg,.opus" },
  { id: "archive", label: "Compactar", detail: "Criar ZIP/GZIP e extrair ZIP", accept: ".zip,.gz,*/*" },
];

type ToolId = (typeof tools)[number]["id"];

const studioLoading = () => <div className="engine-loading" aria-live="polite">Carregando ferramenta local…</div>;
const ImageStudio = dynamic(() => import("@/components/studios/ImageStudio").then((module) => module.ImageStudio), { ssr: false, loading: studioLoading });
const PdfStudio = dynamic(() => import("@/components/studios/PdfStudio").then((module) => module.PdfStudio), { ssr: false, loading: studioLoading });
const MediaStudio = dynamic(() => import("@/components/studios/MediaStudio").then((module) => module.MediaStudio), { ssr: false, loading: studioLoading });
const ArchiveStudio = dynamic(() => import("@/components/studios/ArchiveStudio").then((module) => module.ArchiveStudio), { ssr: false, loading: studioLoading });

export function File360App({
  initialTool = "image",
  heading = <>Faça o que precisa.<br />Baixe e pronto.</>,
  description = "Converta, corte, comprima e organize arquivos sem criar conta. Seus arquivos não saem do dispositivo.",
}: {
  initialTool?: ToolId;
  heading?: React.ReactNode;
  description?: string;
}) {
  const [tool, setTool] = useState<ToolId>(initialTool);
  const [files, setFiles] = useState<File[]>([]);

  const receive = (nextFiles: File[]) => {
    setFiles(nextFiles);
    const categories = new Set(nextFiles.map(categoryOf));
    if (categories.size === 1) {
      const detected = [...categories][0];
      if (detected !== "unknown") setTool(detected);
    }
  };

  const selectTool = (next: ToolId) => {
    setTool(next);
    setFiles([]);
  };

  const selected = tools.find((item) => item.id === tool)!;
  const homeHref = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;

  return (
    <main>
      <header className="site-header shell">
        <a className="brand" href={homeHref} aria-label="File360 — início">
          <span className="brand-mark">F</span><span>File360</span>
        </a>
        <div className="privacy-chip"><span aria-hidden="true">●</span> Processamento local</div>
      </header>

      <section className="hero shell">
        <p className="eyebrow">SEU ARQUIVO. RESOLVIDO.</p>
        <h1>{heading}</h1>
        <p className="hero-copy">{description}</p>
      </section>

      <section className="workspace shell" aria-label="Ferramentas File360">
        <nav className="tool-switcher" aria-label="Tipo de ferramenta">
          {tools.map((item) => (
            <button
              className={tool === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => selectTool(item.id)}
              aria-current={tool === item.id ? "page" : undefined}
            >
              <strong>{item.label}</strong><span>{item.detail}</span>
            </button>
          ))}
        </nav>

        <div className="studio-shell">
          <div className="studio-intro">
            <div><p className="section-kicker">{selected.label}</p><h2>{selected.detail}</h2></div>
            <span className="local-label">Neste navegador</span>
          </div>
          <FileDropzone files={files} onFiles={receive} accept={selected.accept} multiple={tool !== "media"} />
          <FileList files={files} onChange={setFiles} />
          {files.length > 0 && tool === "image" && <ImageStudio files={files} onReset={() => setFiles([])} />}
          {files.length > 0 && tool === "pdf" && <PdfStudio key={files.map((file) => `${file.name}:${file.lastModified}`).join("|")} files={files} onReset={() => setFiles([])} />}
          {files.length > 0 && tool === "media" && <MediaStudio key={`${files[0].name}:${files[0].lastModified}`} file={files[0]} onReset={() => setFiles([])} />}
          {files.length > 0 && tool === "archive" && <ArchiveStudio files={files} onReset={() => setFiles([])} />}
        </div>
      </section>

      <section className="trust-strip shell" aria-label="Privacidade e limites">
        <article><span>01</span><div><strong>Privado de verdade</strong><p>Nenhum upload. O arquivo fica no seu aparelho.</p></div></article>
        <article><span>02</span><div><strong>Sem cadastro</strong><p>Abra, processe e baixe. Sem etapas escondidas.</p></div></article>
        <article><span>03</span><div><strong>Limites honestos</strong><p>O File360 avisa antes de exigir memória demais.</p></div></article>
      </section>

      <footer className="site-footer shell"><span>File360</span><p>Ferramentas locais para tarefas reais.</p></footer>
    </main>
  );
}
