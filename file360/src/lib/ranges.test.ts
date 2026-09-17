import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePageRanges, parseTimecode } from "./ranges.ts";

describe("parsePageRanges", () => {
  it("expande intervalos, remove duplicatas e preserva ordem", () => {
    assert.deepEqual(parsePageRanges("1-3, 2, 5", 5), [0, 1, 2, 4]);
  });
  it("aceita intervalo reverso para reorganizar", () => {
    assert.deepEqual(parsePageRanges("4-2", 4), [3, 2, 1]);
  });
  it("recusa páginas fora do documento", () => {
    assert.throws(() => parsePageRanges("6", 5), /entre 1 e 5/);
  });
});

describe("parseTimecode", () => {
  it("converte SS, MM:SS e HH:MM:SS", () => {
    assert.equal(parseTimecode("9.5"), 9.5);
    assert.equal(parseTimecode("01:30"), 90);
    assert.equal(parseTimecode("1:02:03"), 3723);
  });
});
