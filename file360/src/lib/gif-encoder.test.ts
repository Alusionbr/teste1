import assert from "node:assert/strict";
import { describe, it } from "node:test";
import gifenc from "gifenc";

describe("codificador GIF", () => {
  it("gera um GIF animado válido a partir de frames RGBA", () => {
    const { GIFEncoder, applyPalette, quantize } = gifenc;
    const gif = GIFEncoder();
    for (const color of [[255, 0, 0, 255], [0, 128, 255, 255]]) {
      const rgba = new Uint8Array([...color, ...color, ...color, ...color]);
      const palette = quantize(rgba, 16, { format: "rgb444" });
      const indexed = applyPalette(rgba, palette, "rgb444");
      gif.writeFrame(indexed, 2, 2, { palette, delay: 100, repeat: 0 });
    }
    gif.finish();
    const bytes = gif.bytes();
    assert.equal(new TextDecoder().decode(bytes.slice(0, 6)), "GIF89a");
    assert.equal(bytes.at(-1), 0x3b);
  });
});
