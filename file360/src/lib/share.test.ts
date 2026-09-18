import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canShareFiles, shareFiles } from "./share.ts";

const files = [{} as File];

describe("compartilhamento por capacidade", () => {
  it("fica indisponível sem share e mantém o download como fallback", async () => {
    assert.equal(canShareFiles(files, {}), false);
    assert.equal(await shareFiles(files, {}), "unavailable");
  });

  it("só aprova quando canShare aceita arquivos", () => {
    assert.equal(canShareFiles(files, { canShare: () => false, share: async () => undefined }), false);
    assert.equal(canShareFiles(files, { canShare: (data) => data?.files === files, share: async () => undefined }), true);
  });

  it("trata o cancelamento da folha como cancelamento, não como falha", async () => {
    const target = {
      canShare: () => true,
      share: async () => { throw new DOMException("cancelado", "AbortError"); },
    };
    assert.equal(await shareFiles(files, target), "cancelled");
  });
});
