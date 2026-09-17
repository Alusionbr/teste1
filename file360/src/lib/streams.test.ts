import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { streamToBlobWithLimit } from "./streams.ts";

function chunks(...values: number[][]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      values.forEach((value) => controller.enqueue(new Uint8Array(value)));
      controller.close();
    },
  });
}

describe("streamToBlobWithLimit", () => {
  it("aceita saída igual ao limite", async () => {
    const blob = await streamToBlobWithLimit(chunks([1, 2], [3, 4]), 4);
    assert.equal(blob.size, 4);
  });

  it("interrompe quando os bytes reais excedem o limite", async () => {
    await assert.rejects(
      streamToBlobWithLimit(chunks([1, 2, 3], [4]), 3),
      /ultrapassou o limite local/,
    );
  });

  it("interrompe a leitura ao cancelar", async () => {
    const abort = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
    });
    const pending = streamToBlobWithLimit(stream, 10, abort.signal);
    abort.abort(new DOMException("cancelado", "AbortError"));
    await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  });
});
