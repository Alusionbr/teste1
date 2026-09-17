import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitMediaWithinLongEdge } from "./media-dimensions.ts";

describe("fitMediaWithinLongEdge", () => {
  it("não amplia vídeo menor que o limite", () => {
    assert.deepEqual(fitMediaWithinLongEdge(720, 1280, 1920), { width: 720, height: 1280 });
  });

  it("limita o maior lado de vídeo vertical", () => {
    assert.deepEqual(fitMediaWithinLongEdge(2160, 3840, 1920), { width: 1080, height: 1920 });
  });

  it("limita o maior lado de vídeo horizontal e mantém dimensões pares", () => {
    assert.deepEqual(fitMediaWithinLongEdge(3840, 2160, 1280), { width: 1280, height: 720 });
    assert.deepEqual(fitMediaWithinLongEdge(1921, 1081, 1280), { width: 1280, height: 720 });
  });
});

