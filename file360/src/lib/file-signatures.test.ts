import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPdfEmbeddableImage } from "./file-signatures.ts";

describe("assinaturas de imagem", () => {
  it("detecta o conteúdo mesmo quando o nome ou MIME mentem", () => {
    assert.equal(detectPdfEmbeddableImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(detectPdfEmbeddableImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  });

  it("não classifica bytes desconhecidos", () => {
    assert.equal(detectPdfEmbeddableImage(new Uint8Array([1, 2, 3, 4])), null);
  });
});

