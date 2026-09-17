import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS } from "./files.ts";
import { mediaLimitsForStorage } from "./media-limits.ts";

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

