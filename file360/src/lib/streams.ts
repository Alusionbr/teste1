export async function streamToBlobWithLimit(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  signal?: AbortSignal,
  type = "application/octet-stream",
): Promise<Blob> {
  if (!Number.isFinite(limit) || limit < 0) throw new Error("O limite de saída é inválido.");
  const reader = stream.getReader();
  const chunks: ArrayBuffer[] = [];
  let total = 0;
  const abortRead = () => void reader.cancel(signal?.reason).catch(() => undefined);
  signal?.addEventListener("abort", abortRead, { once: true });

  try {
    while (true) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
      const { value, done } = await reader.read();
      if (signal?.aborted) throw signal.reason ?? new DOMException("Processamento cancelado.", "AbortError");
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        throw new Error("A saída ultrapassou o limite local permitido.");
      }
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      chunks.push(copy.buffer);
    }
    return new Blob(chunks, { type });
  } finally {
    signal?.removeEventListener("abort", abortRead);
    if (signal?.aborted || total > limit) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
