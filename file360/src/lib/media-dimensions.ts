export type MediaDimensions = { width: number; height: number };

function evenAtLeastTwo(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

export function fitMediaWithinLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): MediaDimensions {
  if (![width, height, maxLongEdge].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("As dimensões da mídia são inválidas.");
  }

  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return {
    width: evenAtLeastTwo(width * scale),
    height: evenAtLeastTwo(height * scale),
  };
}

