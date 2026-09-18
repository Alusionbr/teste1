import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS } from "./files.ts";
import { gifInputBytesForStorage, mediaLimitsForOutput, mediaLimitsForStorage } from "./media-limits.ts";

describe("limites de mídia", () => {
  it("mantém o perfil conservador sem armazenamento temporário", () => {
    assert.deepEqual(mediaLimitsForStorage(false), {
      bytes: LIMITS.mediaBytes,
      seconds: LIMITS.mediaSeconds,
      expanded: false,
    });
  });

  it("libera o perfil ampliado somente com armazenamento temporário", () => {
    assert.deepEqual(mediaLimitsForStorage(true), {
      bytes: LIMITS.mediaExtendedBytes,
      seconds: LIMITS.mediaExtendedSeconds,
      expanded: true,
    });
  });
});

describe("fallback de armazenamento de mídia", () => {
  it("volta ao orçamento básico se a criação da saída temporária falhar", () => {
    assert.equal(mediaLimitsForOutput(true, false).bytes, LIMITS.mediaBytes);
    assert.equal(mediaLimitsForOutput(true, true).bytes, LIMITS.mediaExtendedBytes);
  });

  it("mantém o limite do GIF coerente com o armazenamento detectado", () => {
    assert.equal(gifInputBytesForStorage(false), LIMITS.mediaBytes);
    assert.equal(gifInputBytesForStorage(true), LIMITS.gifInputBytes);
  });
});
