import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { backupSummary, parseBackup, type State } from "./logic.ts";

export interface VaultRow {
  payload: unknown;
  revision: number;
}

export interface VaultTransport {
  authenticatedUserId(): Promise<string>;
  read(userId: string): Promise<VaultRow | null>;
  create(userId: string, payload: State): Promise<number | null>;
  replace(userId: string, expectedRevision: number, payload: State): Promise<number | null>;
}

export interface VaultPreview {
  userId: string;
  state: State;
  revision: number;
  summary: ReturnType<typeof backupSummary>;
}

export type SaveResult = { status: "saved"; revision: number } | { status: "conflict" };

export class PrivateVault {
  private readonly transport: VaultTransport;

  constructor(transport: VaultTransport) { this.transport = transport; }

  async currentUserId(): Promise<string> { return this.transport.authenticatedUserId(); }

  // Read-only preview. This never replaces localStorage or confirms an import.
  async preview(): Promise<VaultPreview | null> {
    const userId = await this.transport.authenticatedUserId();
    const row = await this.transport.read(userId);
    if (!row) return null;
    if (!Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error("Revisão remota inválida.");
    const state = parseBackup(row.payload);
    if (await this.transport.authenticatedUserId() !== userId) throw new Error("A sessão mudou durante a consulta do cofre.");
    return { userId, state, revision: row.revision, summary: backupSummary(state) };
  }

  // Must be called only after an explicit user action. No background upload.
  async saveExplicit(input: unknown, expectedRevision: number | null, expectedUserId: string): Promise<SaveResult> {
    const state = parseBackup(input);
    if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
      throw new Error("Revisão esperada inválida.");
    }
    const userId = await this.transport.authenticatedUserId();
    if (userId !== expectedUserId) throw new Error("A sessão mudou; revise o cofre antes de salvar.");
    const revision = expectedRevision === null
      ? await this.transport.create(userId, state)
      : await this.transport.replace(userId, expectedRevision, state);
    if (await this.transport.authenticatedUserId() !== expectedUserId) throw new Error("A sessão mudou durante o salvamento; confira o cofre antes de prosseguir.");
    if (revision === null) return { status: "conflict" };
    if (!Number.isSafeInteger(revision) || revision !== (expectedRevision ?? 0) + 1) {
      throw new Error("Revisão retornada pelo banco é inesperada.");
    }
    return { status: "saved", revision };
  }
}

export function createSupabaseClient(url: string, publishableKey: string): SupabaseClient {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
    throw new Error("URL Supabase inválida: use HTTPS ou localhost de desenvolvimento.");
  }
  if (!publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Use somente uma chave publishable no navegador.");
  }
  return createClient(parsed.toString().replace(/\/$/, ""), publishableKey);
}

export function createSupabaseVaultTransport(client: SupabaseClient): VaultTransport {
  return {
    async authenticatedUserId() {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw new Error("Entre na sua conta antes de acessar o cofre.");
      return data.user.id;
    },
    async read(userId) {
      const { data, error } = await client.from("fin_user_vault")
        .select("payload,revision").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(`Falha ao consultar cofre: ${error.message}`);
      return data ? { payload: data.payload, revision: data.revision } : null;
    },
    async create(userId, payload) {
      const { data, error } = await client.from("fin_user_vault")
        .insert({ user_id: userId, payload, revision: 1 }).select("revision").single();
      if (error?.code === "23505") return null;
      if (error) throw new Error(`Falha ao criar cofre: ${error.message}`);
      return data.revision;
    },
    async replace(userId, expectedRevision, payload) {
      const { data, error } = await client.from("fin_user_vault")
        .update({ payload, revision: expectedRevision + 1 })
        .eq("user_id", userId).eq("revision", expectedRevision)
        .select("revision").maybeSingle();
      if (error) throw new Error(`Falha ao salvar cofre: ${error.message}`);
      return data ? data.revision : null;
    },
  };
}
