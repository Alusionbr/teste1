"use client";

import { formatBytes } from "@/src/lib/files";

export function FileList({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  if (!files.length) return null;
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="file-list" aria-label="Arquivos selecionados">
      {files.map((file, index) => (
        <div className="file-row" key={`${file.name}-${file.lastModified}-${index}`}>
          <span className="file-index">{index + 1}</span>
          <div className="file-copy"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
          <div className="file-actions">
            <button aria-label={`Mover ${file.name} para cima`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button aria-label={`Mover ${file.name} para baixo`} disabled={index === files.length - 1} onClick={() => move(index, 1)}>↓</button>
            <button aria-label={`Remover ${file.name}`} onClick={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
