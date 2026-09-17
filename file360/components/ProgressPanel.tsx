"use client";

import type { ProgressUpdate } from "@/src/types";

export function ProgressPanel({ progress, onCancel }: { progress: ProgressUpdate; onCancel?: () => void }) {
  const percent = progress.value == null ? null : Math.round(progress.value * 100);
  return (
    <section className="progress-panel" aria-live="polite">
      <div className="progress-copy"><strong>{progress.label}</strong>{percent != null && <span>{percent}%</span>}</div>
      <div className={`progress-track ${percent == null ? "indeterminate" : ""}`}>
        <span style={percent == null ? undefined : { width: `${percent}%` }} />
      </div>
      {onCancel && <button className="button quiet" onClick={onCancel}>Cancelar</button>}
    </section>
  );
}
