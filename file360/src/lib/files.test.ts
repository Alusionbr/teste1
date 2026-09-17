import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseName, extensionOf, formatBytes, safeFilename, uniqueName } from "./files.ts";

describe("nomes de arquivos", () => {
  it("normaliza nomes sem permitir separadores de caminho", () => {
    assert.equal(safeFilename("../foto: verão?.jpg"), "..-foto- verão-.jpg");
  });
  it("preserva base e extensão", () => {
    assert.equal(baseName("arquivo.final.pdf"), "arquivo.final");
    assert.equal(extensionOf("arquivo.final.PDF"), "pdf");
  });
  it("evita colisões sem diferenciar maiúsculas", () => {
    const names = new Set<string>();
    assert.equal(uniqueName("foto.jpg", names), "foto.jpg");
    assert.equal(uniqueName("FOTO.jpg", names), "FOTO-2.jpg");
  });
});

describe("formatBytes", () => {
  it("usa unidades binárias legíveis", () => {
    assert.equal(formatBytes(1024), "1.00 KB");
    assert.equal(formatBytes(10 * 1024 * 1024), "10.0 MB");
  });
});
