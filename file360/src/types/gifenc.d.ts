declare module "gifenc" {
  export type GifPalette = number[][];
  export type GifEncoder = {
    writeFrame: (index: Uint8Array, width: number, height: number, options?: {
      palette?: GifPalette;
      delay?: number;
      repeat?: number;
    }) => void;
    finish: () => void;
    bytes: () => Uint8Array<ArrayBuffer>;
    bytesView: () => Uint8Array<ArrayBuffer>;
  };
  export type GifEncApi = {
    GIFEncoder: (options?: { initialCapacity?: number }) => GifEncoder;
    quantize: (rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: "rgb565" | "rgb444" | "rgba4444" }) => GifPalette;
    applyPalette: (rgba: Uint8Array | Uint8ClampedArray, palette: GifPalette, format?: "rgb565" | "rgb444" | "rgba4444") => Uint8Array<ArrayBuffer>;
  };
  const api: GifEncApi;
  export const GIFEncoder: GifEncApi["GIFEncoder"];
  export const quantize: GifEncApi["quantize"];
  export const applyPalette: GifEncApi["applyPalette"];
  export default api;
}
