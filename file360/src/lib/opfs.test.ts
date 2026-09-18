import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTemporaryOutputInDirectory } from "./opfs.ts";

function fakeDirectory(events: string[]) {
  const writable = {
    async write() { events.push("write"); },
    async close() { events.push("close"); },
    async abort() { events.push("abort"); },
  };
  return {
    async *entries() {},
    async getFileHandle() {
      return { createWritable: async () => writable, getFile: async () => new Blob() };
    },
    async removeEntry() { events.push("remove"); },
  } as unknown as FileSystemDirectoryHandle;
}

function fakeDirectoryWithCloseFailure(events: string[]) {
  const writable = {
    async write() { events.push("write"); },
    async close() { events.push("close"); throw new Error("quota"); },
    async abort() { events.push("abort"); },
  };
  return {
    async *entries() {},
    async getFileHandle() {
      return { createWritable: async () => writable, getFile: async () => new Blob() };
    },
    async removeEntry() { events.push("remove"); },
  } as unknown as FileSystemDirectoryHandle;
}

describe("saída temporária OPFS", () => {
  it("aborta o writer antes de remover uma saída parcial", async () => {
    const events: string[] = [];
    const output = await createTemporaryOutputInDirectory(fakeDirectory(events), "mp4", 10);
    await output.cleanup();
    assert.deepEqual(events, ["abort", "remove"]);
  });

  it("não aborta novamente depois que o stream foi fechado", async () => {
    const events: string[] = [];
    const output = await createTemporaryOutputInDirectory(fakeDirectory(events), "mp4", 10);
    const writer = output.writable.getWriter();
    await writer.close();
    await output.cleanup();
    await output.cleanup();
    assert.deepEqual(events, ["close", "remove"]);
  });

  it("interrompe a escrita ao exceder o limite real", async () => {
    const events: string[] = [];
    const output = await createTemporaryOutputInDirectory(fakeDirectory(events), "mp4", 3);
    const writer = output.writable.getWriter();
    await assert.rejects(writer.write({ type: "write", data: new Uint8Array(4), position: 0 }), /ultrapassou o limite local/);
    await output.cleanup();
    assert.deepEqual(events, ["abort", "remove"]);
  });

  it("aborta antes da remoção quando o fechamento falha", async () => {
    const events: string[] = [];
    const output = await createTemporaryOutputInDirectory(fakeDirectoryWithCloseFailure(events), "mp4", 10);
    const writer = output.writable.getWriter();
    await assert.rejects(writer.close(), /quota/);
    await output.cleanup();
    assert.deepEqual(events, ["close", "abort", "remove"]);
  });
});
