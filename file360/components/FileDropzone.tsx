"use client";

import { useRef, useState } from "react";
import { formatBytes } from "@/src/lib/files";

type Props = {
  files: File[];
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
};

export function FileDropzone({ files, onFiles, accept, multiple = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const receive = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles([...list]);
  };

  return (
    <section
      className={`dropzone ${dragging ? "is-dragging" : ""} ${files.length ? "has-files" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        receive(event.dataTransfer.files);
      }}
      aria-label="Área para selecionar arquivos"
    >
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          receive(event.target.files);
          // Allow selecting the same file again after "Processar outro".
          event.currentTarget.value = "";
        }}
      />
      <div className="dropzone-mark" aria-hidden="true">＋</div>
      <div>
        <strong>{files.length ? `${files.length} arquivo${files.length > 1 ? "s" : ""} selecionado${files.length > 1 ? "s" : ""}` : "Arraste seus arquivos aqui"}</strong>
        <p>{files.length ? `${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} no total` : "Eles permanecem neste dispositivo."}</p>
      </div>
      <button className="button secondary" type="button" onClick={() => inputRef.current?.click()}>
        {files.length ? "Trocar arquivos" : "Selecionar arquivos"}
      </button>
    </section>
  );
}
