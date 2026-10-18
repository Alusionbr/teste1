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
  type TaskStep,
  type CalendarEvent,
  type BusySlot,
  type InboxItem,
  type Wish,
  forecast,
  balance,
  validateEntry,
  entryVisibleTo,
} from "./model.ts";
import { nextDue } from "./home.ts";
import { fold, validateCatalogDraft, type CatalogDraft } from "./catalog.ts";
const localCatalogKey = (home: string) => `financeiro360:catalog:${home}`;
import { demoData, ADMIN, MEMBER } from "./demo.ts";
import { defaultPreferences, normalizePreferences, type Preferences } from "./preferences.ts";
import { invoiceMonth } from "../logic.ts";
const table = (collection: keyof Data) =>
  collection === "pantryEvents" ? "fin_pantry_events" : "fin_" + collection;
// Agenda, anotações e desejos guardados só neste aparelho enquanto a atualização do banco não existir.
// A chave inclui a pessoa: quem entrar depois no mesmo aparelho não vê o que é de outra conta.
const localAgendaKey = (home: string, user: string) => `financeiro360:agenda:${home}:${user}`;
interface LocalAgenda {
  events: CalendarEvent[];
  inbox: InboxItem[];
  wishes: Wish[];
  steps: Record<string, TaskStep[]>;
  focus_mode?: boolean;
}
export type OwnCollection = "events" | "inbox" | "wishes";
const missingTable = (e: { code?: string } | null | undefined) => e?.code === "PGRST205" || e?.code === "42P01" || e?.code === "PGRST202" || e?.code === "42883";
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
  // Falso enquanto a atualização da agenda e do foco não estiver no banco: compromissos, anotações,
  // desejos, passos das tarefas e o modo foco ficam só neste aparelho.
  agendaReady = true;
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
      d.category_presets = d.category_presets.filter((item) => item.owner_id === this.userId || item.shared);
      d.entries = d.entries.filter((entry) => entryVisibleTo(
        entry,
        this.userId,
        admin ? "admin" : "member",
        d.members,
      ));
      d.invoice_alignments = d.invoice_alignments.filter((item) => admin || item.owner_id === this.userId);
      d.invoice_alignment_exceptions = d.invoice_alignment_exceptions.filter((item) => admin || item.owner_id === this.userId);
      d.account_balance_checks = d.account_balance_checks.filter((item) => admin || item.owner_id === this.userId);
      if (!admin) d.audit = [];
      if (!admin) d.accounts = d.accounts.map((account) => ({
        ...account,
        current_balance_cents: account.owner_id === this.userId || account.share_balance
          ? balance(this.demoStore!, account) : null,
        opening_cents: account.owner_id === this.userId ? account.opening_cents : null,
        balance_date: account.owner_id === this.userId ? account.balance_date : null,
      }));
      // Mesmas regras do banco: pessoal só para o dono, nem o administrador vê.
      d.busy = d.events
        .filter((e) => e.visibility === "busy" && e.owner_id !== this.userId)
        .map(({ id, owner_id, day, start_time, end_time, repeat, repeat_until }) => ({ id, owner_id, day, start_time, end_time, repeat, repeat_until }));
      d.events = d.events.filter((e) => e.owner_id === this.userId || e.visibility === "home");
      d.inbox = d.inbox.filter((n) => n.owner_id === this.userId);
      d.wishes = d.wishes.filter((w) => w.owner_id === this.userId || w.shared);
      this.householdReady = true;
      this.catalogReady = true;
      this.agendaReady = true;
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
      "fin_reminders",
      "fin_invoice_alignments",
      "fin_invoice_alignment_exceptions",
      "fin_account_balance_checks",
      "fin_category_presets",
    ];
    const results = await Promise.all(
      tables.map(async (t) => {
        if (t === "fin_homes")
          return this.client!.from(t).select("*").eq("id", hid);
        if (t === "fin_accounts") {
          const accounts = await this.client!.rpc("fin_account_overview", { p_home: hid });
          return accounts;
        }
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
    const agenda = await this.loadAgenda(hid, household.tasks);
    const preference = await this.client.from("fin_preferences")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (preference.error)
      throw Error("Não foi possível carregar sua aparência pessoal. Tente atualizar.");
    this.preferences = normalizePreferences(preference.data || {});
    if (!this.agendaReady) this.preferences.focus_mode = this.readLocalAgenda(hid).focus_mode === true;
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
      tasks: agenda.tasks,
      pantryEvents: household.events,
      catalog,
      events: agenda.events,
      busy: agenda.busy,
      inbox: agenda.inbox,
      wishes: agenda.wishes,
      reminders: results[12].data!,
      invoice_alignments: results[13].data!,
      invoice_alignment_exceptions: results[14].data!,
      account_balance_checks: results[15].data!,
      category_presets: results[16].data!,
    } as Data;
  }
  private readLocalAgenda(hid: string): LocalAgenda {
    const empty: LocalAgenda = { events: [], inbox: [], wishes: [], steps: {} };
    try {
      const value = JSON.parse(localStorage.getItem(localAgendaKey(hid, this.userId)) || "null");
      return value && typeof value === "object" ? { ...empty, ...value } : empty;
    } catch {
      return empty;
    }
  }
  private writeLocalAgenda(hid: string, next: LocalAgenda) {
    try {
      localStorage.setItem(localAgendaKey(hid, this.userId), JSON.stringify(next));
    } catch {
      throw Error("Não foi possível guardar neste aparelho. Libere espaço no navegador e tente de novo.");
    }
  }
  private async loadAgenda(hid: string, tasks: Task[]) {
    const [events, inbox, wishes, busy] = await Promise.all([
      this.client!.from("fin_events").select("*").eq("home_id", hid).order("day").limit(2000),
      this.client!.from("fin_inbox").select("*").eq("home_id", hid).order("created_at").limit(500),
      this.client!.from("fin_wishes").select("*").eq("home_id", hid).order("created_at").limit(500),
      this.client!.rpc("fin_busy_slots", { h: hid }),
    ]);
    if ([events, inbox, wishes, busy].some((r) => missingTable(r.error))) {
      this.agendaReady = false;
      const local = this.readLocalAgenda(hid);
      return {
        events: local.events, inbox: local.inbox, wishes: local.wishes, busy: [] as BusySlot[],
        tasks: tasks.map((t) => (local.steps[t.id] ? { ...t, steps: local.steps[t.id] } : t)),
      };
    }
    if (events.error || inbox.error || wishes.error || busy.error)
      throw Error("Não foi possível carregar a agenda. Tente atualizar.");
    this.agendaReady = true;
    return {
      events: events.data as CalendarEvent[], inbox: inbox.data as InboxItem[], wishes: wishes.data as Wish[],
      busy: busy.data as BusySlot[], tasks,
    };
  }
  // Compromissos, anotações e desejos: sempre da própria pessoa.
  async saveOwn(collection: OwnCollection, record: Record<string, unknown>) {
    const hid = this.data!.home.id;
    const list = this.data![collection] as unknown as Record<string, unknown>[];
    const previous = record.id ? list.find((x) => x.id === record.id) : null;
    if (record.id && (!previous || previous.owner_id !== this.userId)) throw Error("Só quem criou pode alterar.");
    const payload = { ...(previous || { home_id: hid, owner_id: this.userId, created_at: new Date().toISOString() }), ...record };
    if (this.demo) {
      const store = this.demoStore![collection] as unknown as Record<string, unknown>[];
      const index = store.findIndex((x) => x.id === record.id);
      if (index >= 0) store[index] = payload;
      else store.push({ id: crypto.randomUUID(), ...payload });
      await this.load();
      return;
    }
    if (!this.agendaReady) {
      const local = this.readLocalAgenda(hid);
      const rows = local[collection] as unknown as Record<string, unknown>[];
      const index = rows.findIndex((x) => x.id === record.id);
      if (index >= 0) rows[index] = payload;
      else rows.push({ id: "local-" + crypto.randomUUID(), ...payload });
      this.writeLocalAgenda(hid, local);
      await this.load();
      return;
    }
    const { error } = record.id
      ? await this.client!.from(table(collection)).update(record).eq("id", record.id).eq("home_id", hid)
      : await this.client!.from(table(collection)).insert(payload);
    if (error) throw Error(error.code === "42501" ? "Você não tem permissão para esta alteração." : "Não foi possível salvar. Confira os campos e tente de novo.");
    await this.load();
  }
  async removeOwn(collection: OwnCollection, id: string) {
    const hid = this.data!.home.id;
    if (this.demo) {
      const store = this.demoStore![collection] as unknown as { id: string }[];
      const index = store.findIndex((x) => x.id === id);
      if (index >= 0) store.splice(index, 1);
    } else if (!this.agendaReady) {
      const local = this.readLocalAgenda(hid);
      local[collection] = (local[collection] as { id: string }[]).filter((x) => x.id !== id) as never;
      this.writeLocalAgenda(hid, local);
    } else {
      const { error } = await this.client!.from(table(collection)).delete().eq("id", id).eq("home_id", hid);
      if (error) throw Error("Não foi possível excluir.");
    }
    await this.load();
  }
  // Passos de uma tarefa (marcar, desmarcar, editar). Sem a atualização do banco, ficam neste aparelho.
  async saveSteps(taskId: string, steps: TaskStep[]) {
    if (this.demo || this.agendaReady) return this.save("tasks", { id: taskId, steps });
    const hid = this.data!.home.id;
    const local = this.readLocalAgenda(hid);
    local.steps[taskId] = steps;
    this.writeLocalAgenda(hid, local);
    await this.load();
  }
  // Várias contas de uma vez (carnê): ou entram todas, ou nenhuma.
  async addEntries(rows: Partial<Entry>[]) {
    if (!rows.length || rows.length > 48) throw Error("Informe de 1 a 48 parcelas.");
    const payload = rows.map((row) => validateEntry({ home_id: this.data!.home.id, owner_id: this.userId, shared: false, ...row } as Entry));
    if (this.demo) {
      this.demoStore!.entries.push(...payload.map((p) => ({ ...p, id: crypto.randomUUID() })));
      await this.load();
      return;
    }
    const r = await this.client!.from("fin_entries").insert(payload);
    if (r.error) throw Error(r.error.code === "42501" ? "Você não tem permissão para lançar." : "Parcelas não salvas. Nenhuma conta foi criada.");
    await this.load();
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
    const rows: CatalogEntry[] = [];
    for (let offset = 0; ; offset += 500) {
      const r = await this.client!.from("fin_catalog").select("*").eq("home_id", hid)
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (r.error?.code === "PGRST205" || r.error?.code === "42P01") {
        this.catalogReady = false;
        return this.readLocalCatalog(hid);
      }
      if (r.error) throw Error("Não foi possível carregar o catálogo de mercado. Tente atualizar.");
      rows.push(...(r.data as CatalogEntry[]));
      if (r.data.length < 500) break;
    }
    this.catalogReady = true;
    return [...rows, ...this.readLocalCatalog(hid)];
  }
  // Cria itens próprios ou ofertas de encarte (um lote só: ou entra tudo, ou nada).
  async addCatalog(drafts: CatalogDraft[]) {
    if (!drafts.length) throw Error("Não há nada para salvar.");
    if (drafts.length > 100) throw Error("Salve até 100 itens de cada vez.");
    // O mesmo produto (código de barras) é guardado uma vez só por casa.
    const known = new Set(this.data!.catalog.map((e) => e.barcode).filter(Boolean));
    const rows = drafts.map(validateCatalogDraft).filter((r) => !r.barcode || !known.has(r.barcode));
    if (!rows.length) return 0;
    const hid = this.data!.home.id;
    if (this.demo) {
      this.demoStore!.catalog.unshift(...rows.map((r) => ({ ...r, id: crypto.randomUUID(), home_id: hid,
        created_by: this.userId, created_at: new Date().toISOString() })));
      await this.load();
      return rows.length;
    }
    if (!this.catalogReady) {
      const local = this.readLocalCatalog(hid);
      this.writeLocalCatalog(hid, [...rows.map((r) => ({ ...r, id: "local-" + crypto.randomUUID(), home_id: hid,
        created_by: this.userId, created_at: new Date().toISOString() })), ...local]);
      await this.load();
      return rows.length;
    }
    const { error } = await this.client!.from("fin_catalog").insert(rows.map((r) => ({ ...r, home_id: hid, created_by: this.userId })));
    if (error)
      throw Error(error.code === "42501" ? "Você não tem permissão para alterar o catálogo." : "Não foi possível salvar. Nada foi adicionado.");
    await this.load();
    return rows.length;
  }
  // Atualiza itens salvos com dados novos das bases abertas (nome, marca, tamanho, categoria).
  async updateCatalog(patches: { id: string; name: string; brand: string; size: string; category: string }[]) {
    if (!patches.length) return;
    const hid = this.data!.home.id;
    const checked = patches.map((p) => ({ id: p.id, ...validateCatalogDraft({
      name: p.name, brand: p.brand, size: p.size, category: p.category, unit: "unidade", store: "",
      price_cents: null, offer_until: null, barcode: "", source: "off" }) }));
    const fields = (p: (typeof checked)[number]) => ({ name: p.name, brand: p.brand, size: p.size, category: p.category });
    if (this.demo) {
      for (const p of checked) Object.assign(this.demoStore!.catalog.find((e) => e.id === p.id) || {}, fields(p));
    } else {
      const mine = new Set(checked.filter((p) => p.id.startsWith("local-")).map((p) => p.id));
      if (mine.size)
        this.writeLocalCatalog(hid, this.readLocalCatalog(hid).map((e) => {
          const p = checked.find((x) => x.id === e.id);
          return p && mine.has(e.id) ? { ...e, ...fields(p) } : e;
        }));
      for (const p of checked.filter((x) => !mine.has(x.id))) {
        const { error } = await this.client!.from("fin_catalog").update(fields(p)).eq("id", p.id).eq("home_id", hid);
        if (error) throw Error("Não foi possível atualizar um item. Confira suas permissões.");
      }
    }
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
    const { focus_mode, ...shared } = settings;
    const columns = this.agendaReady ? settings : shared;
    if (!this.agendaReady && this.data) {
      const local = this.readLocalAgenda(this.data.home.id);
      this.writeLocalAgenda(this.data.home.id, { ...local, focus_mode });
    }
    const result = this.preferencesRevision
      ? await this.client.from("fin_preferences")
          .update(columns)
          .eq("user_id", this.userId)
          .eq("revision", this.preferencesRevision)
          .select("revision")
          .maybeSingle()
      : await this.client.from("fin_preferences")
          .insert({ user_id: this.userId, ...columns })
          .select("revision")
          .single();
    if (result.error || !result.data)
      throw Error(result.error?.code === "23505"
        ? "A aparência foi alterada em outro dispositivo. Atualize antes de salvar novamente."
        : result.error?.message || "A aparência mudou em outro dispositivo. Atualize antes de salvar novamente.");
    this.preferences = settings;
    this.preferencesRevision = result.data.revision;
  }
  async alignInvoice(cardId: string, invoiceMonth: string, cutoffOn: string, totalCents: number, note: string) {
    const card = this.data!.cards.find((item) => item.id === cardId);
    if (!card || card.archived_at || !/^\d{4}-(0[1-9]|1[0-2])$/.test(invoiceMonth) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(cutoffOn) || !Number.isSafeInteger(totalCents) || totalCents < 0)
      throw Error("Confira o cartão, a fatura, a data e o total.");
    if (this.demo) {
      this.demoStore!.invoice_alignments.forEach((item) => {
        if (item.card_id === cardId && item.invoice_month === invoiceMonth) item.active = false;
      });
      this.demoStore!.invoice_alignments.push({ id: crypto.randomUUID(), home_id: card.home_id,
        owner_id: card.owner_id, card_id: cardId, invoice_month: invoiceMonth, cutoff_on: cutoffOn,
        total_cents: totalCents, note, active: true, created_at: new Date().toISOString() });
    } else {
      const { error } = await this.client!.rpc("fin_align_invoice", { p_card: cardId, p_month: invoiceMonth,
        p_cutoff: cutoffOn, p_total: totalCents, p_note: note });
      if (error) throw Error(error.message);
    }
    await this.load();
  }
  async setAlignmentException(alignmentId: string, entryId: string, countAfter: boolean) {
    const alignment = this.data!.invoice_alignments.find((item) => item.id === alignmentId && item.active);
    const entry = this.data!.entries.find((item) => item.id === entryId);
    if (!alignment || !entry || entry.card_id !== alignment.card_id) throw Error("Compra ou alinhamento indisponível.");
    const existing = this.data!.invoice_alignment_exceptions.find((item) => item.alignment_id === alignmentId && item.entry_id === entryId);
    if (this.demo) {
      const list = this.demoStore!.invoice_alignment_exceptions;
      const row = list.find((item) => item.id === existing?.id);
      if (row) row.count_after = countAfter;
      else list.push({ id: crypto.randomUUID(), home_id: alignment.home_id, owner_id: alignment.owner_id,
        alignment_id: alignmentId, entry_id: entryId, count_after: countAfter });
    } else {
      const result = existing
        ? await this.client!.from("fin_invoice_alignment_exceptions").update({ count_after: countAfter }).eq("id", existing.id)
        : await this.client!.from("fin_invoice_alignment_exceptions").insert({ home_id: alignment.home_id,
          owner_id: alignment.owner_id, alignment_id: alignmentId, entry_id: entryId, count_after: countAfter });
      if (result.error) throw Error(result.error.message);
    }
    await this.load();
  }
  async mergeCards(sourceId: string, targetId: string) {
    const source = this.data!.cards.find((item) => item.id === sourceId);
    const target = this.data!.cards.find((item) => item.id === targetId);
    if (!source || !target || source.id === target.id || source.owner_id !== target.owner_id ||
      source.home_id !== target.home_id || source.closing_day !== target.closing_day || source.due_day !== target.due_day ||
      source.archived_at || target.archived_at || this.data!.invoice_alignments.some((item) => item.card_id === sourceId))
      throw Error("Escolha dois cartões ativos do mesmo titular, com o mesmo fechamento e vencimento. Revise alinhamentos do duplicado antes de unir.");
    if (this.demo) {
      this.demoStore!.entries.forEach((item) => { if (item.card_id === sourceId) item.card_id = targetId; });
      this.demoStore!.documents.forEach((item) => { if (item.card_id === sourceId) item.card_id = targetId; });
      const card = this.demoStore!.cards.find((item) => item.id === sourceId)!;
      card.archived_at = new Date().toISOString();
      card.merged_into_id = targetId;
    } else {
      const { error } = await this.client!.rpc("fin_merge_cards", { p_source: sourceId, p_target: targetId });
      if (error) throw Error(error.message);
    }
    await this.load();
  }
  async save(collection: keyof Data, record: Record<string, unknown>) {
    if ((collection === "tasks" || collection === "pantryEvents") && !this.householdReady)
      throw Error("A rotina da casa ainda não foi ativada no banco. Peça ao administrador para aplicar a atualização.");
    // Sem a atualização da agenda, a coluna de passos não existe: os passos ficam neste aparelho.
    let presetId = "";
    if (collection === "tasks" && !this.agendaReady && !this.demo && "steps" in record) {
      const { steps, ...rest } = record;
      record = rest;
      presetId = record.id ? "" : crypto.randomUUID();
      if (Array.isArray(steps)) {
        const local = this.readLocalAgenda(this.data!.home.id);
        local.steps[String(record.id || presetId)] = steps as TaskStep[];
        this.writeLocalAgenda(this.data!.home.id, local);
      }
    }
    if (collection === "pantry" && !this.householdReady) {
      const { location: _location, ...rest } = record;
      record = rest;
    }
    const base = collection === "pantry" || collection === "shopping"
      ? { home_id: this.data!.home.id }
      : collection === "tasks"
        ? { home_id: this.data!.home.id, created_by: this.userId }
        : collection === "reminders"
          ? { home_id: this.data!.home.id, owner_id: this.userId }
          : { home_id: this.data!.home.id, owner_id: this.userId, shared: false };
    const previous = record.id
      ? (this.data![collection] as unknown as Record<string, unknown>[]).find(
          (x) => x.id === record.id,
        )
      : null;
    const payload: Record<string, unknown> = { ...(previous || base), ...(presetId ? { id: presetId } : {}), ...record };
    if (collection === "entries" && this.me?.role === "member" && payload.area !== "personal")
      payload.shared = true;
    if (collection === "entries") {
      const entry = validateEntry(payload as unknown as Entry);
      if (entry.debt_installment_number != null) {
        const debt = this.data!.debts.find((item) => item.id === entry.debt_id);
        if (!debt?.installment_count || entry.debt_installment_number > debt.installment_count)
          throw Error("Esta parcela não pertence ao plano do empréstimo.");
      }
    }
    if (this.demo) {
      const list = this.demoStore![collection] as unknown as Record<
        string,
        unknown
      >[];
      const index = list.findIndex((x) => x.id === record.id);
      if (collection === "accounts" && index >= 0) {
        const before = list[index] as unknown as Data["accounts"][number];
        const after = payload as unknown as Data["accounts"][number];
        if (before.opening_cents !== after.opening_cents || before.balance_date !== after.balance_date)
          this.demoStore!.account_balance_checks.push({ id: crypto.randomUUID(), home_id: before.home_id,
            owner_id: before.owner_id, account_id: before.id, previous_cents: before.opening_cents,
            previous_date: before.balance_date, balance_cents: after.opening_cents,
            balance_date: after.balance_date, created_at: new Date().toISOString() });
      }
      if (collection === "cards" && index >= 0) {
        const previousCard = list[index] as unknown as Data["cards"][number];
        const nextCard = payload as unknown as Data["cards"][number];
        if (previousCard.closing_day !== nextCard.closing_day)
          this.demoStore!.entries.forEach((entry) => {
            if (entry.card_id === previousCard.id && entry.kind === "expense" && entry.payment === "card" && !entry.first_invoice_month)
              entry.first_invoice_month = invoiceMonth(entry.date, previousCard.closing_day);
          });
      }
      if (collection === "entries") {
        const entry = payload as unknown as Entry;
        if (entry.kind === "expense" && entry.payment === "card" && !entry.first_invoice_month) {
          const card = this.demoStore!.cards.find((item) => item.id === entry.card_id);
          if (card) entry.first_invoice_month = invoiceMonth(entry.date, card.closing_day);
        }
      }
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
    if (this.me.role !== "admin") {
      const entry = collection === "entries"
        ? this.data!.entries.find((item) => item.id === id)
        : undefined;
      if (collection !== "entries" || !entry || entry.owner_id !== this.userId || entry.area !== "personal")
        throw Error("Essa opção só está disponível para seus gastos pessoais.");
    }
    await this.save(collection, { id, shared, ...(collection === "accounts" && !shared ? { share_balance: false } : {}) });
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
    card: { id: string; parts: number } | null = null,
  ) {
    const list = this.data!.shopping;
    if (card && !this.demo && !this.agendaReady)
      throw Error("Fechar a compra no cartão precisa da atualização do banco. Por enquanto, escolha Pix/débito/dinheiro ou lance a compra em Dinheiro.");
    for (const line of lines) {
      const s = list.find((x) => x.id === line.id);
      if (!s || s.bought) throw Error("A lista mudou. Atualize antes de concluir.");
      if (!(line.quantity > 0) || !Number.isSafeInteger(line.unit_cents) || line.unit_cents < 0)
        throw Error(`Confira quantidade e preço de ${s.name}.`);
      if (s.quantity !== line.quantity || s.estimate_cents !== line.unit_cents)
        await this.patch("shopping", s.id, { quantity: line.quantity, estimate_cents: line.unit_cents });
    }
    await this.purchase(lines.map((l) => l.id), total, date, account, false, card);
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
    card: { id: string; parts: number } | null = null,
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
        subcategory: null,
        area: "household",
        status: "paid",
        payment: card ? "card" : "cash",
        account_id: card ? null : account,
        card_id: card?.id || null,
        target_account_id: null,
        debt_id: null,
        installments: card?.parts || 1,
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
    const { error } = card
      ? await this.client!.rpc("fin_complete_purchase_card", {
          shopping_ids: ids,
          total_cents: total,
          purchase_date: date,
          card: card.id,
          parts: card.parts,
        })
      : await this.client!.rpc("fin_complete_purchase", {
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
