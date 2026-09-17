export function parsePageRanges(value: string, pageCount: number): number[] {
  const result = new Set<number>();
  const normalized = value.trim();
  if (!normalized) return Array.from({ length: pageCount }, (_, index) => index);

  for (const token of normalized.split(",")) {
    const part = token.trim();
    if (!part) continue;
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Intervalo inválido: “${part}”. Use algo como 1-3, 7.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`A página precisa estar entre 1 e ${pageCount}.`);
    }
    const direction = start <= end ? 1 : -1;
    for (let page = start; ; page += direction) {
      result.add(page - 1);
      if (page === end) break;
    }
  }
  return [...result];
}

export function parseTimecode(value: string): number {
  const pieces = value.trim().split(":").map(Number);
  if (pieces.some((piece) => !Number.isFinite(piece) || piece < 0) || pieces.length > 3) {
    throw new Error("Tempo inválido. Use SS, MM:SS ou HH:MM:SS.");
  }
  const seconds = pieces.reduce((total, piece) => total * 60 + piece, 0);
  if (!Number.isFinite(seconds)) throw new Error("Tempo inválido.");
  return seconds;
}
