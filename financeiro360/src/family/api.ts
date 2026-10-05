import { createSupabaseClient } from "../cloud-vault.ts";
import {
  type Data,
  type Member,
  type Document,
  type Permission,
  type Entry,
  type PantryEvent,
  type CatalogEntry,
  type Task,
  forecast,
  validateEntry,
} from "./model.ts";
import { nextDue } from "./home.ts";
import { fold, validateCatalogDraft, type CatalogDraft } from "./catalog.ts";
const localCatalogKey = (home: string) => `financeiro360:catalog:${home}`;
import { demoData, ADMIN, MEMBER } from "./demo.ts";
import { defaultPreferences, normalizePreferences, type Preferences } from "./preferences.ts";
const table = (collection: keyof Data) =>
  collection === "pantryEvents" ? "fin_pantry_events" : "fin_" + collection;
export class FamilyAPI {
  client: ReturnType<typeof createSupabaseClient> | null = null;
  demo = false;
  userId = "";
  data: Data | null = null;
  private demoStore: Data | null = null;
  private demoPreferences = new Map<string, Preferences>();
  preferences: Preferences = defaultPreferences();
  preferencesRevision = 0;
  // Falso enquanto a migração da rotina da casa não estiver aplicada no banco:
  // a despensa e as compras continuam funcionando, só a rotina e o histórico ficam indisponíveis.
  householdReady = true;
  // Falso enquanto a tabela do catálogo não existir no banco: itens e encartes criados
  // ficam guardados só neste aparelho (localStorage) até a atualização ser aplicada.
  catalogReady = true;
  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL,
      key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (url && key)
      this.client = createSupabaseClient(url, key, "financeiro360-family-auth");
  }
  get me() {
    return this.data?.members.find((m) => m.user_id === this.userId)!;
  }
  allowed(p: Permission) {
    return this.me?.role === "admin" || this.me?.permissions[p] === true;
  }
  async restore() {
    if (!this.client) return false;
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) return false;
    this.userId = data.user.id;
    await this.load();
    return true;
  }
  async login(email: string, password: string) {
    if (!this.client)
      throw Error(
        "O banco familiar ainda precisa ser ativado. Você pode explorar a demonstração com dados fictícios.",
      );
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error)
      throw Error(
        "Não foi possível entrar. Confira suas credenciais e a disponibilidade do banco.",
      );
    this.userId = data.user.id;
    await this.load();
  }
  startDemo() {
    this.demo = true;
    this.demoStore = demoData();
    this.userId = ADMIN;
    return this.load();
  }
  switchDemo() {
    this.userId = this.userId === ADMIN ? MEMBER : ADMIN;
    return this.load();
  }
  async load() {
    if (this.demo) {
      const d = structuredClone(this.demoStore!);
      const admin = this.userId === ADMIN;
      for (const key of [
        "accounts",
        "cards",
        "entries",
        "debts",
        "goals",
        "documents",
        "recurring",
      ] as const)
        d[key] = d[key].filter(
          (x) => admin || x.owner_id === this.userId || x.shared,
        ) as never;
      if (!admin) d.audit = [];
      this.householdReady = true;
      this.catalogReady = true;
      this.data = d;
      this.preferences = this.demoPreferences.get(this.userId) || defaultPreferences();
      this.preferencesRevision = 0;
      return;
    }
    if (!this.client) throw Error("Banco indisponível.");
    const mem = await this.client
      .from("fin_members")
      .select("*")
      .eq("user_id", this.userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (mem.error)
      throw Error("A estrutura familiar ainda não foi ativada neste banco.");
    if (!mem.data)
      throw Error(
        "Sua conta ainda não tem acesso à família. Peça ao administrador para cadastrar seu usuário.",
      );
    const hid = mem.data.home_id;
    const tables = [
      "fin_homes",
      "fin_members",
      "fin_accounts",
      "fin_cards",
      "fin_entries",
      "fin_debts",
      "fin_goals",
      "fin_pantry",
      "fin_shopping",
      "fin_documents",
      "fin_audit",
      "fin_recurring",
    ];
    const results = await Promise.all(
      tables.map(async (t) => {
        if (t === "fin_homes")
          return this.client!.from(t).select("*").eq("id", hid);
        if (t === "fin_audit")
          return this.client!.from(t)
            .select("*")
            .eq("home_id", hid)
            .order("created_at", { ascending: false })
            .limit(100);
        const rows: Record<string, unknown>[] = [];
        for (let offset = 0; ; offset += 500) {
          const r = await this.client!.from(t)
            .select("*")
            .eq("home_id", hid)
            .order(t === "fin_members" ? "user_id" : "id")
            .range(offset, offset + 499);
          if (r.error) return r;
          rows.push(...r.data);
          if (r.data.length < 500) break;
        }
        return { data: rows, error: null };
      }),
    );
    if (results.some((r) => r.error))
      throw Error("Não foi possível carregar todos os dados. Tente atualizar.");
    const household = await this.loadHousehold(hid);
    const catalog = await this.loadCatalog(hid);
    const preference = await this.client.from("fin_preferences")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (preference.error)
      throw Error("Não foi possível carregar sua aparência pessoal. Tente atualizar.");
    this.preferences = normalizePreferences(preference.data || {});
    this.preferencesRevision = preference.data?.revision || 0;
    this.data = {
      home: results[0].data![0],
      members: results[1].data!,
      accounts: results[2].data!,
      cards: results[3].data!,
      entries: results[4].data!,
      debts: results[5].data!,
      goals: results[6].data!,
      pantry: results[7].data!,
      shopping: results[8].data!,
      documents: results[9].data!,
      audit: results[10].data!,
      recurring: results[11].data!,
      tasks: household.tasks,
      pantryEvents: household.events,
      catalog,
    } as Data;
  }
  private readLocalCatalog(hid: string): CatalogEntry[] {
    try {
      const rows = JSON.parse(localStorage.getItem(localCatalogKey(hid)) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }
  private writeLocalCatalog(hid: string, rows: CatalogEntry[]) {
    try {
      localStorage.setItem(localCatalogKey(hid), JSON.stringify(rows));
    } catch {
      throw Error("Não foi possível guardar neste aparelho. Libere espaço no navegador e tente de novo.");
    }
  }
  private async loadCatalog(hid: string): Promise<CatalogEntry[]> {
    const r = await this.client!.from("fin_catalog").select("*").eq("home_id", hid)
      .order("created_at", { ascending: false }).limit(1000);
    if (r.error?.code === "PGRST205" || r.error?.code === "42P01") {
      this.catalogReady = false;
      return this.readLocalCatalog(hid);
    }
    if (r.error) throw Error("Não foi possível carregar o catálogo de mercado. Tente atualizar.");
    this.catalogReady = true;
    return [...(r.data as CatalogEntry[]), ...this.readLocalCatalog(hid)];
  }
  // Cria itens próprios ou ofertas de encarte (um lote só: ou entra tudo, ou nada).
  async addCatalog(drafts: CatalogDraft[]) {
    if (!drafts.length) throw Error("Não há nada para salvar.");
    if (drafts.length > 100) throw Error("Salve até 100 itens de cada vez.");
    const rows = drafts.map(validateCatalogDraft);
    const hid = this.data!.home.id;
    if (this.demo) {
      this.demoStore!.catalog.unshift(...rows.map((r) => ({ ...r, id: crypto.randomUUID(), home_id: hid,
        created_by: this.userId, created_at: new Date().toISOString() })));
      await this.load();
      return;
    }
    if (!this.catalogReady) {
      const local = this.readLocalCatalog(hid);
      this.writeLocalCatalog(hid, [...rows.map((r) => ({ ...r, id: "local-" + crypto.randomUUID(), home_id: hid,
        created_by: this.userId, created_at: new Date().toISOString() })), ...local]);
      await this.load();
      return;
    }
    const { error } = await this.client!.from("fin_catalog").insert(rows.map((r) => ({ ...r, home_id: hid, created_by: this.userId })));
    if (error)
      throw Error(error.code === "42501" ? "Você não tem permissão para alterar o catálogo." : "Não foi possível salvar. Nada foi adicionado.");
    await this.load();
  }
  async removeCatalog(ids: string[]) {
    const hid = this.data!.home.id;
    if (this.demo) {
      this.demoStore!.catalog = this.demoStore!.catalog.filter((e) => !ids.includes(e.id));
      await this.load();
      return;
    }
    const mine = ids.filter((id) => id.startsWith("local-"));
    const remote = ids.filter((id) => !id.startsWith("local-"));
    if (mine.length) this.writeLocalCatalog(hid, this.readLocalCatalog(hid).filter((e) => !mine.includes(e.id)));
    if (remote.length) {
      const { error } = await this.client!.from("fin_catalog").delete().in("id", remote).eq("home_id", hid);
      if (error) throw Error("Não foi possível remover. Confira suas permissões.");
    }
    await this.load();
  }
  // Põe um item na lista de compras. Se já houver o mesmo item pendente, soma a quantidade.
  async addToShopping(line: { name: string; unit: string; quantity: number; estimate_cents: number }) {
    const name = line.name.trim().replace(/\s+/g, " ").slice(0, 151);
    if (!name || !(line.quantity > 0) || !Number.isSafeInteger(line.estimate_cents) || line.estimate_cents < 0)
      throw Error("Confira o nome, a quantidade e o preço.");
    const same = this.data!.shopping.find((s) => !s.bought && !s.pantry_id && fold(s.name) === fold(name) && s.unit === line.unit);
    if (same) {
      await this.patch("shopping", same.id, {
        quantity: Math.round((same.quantity + line.quantity) * 1000) / 1000,
        ...(line.estimate_cents > 0 ? { estimate_cents: line.estimate_cents } : {}),
      });
      await this.load();
      return "somou";
    }
    await this.save("shopping", { name, pantry_id: null, quantity: line.quantity, unit: line.unit,
      estimate_cents: line.estimate_cents, bought: false });
    return "novo";
  }
  private async loadHousehold(hid: string) {
    const [tasks, events] = await Promise.all([
      this.client!.from("fin_tasks").select("*").eq("home_id", hid).order("due_date").limit(1000),
      this.client!.from("fin_pantry_events").select("*").eq("home_id", hid)
        .order("created_at", { ascending: false }).limit(500),
    ]);
    const missing = (e: { code?: string } | null) => e?.code === "PGRST205" || e?.code === "42P01";
    if (missing(tasks.error) || missing(events.error)) {
      this.householdReady = false;
      return { tasks: [] as Task[], events: [] as PantryEvent[] };
    }
    if (tasks.error || events.error)
      throw Error("Não foi possível carregar a rotina da casa. Tente atualizar.");
    this.householdReady = true;
    return { tasks: tasks.data as Task[], events: events.data as PantryEvent[] };
  }
  async savePreferences(next: Partial<Preferences>) {
    const settings = normalizePreferences({ ...this.preferences, ...next });
    if (this.demo) {
      this.demoPreferences.set(this.userId, settings);
      this.preferences = settings;
      return;
    }
    if (!this.client || !this.userId) throw Error("Entre na sua conta para salvar a aparência.");
    const result = this.preferencesRevision
      ? await this.client.from("fin_preferences")
          .update(settings)
          .eq("user_id", this.userId)
          .eq("revision", this.preferencesRevision)
          .select("revision")
          .maybeSingle()
      : await this.client.from("fin_preferences")
          .insert({ user_id: this.userId, ...settings })
          .select("revision")
          .single();
    if (result.error || !result.data)
      throw Error(result.error?.code === "23505"
        ? "A aparência foi alterada em outro dispositivo. Atualize antes de salvar novamente."
        : result.error?.message || "A aparência mudou em outro dispositivo. Atualize antes de salvar novamente.");
    this.preferences = settings;
    this.preferencesRevision = result.data.revision;
  }
  async save(collection: keyof Data, record: Record<string, unknown>) {
    if ((collection === "tasks" || collection === "pantryEvents") && !this.householdReady)
      throw Error("A rotina da casa ainda não foi ativada no banco. Peça ao administrador para aplicar a atualização.");
    if (collection === "pantry" && !this.householdReady) {
      const { location: _location, ...rest } = record;
      record = rest;
    }
    const base =
      collection === "pantry" || collection === "shopping"
        ? { home_id: this.data!.home.id }
        : collection === "tasks"
          ? { home_id: this.data!.home.id, created_by: this.userId }
          : { home_id: this.data!.home.id, owner_id: this.userId, shared: false };
    const previous = record.id
      ? (this.data![collection] as unknown as Record<string, unknown>[]).find(
          (x) => x.id === record.id,
        )
      : null;
    const payload = { ...(previous || base), ...record };
    if (collection === "entries") validateEntry(payload as unknown as Entry);
    if (this.demo) {
      const list = this.demoStore![collection] as unknown as Record<
        string,
        unknown
      >[];
      const index = list.findIndex((x) => x.id === record.id);
      if (index >= 0) list[index] = { ...list[index], ...payload };
      else list.push({ id: crypto.randomUUID(), ...payload });
      await this.load();
      return;
    }
    const { error } = record.id
      ? await this.client!.from(table(collection))
          .update(record)
          .eq("id", record.id)
          .eq("home_id", this.data!.home.id)
      : await this.client!.from(table(collection)).insert(payload);
    if (error)
      throw Error(
        error.code === "42501"
          ? "Você não tem permissão para esta alteração."
          : error.code === "23503"
            ? "Este registro tem vínculos. Confira as contas, cartões e lançamentos."
            : error.message,
      );
    await this.load();
  }
  async share(collection: keyof Data, id: string, shared: boolean) {
    if (this.me.role !== "admin")
      throw Error("Somente o administrador pode compartilhar.");
    await this.save(collection, { id, shared });
  }
  async remove(collection: keyof Data, id: string) {
    if (this.demo) {
      const list = this.demoStore![collection] as unknown as { id: string }[];
      list.splice(
        list.findIndex((x) => x.id === id),
        1,
      );
      await this.load();
      return;
    }
    const { error } = await this.client!.from(table(collection))
      .delete()
      .eq("id", id)
      .eq("home_id", this.data!.home.id);
    if (error)
      throw Error(
        "Não foi possível excluir. Verifique se há registros vinculados.",
      );
    await this.load();
  }
  async member(input: {
    email?: string;
    password?: string;
    name?: string;
    user_id?: string;
    permissions?: Member["permissions"];
    active?: boolean;
  }) {
    if (this.demo) {
      if (input.user_id) {
        const m = this.demoStore!.members.find(
          (m) => m.user_id === input.user_id,
        )!;
        if (input.permissions) m.permissions = input.permissions;
        if (input.active !== undefined) m.active = input.active;
      } else
        throw Error("Criação de conta real disponível após ativar o banco.");
      await this.load();
      return;
    }
    const { data, error } = await this.client!.functions.invoke(
      "fin-family-admin",
      { body: { home_id: this.data!.home.id, ...input } },
    );
    if (error || data?.error)
      throw Error(data?.error || "Não foi possível administrar o usuário.");
    await this.load();
  }
  async password(current: string, password: string) {
    if (password.length < 8) throw Error("Use ao menos 8 caracteres.");
    if (this.demo) throw Error("Troca de senha disponível na conta real.");
    const user = await this.client!.auth.getUser();
    const verified = await this.client!.auth.signInWithPassword({
      email: user.data.user!.email!,
      password: current,
    });
    if (verified.error) throw Error("Senha atual incorreta.");
    const { error } = await this.client!.auth.updateUser({ password });
    if (error) throw Error(error.message);
    const res = await this.client!.functions.invoke("fin-family-admin", {
      body: { home_id: this.data!.home.id, action: "password_changed" },
    });
    if (res.error)
      throw Error(
        "Senha alterada. Entre novamente para concluir a atualização.",
      );
    await this.load();
  }
  async upload(
    file: File,
    parent: { entry_id: string | null; card_id: string | null },
  ) {
    if (this.demo)
      throw Error("Anexos reais ficam disponíveis após ativar o banco.");
    if (
      !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        file.type,
      ) ||
      file.size > 10485760 ||
      file.size === 0
    )
      throw Error("Use PDF, JPG, PNG ou WebP de até 10 MB.");
    const id = crypto.randomUUID();
    const path = `${this.data!.home.id}/${this.userId}/${id}`;
    const row = {
      id,
      home_id: this.data!.home.id,
      owner_id: this.userId,
      shared: false,
      name: file.name.slice(0, 200),
      path,
      ...parent,
      mime: file.type,
      size: file.size,
    };
    const inserted = await this.client!.from("fin_documents").insert(row);
    if (inserted.error)
      throw Error("Não foi possível registrar o comprovante.");
    const uploaded = await this.client!.storage.from(
      "fin-family-private",
    ).upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) {
      await this.client!.from("fin_documents").delete().eq("id", id);
      throw Error("Upload não concluído. Tente novamente.");
    }
    await this.load();
  }
  async download(doc: Document) {
    const { data, error } = await this.client!.storage.from(
      "fin-family-private",
    ).createSignedUrl(doc.path, 60);
    if (error) throw Error("Documento indisponível ou acesso revogado.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  // Modo mercado: grava quantidade e preço reais de cada item antes de concluir,
  // depois lembra o último preço pago no produto da despensa.
  async purchaseItems(
    lines: { id: string; quantity: number; unit_cents: number }[],
    total: number,
    date: string,
    account: string | null,
  ) {
    const list = this.data!.shopping;
    for (const line of lines) {
      const s = list.find((x) => x.id === line.id);
      if (!s || s.bought) throw Error("A lista mudou. Atualize antes de concluir.");
      if (!(line.quantity > 0) || !Number.isSafeInteger(line.unit_cents) || line.unit_cents < 0)
        throw Error(`Confira quantidade e preço de ${s.name}.`);
      if (s.quantity !== line.quantity || s.estimate_cents !== line.unit_cents)
        await this.patch("shopping", s.id, { quantity: line.quantity, estimate_cents: line.unit_cents });
    }
    await this.purchase(lines.map((l) => l.id), total, date, account, false);
    // A compra já foi concluída: lembrar o preço é um complemento e não pode parecer falha da compra.
    for (const line of lines) {
      const pantryId = list.find((x) => x.id === line.id)?.pantry_id;
      if (pantryId && line.unit_cents > 0)
        await this.patch("pantry", pantryId, { price_cents: line.unit_cents }).catch(() => undefined);
    }
    await this.load();
  }
  private async patch(collection: "shopping" | "pantry", id: string, fields: Record<string, unknown>) {
    if (this.demo) {
      const row = (this.demoStore![collection] as unknown as Record<string, unknown>[]).find((x) => x.id === id);
      if (row) Object.assign(row, fields);
      return;
    }
    const { error } = await this.client!.from("fin_" + collection).update(fields).eq("id", id).eq("home_id", this.data!.home.id);
    if (error) throw Error("Não foi possível atualizar a lista. Confira suas permissões.");
  }
  // Saída da despensa (usei, perdi/venceu, acabou) ou contagem, com histórico quando disponível.
  async pantryMove(id: string, kind: PantryEvent["kind"], amount: number) {
    if (!(amount >= 0) || (["used", "lost"].includes(kind) && amount <= 0))
      throw Error("Informe uma quantidade maior que zero.");
    if (this.demo) {
      const p = this.demoStore!.pantry.find((x) => x.id === id)!;
      const stock = forecast(p).stock;
      const moved = kind === "counted" ? amount : kind === "finished" ? stock : Math.min(amount, stock);
      p.quantity = kind === "counted" ? amount : kind === "finished" ? 0 : stock - moved;
      p.updated_at = new Date().toISOString();
      this.demoStore!.pantryEvents.unshift({
        id: crypto.randomUUID(), home_id: p.home_id, pantry_id: p.id, name: p.name, kind, quantity: moved,
        value_cents: kind === "lost" ? Math.round(moved * p.price_cents) : 0, actor_id: this.userId,
        created_at: new Date().toISOString(),
      });
      await this.load();
      return;
    }
    if (!this.householdReady) {
      const p = this.data!.pantry.find((x) => x.id === id)!;
      const stock = forecast(p).stock;
      const quantity = kind === "counted" ? amount : kind === "finished" ? 0 : Math.max(0, stock - amount);
      await this.save("pantry", { id, quantity, updated_at: new Date().toISOString() });
      return;
    }
    const { error } = await this.client!.rpc("fin_pantry_move", { item: id, move: kind, amount });
    if (error) throw Error("Não foi possível atualizar a despensa. Confira suas permissões e atualize.");
    await this.load();
  }
  // Concluir tarefa: repetir o toque não duplica a próxima ocorrência.
  async completeTask(id: string, doneOn: string) {
    if (this.demo) {
      const tasks = this.demoStore!.tasks;
      const t = tasks.find((x) => x.id === id)!;
      if (!t.done_at) Object.assign(t, { done_at: new Date().toISOString(), done_by: this.userId });
      const due = nextDue(t.repeat, doneOn);
      if (due && !tasks.some((x) => x.previous_id === t.id))
        tasks.push({ ...t, id: crypto.randomUUID(), due_date: due, done_at: null, done_by: null,
          previous_id: t.id, created_by: this.userId, created_at: new Date().toISOString() });
      await this.load();
      return;
    }
    if (!this.householdReady) throw Error("A rotina da casa ainda não foi ativada no banco.");
    const { error } = await this.client!.rpc("fin_complete_task", { task: id, done_on: doneOn });
    if (error) throw Error("Não foi possível concluir a tarefa. Atualize e tente novamente.");
    await this.load();
  }
  async purchase(
    ids: string[],
    total: number,
    date: string,
    account: string | null,
    reload = true,
  ) {
    if (this.demo) {
      const list = this.demoStore!.shopping.filter(
        (s) => ids.includes(s.id) && !s.bought,
      );
      if (list.length !== ids.length) throw Error("Lista já concluída.");
      await this.save("entries", {
        description: "Compra de mercado",
        amount_cents: total,
        date,
        kind: "expense",
        category: "Mercado",
        area: "household",
        status: "paid",
        payment: "cash",
        account_id: account,
        card_id: null,
        target_account_id: null,
        debt_id: null,
        installments: 1,
        due_date: null,
        invoice_month: null,
        source_ref: null,
      });
      for (const s of list) {
        s.bought = true;
        const p = this.demoStore!.pantry.find((p) => p.id === s.pantry_id);
        if (p) {
          // Mesma regra do banco: parte da quantidade estimada de hoje, não da última contagem.
          p.quantity = forecast(p).stock + s.quantity;
          p.updated_at = new Date().toISOString();
        }
      }
      if (reload) await this.load();
      return;
    }
    const { error } = await this.client!.rpc("fin_complete_purchase", {
      shopping_ids: ids,
      total_cents: total,
      purchase_date: date,
      account,
    });
    if (error)
      throw Error(
        "Compra não concluída. Confira as permissões e atualize a lista.",
      );
    if (reload) await this.load();
  }
  async setBudget(budget_cents: number, name: string) {
    if (this.demo) {
      this.demoStore!.home.budget_cents = budget_cents;
      this.demoStore!.home.name = name;
      await this.load();
      return;
    }
    const { error } = await this.client!.from("fin_homes")
      .update({ budget_cents, name })
      .eq("id", this.data!.home.id);
    if (error) throw Error("Não foi possível salvar o planejamento.");
    await this.load();
  }

  async importEntries(rows: Partial<Entry>[]) {
    const payload = rows.map((row) =>
      validateEntry({
        home_id: this.data!.home.id,
        owner_id: this.userId,
        shared: false,
        ...row,
      } as Entry),
    );
    if (this.demo) {
      this.demoStore!.entries.push(
        ...payload.map((p) => ({ ...p, id: crypto.randomUUID() })),
      );
      await this.load();
      return;
    }
    const r = await this.client!.from("fin_entries").insert(payload);
    if (r.error)
      throw Error(
        "Importação não concluída. Nenhum registro deste lote foi adicionado.",
      );
    await this.load();
  }
  async planMonth(month: string) {
    if (this.demo) {
      const d = this.demoStore!;
      for (const r of d.recurring.filter((r) => r.start_month <= month)) {
        const key = `recurring:${r.id}:${month}`;
        if (d.entries.some((e) => e.source_ref === key)) continue;
        const last = new Date(
          Number(month.slice(0, 4)),
          Number(month.slice(5)),
          0,
        ).getDate();
        const date =
          month + "-" + String(Math.min(r.day, last)).padStart(2, "0");
        await this.save("entries", {
          description: r.name,
          amount_cents: r.amount_cents,
          date,
          due_date: date,
          kind: "expense",
          category: r.category,
          area: r.area,
          status: "pending",
          payment: "cash",
          card_id: null,
          account_id: null,
          target_account_id: null,
          debt_id: null,
          installments: 1,
          invoice_month: null,
          source_ref: key,
        });
      }
      return;
    }
    const r = await this.client!.rpc("fin_plan_month", {
      h: this.data!.home.id,
      m: month,
    });
    if (r.error) throw Error("Não foi possível gerar as contas do mês.");
    await this.load();
  }
  async logout() {
    if (this.client && !this.demo)
      await this.client.auth.signOut({ scope: "local" });
    this.data = null;
    this.userId = "";
    this.demo = false;
    this.demoStore = null;
    this.demoPreferences.clear();
    this.preferences = defaultPreferences();
    this.preferencesRevision = 0;
  }
}
