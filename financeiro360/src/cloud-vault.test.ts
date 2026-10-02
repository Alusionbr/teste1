import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseClient, PrivateVault, type VaultRow, type VaultTransport } from "./cloud-vault.ts";
import { emptyState } from "./logic.ts";

function memoryTransport(initialUser = "user-a") {
  const rows = new Map<string, VaultRow>();
  let user = initialUser;
  let writes = 0;
  const transport: VaultTransport = {
    async authenticatedUserId() { return user; },
    async read(userId) { return rows.get(userId) || null; },
    async create(userId, payload) {
      writes++;
      if (rows.has(userId)) return null;
      rows.set(userId, { payload, revision: 1 });
      return 1;
    },
    async replace(userId, expectedRevision, payload) {
      writes++;
      const existing = rows.get(userId);
      if (!existing || existing.revision !== expectedRevision) return null;
      rows.set(userId, { payload, revision: expectedRevision + 1 });
      return expectedRevision + 1;
    },
  };
  return { transport, rows, setUser(value: string) { user = value; }, get writes() { return writes; } };
}

test("cofre exige salvamento explícito e revisão otimista", async () => {
  const memory = memoryTransport();
  const vault = new PrivateVault(memory.transport);
  assert.equal(memory.writes, 0);
  assert.equal(await vault.preview(), null);
  const first = emptyState();
  assert.deepEqual(await vault.saveExplicit(first, null, "user-a"), { status: "saved", revision: 1 });
  const changed = { ...first, names: { wife: "Pessoa B", husband: "Pessoa A" } };
  assert.deepEqual(await vault.saveExplicit(changed, 1, "user-a"), { status: "saved", revision: 2 });
  assert.deepEqual(await vault.saveExplicit(first, 1, "user-a"), { status: "conflict" });
  assert.equal((await vault.preview())?.state.names.wife, "Pessoa B");
});

test("cofre não mistura usuários e rejeita payload remoto inválido", async () => {
  const memory = memoryTransport();
  const vault = new PrivateVault(memory.transport);
  await vault.saveExplicit(emptyState(), null, "user-a");
  memory.setUser("user-b");
  assert.equal(await vault.preview(), null);
  memory.rows.set("user-b", { payload: { version: 999 }, revision: 1 });
  await assert.rejects(vault.preview(), /inválido|incompatível/);
});

test("backup inválido não gera escrita e chave secreta não entra no navegador", async () => {
  const memory = memoryTransport();
  const vault = new PrivateVault(memory.transport);
  await assert.rejects(vault.saveExplicit({ version: 999 }, null, "user-a"), /inválido|incompatível/);
  assert.equal(memory.writes, 0);
  assert.throws(() => createSupabaseClient("https://example.supabase.co", "sb_secret_example"), /publishable/);
});

test("troca de sessão impede salvar na conta errada", async () => {
  const memory = memoryTransport();
  const vault = new PrivateVault(memory.transport);
  memory.setUser("user-b");
  await assert.rejects(vault.saveExplicit(emptyState(), null, "user-a"), /sessão mudou/);
  assert.equal(memory.writes, 0);
});
