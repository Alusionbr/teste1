import assert from "node:assert/strict";
import test from "node:test";
import { emptyState } from "./logic.ts";
import { readStored, writeStored } from "./storage.ts";

test("conteúdo local corrompido permanece intocado até importação válida", () => {
  let raw = "{backup interrompido";
  const loaded = readStored(() => raw);
  assert.equal(loaded.blocked, true);
  assert.equal(writeStored((value) => { raw = value; }, loaded.state, loaded.blocked), false);
  assert.equal(raw, "{backup interrompido");
  const imported = emptyState();
  imported.names.wife = "Ana";
  assert.equal(writeStored((value) => { raw = value; }, imported, false), true);
  assert.equal(readStored(() => raw).state.names.wife, "Ana");
});

test("falha de gravação é retornada ao chamador", () => {
  assert.equal(writeStored(() => { throw new Error("quota"); }, emptyState(), false), false);
});
