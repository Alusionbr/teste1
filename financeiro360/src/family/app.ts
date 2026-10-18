import "./style.css";
import { FamilyAPI } from "./api.ts";
import {
  brl as formatBrl,
  today,
  metrics,
  invoice,
  monthPicture,
  invoiceInstallments,
  balance,
  forecast,
  recommendations,
  roundUpHundredths,
  parseMoney,
  permissions,
  validIsoDate,
  type Data,
  type Entry,
  type Debt,
  type Permission,
  type Member,
  type Pantry,
  type PantryEvent,
  type Shopping,
  type Task,
  type Reminder,
} from "./model.ts";
import {
  addDays,
  attention,
  dailyUseFromDuration,
  dueLabel,
  durationChoices,
  durationFromDailyUse,
  expiry,
  formatDate,
  formatQuantity,
  lineCents,
  locationOf,
  locationOrder,
  pantryLocations,
  pantryStatus,
  pantryUnits,
  repeatLabels,
  shoppingGroups,
  shoppingText,
  suggestionReason,
  taskGroups,
  taskKinds,
  taskTemplates,
  wasteThisMonth,
} from "./home.ts";
import {
  catalogCards,
  catalogCategories,
  catalogStores,
  catalogUnits,
  categoryIds,
  composeName,
  entryCard,
  filterCards,
  guessCategory,
  offerLabel,
  parseFlyerText,
  sortCards,
  type CatalogCard,
  type CatalogCategory,
  type FlyerRow,
} from "./catalog.ts";
import { brl, button, centsText, emptyState, esc, field, formActions, icon, input, moneyInput, opt, segmented } from "./ui.ts";
import type { ViewCtx } from "./views/context.ts";
import { carneForm, committedPanel, futureView, plansView, simulateForm, simulationResult } from "./views/money-future.ts";
import { agendaView, eventForm, type AgendaState } from "./views/agenda.ts";
import { focusCard, focusPage, noteForm, triageContent, wishForm, wishesSection, type TimerState } from "./views/focus.ts";
import { cardLimitUse, carneSchedule, CARNE_PREFIX } from "./plans.ts";
import { frequentEntries, parseQuick } from "./quick.ts";
import { agendaItems, dueReminders, occurrences, toIcs, weekday, type AgendaFilter } from "./agenda.ts";
import { doneToday, focusQueue, parseSteps, timerLeft, timerText } from "./focus.ts";
import type { CalendarEvent } from "./model.ts";
import { OffError, fetchProduct, offCredit, searchProducts, type OffProduct } from "./off.ts";
import { dashboardWidgets, quickActions, defaultPreferences, type DashboardWidget, type QuickAction } from "./preferences.ts";
import { financialSeries, financialTotals, spendingGroups, type FlowPoint } from "./insights.ts";
import {
  addMonths,
  dueDate,
  invoiceMonth,
  installmentAmount,
  parseBackup,
} from "../logic.ts";
const api = new FamilyAPI();
const root = document.querySelector<HTMLDivElement>("#app")!;
let page = "overview",
  month = today().slice(0, 7),
  calendarSelectedDate = today(),
  calendarFilter: "all" | "reminder" | "due_date" = "all",
  newReminderKind: Reminder["kind"] = "reminder",
  notice = "",
  busy = false,
  filter = "",
  area = "all",
  owner = "all",
  status = "all",
  entryKind = "all",
  entryCategory = "all",
  entrySubcategory = "all",
  entryFiltersOpen = false,
  cardIdFilter = "all",
  cardOwnerFilter = "all",
  cardStatusFilter: "all" | "open" | "paid" = "all",
  analysisPeriod: "monthly" | "yearly" = "monthly",
  editId = "",
  modal = "",
  categoryPresetCategory = "",
  importRows: Partial<Entry>[] = [],
  houseTab = "pantry",
  pantryPlace = "all",
  pantrySearch = "",
  taskPerson = "all",
  suggestDays = 14,
  moveKind: PantryEvent["kind"] = "used",
  shopTab = "list",
  catalogOpen = new Set<string>(),
  catalogStore = "all",
  catalogCategory = "all",
  catalogTerm = "",
  catalogDraftName = "",
  flyerDraft = { store: catalogStores[0], until: "", text: "" },
  pickerQuery = "",
  pickerCategory = "mercearia",
  pickerRows: OffProduct[] = [],
  pickerState: "idle" | "loading" | "done" | "error" = "idle",
  pickerMessage = "",
  pickerFromCache = false,
  pickedProduct: OffProduct | null = null,
  refresh = { running: false, done: 0, total: 0 },
  flyerRows: FlyerRow[] = [],
  flyerSkipped = 0,
  offerMode = false,
  submitNotice = "Alteração salva.",
  cardsTab = "invoices",
  agenda: AgendaState = { tab: "day", date: today(), filter: "all" },
  // Rascunho vindo do lançamento rápido, de "Repetir" ou de uma anotação: abre o formulário já preenchido.
  entryDraft: Partial<Entry> | null = null,
  draftHint = "",
  // Anotação sendo organizada: sai da caixa de entrada quando o destino for salvo.
  triageNoteId = "",
  eventPreset: Partial<CalendarEvent> = {},
  wishDraftName = "",
  taskTitlePreset = "",
  simulateHtml = "",
  agendaAlerts: { key: string; text: string }[] = [];
// Preferências deste aparelho (adiar no foco, avisos já vistos, temporizador). Sem armazenamento, segue sem elas.
const stored = <T,>(area: "local" | "session", key: string, fallback: T): T => {
  try {
    const raw = (area === "local" ? localStorage : sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const store = (area: "local" | "session", key: string, value: unknown) => {
  try {
    if (value === null) (area === "local" ? localStorage : sessionStorage).removeItem(key);
    else (area === "local" ? localStorage : sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* conveniência do aparelho: sem espaço, segue sem guardar */
  }
};
const SNOOZE_KEY = "financeiro360:foco-adiado";
const SKIP_KEY = "financeiro360:foco-pulado";
const SEEN_KEY = "financeiro360:avisos-vistos";
const TIMER_KEY = "financeiro360:temporizador";
let timer: TimerState | null = stored("session", TIMER_KEY, null);
// Carrinho do modo mercado: sobrevive a re-renderizações, atualização automática e falhas de envio.
const cart = new Map<string, { checked: boolean; qty: string; price: string }>();
const cartMeta = { total: "", date: "", account: "", pay: "cash", card: "", parts: "1" };
const nav = [
  ["overview", "Início"],
  ["agenda", "Agenda"],
  ["entries", "Dinheiro"],
  ["analysis", "Análises"],
  ["shopping", "Compras"],
  ["pantry", "Casa"],
  ["settings", "Perfil"],
  ["cards", "Cartões e faturas"],
  ["calendar", "Calendário familiar"],
  ["reminders", "Avisos e lembretes"],
  ["accounts", "Contas e dívidas"],
  ["planning", "Planejamento"],
  ["goals", "Metas"],
  ["documents", "Comprovantes"],
  ["family", "Família e acesso"],
  ["categories", "Categorias"],
  ["focus", "Agora (foco)"],
];
const primaryNav = new Set(["overview", "agenda", "entries", "analysis", "shopping", "pantry", "settings"]);
// Barra de baixo no celular: seis destinos; as demais seções ficam no menu "Abrir uma seção".
const mobileNav = new Set(["overview", "agenda", "entries", "analysis", "shopping", "settings"]);
const navButton = ([id, label]: string[]) => `<button type="button" class="nav-item ${page === id ? "active" : ""}" data-action="nav" data-page="${id}">${icon(id)}<span>${label}</span>${id === "shopping" && api.data!.shopping.some((s) => !s.bought) || (id === "reminders" || id === "calendar") && api.data!.reminders.some((r) => r.kind !== "post_it" && r.due_on && !r.completed && daysFromToday(r.due_on) <= 7) ? "<i></i>" : ""}</button>`;
function sidebarNav() {
  const primary = nav.filter(([id]) => primaryNav.has(id)).map(navButton).join("");
  const other = nav.filter(([id]) => !primaryNav.has(id)).map(navButton).join("");
  const expanded = !api.preferences.simple_mode || !primaryNav.has(page);
  return `${primary}<details class="sidebar-more" ${expanded ? "open" : ""}><summary>Mais seções</summary><div>${other}</div></details>`;
}
const names = (id: string) =>
  api.data?.members.find((m) => m.user_id === id)?.display_name || "Membro";
const admin = () => api.me?.role === "admin";
const own = (r: { owner_id: string }) => admin() || r.owner_id === api.userId;
const accountOptions = (current?: string | null) =>
  opt("", "Sem conta vinculada", current) +
  api
    .data!.accounts.filter(own)
    .map((a) => opt(a.id, a.name, current))
    .join("");
const cardOptions = (current?: string | null) =>
  opt("", "Selecione um cartão", current) +
  api
    .data!.cards.filter((c) => own(c) && !c.archived_at)
    .map((c) => opt(c.id, c.name, current))
    .join("");
const commonCategories = [
  "Mercado", "Moradia", "Contas da casa", "Alimentação fora", "Transporte",
  "Saúde", "Educação", "Família e filhos", "Pets", "Vestuário",
  "Cuidados pessoais", "Lazer", "Assinaturas", "Impostos", "Salário",
  "Investimentos", "Dívidas", "Fatura", "Transferência", "Seguros",
  "Serviços domésticos", "Presentes e doações", "Taxas bancárias", "Outros",
];
const subcategorySuggestions: Record<string, string[]> = {
  Mercado: ["Supermercado", "Hortifruti", "Açougue", "Padaria", "Mercearia", "Feira"],
  Moradia: ["Aluguel", "Prestação", "Condomínio", "Manutenção", "Móveis"],
  "Contas da casa": ["Água", "Energia", "Gás", "Internet", "Telefone", "Limpeza"],
  "Alimentação fora": ["Restaurante", "Delivery", "Lanche", "Café"],
  Transporte: ["Combustível", "Aplicativo", "Transporte público", "Estacionamento", "Manutenção", "Pedágio"],
  Saúde: ["Consulta", "Exames", "Medicamentos", "Vacinas", "Dentista", "Terapia", "Plano de saúde", "Óculos", "Hospital", "Fisioterapia"],
  Educação: ["Mensalidade", "Material escolar", "Uniforme", "Curso", "Atividade"],
  "Família e filhos": ["Creche", "Cuidados infantis", "Fraldas", "Fórmula infantil", "Mesada", "Atividade infantil", "Presente", "Ajuda à família"],
  Pets: ["Ração", "Veterinário", "Medicamentos", "Banho e tosa", "Acessórios"],
  Vestuário: ["Roupas", "Calçados", "Acessórios"],
  "Cuidados pessoais": ["Cabelo", "Barbearia", "Higiene", "Cosméticos"],
  Lazer: ["Passeios", "Viagem", "Cinema", "Brinquedos", "Esporte"],
  Assinaturas: ["Streaming", "Aplicativos", "Serviços digitais"],
  Impostos: ["IPTU", "IPVA", "Taxas", "Multas"],
  Salário: ["Salário", "Benefício", "Reembolso", "Venda", "Renda extra"],
  Investimentos: ["Aporte", "Rendimento", "Resgate"],
  Dívidas: ["Empréstimo", "Financiamento", "Juros"],
  Fatura: ["Pagamento de cartão"],
  Transferência: ["Entre contas", "Retirada", "Depósito"],
  Seguros: ["Vida", "Residencial", "Automóvel", "Saúde"],
  "Serviços domésticos": ["Diarista", "Conserto", "Jardinagem", "Lavanderia"],
  "Presentes e doações": ["Aniversário", "Datas especiais", "Doação"],
  "Taxas bancárias": ["Tarifa", "Anuidade", "Juros", "Multa"],
  Outros: ["A confirmar"],
};
const categoryIsHidden = (category: string) => category.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase() === "maconha";
const sortCategoriesByUse = (categories: Iterable<string>) => {
  const counts = new Map<string, number>();
  for (const entry of api.data?.entries || []) {
    if (entry.kind === "expense" && entry.status !== "pending_review") counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  }
  const defaultOrder = new Map(commonCategories.map((category, index) => [category, index]));
  return Array.from(new Set(categories)).filter((category) => !!category && !categoryIsHidden(category))
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) ||
      (defaultOrder.get(a) ?? 999) - (defaultOrder.get(b) ?? 999) || a.localeCompare(b, "pt-BR"));
};
const sortSubcategoriesByUse = (category: string, items: Iterable<string>) => {
  const counts = new Map<string, number>();
  for (const entry of api.data?.entries || []) {
    if (entry.kind === "expense" && entry.status !== "pending_review" && entry.category === category && entry.subcategory)
      counts.set(entry.subcategory, (counts.get(entry.subcategory) || 0) + 1);
  }
  const defaultOrder = new Map((subcategorySuggestions[category] || []).map((name, index) => [name, index]));
  return Array.from(new Set(items)).filter(Boolean).sort((a, b) =>
    (counts.get(b) || 0) - (counts.get(a) || 0) ||
    (defaultOrder.get(a) ?? 999) - (defaultOrder.get(b) ?? 999) || a.localeCompare(b, "pt-BR"));
};
const categoryOptions = (current: string) => {
  const categories = sortCategoriesByUse([
    ...commonCategories,
    ...(api.data?.category_presets || []).map((item) => item.category),
    ...(api.data?.entries || []).map((entry) => entry.category),
    ...(api.data?.recurring || []).map((entry) => entry.category),
  ]);
  if (current && categoryIsHidden(current)) categories.push(current);
  return categories.map((category) => opt(category, categoryIsHidden(category) ? `${category} · lançamento antigo` : category, current)).join("");
};
const subcategoriesFor = (category: string) => sortSubcategoriesByUse(category, [
  ...(api.data?.category_presets || []).filter((item) => item.category === category).map((item) => item.subcategory || ""),
  ...(subcategorySuggestions[category] || []),
  ...(api.data?.entries || []).filter((entry) => entry.category === category).map((entry) => entry.subcategory || ""),
]);
const subcategoryList = (category: string) => `<datalist id="subcategories">${subcategoriesFor(category).map((subcategory) => `<option value="${esc(subcategory)}"></option>`).join("")}</datalist>`;
const subcategoryChips = (category: string, selected = "") => subcategoriesFor(category).slice(0, 7)
  .map((item) => button("pick-subcategory", item, `subcategory-chip ${item === selected ? "selected" : ""}`, `data-value="${esc(item)}"`)).join("");
const quickGroceries = [
  ["Arroz", "pacote"], ["Feijão", "pacote"], ["Leite", "litro"],
  ["Ovos", "dúzia"], ["Pão", "pacote"], ["Café", "pacote"],
  ["Banana", "kg"], ["Frango", "kg"], ["Óleo", "garrafa"],
  ["Papel higiênico", "pacote"], ["Detergente", "unidade"], ["Sabão em pó", "pacote"],
] as const;
const daysFromToday = (date: string) => Math.floor(
  (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today()}T12:00:00Z`)) / 86400000,
);
const reminderTiming = (date: string) => {
  const days = daysFromToday(date);
  return days < 0 ? `Atrasado há ${Math.abs(days)} dia(s)` : days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`;
};
const nextReminderDate = (reminder: Reminder & { due_on: string }) => {
  if (reminder.recurrence === "weekly")
    return new Date(Date.parse(`${reminder.due_on}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const months = reminder.recurrence === "yearly" ? 12 : 1;
  const targetMonth = addMonths(reminder.due_on.slice(0, 7), months);
  const [year, month] = targetMonth.split("-").map(Number);
  const day = Number(reminder.due_on.slice(8, 10));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${targetMonth}-${String(Math.min(day, last)).padStart(2, "0")}`;
};
const reminderDatesInMonth = (reminder: Reminder, monthKey: string) => {
  if (!reminder.due_on || reminder.kind === "post_it") return [];
  const dates: string[] = [];
  const [year, monthNumber] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const end = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  let date = reminder.due_on;
  if (reminder.recurrence === "once") return date >= start && date <= end ? [date] : [];
  if (reminder.recurrence === "monthly" || reminder.recurrence === "yearly") {
    const [dueYear, dueMonth] = reminder.due_on.slice(0, 7).split("-").map(Number);
    if (reminder.recurrence === "yearly" && (dueMonth !== monthNumber || dueYear > year)) return [];
    if (reminder.recurrence === "monthly" && reminder.due_on.slice(0, 7) > monthKey) return [];
    const day = Number(reminder.due_on.slice(8, 10));
    const actual = Math.min(day, lastDay);
    date = `${monthKey}-${String(actual).padStart(2, "0")}`;
    return date >= reminder.due_on ? [date] : [];
  }
  while (date < start) date = new Date(Date.parse(`${date}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  while (date <= end) {
    dates.push(date);
    date = new Date(Date.parse(`${date}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  }
  return dates;
};
const share = (collection: string, r: { id: string; shared: boolean; owner_id?: string; area?: string }) => {
  const isOwner = r.owner_id === api.userId;
  const canToggle = admin() && !(collection === "entries" && !isOwner && r.area === "personal") ||
    (!admin() && collection === "entries" && isOwner && r.area === "personal");
  if (canToggle) {
    const label = collection === "entries" && !admin()
      ? r.shared ? "Compartilhado" : "Compartilhar com a família"
      : r.shared ? "Compartilhado" : "Privado";
    return button(
      "share",
      label,
      collection === "entries" && !admin() ? (r.shared ? "badge shared" : "secondary") : r.shared ? "badge shared" : "badge private",
      `data-table="${collection}" data-id="${esc(r.id)}" data-shared="${r.shared}" aria-label="${r.shared ? "Remover compartilhamento" : "Compartilhar com a família"}"`,
    );
  }
  const label = collection === "entries" && r.area === "household"
    ? "Gasto da casa"
    : r.shared ? "Compartilhado" : "Seu registro";
  return `<span class="badge ${r.shared ? "shared" : "private"}">${label}</span>`;
};
const empty = (text: string, action?: string) => emptyState(page, text, action);
const formEnd = (label = "Salvar") => formActions(label, busy);
const ctx = (): ViewCtx => ({ api, month, today: today(), busy, names, own, empty });
// Itens escondidos da tela "Agora": adiados (até amanhã) e pulados (até fechar o app).
function focusHidden() {
  const snoozed = stored<Record<string, string>>("local", SNOOZE_KEY, {});
  const skipped = stored<string[]>("session", SKIP_KEY, []);
  return new Set([...Object.entries(snoozed).filter(([, until]) => until > today()).map(([key]) => key), ...skipped]);
}
const remindersOn = () => "Notification" in window && Notification.permission === "granted";
const queue = () => focusQueue(api.data!, api.userId, new Date(), today(), focusHidden());
const deleteButton = (table: string, id: string) =>
  button(
    "delete",
    "Excluir",
    "text-button danger",
    `data-table="${table}" data-id="${esc(id)}"`,
  );
function login() {
  return `<main class="login"><section class="login-story"><a class="brand"><span class="brand-mark">${icon("goals")}</span>Financeiro<span>360</span></a><div class="story-content"><span class="eyebrow">SUA CASA. SEU EQUILÍBRIO.</span><h1>Cuide do dinheiro.<br><em>Viva melhor em família.</em></h1><p>Finanças organizadas, uma despensa planejada e mais tranquilidade para o que realmente importa.</p><div class="story-cards"><article><span>${icon("cards")}</span><strong>Tudo no lugar</strong><small>Gastos, faturas e comprovantes</small></article><article><span>${icon("family")}</span><strong>Privacidade com controle</strong><small>Cada pessoa vê o que deve ver</small></article><article><span>${icon("pantry")}</span><strong>Uma casa mais inteligente</strong><small>Menos desperdício, compras melhores</small></article></div></div><small>Organização começa com pequenos hábitos.</small></section><section class="login-form"><div class="welcome-mark">${icon("overview")}</div><span class="eyebrow">BEM-VINDO À SUA CASA</span><h2>Vamos organizar o dia?</h2><p>Acesse seu espaço seguro da família.</p>${notice ? `<div class="notice" role="alert">${esc(notice)}</div>` : ""}<form id="login-form">${field("email", "Seu e-mail", input("email", "email", "", 'autocomplete="username" required'))}${field("password", "Sua senha", input("password", "password", "", 'autocomplete="current-password" required'))}<button class="primary full" type="submit" ${busy ? "disabled" : ""}>${busy ? "Entrando…" : "Entrar no meu painel"} ${icon("arrow")}</button></form><div class="divider"><span>CONHEÇA O APP</span></div>${button("demo", "Explorar demonstração", "secondary full")}<p class="fine">A demonstração usa dados fictícios e não guarda informações. Para acessar seus dados reais, use a conta cadastrada pelo administrador.</p></section></main>`;
}
function quickPanel() {
  const allowed: Record<QuickAction, boolean> = { expense: api.allowed("entries"), cards: true, shopping: true, pantry: true };
  const visible = api.preferences.quick_actions.filter((id) => id !== "expense" && allowed[id]);
  return visible.length ? `<nav class="quick-panel" aria-label="Seus atalhos">${visible.map((id) => button("nav", actionNames[id], "secondary", `data-page="${id === "cards" ? "cards" : id === "shopping" ? "shopping" : "pantry"}"`)).join("")}</nav>` : "";
}
// Lançar em uma linha: o texto vira um rascunho que a pessoa confere no formulário antes de salvar.
function quickEntry() {
  if (!api.allowed("entries")) return "";
  const frequent = frequentEntries(api.data!.entries.filter(own), today());
  return `<form id="quick-form" class="panel quick-entry" autocomplete="off"><label for="quick-text" class="eyebrow">LANÇAR RÁPIDO</label><div class="quick-row"><input id="quick-text" name="text" type="text" maxlength="200" enterkeyhint="go" placeholder="Ex.: mercado 52,30 nubank 3x" aria-describedby="quick-help"><button class="primary" type="submit">Conferir</button></div>${
    frequent.length ? `<div class="chips" aria-label="Repetir um gasto frequente">${frequent.map((e) => `<button type="button" class="chip" data-action="repeat-entry" data-id="${e.id}">↻ ${esc(e.description)}</button>`).join("")}</div>` : ""
  }<p class="fine" id="quick-help">Escreva o valor, e se quiser o cartão, as parcelas (3x), “ontem” ou “vence dia 10”. Você confere antes de salvar.</p></form>`;
}
// Modo foco: o Início mostra só o próximo passo, o dia de hoje e o lançamento rápido.
function focusSummary() {
  const items = agendaItems(api.data!, today(), today(), api.userId, "mine", today());
  return `${focusCard(queue(), ctx(), doneToday(api.data!, api.userId, today()), false)}${quickEntry()}<section class="panel"><div class="panel-title"><div><span class="eyebrow">HOJE</span><h3>Seu dia</h3></div>${button("nav", "Abrir agenda", "text-button", 'data-page="agenda"')}</div>${
    items.length
      ? `<div class="records">${items.map((i) => `<article class="record"><span class="agenda-time">${esc(i.time || "Dia todo")}</span><div class="record-info"><strong>${esc(i.title)}</strong>${i.detail ? `<small>${esc(i.detail)}</small>` : ""}</div>${i.cents !== null ? `<strong class="record-value">${brl(i.cents)}</strong>` : ""}</article>`).join("")}</div>`
      : '<p class="fine">Nada marcado para você hoje.</p>'
  }</section><p class="fine">Modo foco ligado. Para ver o painel completo, desligue em Perfil → Aparência.</p>`;
}
// Validade e rotina da casa no painel "Próximos passos" do Início.
function houseInsights(data: Data) {
  const care = attention(data.pantry);
  const chores = taskGroups(data.tasks);
  const choresNow = [...chores.overdue, ...chores.today];
  const expiring = care.expiring.length
    ? `<article class="insight warning"><span>${icon("check")}</span><div><strong>${care.expiring.length} produto(s) vencendo</strong><p>${care.expiring.slice(0, 3).map((p) => `${esc(p.name)} (${esc(expiry(p)!.label.toLocaleLowerCase())})`).join(", ")}. Use primeiro para não desperdiçar.</p>${button("nav", "Ver despensa", "text-button", 'data-page="pantry" data-house="pantry"')}</div></article>`
    : "";
  const routine = api.householdReady
    ? `<article class="insight ${chores.overdue.length ? "warning" : ""}"><span>${icon("family")}</span><div><strong>${choresNow.length ? `${choresNow.length} tarefa(s) da casa para hoje` : "Rotina da casa em dia"}</strong><p>${choresNow.length ? choresNow.slice(0, 3).map((t) => `${esc(t.title)}${t.assignee_id ? ` · ${esc(names(t.assignee_id))}` : ""}`).join("; ") + (chores.overdue.length ? `. ${chores.overdue.length} atrasada(s).` : ".") : "Nenhuma tarefa atrasada ou marcada para hoje."}</p>${button("nav", "Ver rotina", "text-button", 'data-page="pantry" data-house="tasks"')}</div></article>`
    : "";
  return expiring + routine;
}
function summary() {
  if (api.preferences.focus_mode) return focusSummary();
  const data = api.data!;
  const monthly = metrics(data, month);
  const cash = financialTotals(data.entries, month);
  const picture = monthPicture(data, month);
  const groups = spendingGroups(data, month);
  const monthName = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const previousMonth = addMonths(month, -1);
  const previousSpending = metrics(data, previousMonth).spend;
  const trend = previousSpending ? Math.round((monthly.spend - previousSpending) / previousSpending * 100) : null;
  const accountBalances = data.accounts.map((account) => balance(data, account)).filter((value): value is number => value !== null);
  const knownBalance = accountBalances.reduce((sum, value) => sum + value, 0);
  const pendingReviews = data.entries.filter((entry) => entry.status === "pending_review").length;
  const urgentReminders = data.reminders.filter((item) => item.kind !== "post_it" && item.due_on && !item.completed && daysFromToday(item.due_on) <= 7)
    .sort((x, y) => x.due_on!.localeCompare(y.due_on!));
  const lowPantry = data.pantry.filter((item) => {
    const estimate = forecast(item);
    return estimate.stock <= item.minimum || estimate.days !== null && estimate.days < 7;
  });
  const householdPercent = data.home.budget_cents ? Math.min(100, Math.round(monthly.home / data.home.budget_cents * 100)) : 0;
  return `<section class="overview-heading"><div><span class="eyebrow">VISÃO DA FAMÍLIA</span><h2>Seu mês, sem complicação.</h2><p>Valores de ${esc(monthName)}. Você vê apenas os registros permitidos para a sua conta.</p></div>${button("nav", "Ver análises", "secondary", 'data-page="analysis"')}</section>
  <section class="overview-hero"><div><span class="eyebrow">GASTOS LANÇADOS NO MÊS</span><strong>${brl(monthly.spend)}</strong><p>Compras pelo valor total, inclusive no cartão. Este número mostra quanto foi gasto, não quanto saiu da conta.</p><span class="overview-trend">${trend === null ? "Sem comparação com o mês anterior" : `${trend > 0 ? "↑" : trend < 0 ? "↓" : "="} ${Math.abs(trend)}% em relação ao mês anterior`}</span></div><div class="overview-hero-art" aria-hidden="true"><span></span><span></span><span></span><span></span></div></section>
  <div class="cash-summary" aria-label="Dinheiro recebido e pago no mês"><article class="cash-tile cash-received"><span>${icon("accounts")} Entrou nas contas</span><strong>${brl(cash.received)}</strong><small>Receitas confirmadas</small></article><article class="cash-tile cash-paid"><span>${icon("entries")} Saiu das contas</span><strong>${brl(cash.paid)}</strong><small>Pagamentos confirmados, inclusive faturas</small></article></div>
  <section class="quick-create"><div><span class="eyebrow">REGISTRE EM SEGUNDOS</span><h3>O que aconteceu agora?</h3></div><div class="quick-create-actions">${api.allowed("entries") ? (api.preferences.quick_actions.includes("expense") ? button("quick-expense", `${icon("plus")} Gasto rápido`, "primary") : "") + button("add-entry", "Mais detalhes", "secondary") + button("add-income", `${icon("accounts")} Receita`, "secondary") + button("add-payable", `${icon("calendar")} Conta a pagar`, "secondary") + button("transfer", `${icon("arrow")} Transferência`, "secondary") : ""}</div></section>${quickPanel()}
  ${focusCard(queue(), ctx(), doneToday(data, api.userId, today()), false)}${quickEntry()}
  <div class="overview-status"><article><span>A pagar neste mês</span><strong>${brl(picture.due)}</strong><small>Contas pendentes e faturas por vencimento</small></article><article><span>Saldo conhecido em contas</span><strong>${accountBalances.length ? brl(knownBalance) : "Ainda não informado"}</strong><small>${accountBalances.length} conta(s) com saldo visível</small></article><article><span>Para conferir</span><strong>${pendingReviews}</strong><small>Lançamentos fora dos totais até confirmar</small></article></div>
  ${committedPanel(ctx())}
  ${data.home.budget_cents ? `<section class="budget-strip"><div><span>Orçamento do lar</span><strong>${brl(monthly.home)} de ${brl(data.home.budget_cents)}</strong></div><div class="bar"><b style="width:${householdPercent}%"></b></div><small>${householdPercent}% usado pelos gastos visíveis da casa</small></section>` : ""}
  ${urgentReminders.length ? `<section class="overview-alert"><span>${icon("reminders")}</span><div><strong>${urgentReminders.length} aviso(s) próximos</strong><p>${urgentReminders.slice(0, 2).map((item) => `${esc(item.title)} · ${reminderTiming(item.due_on!)}`).join("<br>")}</p></div>${button("nav", "Abrir calendário", "text-button", 'data-page="calendar"')}</section>` : ""}
  <div class="overview-chart">${flowChart(financialSeries(data, month, "monthly").slice(-6), "Entradas e saídas · 6 meses")}${button("nav", "Explorar meses e anos", "text-button", 'data-page="analysis"')}</div>
  <div class="dashboard-grid"><section class="panel" data-widget="categories"><div class="panel-title"><div><span class="eyebrow">ONDE FOI GASTO</span><h3>Principais categorias</h3></div>${button("nav", "Ver detalhes", "text-button", 'data-page="analysis"')}</div>${groups.length ? `<div class="category-chart">${groups.slice(0, 5).map((group, index) => `<div class="category-row"><span><i style="background:var(--chart-${index % 4})"></i>${esc(group.name)}</span><strong>${brl(group.total)}</strong><div class="bar"><b style="width:${monthly.spend ? Math.round(group.total / monthly.spend * 100) : 0}%;background:var(--chart-${index % 4})"></b></div></div>`).join("")}</div>` : '<p class="fine">Os gastos classificados aparecerão aqui.</p>'}</section><section class="panel intelligence" data-widget="insights"><div class="panel-title"><div><span class="eyebrow">PRECISA DE ATENÇÃO</span><h3>Próximos passos</h3></div></div>${monthly.overdue.length ? `<article class="insight warning"><span>${icon("calendar")}</span><div><strong>${monthly.overdue.length} conta(s) vencida(s)</strong><p>Confira ${brl(monthly.overdue.reduce((sum, item) => sum + item.amount_cents, 0))} em pendências.</p></div></article>` : `<article class="insight"><span>${icon("check")}</span><div><strong>Sem vencimentos atrasados</strong><p>Os registros visíveis estão em dia.</p></div></article>`}<article class="insight"><span>${icon("pantry")}</span><div><strong>${lowPantry.length ? `${lowPantry.length} produto(s) para repor` : "Despensa em ordem"}</strong><p>${lowPantry.length ? lowPantry.slice(0, 3).map((item) => esc(item.name)).join(", ") : "O estoque cadastrado não pede reposição agora."}</p></div></article>${houseInsights(data)}</section><section class="panel wide-panel" data-widget="recent"><div class="panel-title"><div><span class="eyebrow">ÚLTIMOS REGISTROS</span><h3>Movimentações recentes</h3></div>${button("nav", "Ver todos", "text-button", 'data-page="entries"')}</div>${entryList([...data.entries].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5))}</section></div><p class="fine overview-footnote">Recebido e pago consideram apenas operações confirmadas. Transferências entre contas não entram como receita ou despesa. Gastos incluem o valor integral da compra na data do lançamento.</p>`;
}
function entryList(rows: Entry[]) {
  if (!rows.length) return empty("Nenhum lançamento por aqui", "add-entry");
  const kindNames: Record<Entry["kind"], string> = {
    expense: "Gasto", income: "Receita", card_payment: "Fatura paga",
    transfer: "Transferência", debt_payment: "Empréstimo pago",
  };
  return `<div class="records">${rows.map((entry) => {
    const card = entry.card_id ? api.data!.cards.find((item) => item.id === entry.card_id) : undefined;
    const invoiceMonthLabel = entry.kind === "expense" && entry.payment === "card" && card
      ? entry.first_invoice_month || invoiceMonth(entry.date, card.closing_day) : null;
    const canManage = (admin() || own(entry)) && api.allowed("entries");
    const entryActions = `${share("entries", entry)}${invoiceMonthLabel ? button("entry-invoice", "Ver fatura", "text-button", `data-id="${entry.id}"`) : ""}${canManage && (entry.kind === "expense" || entry.kind === "income") && !entry.source_ref?.startsWith(CARNE_PREFIX) ? button("repeat-entry", "Repetir", "text-button", `data-id="${entry.id}" aria-label="Lançar de novo: ${esc(entry.description)}"`) : ""}${canManage ? button("edit-entry", "Editar lançamento", "text-button", `data-id="${entry.id}"`) : ""}${entry.status === "pending_review" && canManage ? button("confirm-entry", "Confirmar lançamento", "text-button", `data-id="${entry.id}"`) : ""}${canManage ? deleteButton("entries", entry.id) : ""}`;
    const state = entry.status === "pending_review" ? "Em revisão" : entry.status === "pending" ? "A pagar" : entry.payment === "card" ? "No cartão" : "Confirmado";
    return `<article class="record money-record"><span class="record-icon ${entry.kind === "income" ? "income" : entry.kind === "expense" ? "expense" : "movement"}">${icon(entry.payment === "card" ? "cards" : entry.kind === "income" ? "accounts" : "entries")}</span><div class="record-info"><div class="record-title-line"><strong>${esc(entry.description)}</strong><span class="record-kind">${kindNames[entry.kind]}</span></div><small>${entry.date.split("-").reverse().join("/")}${entry.payee ? ` · ${esc(entry.payee)}` : ""} · ${esc(entry.category)}${entry.subcategory ? ` / ${esc(entry.subcategory)}` : ""}${invoiceMonthLabel ? ` · ${esc(card!.name)} (${invoiceMonthLabel.split("-").reverse().join("/")})` : ""}</small><span class="record-owner">${esc(names(entry.owner_id))} · ${{ household: "Casa", personal: "Pessoal", business: "Empresa" }[entry.area]}</span></div><div class="record-value"><strong class="${entry.kind === "income" ? "positive" : entry.kind === "expense" ? "negative" : ""}">${entry.kind === "income" ? "+" : entry.kind === "expense" ? "−" : ""}${brl(entry.amount_cents)}</strong><small class="record-state ${entry.status}">${state}${entry.installments > 1 ? ` · ${entry.installments}x` : ""}</small></div>${entry.status === "pending" && canManage && api.allowed("payments") ? button("paid", "Marcar pago", "secondary record-pay", `data-id="${entry.id}"`) : ""}<details class="record-menu"><summary aria-label="Opções de ${esc(entry.description)}">•••</summary><div class="record-menu-pop">${entryActions}</div></details></article>`;
  }).join("")}</div>`;
}
function flowChart(points: FlowPoint[], title: string) {
  const peak = Math.max(1, ...points.flatMap((point) => [point.received, point.paid]));
  return `<section class="panel flow-chart-panel"><div class="panel-title"><div><span class="eyebrow">DINHEIRO EM MOVIMENTO</span><h3>${esc(title)}</h3></div><div class="flow-legend"><span><i class="legend-in"></i>Recebido</span><span><i class="legend-out"></i>Pago</span></div></div><div class="flow-chart-scroll"><div class="flow-chart" role="img" aria-label="Comparação entre valores recebidos e pagos por período">${points.map((point) => `<div class="flow-column"><div class="flow-bars"><span class="flow-bar flow-bar-in" style="height:${point.received ? Math.max(3, Math.round(point.received / peak * 100)) : 0}%" title="${esc(point.label)}: recebido ${esc(formatBrl(point.received))}"></span><span class="flow-bar flow-bar-out" style="height:${point.paid ? Math.max(3, Math.round(point.paid / peak * 100)) : 0}%" title="${esc(point.label)}: pago ${esc(formatBrl(point.paid))}"></span></div><span class="flow-label">${esc(point.label)}</span></div>`).join("")}</div></div><details class="chart-data"><summary>Ver valores do gráfico</summary><div class="chart-data-table"><table><thead><tr><th>Período</th><th>Recebido</th><th>Pago</th><th>Gastos lançados</th></tr></thead><tbody>${points.map((point) => `<tr><th>${esc(point.label)}</th><td>${brl(point.received)}</td><td>${brl(point.paid)}</td><td>${brl(point.spending)}</td></tr>`).join("")}</tbody></table></div></details><p class="fine">Compras no cartão entram em “gastos lançados”. O dinheiro sai das contas quando a fatura é paga.</p></section>`;
}
function spendingDonut(groups: ReturnType<typeof spendingGroups>) {
  const total = groups.reduce((sum, item) => sum + item.total, 0);
  if (!total) return '<div class="spending-donut empty-donut"><span>Sem gastos</span></div>';
  const segments = groups.slice(0, 4).map((item) => item.total);
  const rest = groups.slice(4).reduce((sum, item) => sum + item.total, 0);
  if (rest) segments.push(rest);
  const colors = ["#20745d", "#76a493", "#e8ac72", "#92a9c7", "#d8dfe3"];
  let cursor = 0;
  const stops = segments.map((value, index) => {
    const start = cursor;
    cursor += value / total * 100;
    return `${colors[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return `<div class="spending-donut" style="background:conic-gradient(${stops.join(",")})"><span><small>Total de gastos</small><strong>${brl(total)}</strong></span></div>`;
}
function analysis() {
  const data = api.data!;
  const year = month.slice(0, 4);
  const prefix = analysisPeriod === "monthly" ? month : year;
  const totals = financialTotals(data.entries, prefix);
  const groups = spendingGroups(data, prefix);
  const points = financialSeries(data, month, analysisPeriod);
  return `<section class="page-intro"><div><h2>Entenda o ritmo da casa.</h2><p>Compare o que entrou, o que foi pago e onde os gastos aconteceram.</p></div><div class="period-switch" role="group" aria-label="Período dos gráficos">${button("analysis-period", "Mês a mês", analysisPeriod === "monthly" ? "active" : "", 'data-period="monthly"')}${button("analysis-period", "Ano a ano", analysisPeriod === "yearly" ? "active" : "", 'data-period="yearly"')}</div></section><section class="analysis-summary"><article class="analysis-total received"><span>Recebido · ${analysisPeriod === "monthly" ? month.split("-").reverse().join("/") : year}</span><strong>${brl(totals.received)}</strong><small>Receitas confirmadas</small></article><article class="analysis-total paid"><span>Pago</span><strong>${brl(totals.paid)}</strong><small>Saídas confirmadas das contas</small></article><article class="analysis-total spending"><span>Gastos lançados</span><strong>${brl(totals.spending)}</strong><small>Valor integral das compras</small></article></section>${flowChart(points, analysisPeriod === "monthly" ? "Últimos 12 meses" : "Últimos 5 anos")}<div class="analysis-breakdown"><section class="panel"><div class="panel-title"><div><span class="eyebrow">COMPOSIÇÃO DOS GASTOS</span><h3>Por categoria</h3></div></div>${spendingDonut(groups)}</section><section class="panel"><div class="panel-title"><div><span class="eyebrow">CLASSIFICAÇÃO</span><h3>Categorias e subcategorias</h3></div>${button("nav", "Gerenciar", "text-button", 'data-page="categories"')}</div>${groups.length ? groups.map((group, index) => `<details class="analysis-category"><summary><span><i style="background:var(--chart-${index % 4})"></i>${esc(group.name)}</span><strong>${brl(group.total)}</strong></summary><div>${group.subcategories.map(([name, value]) => `<p class="detail-line">${esc(name)} <strong>${brl(value)}</strong></p>`).join("")}</div></details>`).join("") : '<p class="fine">Sem gastos nesse período. Escolha outro mês ou registre um gasto.</p>'}</section></div>`;
}
function categories() {
  const presets = api.data!.category_presets;
  const names = sortCategoriesByUse([...commonCategories, ...presets.map((item) => item.category),
    ...api.data!.entries.map((item) => item.category)]);
  return `<section class="page-intro"><div><h2>Classifique sem esforço.</h2><p>Escolha sugestões prontas ou crie opções para usar nos próximos lançamentos.</p></div>${api.allowed("entries") ? button("add-category-preset", icon("plus") + " Criar opção") : ""}</section><div class="category-library">${names.map((name) => {
    const custom = presets.filter((item) => item.category === name && !categoryIsHidden(item.category));
    const suggestions = Array.from(new Set([...(subcategorySuggestions[name] || []),
      ...custom.map((item) => item.subcategory || ""),
      ...api.data!.entries.filter((item) => item.category === name).map((item) => item.subcategory || "")])).filter(Boolean);
    return `<section class="panel category-library-card"><div class="panel-title"><h3>${esc(name)}</h3><span class="badge">${suggestions.length} tipo(s)</span></div><div class="category-tags">${suggestions.length ? suggestions.map((item) => `<span>${esc(item)}</span>`).join("") : '<span>Sem subcategoria ainda</span>'}</div>${api.allowed("entries") ? button("add-subcategory", `${icon("plus")} Adicionar subcategoria`, "secondary full", `data-category="${esc(name)}"`) : ""}${custom.length ? `<details class="category-saved-options" open><summary>Opções salvas (${custom.length})</summary>${custom.map((item) => `<div class="category-custom-row"><span>${esc(item.subcategory || "Categoria personalizada")}${item.shared ? " · Família" : ""}</span>${item.owner_id === api.userId && api.allowed("entries") ? button("edit-category-preset", "Editar", "text-button", `data-id="${item.id}"`) + deleteButton("category_presets", item.id) : ""}</div>`).join("")}</details>` : ""}</section>`;
  }).join("")}</div><p class="fine section-gap">Crie aqui as opções que deseja encontrar facilmente nos próximos lançamentos. Editar uma opção não altera lançamentos antigos.</p>`;
}
function entries() {
  const data = api.data!;
  const categoryNames = sortCategoriesByUse(data.entries.map((item) => item.category));
  const subcategoryNames = Array.from(new Set(data.entries.filter((item) => entryCategory === "all" || item.category === entryCategory)
    .map((item) => item.subcategory).filter((item): item is string => !!item))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const rows = data.entries.filter((entry) => entry.date.startsWith(month) &&
    (entryKind === "all" || entryKind === "expenses" && entry.kind === "expense" ||
      entryKind === "income" && entry.kind === "income" ||
      entryKind === "payments" && ["card_payment", "debt_payment"].includes(entry.kind) ||
      entryKind === "transfers" && entry.kind === "transfer") &&
    (area === "all" || entry.area === area) && (owner === "all" || entry.owner_id === owner) &&
    (status === "all" || entry.status === status) &&
    (entryCategory === "all" || entry.category === entryCategory) &&
    (entrySubcategory === "all" || entry.subcategory === entrySubcategory) &&
    `${entry.description} ${entry.payee || ""} ${entry.category} ${entry.subcategory || ""}`
      .toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at || "").localeCompare(a.created_at || ""));
  const totals = financialTotals(data.entries, month);
  const tabs = [["all", "Tudo"], ["expenses", "Gastos"], ["income", "Receitas"],
    ["payments", "Pagamentos"], ["transfers", "Transferências"]];
  return `<section class="page-intro"><div><h2>Todos os movimentos, no lugar certo.</h2><p>Veja gastos, dinheiro recebido e pagamentos sem misturar os totais.</p></div><div class="button-row">${button("nav", "Categorias", "secondary", 'data-page="categories"')}${api.allowed("entries") ? button("add-entry", icon("plus") + " Novo lançamento") : ""}</div></section><div class="entry-overview"><div><span>Gastos lançados</span><strong>${brl(totals.spending)}</strong></div><div><span>Entrou</span><strong>${brl(totals.received)}</strong></div><div><span>Saiu das contas</span><strong>${brl(totals.paid)}</strong></div></div><section class="panel entry-panel"><div class="entry-tabs" role="group" aria-label="Tipo de lançamento">${tabs.map(([kind, label]) => button("entry-kind", label, entryKind === kind ? "active" : "", `data-kind="${kind}" aria-pressed="${entryKind === kind}"`)).join("")}</div><div class="entry-search">${input("search", "search", filter, 'placeholder="Buscar descrição, lugar ou categoria" aria-label="Buscar lançamentos"')}<span>${rows.length} registro(s)</span></div><details class="entry-extra-filters" ${entryFiltersOpen ? "open" : ""}><summary>Filtrar por pessoa, categoria ou situação</summary><div class="filters"><select name="area" aria-label="Filtrar área">${opt("all", "Todas as áreas", area) + opt("household", "Casa", area) + opt("personal", "Pessoal", area) + opt("business", "Empresa", area)}</select><select name="owner" aria-label="Filtrar responsável">${opt("all", "Todas as pessoas", owner) + data.members.map((item) => opt(item.user_id, item.display_name, owner)).join("")}</select><select name="status" aria-label="Filtrar situação">${opt("all", "Todas as situações", status) + opt("paid", "Confirmados", status) + opt("pending", "A pagar", status) + opt("pending_review", "Em revisão", status)}</select><select name="entry_category" aria-label="Filtrar categoria">${opt("all", "Todas as categorias", entryCategory) + categoryNames.map((item) => opt(item, item, entryCategory)).join("")}</select><select name="entry_subcategory" aria-label="Filtrar subcategoria">${opt("all", "Todas as subcategorias", entrySubcategory) + subcategoryNames.map((item) => opt(item, item, entrySubcategory)).join("")}</select></div></details>${entryList(rows)}</section>`;
}
const cardDueDate = (card: Data["cards"][number]) => dueDate(month, {
  id: card.id, name: card.name, owner: "wife", limitCents: card.limit_cents || 0,
  closingDay: card.closing_day, dueDay: card.due_day,
});
function cards() {
  const d = api.data!;
  const duplicates = d.cards.filter((card) => !card.archived_at && d.cards.some((other) => other.id !== card.id && !other.archived_at && other.owner_id === card.owner_id && other.name.trim().toLocaleLowerCase() === card.name.trim().toLocaleLowerCase() && other.closing_day === card.closing_day && other.due_day === card.due_day));
  const availableCards = d.cards.filter((card) => !card.archived_at);
  const owners = d.members.filter((member) => availableCards.some((card) => card.owner_id === member.user_id));
  const visibleCards = availableCards.filter((card) =>
    (cardIdFilter === "all" || card.id === cardIdFilter) &&
    (cardOwnerFilter === "all" || card.owner_id === cardOwnerFilter) &&
    (cardStatusFilter === "all" || (cardStatusFilter === "open" ? invoice(d, card, month).remaining > 0 : invoice(d, card, month).remaining === 0)))
    .sort((a, b) => cardDueDate(a).localeCompare(cardDueDate(b)));
  const invoiceTotal = visibleCards.reduce((sum, card) => sum + invoice(d, card, month).total, 0);
  const openTotal = visibleCards.reduce((sum, card) => sum + invoice(d, card, month).remaining, 0);
  const nextDue = visibleCards.filter((card) => invoice(d, card, month).remaining > 0)
    .map((card) => ({ card, date: cardDueDate(card) })).sort((a, b) => a.date.localeCompare(b.date))[0];
  const tabs = segmented("cards-tab", cardsTab, [["invoices", "Faturas"], ["plans", "Parcelamentos"], ["future", "Próximos meses"]], "Seções de cartões");
  if (cardsTab !== "invoices")
    return `<section class="page-intro"><div><h2>Cartões sem surpresas.</h2><p>Parcelas previstas, o que ainda falta pagar e o que já está comprometido nos próximos meses.</p></div>${api.allowed("cards") ? button("add-card", icon("plus") + " Adicionar cartão") : ""}</section>${tabs}${cardsTab === "plans" ? plansView(ctx()) : futureView(ctx())}`;
  return `<section class="page-intro"><div><h2>Cartões sem surpresas.</h2><p>Confira o total de cada cartão e seu próprio vencimento.</p></div>${api.allowed("cards") ? button("add-card", icon("plus") + " Adicionar cartão") : ""}</section>${tabs}${duplicates.length ? `<div class="hint-banner">${icon("cards")}<div><strong>Possíveis cartões duplicados</strong><p>${[...new Set(duplicates.map((item) => item.name))].map(esc).join(", ")}. Abra o cartão que será removido e toque em “Unir duplicado”. Compras e anexos serão preservados.</p></div></div>` : ""}<section class="panel card-filter-panel"><div class="card-filter-heading"><div><span class="eyebrow">FATURAS PREVISTAS</span><strong>${brl(invoiceTotal)}</strong></div><div><span class="eyebrow">EM ABERTO</span><strong>${brl(openTotal)}</strong></div><div><span class="eyebrow">PRÓXIMO VENCIMENTO</span><strong>${nextDue ? `${esc(nextDue.card.name)} · ${nextDue.date.split("-").reverse().join("/")}` : "Nenhum"}</strong></div></div><div class="card-filters"><label><span>Cartão</span><select name="card_id_filter">${opt("all", "Todos os cartões", cardIdFilter)}${availableCards.map((card) => opt(card.id, card.name, cardIdFilter)).join("")}</select></label><label><span>Titular</span><select name="card_owner_filter">${opt("all", "Todos os titulares", cardOwnerFilter)}${owners.map((member) => opt(member.user_id, member.display_name, cardOwnerFilter)).join("")}</select></label><label><span>Situação</span><select name="card_status_filter">${opt("all", "Todas as faturas", cardStatusFilter)}${opt("open", "Com valor em aberto", cardStatusFilter)}${opt("paid", "Quitadas", cardStatusFilter)}</select></label></div><p class="fine">Os totais respeitam a fatura e o vencimento cadastrados em cada cartão.</p></section><div class="card-grid">${
    visibleCards
      .map((c, i) => {
        const f = invoice(d, c, month),
          openMonth = invoiceMonth(today(), c.closing_day),
          lines = invoiceInstallments(d.entries, c, month),
          categoryTotals = Array.from(lines.reduce((totals, line) =>
            totals.set(line.entry.category, (totals.get(line.entry.category) || 0) + line.amount_cents),
          new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);
        return `<section class="panel card-panel"><div class="credit-card cc-${i % 3}"><span>${esc(c.name)}</span>${icon("cards")}<strong>•••• &nbsp; •••• &nbsp; ••••</strong><small>${esc(names(c.owner_id))}</small></div><p class="invoice-open-hint">Compras feitas agora entram na fatura de <strong>${openMonth.split("-").reverse().join("/")}</strong> ${month !== openMonth ? button("open-invoice", "Abrir fatura em aberto", "text-button", `data-month="${openMonth}"`) : ""}</p><div class="invoice-stats"><div><span>Fatura prevista · ${month.split("-").reverse().join("/")}</span><strong>${brl(f.total)}</strong></div><div><span>A pagar · vence ${cardDueDate(c).split("-").reverse().join("/")}</span><strong>${brl(f.remaining)}</strong></div></div>${f.alignment ? `<p class="fine">Alinhada em ${f.alignment.cutoff_on.split("-").reverse().join("/")}: ${brl(f.alignment.total_cents)} + ${brl(f.added)} em compras posteriores. ${f.untracked > 0 ? `${brl(f.untracked)} sem compra detalhada.` : f.untracked < 0 ? `Confira ${brl(-f.untracked)} em compras anteriores acima do valor informado.` : "Compras anteriores conferidas."}${f.overpaid ? ` Crédito: ${brl(f.overpaid)}.` : ""}</p>` : ""}${(() => {
          const use = cardLimitUse(d, c, month);
          return use.available === null ? "" : `<p class="fine limit-line">Limite estimado livre: <strong>${brl(use.available)}</strong> · ${brl(use.used)} em parcelas e compras ainda não pagas</p>`;
        })()}<p class="fine">Fecha dia ${c.closing_day} · limite ${c.limit_cents === null ? "não informado" : brl(c.limit_cents)}${c.created_at ? ` · cadastrado em ${c.created_at.slice(0, 10).split("-").reverse().join("/")}` : ""}</p><p class="fine">Fatura selecionada: ${month.split("-").reverse().join("/")} · compras até o fechamento entram nela; depois do fechamento, passam para a próxima competência.</p><div class="button-row">${share("cards", c)}${own(c) && api.allowed("cards") ? button("align-invoice", "Alinhar fatura", "secondary", `data-id="${c.id}"`) : ""}${own(c) && api.allowed("payments") ? button("card-payment", "Registrar pagamento", "secondary", `data-id="${c.id}"`) : ""}${own(c) && api.allowed("cards") ? button("edit-card", "Editar cartão", "text-button", `data-id="${c.id}"`) + button("merge-card", "Unir duplicado", "text-button", `data-id="${c.id}"`) + button("archive-card", "Arquivar", "text-button", `data-id="${c.id}"`) + (!d.entries.some((item) => item.card_id === c.id) && !d.documents.some((item) => item.card_id === c.id) && !d.invoice_alignments.some((item) => item.card_id === c.id) ? deleteButton("cards", c.id) : "") : ""}</div><details><summary>Ver ${lines.length} compra(s) e categorias</summary>${categoryTotals.length ? `<div class="card-category-breakdown"><h4>Gastos por categoria</h4><div class="category-chart">${categoryTotals.map(([category, amount], index) => `<div class="category-row"><span><i style="background:var(--chart-${index % 4})"></i>${esc(category)}</span><strong>${brl(amount)}</strong><div class="bar"><b style="width:${f.total ? Math.round((amount / f.total) * 100) : 0}%;background:var(--chart-${index % 4})"></b></div></div>`).join("")}</div></div>` : '<p class="fine">Ainda não há compras nesta fatura.</p>'}${lines.length ? lines.map((line) => { const ex = f.alignment && d.invoice_alignment_exceptions.find((item) => item.alignment_id === f.alignment!.id && item.entry_id === line.entry.id); const after = ex?.count_after ?? (f.alignment ? line.entry.date > f.alignment.cutoff_on : false); return `<p class="detail-line">${esc(line.entry.description)} <strong>Parcela ${line.number}/${line.total} · ${brl(line.amount_cents)}</strong><small>${esc(line.entry.category)} · compra em ${line.entry.date.split("-").reverse().join("/")}</small>${f.alignment && own(c) ? button("toggle-alignment-entry", after ? "Já estava no valor alinhado" : "Somar ao valor alinhado", "text-button", `data-id="${line.entry.id}" data-alignment="${f.alignment.id}" data-after="${after}"`) : ""}</p>`; }).join("") : ""}</details></section>`;
      })
      .join("") || empty("Cadastre seu primeiro cartão", "add-card")
  }</div>${d.cards.some((c) => c.archived_at) ? `<details class="panel section-gap"><summary>Cartões arquivados (${d.cards.filter((c) => c.archived_at).length})</summary>${d.cards.filter((c) => c.archived_at).map((c) => `<p class="detail-line">${esc(c.name)} · ${esc(names(c.owner_id))}${c.merged_into_id ? ` · unido a ${esc(d.cards.find((item) => item.id === c.merged_into_id)?.name || "outro cartão")}` : ""}${!c.merged_into_id && own(c) && api.allowed("cards") ? button("restore-card", "Restaurar", "text-button", `data-id="${c.id}"`) : ""}</p>`).join("")}</details>` : ""}`;
}
function loanSchedule(debt: Debt, entries: Entry[]) {
  if (!debt.installment_count || !debt.first_due_date || !debt.installment_cents) return "";
  const payments = entries.filter((entry) => entry.kind === "debt_payment" && entry.debt_id === debt.id && entry.status === "paid");
  const unlinked = payments.filter((entry) => !entry.debt_installment_number).reduce((sum, entry) => sum + entry.amount_cents, 0);
  const rows = Array.from({ length: debt.installment_count }, (_, index) => {
    const number = index + 1;
    const date = new Date(`${debt.first_due_date}T12:00:00Z`);
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + index);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
    const paid = payments.filter((entry) => entry.debt_installment_number === number).reduce((sum, entry) => sum + entry.amount_cents, 0);
    const label = paid >= debt.installment_cents! ? "Pago" : paid ? `Parcial: ${brl(paid)}` : "Em aberto";
    return `<p class="detail-line">${number}/${debt.installment_count} · ${date.toISOString().slice(0, 10).split("-").reverse().join("/")} · ${brl(debt.installment_cents!)} <small>${label}</small></p>`;
  });
  return `<details><summary>Ver calendário de parcelas</summary>${rows.join("")}${unlinked ? `<p class="fine">${brl(unlinked)} em pagamentos sem parcela vinculada. Edite o lançamento para associar.</p>` : ""}</details>`;
}
function accounts() {
  const d = api.data!;
  return `<section class="page-intro"><div><h2>Cada conta, cada compromisso.</h2><p>Saldos conhecidos, transferências e pagamentos de principal.</p></div><div class="button-row">${api.allowed("cards") ? button("add-account", "Nova conta") : ""}${api.allowed("entries") ? button("transfer", "Transferir entre contas", "secondary") + button("add-debt", "Novo empréstimo ou dívida", "secondary") : ""}</div></section><div class="card-grid">${d.accounts
    .map((a) => {
      const canSeeBalance = own(a) || admin() || (a.shared && a.share_balance);
      const b = canSeeBalance ? balance(d, a) : null;
      const checks = d.account_balance_checks.filter((item) => item.account_id === a.id).sort((x, y) => y.created_at.localeCompare(x.created_at));
      return `<section class="panel"><span class="eyebrow">${esc(a.area === "business" ? "EMPRESA" : a.area === "household" ? "LAR" : "PESSOAL")}</span><h3>${esc(a.name)}</h3><strong class="large-number">${!canSeeBalance ? "Saldo privado" : b === null ? "Saldo desconhecido" : brl(b)}</strong><p class="fine">${!canSeeBalance ? "O titular não compartilhou o saldo desta conta." : a.balance_date ? `Base em ${a.balance_date}. Pagamentos, receitas e transferências posteriores já entram no saldo.` : "Informe saldo e data-base para calcular movimentos."}</p><div class="button-row">${share("accounts", a)}${admin() && a.shared ? button("share-balance", a.share_balance ? "Ocultar saldo da família" : "Compartilhar saldo com a família", "text-button", `data-id="${a.id}"`) : ""}${own(a) && api.allowed("entries") ? button("transfer", "Transferir", "secondary", `data-id="${a.id}"`) : ""}${own(a) && api.allowed("cards") ? button("edit-account", "Conferir saldo / editar", "text-button", `data-id="${a.id}"`) + deleteButton("accounts", a.id) : ""}</div>${checks.length && own(a) ? `<details><summary>Histórico de saldos conferidos</summary>${checks.map((item) => `<p class="detail-line">${item.balance_date || "Sem data"} · ${item.balance_cents === null ? "Saldo removido" : brl(item.balance_cents)} <small>registrado em ${item.created_at.slice(0, 10).split("-").reverse().join("/")}</small></p>`).join("")}</details>` : ""}</section>`;
    })
    .join(
      "",
    )}</div><section class="panel section-gap"><div class="panel-title"><h3>Dívidas e compromissos</h3><span class="badge">Principal separado dos juros</span></div>${
    d.debts
      .map((debt) => {
        const paid = d.entries
          .filter(
            (e) =>
              e.kind === "debt_payment" &&
              e.debt_id === debt.id &&
              e.status === "paid",
          )
          .reduce((s, e) => s + e.amount_cents, 0);
        return `<article class="record"><span class="record-icon">${icon("debt")}</span><div class="record-info"><strong>${esc(debt.name)}</strong><small>${esc(debt.creditor)} · ${esc(names(debt.owner_id))}${debt.due_date ? " · vence " + debt.due_date : ""}${debt.installment_count ? ` · ${debt.installment_count} parcelas de ${brl(debt.installment_cents || 0)}` : ""}</small>${loanSchedule(debt, d.entries)}</div><strong>${debt.balance_cents === null ? "Saldo desconhecido" : brl(Math.max(0, debt.balance_cents - paid))}</strong><div class="record-actions">${share("debts", debt)}${own(debt) && api.allowed("payments") ? button("debt-payment", "Pagar principal", "secondary", `data-id="${debt.id}"`) : ""}${own(debt) && api.allowed("entries") ? button("edit-debt", "Editar plano", "text-button", `data-id="${debt.id}"`) + deleteButton("debts", debt.id) : ""}</div></article>`;
      })
      .join("") || empty("Nenhuma dívida cadastrada", "add-debt")
  }<p class="fine">Juros e taxas devem ser registrados como despesa. Pagamentos de principal não são contados novamente nos gastos.</p></section>`;
}
const statusBadge: Record<string, string> = { out: "danger-badge", expired: "danger-badge", soon: "warning-badge", low: "warning-badge", ok: "" };
function pantryCard(p: Pantry) {
  const d = api.data!,
    s = pantryStatus(p),
    e = expiry(p),
    lasts = durationFromDailyUse(p.daily_use),
    counted = formatDate(p.updated_at.slice(0, 10)),
    onList = d.shopping.some((x) => !x.bought && x.pantry_id === p.id),
    place = pantryLocations[locationOf(p)];
  const actions = api.allowed("pantry")
    ? (s.stock > 0
        ? button("pantry-use", "Usei", "secondary", `data-id="${p.id}" aria-label="Registrar uso de ${esc(p.name)}"`) +
          button("pantry-finish", "Acabou", "text-button", `data-id="${p.id}"`) +
          button("pantry-lost", "Perdi / venceu", "text-button", `data-id="${p.id}"`)
        : "") + button("edit-pantry", "Conferir", "text-button", `data-id="${p.id}" aria-label="Conferir quantidade de ${esc(p.name)}"`)
    : "";
  const buy = api.allowed("shopping")
    ? onList ? '<span class="badge">Na lista</span>' : button("shop-item", "Pôr na lista", "text-button", `data-id="${p.id}"`)
    : "";
  return `<section class="panel pantry-card level-${s.level}"><div class="panel-title"><span class="pantry-emoji" aria-hidden="true">${place.emoji}</span><span class="badge ${statusBadge[s.level]}">${esc(s.label)}</span></div><h3>${esc(p.name)}</h3><strong class="large-number">${formatQuantity(s.stock)}<small> ${esc(p.unit)}</small></strong><p class="fine">${p.daily_use > 0 ? `Estimativa de hoje · contado em ${counted}` : `Contado em ${counted}`}</p><p class="fine">${lasts ? `1 ${esc(p.unit)} dura ~${lasts} dia(s)${s.days !== null ? ` · acaba em ~${s.days} dia(s)` : ""}` : "Duração não acompanhada"}${e ? ` · ${esc(e.label)}` : ""}</p><div class="bar"><b style="width:${Math.min(100, (s.stock / Math.max(p.minimum * 2, 1)) * 100)}%"></b></div><p class="fine">Mínimo ${formatQuantity(p.minimum)} ${esc(p.unit)}${p.price_cents ? ` · último preço ${brl(p.price_cents)}` : ""}</p><div class="button-row">${actions}${buy}${api.allowed("pantry") ? deleteButton("pantry", p.id) : ""}</div></section>`;
}
function pantryView(tabs: string) {
  const d = api.data!;
  const term = pantrySearch.toLocaleLowerCase();
  const items = d.pantry.filter((p) => (pantryPlace === "all" || locationOf(p) === pantryPlace) && p.name.toLocaleLowerCase().includes(term));
  const care = attention(d.pantry);
  const waste = wasteThisMonth(d.pantryEvents, month);
  const count = (l: string) => d.pantry.filter((p) => l === "all" || locationOf(p) === l).length;
  const chip = (id: string, label: string) =>
    `<button type="button" class="chip ${pantryPlace === id ? "active" : ""}" data-action="pantry-place" data-id="${id}" aria-pressed="${pantryPlace === id}">${label} <span>${count(id)}</span></button>`;
  const groups = locationOrder
    .map((l) => ({ l, rows: items.filter((p) => locationOf(p) === l) }))
    .filter((g) => g.rows.length)
    .map((g) => `<h3 class="group-title">${pantryLocations[g.l].emoji} ${pantryLocations[g.l].label}</h3><div class="pantry-grid">${g.rows.map(pantryCard).join("")}</div>`)
    .join("");
  return `<section class="page-intro"><div><h2>Uma casa bem cuidada.</h2><p>O que tem, o que acaba, o que vence e o que precisa ser feito.</p></div>${api.allowed("pantry") ? button("add-pantry", icon("plus") + " Cadastrar produto") : ""}</section>${tabs}<div class="house-stats"><div><span>Para repor</span><strong>${care.restock.length}</strong><small>${care.restock.slice(0, 3).map((p) => esc(p.name)).join(", ") || "Nada urgente"}</small></div><div><span>Vencendo em 7 dias</span><strong>${care.expiring.length}</strong><small>${care.expiring.slice(0, 3).map((p) => esc(p.name)).join(", ") || "Sem validade próxima"}</small></div>${api.householdReady ? `<div><span>Perdas no mês</span><strong>${brl(waste.cents)}</strong><small>${waste.count} registro(s) de “perdi / venceu”</small></div>` : ""}</div>${d.pantry.length ? `<div class="filters pantry-filters">${input("pantry_search", "search", pantrySearch, 'placeholder="Buscar produto" aria-label="Buscar na despensa"')}<div class="chips" role="group" aria-label="Filtrar por local">${chip("all", "Tudo")}${locationOrder.filter((l) => count(l)).map((l) => chip(l, `${pantryLocations[l].emoji} ${pantryLocations[l].label}`)).join("")}</div></div>` : ""}${groups || (d.pantry.length ? '<p class="fine">Nenhum produto com esse filtro.</p>' : empty("Comece pelo que está na sua casa", "add-pantry"))}<p class="fine">“Usei” e “Perdi / venceu” descontam da quantidade estimada de hoje. “Conferir” registra uma nova contagem. A estimativa usa quanto tempo cada unidade costuma durar.</p>`;
}
function taskCard(t: Task) {
  const kind = taskKinds[t.kind] || taskKinds.other;
  const overdue = t.due_date && t.due_date < today() && !t.done_at;
  const removable = admin() || t.created_by === api.userId;
  if (t.done_at)
    return `<article class="record task done"><span class="record-icon" aria-hidden="true">${kind.emoji}</span><div class="record-info"><strong>${esc(t.title)}</strong><small>Feita por ${esc(names(t.done_by!))} em ${new Date(t.done_at).toLocaleDateString("pt-BR")}</small></div><div class="record-actions">${t.repeat === "none" ? button("task-reopen", "Desfazer", "text-button", `data-id="${t.id}"`) : ""}</div></article>`;
  return `<article class="record task ${overdue ? "overdue" : ""}"><span class="record-icon" aria-hidden="true">${kind.emoji}</span><div class="record-info"><strong>${esc(t.title)}</strong><small>${esc(dueLabel(t))} · ${t.assignee_id ? esc(names(t.assignee_id)) : "Qualquer pessoa"}${t.repeat !== "none" ? ` · ${repeatLabels[t.repeat]}` : ""}</small>${t.notes ? `<small>${esc(t.notes)}</small>` : ""}${t.steps?.length ? `<ul class="steps">${t.steps.map((st, i) => `<li><label><input type="checkbox" data-action="step-toggle" data-id="${t.id}" data-step="${i}" ${st.done ? "checked" : ""}> <span>${esc(st.text)}</span></label></li>`).join("")}</ul>` : ""}</div><div class="record-actions">${button("task-done", icon("check") + " Feito", "secondary", `data-id="${t.id}" aria-label="Marcar ${esc(t.title)} como feita"`)}${button("timer-start", icon("timer") + " 15 min", "text-button", `data-id="900" data-label="${esc(t.title)}" aria-label="Começar 15 minutos em ${esc(t.title)}"`)}${button("edit-task", "Editar", "text-button", `data-id="${t.id}"`)}${removable ? deleteButton("tasks", t.id) : ""}</div></article>`;
}
function tasksView(tabs: string) {
  const intro = `<section class="page-intro"><div><h2>A casa em dia, sem cobrança.</h2><p>Cada tarefa com responsável, prazo e repetição. Quem conclui fica registrado.</p></div>${api.householdReady ? button("add-task", icon("plus") + " Nova tarefa") : ""}</section>${tabs}`;
  if (!api.householdReady)
    return `${intro}<div class="hint-banner">${icon("settings")}<div><strong>Rotina da casa aguardando ativação</strong><p>Esta função precisa de uma atualização do banco da família. A despensa e as compras continuam funcionando normalmente.</p></div></div>`;
  const d = api.data!,
    g = taskGroups(d.tasks, today(), taskPerson);
  const people = opt("all", "Todas as pessoas", taskPerson) + opt(api.userId, "Só as minhas", taskPerson) +
    d.members.filter((m) => m.active && m.user_id !== api.userId).map((m) => opt(m.user_id, m.display_name, taskPerson)).join("") +
    opt("none", "Sem responsável", taskPerson);
  const block = (title: string, rows: Task[], tone = "") =>
    rows.length ? `<section class="panel task-block ${tone}"><div class="panel-title"><h3>${title}</h3><span class="badge">${rows.length}</span></div><div class="records">${rows.map(taskCard).join("")}</div></section>` : "";
  const open = g.overdue.length + g.today.length + g.week.length + g.later.length + g.undated.length;
  return `${intro}<div class="filters"><select name="task_person" aria-label="Filtrar por responsável">${people}</select></div>${
    open
      ? block("Atrasadas", g.overdue, "late") + block("Hoje", g.today) + block("Próximos 7 dias", g.week) + block("Mais adiante", g.later) + block("Sem data", g.undated)
      : empty("Nenhuma tarefa pendente por aqui", "add-task")
  }${g.done.length ? `<details class="panel section-gap"><summary>Feitas recentemente (${g.done.length})</summary><div class="records">${g.done.map(taskCard).join("")}</div></details>` : ""}<p class="fine">Tarefas repetidas ganham a próxima data a partir do dia em que foram feitas. Tocar duas vezes em “Feito” não duplica a tarefa.</p>`;
}
function house() {
  const tabs = `<div class="segmented" role="group" aria-label="Seções da casa">${[["pantry", "Despensa"], ["tasks", "Rotina da casa"]]
    .map(([id, label]) => `<button type="button" class="${houseTab === id ? "active" : ""}" aria-pressed="${houseTab === id}" data-action="house-tab" data-id="${id}">${label}</button>`)
    .join("")}</div>`;
  return houseTab === "tasks" ? tasksView(tabs) : pantryView(tabs);
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function openPicker(query: string, category: string) {
  pickerQuery = query;
  pickerCategory = category;
  pickerRows = [];
  pickerState = "idle";
  pickerMessage = "";
  pickerFromCache = false;
  pickedProduct = null;
  show("catalog-find");
  if (query.trim().length >= 2) void runPicker();
}
async function runPicker() {
  const query = pickerQuery;
  pickerState = "loading";
  pickerMessage = "";
  render();
  try {
    const result = await searchProducts(query, pickerCategory);
    if (modal !== "catalog-find" || query !== pickerQuery) return;
    pickerRows = result.rows;
    pickerFromCache = result.fromCache;
    pickerState = "done";
    pickerMessage = result.rows.length ? "" : "Nenhum produto encontrado. Tente menos palavras (ex.: só “sabonete”) ou crie o item manualmente.";
  } catch (error) {
    if (modal !== "catalog-find" || query !== pickerQuery) return;
    pickerRows = [];
    pickerState = "error";
    pickerMessage = error instanceof OffError || error instanceof Error ? error.message : "Não foi possível buscar agora.";
  }
  render();
}
// Atualiza nome, marca e tamanho dos produtos salvos pela API, respeitando o limite do serviço (15 por minuto).
async function refreshCatalog() {
  if (refresh.running) return;
  const targets = refreshable().slice(0, 20);
  refresh = { running: true, done: 0, total: targets.length };
  render();
  const patches: { id: string; name: string; brand: string; size: string; category: string }[] = [];
  let unchanged = 0, missing = 0, stopped = "";
  for (const [index, entry] of targets.entries()) {
    try {
      const product = await fetchProduct(entry.barcode, entry.category);
      if (!product) missing++;
      else if (product.name !== entry.name || product.brand !== entry.brand || product.size !== entry.size)
        patches.push({ id: entry.id, name: product.name, brand: product.brand, size: product.size, category: entry.category });
      else unchanged++;
    } catch (error) {
      stopped = error instanceof Error ? error.message : "O serviço de produtos não respondeu.";
      break;
    }
    refresh.done = index + 1;
    const label = root.querySelector("#refresh-progress");
    if (label) label.textContent = `Atualizando ${refresh.done} de ${refresh.total}… pode continuar usando o app.`;
    if (index < targets.length - 1) await sleep(4500);
  }
  refresh.running = false;
  try {
    await api.updateCatalog(patches);
    notice = `${patches.length} produto(s) atualizado(s), ${unchanged} sem mudança${missing ? `, ${missing} não encontrado(s) na base` : ""}.${stopped ? " Parei antes do fim: " + stopped : ""}`;
  } catch (error) {
    notice = error instanceof Error ? error.message : "Não foi possível salvar as atualizações.";
  }
  render();
}
function shopTabs() {
  const pending = api.data!.shopping.filter((s) => !s.bought).length;
  return `<div class="segmented" role="group" aria-label="Seções das compras">${[["list", `Minha lista (${pending})`], ["catalog", "Catálogo"], ["flyers", "Encartes"]]
    .map(([id, label]) => `<button type="button" class="${shopTab === id ? "active" : ""}" aria-pressed="${shopTab === id}" data-action="shop-tab" data-id="${id}">${label}</button>`)
    .join("")}</div>`;
}
function shopping() {
  const tabs = shopTabs();
  return shopTab === "catalog" ? catalogView(tabs) : shopTab === "flyers" ? flyersView(tabs) : shoppingList(tabs);
}
const catalogBanner = () =>
  api.catalogReady
    ? ""
    : `<div class="hint-banner">${icon("settings")}<div><strong>Itens e encartes guardados só neste aparelho</strong><p>O catálogo pronto funciona normalmente. Os itens e ofertas que você criar ficam neste aparelho até a atualização do banco da família ser ativada; depois disso, passam a aparecer para todos da casa.</p></div></div>`;
function productCard(p: OffProduct): CatalogCard {
  return { key: "o:" + p.code, source: "mine", id: "", name: p.name, category: p.category, unit: "unidade", brand: p.brand,
    size: p.size, barcode: p.code, packaged: false, store: "", price_cents: null, offer_until: null, expired: false, local: false };
}
const cardByKey = (key: string) =>
  key.startsWith("o:")
    ? pickedProduct && "o:" + pickedProduct.code === key ? productCard(pickedProduct) : undefined
    : catalogCards(api.data!.catalog).find((c) => c.key === key);
const refreshable = () => api.data!.catalog.filter((e) => e.barcode && e.source === "off");
function catalogRow(c: CatalogCard) {
  const cat = catalogCategories[c.category as CatalogCategory];
  const mine = c.source !== "builtin";
  const detail = c.packaged
    ? "Toque para escolher a marca e o tamanho"
    : [c.brand, c.size].filter(Boolean).join(" · ") || `Vendido por ${c.unit}`;
  const where = mine ? ` · ${c.store ? c.store : c.barcode ? "Da base aberta" : "Meu item"}${c.local ? " · só neste aparelho" : ""}` : "";
  const main = !api.allowed("shopping")
    ? ""
    : c.packaged
      ? button("catalog-find", icon("plus") + " Escolher produto", "secondary", `data-id="${esc(c.key)}" aria-label="Escolher produto para ${esc(c.name)}"`)
      : button("catalog-pick", icon("plus") + " Adicionar", "secondary", `data-id="${esc(c.key)}" aria-label="Adicionar ${esc(c.name)} à lista"`);
  return `<div class="catalog-row"><div class="catalog-info"><strong>${esc(c.name)}</strong><small>${esc(detail)}${esc(where)}</small></div>${c.price_cents ? `<span class="catalog-price">${brl(c.price_cents)}</span>` : ""}<span class="row-actions">${main}${mine && api.allowed("shopping") ? button("catalog-delete", "Excluir", "text-button danger", `data-id="${esc(c.id)}" aria-label="Excluir ${esc(c.name)} do catálogo"`) : ""}</span><span class="catalog-cat" aria-hidden="true">${cat?.emoji || ""}</span></div>`;
}
function catalogView(tabs: string) {
  const d = api.data!;
  const filter = { store: catalogStore, category: catalogCategory, term: catalogTerm };
  const cards = sortCards(filterCards(catalogCards(d.catalog), filter));
  const offers = cards.filter((c) => c.source === "offer");
  const rest = cards.filter((c) => c.source !== "offer");
  const chip = (action: string, id: string, label: string, current: string) =>
    `<button type="button" class="chip ${current === id ? "active" : ""}" data-action="${action}" data-id="${esc(id)}" aria-pressed="${current === id}">${label}</button>`;
  // Sem busca nem filtro as categorias começam recolhidas (a lista tem uns 100 atalhos); com filtro abrem sozinhas.
  const filtering = Boolean(catalogTerm.trim()) || catalogCategory !== "all";
  const groups = categoryIds
    .map((id) => ({ id, rows: rest.filter((c) => c.category === id) }))
    .filter((g) => g.rows.length)
    .map((g) => `<details class="catalog-group" data-cat="${g.id}" ${filtering || catalogOpen.has(g.id) ? "open" : ""}><summary>${catalogCategories[g.id].emoji} ${catalogCategories[g.id].label} <span class="badge">${g.rows.length}</span></summary><div class="catalog-list">${g.rows.map(catalogRow).join("")}</div></details>`)
    .join("");
  const online = catalogTerm.trim().length >= 2 && api.allowed("shopping");
  const onlineButton = online ? `<div class="online-search">${button("catalog-search-online", `🔎 Buscar “${esc(catalogTerm.trim())}” nas bases de produtos`, "secondary")}</div>` : "";
  const none = `<div class="empty"><span class="empty-icon" aria-hidden="true">🔎</span><h3>Nada nos seus atalhos${catalogTerm ? ` para “${esc(catalogTerm)}”` : ""}</h3><p>Busque o produto real (marca e tamanho) nas bases abertas de produtos ou crie o item manualmente.</p>${online ? button("catalog-search-online", "Buscar nas bases de produtos") : ""}${api.allowed("shopping") ? button("catalog-new-from-term", "Criar item manualmente", "secondary") : ""}</div>`;
  const n = refreshable().length;
  const refreshBar = n && api.allowed("shopping")
    ? `<div class="refresh-bar">${refresh.running ? `<span id="refresh-progress" aria-live="polite">Atualizando ${refresh.done} de ${refresh.total}… pode continuar usando o app.</span>` : button("catalog-refresh", `Atualizar dados dos produtos salvos (${n})`, "secondary")}</div>`
    : "";
  return `<section class="page-intro"><div><h2>Catálogo de mercado.</h2><p>Atalhos de itens comuns; os produtos reais (marca e tamanho) vêm de bases abertas e gratuitas. Preços você informa ou cola do encarte.</p></div><div class="button-row">${api.allowed("shopping") ? button("catalog-new", icon("plus") + " Criar item") + button("flyer-paste", "Colar encarte", "secondary") : ""}</div></section>${tabs}${catalogBanner()}<div class="filters pantry-filters">${input("catalog_search", "search", catalogTerm, 'placeholder="Buscar item (ex.: arroz, detergente)" aria-label="Buscar no catálogo"')}<div class="chips" role="group" aria-label="Filtrar por mercado">${chip("catalog-store", "all", "Todos os mercados", catalogStore)}${catalogStores.map((s) => chip("catalog-store", s, esc(s), catalogStore)).join("")}</div></div>${onlineButton}<div class="chips category-chips" role="group" aria-label="Filtrar por categoria">${chip("catalog-cat", "all", "Tudo", catalogCategory)}${categoryIds.map((id) => chip("catalog-cat", id, `${catalogCategories[id].emoji} ${catalogCategories[id].label}`, catalogCategory)).join("")}</div>${refreshBar}${offers.length ? `<section class="panel offer-panel"><div class="panel-title"><div><span class="eyebrow">DOS SEUS ENCARTES</span><h3>Em oferta agora</h3></div><span class="badge">${offers.length}</span></div><div class="offer-grid">${offers.map((c) => `<article class="offer-card"><span class="badge shared">${esc(c.store || "Oferta")} · ${esc(offerLabel(c))}</span><strong>${esc(composeName(c.name, c.brand, c.size))}</strong><b>${brl(c.price_cents || 0)}</b>${api.allowed("shopping") ? button("catalog-pick", "Pôr na lista", "secondary", `data-id="${esc(c.key)}"`) : ""}</article>`).join("")}</div></section>` : ""}${groups || (offers.length ? "" : none)}<p class="fine credit">Produtos: <a href="${offCredit.url}" target="_blank" rel="noopener noreferrer">Open Food Facts</a> (alimentos), Open Beauty Facts (higiene) e Open Products Facts (limpeza). ${offCredit.license} Só o nome buscado é enviado a esses serviços. Eles não têm preços do Brasil: o valor é o que você informar ou colar do encarte.</p>`;
}
function flyersView(tabs: string) {
  const d = api.data!;
  const cards = d.catalog.map((e) => entryCard(e)).filter((c) => c.source === "offer");
  const valid = cards.filter((c) => !c.expired);
  const expired = cards.filter((c) => c.expired);
  const stores = [...new Set(valid.map((c) => c.store || "Outro mercado"))].sort();
  const row = (c: CatalogCard) => `<article class="record offer-row"><span class="record-icon" aria-hidden="true">${catalogCategories[c.category as CatalogCategory]?.emoji || "🏷️"}</span><div class="record-info"><strong>${esc(composeName(c.name, c.brand, c.size))}</strong><small>${esc(offerLabel(c))}${c.local ? " · só neste aparelho" : ""}</small></div><strong>${brl(c.price_cents || 0)}</strong><div class="record-actions">${!c.expired && api.allowed("shopping") ? button("catalog-pick", "Pôr na lista", "secondary", `data-id="${esc(c.key)}"`) : ""}${api.allowed("shopping") ? button("catalog-delete", "Excluir", "text-button danger", `data-id="${esc(c.id)}" aria-label="Excluir oferta ${esc(c.name)}"`) : ""}</div></article>`;
  return `<section class="page-intro"><div><h2>Encartes e ofertas.</h2><p>Guarde as ofertas do Atacadão, Sam's Club ou outro mercado e ponha na lista com um toque.</p></div><div class="button-row">${api.allowed("shopping") ? button("flyer-paste", "Colar texto do encarte") + button("offer-new", icon("plus") + " Nova oferta", "secondary") : ""}</div></section>${tabs}${catalogBanner()}${stores.length ? stores.map((store) => `<section class="panel task-block"><div class="panel-title"><h3>${esc(store)}</h3><span class="badge">${valid.filter((c) => (c.store || "Outro mercado") === store).length}</span></div><div class="records">${valid.filter((c) => (c.store || "Outro mercado") === store).sort((a, b) => (a.offer_until || "").localeCompare(b.offer_until || "")).map(row).join("")}</div></section>`).join("") : `<div class="empty"><span class="empty-icon" aria-hidden="true">🏷️</span><h3>Nenhuma oferta guardada</h3><p>Abra o encarte no site ou no WhatsApp do mercado, copie o texto e use “Colar texto do encarte”. O app separa produto e preço, você confere e salva. Também dá para cadastrar uma oferta por vez.</p>${api.allowed("shopping") ? button("flyer-paste", "Colar texto do encarte") : ""}</div>`}${expired.length ? `<details class="panel section-gap"><summary>Ofertas vencidas (${expired.length})</summary><div class="records">${expired.map(row).join("")}</div>${api.allowed("shopping") ? `<div class="button-row section-gap">${button("offers-clean", "Remover todas as vencidas", "secondary")}</div>` : ""}</details>` : ""}<p class="fine">Ofertas somem das buscas depois da validade. Os preços valem só para o mercado e a data informados; confira sempre no caixa.</p>`;
}
function catalogAddForm(c: CatalogCard) {
  const fromSearch = c.key.startsWith("o:");
  const saved = c.barcode ? api.data!.catalog.some((e) => e.barcode === c.barcode) : true;
  const detail = [c.brand, c.size].filter(Boolean).join(" · ");
  return `<form id="catalog-add-form" class="form-grid">${input("key", "hidden", c.key)}<p class="wide"><strong>${esc(composeName(c.name, c.brand, c.size))}</strong>${detail ? `<br><small>${esc(detail)}</small>` : ""}${c.store ? ` · ${esc(c.store)}` : ""}${c.offer_until ? ` · ${esc(offerLabel(c))}` : ""}</p>${c.source === "builtin" || !c.barcode ? field("extra", "Detalhe (opcional)", input("extra", "text", "", 'maxlength="60" placeholder="Ex.: prata, pacote 1 kg, marca X"'), true) : ""}${field("quantity", `Quantidade (${esc(c.unit)})`, input("quantity", "number", 1, 'min="0.01" step="0.01" inputmode="decimal" required'))}${field("price", `Preço por ${esc(c.unit)} (R$, se souber)`, moneyInput("price", c.price_cents ? centsText(c.price_cents) : ""))}${fromSearch && !saved && api.allowed("shopping") ? '<label class="check-row wide"><input type="checkbox" name="save_item" checked> <span>Guardar no meu catálogo (acho rápido depois e posso atualizar pela internet)</span></label>' : ""}<p class="fine wide">Se este item já estiver na lista, a quantidade é somada em vez de repetir a linha.</p><div class="form-actions wide">${fromSearch ? button("find-back", "Voltar aos resultados", "secondary") : button("close", "Cancelar", "secondary")}<button class="primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Salvando…" : "Adicionar à lista"}</button></div></form>`;
}
function findContent() {
  const known = new Set(api.data!.catalog.map((e) => e.barcode).filter(Boolean));
  const rows = pickerRows
    .map((p) => `<div class="find-row"><div class="catalog-info"><strong>${esc(p.name)}</strong><small>${[p.brand, p.size].filter(Boolean).map(esc).join(" · ") || "Sem marca ou tamanho informado"}${known.has(p.code) ? " · já no seu catálogo" : ""}</small></div>${button("find-pick", "Escolher", "secondary", `data-id="${esc(p.code)}" aria-label="Escolher ${esc(p.name)}"`)}</div>`)
    .join("");
  const fallback = pickerState === "error" || (pickerState === "done" && !pickerRows.length)
    ? `<div class="button-row">${button("catalog-new-from-picker", `Criar “${esc(pickerQuery.trim())}” manualmente`, "secondary")}</div>` : "";
  return `<form id="find-form" class="form-grid">${field("query", "O que você procura", input("query", "text", pickerQuery, 'maxlength="80" required placeholder="Ex.: arroz camil, detergente ypê"'), true)}${field("category", "Tipo de produto", `<select name="category">${categoryIds.map((id) => opt(id, `${catalogCategories[id].emoji} ${catalogCategories[id].label}`, pickerCategory)).join("")}</select>`, true)}<div class="form-actions wide"><button class="secondary" type="button" data-action="close">Cancelar</button><button class="primary" type="submit" ${pickerState === "loading" ? "disabled" : ""}>${pickerState === "loading" ? "Buscando…" : "Buscar"}</button></div></form><div class="find-results" aria-live="polite">${pickerState === "loading" ? '<p class="fine">Buscando nas bases abertas de produtos…</p>' : ""}${pickerMessage ? `<div class="notice ${pickerState === "error" ? "error" : ""}">${esc(pickerMessage)}</div>` : ""}${pickerState === "done" && pickerFromCache ? '<p class="fine">Resultado guardado neste aparelho (busca recente).</p>' : ""}${rows}${fallback}</div><p class="fine">${offCredit.license} Fonte: ${esc(offCredit.name)} e bases irmãs. Só o texto buscado é enviado.</p>`;
}
function catalogNewForm(offer: boolean) {
  const unitOptions = catalogUnits.map((u) => opt(u, u, "unidade")).join("");
  return `<form id="catalog-new-form" class="form-grid">${field("name", offer ? "Produto da oferta" : "Nome do item", input("name", "text", catalogDraftName, 'maxlength="120" required placeholder="Ex.: Arroz, Detergente, Papel higiênico"'), true)}${field("brand", "Marca (opcional)", input("brand", "text", "", 'maxlength="60"'))}${field("size", "Tamanho (opcional)", input("size", "text", "", 'maxlength="40" placeholder="Ex.: 5 kg, 12 rolos"'))}${field("category", "Categoria", `<select name="category">${categoryIds.map((id) => opt(id, `${catalogCategories[id].emoji} ${catalogCategories[id].label}`, catalogCategory === "all" ? "mercearia" : catalogCategory)).join("")}</select>`)}${field("unit", "Vendido por", `<select name="unit">${unitOptions}</select>`)}${field("store", "Mercado", `<select name="store">${opt("", "Qualquer mercado") + catalogStores.map((s) => opt(s, s, offer ? flyerDraft.store : "")).join("")}</select>`)}${field("price", offer ? "Preço da oferta (R$)" : "Preço (R$, opcional)", moneyInput("price"))}${field("offer_until", offer ? "Oferta válida até" : "É oferta de encarte? Válida até (opcional)", input("offer_until", "date", offer ? flyerDraft.until : "", offer ? "required" : ""))}<label class="check-row wide"><input type="checkbox" name="add_to_list"> <span>Também colocar na lista de compras agora</span></label>${formEnd("Salvar item")}</form>`;
}
function flyerForm() {
  return `<form id="flyer-form" class="form-grid">${field("store", "Mercado do encarte", `<select name="store" required>${catalogStores.map((s) => opt(s, s, flyerDraft.store)).join("")}</select>`)}${field("until", "Ofertas válidas até", input("until", "date", flyerDraft.until, "required"))}${field("text", "Texto do encarte (uma oferta por linha, com o preço)", `<textarea name="text" rows="9" maxlength="20000" required placeholder="Arroz Tio João 5 kg - R$ 24,90&#10;Feijão carioca Camil 1 kg R$ 7,49&#10;Detergente Ypê 500 ml R$ 2,19">${esc(flyerDraft.text)}</textarea>`, true)}<p class="fine wide">Copie o texto do encarte no site ou no WhatsApp do mercado e cole aqui. O app não lê fotos nem PDF: confira tudo na próxima tela antes de salvar. Linhas sem preço são ignoradas.</p>${formEnd("Ver prévia")}</form>`;
}
function flyerPreview() {
  const rows = flyerRows;
  return `<form id="flyer-confirm-form" class="form-grid"><p class="wide"><strong>${esc(flyerDraft.store)}</strong> · válido até ${esc(formatDate(flyerDraft.until))} · ${rows.length} oferta(s)${flyerSkipped ? ` · ${flyerSkipped} linha(s) sem preço ignorada(s)` : ""}</p><div class="wide import-list">${rows.map((r, i) => `<label class="flyer-row"><input type="checkbox" name="row" value="${i}" checked aria-label="Salvar ${esc(r.name)}"><span><strong>${esc(r.name)}</strong><small>${catalogCategories[r.category].emoji} ${catalogCategories[r.category].label}</small></span><b>${brl(r.price_cents)}</b></label>`).join("")}</div><p class="fine wide">Desmarque o que não quiser guardar. Para corrigir um nome ou preço, volte e ajuste o texto.</p><div class="form-actions wide">${button("flyer-back", "Voltar e editar", "secondary")}<button class="primary" type="submit" ${busy ? "disabled" : ""}>Salvar ofertas marcadas</button></div></form>`;
}
function shoppingList(tabs: string) {
  const d = api.data!,
    items = d.shopping.filter((s) => !s.bought),
    estimate = items.reduce((sum, s) => sum + lineCents(s.quantity, s.estimate_cents), 0),
    canBuy = api.allowed("shopping") && api.allowed("entries") && api.allowed("pantry");
  const line = (s: Shopping) => {
    const p = d.pantry.find((x) => x.id === s.pantry_id);
    const c = cart.get(s.id);
    return `<div class="market-item" data-line="${s.id}"><label class="market-check"><input type="checkbox" name="items" value="${s.id}" ${c?.checked ? "checked" : ""} aria-label="${esc(s.name)} está no carrinho"><span><strong>${esc(s.name)}</strong><small>${p ? `Por quê: ${esc(suggestionReason(p))}` : "Item avulso · não altera a despensa"}</small></span></label><label class="mini"><span>Qtd. (${esc(s.unit)})</span><input name="qty-${s.id}" type="number" min="0.01" step="0.01" inputmode="decimal" value="${esc(c?.qty ?? s.quantity)}"></label><label class="mini"><span>Preço por ${esc(s.unit)}</span>${moneyInput(`price-${s.id}`, c?.price ?? (s.estimate_cents ? centsText(s.estimate_cents) : ""))}</label><strong class="line-total" data-line-total="${s.id}">${brl(lineCents(s.quantity, s.estimate_cents))}</strong>${api.allowed("shopping") ? deleteButton("shopping", s.id) : ""}</div>`;
  };
  const list = shoppingGroups(items, d.pantry)
    .map((g) => `<h4 class="group-title">${g.emoji} ${g.label}</h4>${g.items.map(line).join("")}`)
    .join("");
  return `<section class="page-intro"><div><h2>Compras com propósito.</h2><p>Monte a lista em casa e marque no mercado só o que entrou no carrinho.</p></div><div class="button-row">${api.allowed("shopping") ? `<label class="inline-select"><span>Sugerir para</span><select name="suggest_days">${[7, 14, 30].map((n) => opt(String(n), `${n} dias`, String(suggestDays))).join("")}</select></label>${button("generate-list", "✦ Sugerir lista")}${button("add-shopping", "Adicionar item", "secondary")}` : ""}${items.length ? button("share-list", "Enviar lista", "secondary") : ""}</div></section>${tabs}<div class="shopping-layout"><section class="panel"><div class="panel-title"><h3>Modo mercado</h3><span class="badge">${items.length} item(s)</span></div>${
    items.length
      ? `<form id="purchase-form"><p class="fine">Marque o que já está no carrinho. Ajuste quantidade e preço se mudaram. O que não for marcado continua na lista.</p>${list}<div class="cart-summary"><span>No carrinho: <strong id="cart-count">0</strong> item(s)</span><span>Soma dos itens: <strong id="cart-sum">${formatBrl(0)}</strong></span></div><div class="form-grid section-gap">${field("total", "Total pago no caixa (R$)", moneyInput("total", cartMeta.total))}${field("date", "Data da compra", input("date", "date", cartMeta.date || today(), "required"))}${field("pay", "Como pagou?", `<select name="pay">${opt("cash", "Pix, débito ou dinheiro", cartMeta.pay) + opt("card", "Cartão de crédito", cartMeta.pay)}</select>`)}<div class="conditional-field" data-pay="cash">${field("account_id", "Conta utilizada", `<select name="account_id">${accountOptions(cartMeta.account)}</select>`)}</div><div class="conditional-field" data-pay="card">${field("card_id", "Cartão", `<select name="card_id">${cardOptions(cartMeta.card)}</select>`)}</div><div class="conditional-field" data-pay="card">${field("parts", "Parcelas", input("parts", "number", cartMeta.parts, 'min="1" max="48" inputmode="numeric"'))}</div></div><p class="fine" id="cart-diff" aria-live="polite"></p>${canBuy ? `<button class="primary full section-gap" type="submit">Concluir compra dos itens marcados</button>` : '<p class="fine">Concluir compra exige permissões de compras, despensa e lançamentos.</p>'}</form>`
      : empty("Sua próxima lista começa aqui", "add-shopping")
  }</section><aside class="panel shopping-aside"><span class="eyebrow">PLANEJE ANTES DE SAIR</span><h3>Estimativa da lista inteira</h3><strong class="large-number">${brl(estimate)}</strong><p>Ao concluir, o total pago vira uma única despesa do lar, os produtos marcados entram na despensa e o preço pago fica guardado para a próxima estimativa.</p><div class="insight"><span>✦</span><p>A sugestão completa o estoque para ${suggestDays} dias de consumo ou o mínimo definido, e explica o motivo de cada item.</p></div><p class="fine">Histórico: ${d.shopping.filter((s) => s.bought).length} item(s) comprado(s). Pagou no cartão? Escolha “Cartão de crédito” e as parcelas: a compra entra nas faturas certas.</p></aside></div>`;
}
function syncCart() {
  const form = root.querySelector<HTMLFormElement>("#purchase-form");
  if (!form) return;
  let sum = 0,
    count = 0;
  form.querySelectorAll<HTMLElement>("[data-line]").forEach((row) => {
    const id = row.dataset.line!;
    const qty = Number(val(form, `qty-${id}`)) || 0;
    const price = parseMoney(val(form, `price-${id}`)) || 0;
    const cents = lineCents(qty, price);
    const checked = row.querySelector<HTMLInputElement>('[name="items"]')!.checked;
    cart.set(id, { checked, qty: val(form, `qty-${id}`), price: val(form, `price-${id}`) });
    row.classList.toggle("in-cart", checked);
    row.querySelector<HTMLElement>("[data-line-total]")!.innerHTML = brl(cents);
    if (checked) {
      sum += cents;
      count++;
    }
  });
  root.querySelector("#cart-count")!.textContent = String(count);
  root.querySelector<HTMLElement>("#cart-sum")!.innerHTML = brl(sum);
  const total = form.elements.namedItem("total") as HTMLInputElement;
  // Total vazio acompanha a soma dos itens; um valor digitado (o do cupom) é mantido.
  const auto = sum ? centsText(sum) : "";
  if (!total.value) cartMeta.total = "";
  else if (total.value !== total.dataset.auto) cartMeta.total = total.value;
  if (!cartMeta.total) total.value = auto;
  total.dataset.auto = auto;
  cartMeta.date = val(form, "date");
  cartMeta.account = val(form, "account_id");
  cartMeta.pay = val(form, "pay") || "cash";
  cartMeta.card = val(form, "card_id");
  cartMeta.parts = val(form, "parts") || "1";
  form.querySelectorAll<HTMLElement>("[data-pay]").forEach((el) => {
    el.hidden = el.dataset.pay !== cartMeta.pay;
    el.querySelectorAll<HTMLSelectElement | HTMLInputElement>("select, input").forEach((c) => (c.disabled = el.hidden));
  });
  const paid = parseMoney(total.value);
  const diff = root.querySelector<HTMLElement>("#cart-diff")!;
  diff.textContent = paid !== null && sum && paid !== sum
    ? `O total pago difere da soma dos itens em ${formatBrl(Math.abs(paid - sum))} (descontos, itens sem preço ou erro de digitação). Será registrado o total pago.`
    : "";
}
function calendar() {
  const d = api.data!;
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const weeks = Math.ceil((offset + count) / 7);
  const events = new Map<string, { reminder: Reminder; occurrence: string }[]>();
  for (const reminder of d.reminders) {
    if (calendarFilter !== "all" && reminder.kind !== calendarFilter) continue;
    for (const occurrence of reminderDatesInMonth(reminder, month)) {
      const list = events.get(occurrence) || [];
      list.push({ reminder, occurrence });
      events.set(occurrence, list);
    }
  }
  const days = Array.from({ length: weeks * 7 }, (_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > count) return '<div class="calendar-day outside" aria-hidden="true"></div>';
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const rows = events.get(date) || [];
    return `<button type="button" class="calendar-day ${date === today() ? "today" : ""} ${date === calendarSelectedDate ? "selected" : ""} ${rows.length ? "has-events" : ""}" data-action="calendar-day" data-date="${date}" aria-label="${day} de ${month.split("-")[1]}: ${rows.length} aviso(s)"><span class="calendar-day-number">${day}</span>${rows.length ? `<span class="calendar-day-events">${rows.slice(0, 2).map(({ reminder }) => `<i class="${reminder.completed ? "done" : ""} ${reminder.kind === "due_date" ? "due-dot" : ""}"></i>`).join("")}${rows.length > 2 ? `<small>+${rows.length - 2}</small>` : ""}</span>` : ""}</button>`;
  }).join("");
  const selectedEvents = events.get(calendarSelectedDate) || [];
  const eventRow = ({ reminder }: { reminder: Reminder; occurrence: string }) => `<article class="record reminder-record calendar-event ${reminder.kind === "due_date" ? "due-date-event" : ""}"><span class="record-icon">${icon(reminder.kind === "due_date" ? "debt" : "reminders")}</span><div class="record-info"><strong>${esc(reminder.title)}</strong><small>${reminder.kind === "due_date" ? "Vencimento" : "Lembrete"}${reminder.recurrence !== "once" ? ` · ${({ weekly: "Semanal", monthly: "Mensal", yearly: "Anual" }[reminder.recurrence])}` : ""} · ${esc(names(reminder.owner_id))}${reminder.note ? ` · ${esc(reminder.note)}` : ""}${reminder.completed ? " · Concluído" : ""}</small></div>${!reminder.completed && own(reminder) ? button("finish-reminder", reminder.recurrence === "once" ? "Concluir" : "Feito", "secondary", `data-id="${reminder.id}"`) : ""}${own(reminder) ? button("edit-reminder", "Editar", "text-button", `data-id="${reminder.id}"`) : ""}</article>`;
  return `<section class="page-intro"><div><h2>Calendário da família</h2><p>Compromissos e lembretes compartilhados em um só lugar.</p></div>${api.allowed("entries") ? button("add-reminder-day", icon("plus") + " Criar aviso", "primary", `data-date="${calendarSelectedDate}"`) : ""}</section><section class="panel calendar-panel"><div class="calendar-toolbar"><button type="button" class="secondary" data-action="calendar-shift" data-step="-1" aria-label="Mês anterior">‹</button><h3>${monthStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}</h3><button type="button" class="secondary" data-action="calendar-shift" data-step="1" aria-label="Próximo mês">›</button>${button("calendar-today", "Hoje", "text-button")}</div><div class="calendar-filters"><button type="button" class="${calendarFilter === "all" ? "active" : ""}" data-action="calendar-filter" data-filter="all">Todos</button><button type="button" class="${calendarFilter === "reminder" ? "active" : ""}" data-action="calendar-filter" data-filter="reminder">Lembretes</button><button type="button" class="${calendarFilter === "due_date" ? "active" : ""}" data-action="calendar-filter" data-filter="due_date">Vencimentos</button></div><div class="calendar-grid calendar-weekdays">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => `<span>${day}</span>`).join("")}</div><div class="calendar-grid">${days}</div><div class="calendar-legend"><span><i></i> Aviso agendado</span><span><i class="done"></i> Lembrete concluído</span></div></section><section class="panel calendar-agenda"><div class="panel-title"><div><span class="eyebrow">AGENDA DO DIA</span><h3>${calendarSelectedDate.split("-").reverse().join("/")}</h3></div>${api.allowed("entries") ? button("add-reminder-day", "Adicionar aviso neste dia", "secondary", `data-date="${calendarSelectedDate}"`) : ""}</div>${selectedEvents.length ? selectedEvents.map(eventRow).join("") : `<p class="fine">Nenhum aviso neste dia. ${api.allowed("entries") ? "Adicione um para manter a família em dia." : "Os avisos compartilhados aparecerão aqui."}</p>`}<p class="fine">Os avisos ficam compartilhados com os membros ativos da família. Os lembretes recorrentes aparecem em cada data prevista.</p></section>`;
}
function reminders() {
  const d = api.data!;
  const dated = d.reminders.filter((item) => item.kind !== "post_it" && item.due_on);
  const active = dated.filter((item) => !item.completed).sort((a, b) => a.due_on!.localeCompare(b.due_on!));
  const completed = dated.filter((item) => item.completed).sort((a, b) => b.due_on!.localeCompare(a.due_on!));
  const dueDates = active.filter((item) => item.kind === "due_date");
  const tasks = active.filter((item) => item.kind === "reminder");
  const notes = d.reminders.filter((item) => item.kind === "post_it");
  const row = (item: Reminder) => `<article class="record reminder-record ${item.kind === "due_date" ? "due-date-event" : ""}"><span class="record-icon">${icon(item.kind === "due_date" ? "debt" : "reminders")}</span><div class="record-info"><strong>${esc(item.title)}</strong><small>${item.due_on ? `<span class="${daysFromToday(item.due_on) < 0 ? "reminder-late" : ""}">${reminderTiming(item.due_on)}</span> · ${item.due_on.split("-").reverse().join("/")}` : "Post-it"}${item.kind === "due_date" ? " · Vencimento" : " · Lembrete"}${item.recurrence !== "once" ? ` · ${({weekly:"Toda semana",monthly:"Todo mês",yearly:"Todo ano"}[item.recurrence])}` : ""} · ${esc(names(item.owner_id))}${item.note ? `<br>${esc(item.note)}` : ""}</small></div>${!item.completed && own(item) ? button("finish-reminder", item.recurrence === "once" ? "Concluir" : "Feito, lembrar depois", "secondary", `data-id="${item.id}"`) : ""}${own(item) ? button("edit-reminder", "Editar", "text-button", `data-id="${item.id}"`) + deleteButton("reminders", item.id) : ""}</article>`;
  const postIt = (item: Reminder) => `<article class="post-it post-it-${item.color}" role="note"><div><span class="badge">Post-it</span>${own(item) ? `<span class="post-it-actions">${button("edit-reminder", "Editar", "text-button", `data-id="${item.id}"`)}${deleteButton("reminders", item.id)}</span>` : ""}</div><h3>${esc(item.title)}</h3>${item.note ? `<p>${esc(item.note)}</p>` : ""}<small>${esc(names(item.owner_id))}</small></article>`;
  return `<section class="page-intro"><div><h2>Lembretes e avisos da família</h2><p>Datas, vencimentos e recados compartilhados num só lugar.</p></div><div class="button-row">${button("nav", "Abrir calendário", "secondary", 'data-page="calendar"')}${api.allowed("entries") ? button("add-reminder", icon("plus") + " Novo lembrete") + button("add-due-date", "Novo vencimento", "secondary") + button("add-post-it", "Novo post-it", "secondary") : ""}</div></section><section class="panel"><div class="panel-title"><div><span class="eyebrow">DATAS IMPORTANTES</span><h3>Lembretes</h3></div><span class="badge">${tasks.length}</span></div>${tasks.map(row).join("") || '<p class="fine">Nenhum lembrete pendente.</p>'}</section><section class="panel section-gap due-date-panel"><div class="panel-title"><div><span class="eyebrow">CONTAS E COMPROMISSOS</span><h3>Vencimentos</h3></div><span class="badge">${dueDates.length}</span></div>${dueDates.map(row).join("") || '<p class="fine">Nenhum vencimento pendente.</p>'}</section><section class="panel section-gap post-it-board"><div class="panel-title"><div><span class="eyebrow">RECADOS RÁPIDOS</span><h3>Post-its da família</h3></div>${api.allowed("entries") ? button("add-post-it", "Adicionar post-it", "secondary") : ""}</div><div class="post-it-grid">${notes.map(postIt).join("") || '<p class="fine">O mural está vazio. Adicione um recado para todos verem.</p>'}</div></section><details class="panel reminder-history section-gap"><summary>Concluídos (${completed.length})</summary>${completed.map(row).join("") || '<p class="fine">Nenhum item concluído ainda.</p>'}</details>`;
}
function planning() {
  return `<section class="page-intro"><div><h2>Um mês com menos surpresas.</h2><p>Despesas fixas previstas e limite mensal do lar.</p></div><div class="button-row">${api.allowed("entries") ? button("add-recurring", "Cadastrar despesa fixa") + button("plan-month", "Gerar contas do mês", "secondary") : ""}</div></section><section class="panel"><h3>Contas que se repetem</h3>${api.data!.recurring.map((r) => `<article class="record"><span class="record-icon">${icon("entries")}</span><div class="record-info"><strong>${esc(r.name)}</strong><small>Dia ${r.day} · desde ${r.start_month} · ${esc(names(r.owner_id))}</small></div><strong>${brl(r.amount_cents)}</strong><div class="record-actions">${share("recurring", r)}${own(r) && api.allowed("entries") ? deleteButton("recurring", r.id) : ""}</div></article>`).join("") || empty("Cadastre aluguel, internet e outras contas", "add-recurring")}<p class="fine">Gerar contas cria compromissos a pagar uma única vez por mês. A geração nunca informa um pagamento automaticamente. Contas já geradas permanecem no histórico.</p></section>`;
}
function goals() {
  return `<section class="page-intro"><div><h2>Planos que ganham forma.</h2><p>Acompanhe sua reserva e os objetivos da família.</p></div>${api.allowed("entries") ? button("add-goal", "Nova meta") : ""}</section><div class="card-grid">${api.data!.goals.map((g) => `<section class="panel"><span class="record-icon">${icon("goals")}</span><h3>${esc(g.name)}</h3><strong class="large-number">${brl(g.saved_cents)}</strong><p>de ${brl(g.target_cents)}${g.due_date ? " · até " + g.due_date : ""}</p><div class="bar"><b style="width:${Math.min(100, (g.saved_cents / g.target_cents) * 100)}%"></b></div><p class="fine">${Math.round((g.saved_cents / g.target_cents) * 100)}% da meta · progresso informado manualmente</p><div class="button-row">${share("goals", g)}${own(g) && api.allowed("entries") ? button("edit-goal", "Atualizar progresso", "secondary", `data-id="${g.id}"`) + deleteButton("goals", g.id) : ""}</div></section>`).join("") || empty("Dê um nome ao seu próximo objetivo", "add-goal")}</div>${wishesSection(ctx())}`;
}
function documents() {
  const d = api.data!;
  return `<section class="page-intro"><div><h2>Comprovantes sempre à mão.</h2><p>Recibos, faturas e documentos protegidos por acesso.</p></div>${api.allowed("documents") ? button("add-document", "Anexar documento") : ""}</section><section class="panel">${d.documents.length ? d.documents.map((doc) => `<article class="record"><span class="record-icon">${icon("documents")}</span><div class="record-info"><strong>${esc(doc.name)}</strong><small>${Math.ceil(doc.size / 1024)} KB · ${esc(names(doc.owner_id))}</small></div><div class="record-actions">${share("documents", doc)}${button("open-document", "Abrir", "secondary", `data-id="${doc.id}"`)}${own(doc) && api.allowed("documents") ? deleteButton("documents", doc.id) : ""}</div></article>`).join("") : empty("Tudo organizado desde o primeiro recibo", "add-document")}<p class="fine">PDF, JPG, PNG ou WebP até 10 MB. Documentos vinculados a um gasto privado continuam privados mesmo que você marque o documento como compartilhado.</p></section>`;
}
function family() {
  const d = api.data!;
  return `<section class="page-intro"><div><h2>Uma família. Acessos diferentes.</h2><p>Gastos da casa entram no painel familiar. Cada pessoa também pode registrar seus gastos pessoais.</p></div>${admin() ? button("add-member", "Criar usuário") : ""}</section><div class="hint-banner">${icon("family")}<div><strong>${admin() ? "Compartilhamento claro para a casa" : "Organize os gastos do seu jeito"}</strong><p>${admin() ? "Gastos da casa compartilhados aparecem no painel familiar. Cada pessoa mantém suas despesas pessoais sob seu próprio controle." : "Gastos da casa que você registrar aparecem no painel familiar. Seus gastos pessoais ficam visíveis só para você até optar por compartilhar."}</p></div></div><div class="card-grid">${d.members
    .map(
      (m) =>
        `<section class="panel member-panel"><div class="avatar">${esc(m.display_name.slice(0, 1))}</div><h3>${esc(m.display_name)}</h3><span class="badge ${m.active ? "shared" : "warning-badge"}">${m.role === "admin" ? "Administrador" : m.active ? "Membro ativo" : "Acesso suspenso"}</span>${
          m.role === "admin"
            ? "<p>Visão completa e controle das permissões e do compartilhamento.</p>"
            : `<form id="permissions-form" data-id="${m.user_id}"><div class="permission-list">${Object.entries(
                permissions,
              )
                .map(
                  ([key, label]) =>
                    `<label><input type="checkbox" name="${key}" ${m.permissions[key as Permission] ? "checked" : ""} ${admin() ? "" : "disabled"}><span>${label}</span></label>`,
                )
                .join(
                  "",
                )}</div>${admin() ? `<button type="submit" class="primary full">Salvar permissões</button>` : ""}</form>${admin() ? button("toggle-member", m.active ? "Suspender acesso" : "Reativar acesso", "text-button section-gap", `data-id="${m.user_id}"`) : ""}`
        }</section>`,
    )
    .join("")}</div>${
    admin()
      ? `<section class="panel section-gap"><h3>Histórico de alterações</h3>${
          d.audit.length
            ? `<div class="audit-list">${d.audit
                .slice(0, 20)
                .map(
                  (a) =>
                    `<p><span>${esc(names(a.actor_id))} · ${esc(a.action)} · ${esc(a.table_name.replace("fin_", ""))}</span><small>${new Date(a.created_at).toLocaleString("pt-BR")}</small></p>`,
                )
                .join("")}</div>`
            : '<p class="fine">As alterações reais serão registradas aqui, sem copiar valores privados para o histórico.</p>'
        }</section>`
      : ""
  }`;
}
const widgetNames: Record<DashboardWidget, string> = { categories: "Gastos por categoria", insights: "Próximos passos", recent: "Últimos lançamentos" };
const actionNames: Record<QuickAction, string> = { expense: "Registrar gasto", cards: "Ver cartões", shopping: "Lista de compras", pantry: "Despensa" };
function appearanceSettings() {
  const pref = api.preferences;
  return `<section class="panel appearance-settings"><h3>Aparência e atalhos</h3><p>Estas escolhas pertencem somente à sua conta.</p><form id="preferences-form" class="form-grid">${field("theme", "Tema", `<select name="theme">${opt("system", "Acompanhar aparelho", pref.theme) + opt("light", "Claro", pref.theme) + opt("dark", "Escuro", pref.theme)}</select>`)}${field("palette", "Cor", `<select name="palette">${opt("forest", "Verde", pref.palette) + opt("ocean", "Azul", pref.palette) + opt("plum", "Ameixa", pref.palette)}</select>`)}${field("text_size", "Tamanho do texto", `<select name="text_size">${opt("standard", "Padrão", pref.text_size) + opt("large", "Maior", pref.text_size)}</select>`)}<div class="preference-checks wide"><label><input type="checkbox" name="comfortable" ${pref.comfortable ? "checked" : ""}> Mais espaço entre elementos</label><label><input type="checkbox" name="simple_mode" ${pref.simple_mode ? "checked" : ""}> Modo simples</label><label><input type="checkbox" name="hide_values" ${pref.hide_values ? "checked" : ""}> Ocultar valores na tela</label><label><input type="checkbox" name="focus_mode" ${pref.focus_mode ? "checked" : ""}> Modo foco: Início só com o próximo passo e o dia de hoje</label></div><fieldset class="wide preference-list"><legend>Blocos do painel</legend><p>Marque o que deseja ver. Use as setas para mudar a ordem.</p>${pref.dashboard_order.concat(dashboardWidgets.filter((item) => !pref.dashboard_order.includes(item))).map((id) => `<div class="preference-row"><label><input type="checkbox" name="widget" value="${id}" ${pref.dashboard_order.includes(id) ? "checked" : ""}> ${widgetNames[id]}</label><span>${button("widget-up", "↑", "secondary", `data-id="${id}" aria-label="Subir ${widgetNames[id]}"`)}${button("widget-down", "↓", "secondary", `data-id="${id}" aria-label="Descer ${widgetNames[id]}"`)}</span></div>`).join("")}</fieldset><fieldset class="wide preference-list"><legend>Atalhos do início</legend>${quickActions.map((id) => `<label><input type="checkbox" name="quick_action" value="${id}" ${pref.quick_actions.includes(id) ? "checked" : ""}> ${actionNames[id]}</label>`).join("")}</fieldset><div class="button-row wide"><button type="submit" class="primary">Salvar aparência</button>${button("reset-preferences", "Restaurar padrão", "secondary")}</div></form></section>`;
}
function settings() {
  return `<section class="page-intro"><div><h2>Do seu jeito.</h2><p>Segurança, planejamento e dados bem cuidados.</p></div></section>${appearanceSettings()}<div class="card-grid">${admin() ? `<section class="panel"><h3>Planejamento da casa</h3><form id="budget-form" class="form-grid">${field("name", "Nome da casa", input("name", "text", api.data!.home.name, 'maxlength="80" required'), true)}${field("budget", "Orçamento mensal do lar (R$)", moneyInput("budget", (api.data!.home.budget_cents / 100).toFixed(2).replace(".", ",")), true)}<button type="submit" class="primary wide">Salvar planejamento</button></form></section>` : ""}<section class="panel"><h3>Trocar minha senha</h3>${api.me.password_change_required ? '<p class="notice">Sua conta usa uma senha inicial. Defina sua senha pessoal aqui.</p>' : ""}<form id="password-form" class="form-grid">${field("current", "Senha atual", input("current", "password", "", 'autocomplete="current-password" required'), true)}${field("password", "Nova senha", input("password", "password", "", 'autocomplete="new-password" minlength="8" required'), true)}${field("confirm", "Repita a nova senha", input("confirm", "password", "", 'autocomplete="new-password" minlength="8" required'), true)}<button type="submit" class="primary wide">Atualizar senha</button></form></section><section class="panel"><h3>Seus dados</h3><p>O backup inclui apenas os registros que sua conta pode acessar. O arquivo contém informações financeiras.</p>${button("export", "Exportar backup JSON", "secondary full")}${admin() ? button("import", "Importar relatório ou backup", "secondary full section-gap") : ""}<p class="fine">A importação mostra uma prévia e adiciona registros em revisão. Nenhum histórico é substituído automaticamente.</p></section><section class="panel"><h3>Como os números funcionam</h3><p>Gastos entram pelo valor total na data da compra. Parcelas aparecem nas faturas seguintes. Pagamentos de faturas, transferências e principal de dívidas não criam nova despesa.</p><p>Saldo inicial desconhecido permanece desconhecido. Registros em revisão ficam fora dos cálculos.</p></section></div>`;
}
function entryForm(preset: Partial<Entry> = {}) {
  const e = {
    kind: "expense",
    date: today(),
    category: "",
    area: "household",
    status: "paid",
    payment: "cash",
    installments: 1,
    ...preset,
  };
  const conditional = (name: string, content: string, wide = false) =>
    `<div class="conditional-field ${wide ? "wide" : ""}" data-entry-field="${name}">${content}</div>`;
  return `<form id="entry-form" class="form-grid">${input("id", "hidden", e.id || "")}${field(
    "kind",
    "O que você quer registrar?",
    `<select name="kind">${[
      ["expense", "Registrar gasto"],
      ["payable", "Conta a pagar"],
      ["income", "Receita"],
      ["card_payment", "Pagamento de fatura"],
      ["transfer", "Transferência"],
      ["debt_payment", "Pagamento de principal"],
    ]
      .filter(([v]) => !api.preferences.simple_mode || ["expense", "payable", "income"].includes(v) || v === e.kind)
      .map(([v, l]) => opt(v, l, e.kind === "expense" && e.status === "pending" && e.payment === "cash" ? "payable" : e.kind))
      .join("")}</select>`,
  )}${conditional("payment", field("payment", "Como pagou?", `<select name="payment">${opt("cash", "Pix, débito ou dinheiro", e.payment) + opt("card", "Cartão", e.payment)}</select>`))}${conditional("card", field("card_id", "Cartão", `<select name="card_id">${cardOptions(e.card_id)}</select>`))}${conditional("installment-basis", field("installment_basis", "Qual valor você tem?", `<select name="installment_basis">${opt("total", "Tenho o total da compra", "total") + opt("each", "Tenho o valor da parcela", "total")}</select>`))}<label><span id="amount-label">Valor (R$)</span>${moneyInput("amount", e.amount_cents ? (e.amount_cents / 100).toFixed(2).replace(".", ",") : "")}</label>${conditional("installments", field("installments", "Número de parcelas", input("installments", "number", e.installments, 'min="1" max="48" required')))}${conditional("first-invoice", field("first_invoice_month", "Primeira fatura (se precisar ajustar)", input("first_invoice_month", "month", e.first_invoice_month || "") + '<small>Se deixar vazio, usamos o fechamento atual do cartão.</small>'))}${field("description", "Descrição", input("description", "text", e.description || "", 'maxlength="160" placeholder="Ex.: compras da semana" required'), true)}${field("payee", "Estabelecimento ou destinatário (opcional)", input("payee", "text", e.payee || "", 'maxlength="160" list="payees" placeholder="Ex.: farmácia, iFood ou pessoa"') + `<datalist id="payees">${[...new Set(api.data!.entries.map((item) => item.payee).filter(Boolean))].map((item) => `<option value="${esc(item)}"></option>`).join("")}</datalist>`, true)}${field("date", "Data da compra", input("date", "date", e.date, "required"))}${field("category", "Categoria", `<select name="category" required>${opt("", "Selecione uma categoria", e.category)}${categoryOptions(e.category)}</select>`)}${field("subcategory", "Subcategoria (opcional)", input("subcategory", "text", e.subcategory || "", 'list="subcategories" maxlength="80" placeholder="Ex.: vacinas"') + subcategoryList(e.category) + `<div class="subcategory-chips" data-subcategory-chips>${subcategoryChips(e.category, e.subcategory || "")}</div>`)}<p class="fine wide">Toque em uma sugestão ou digite um nome novo. Salve suas opções frequentes em Categorias.</p>${conditional("due-date", field("due_date", "Vencimento", input("due_date", "date", e.due_date || "")))}<details class="more-details wide" ${api.preferences.simple_mode ? "" : "open"}><summary>Mais detalhes</summary><div class="form-grid">${field(
    "area",
    "Área",
    `<select name="area">${[
      ["household", admin() ? "Lar / família" : "Gasto da casa (compartilhado)"],
      ["personal", admin() ? "Pessoal" : "Meu gasto pessoal"],
      ["business", "Empresa"],
    ]
      .map(([v, l]) => opt(v, l, e.area))
      .join("")}</select>`,
  )}${conditional("status", field(
    "status",
    "Situação",
    `<select name="status">${[
      ["paid", "Confirmado / pago"],
      ["pending", "A pagar"],
      ["pending_review", "Em revisão"],
    ]
      .map(([v, l]) => opt(v, l, e.status))
      .join("")}</select>`,
  ))}${conditional("source", field("source_ref", "Referência / origem", input("source_ref", "text", e.source_ref || "", 'maxlength="160"'), true))}</div></details><p class="installment-preview wide" id="installment-preview" aria-live="polite"></p>${conditional("account", field("account_id", "Conta usada", `<select name="account_id">${accountOptions(e.account_id)}</select>`))}${conditional("target-account", field("target_account_id", "Conta de destino", `<select name="target_account_id">${accountOptions(e.target_account_id)}</select>`))}${conditional("invoice-month", field("invoice_month", "Competência da fatura paga", input("invoice_month", "month", e.invoice_month || month)))}${conditional("debt", field(
    "debt_id",
    "Dívida (pagamento de principal)",
    `<select name="debt_id">${
      opt("", "Sem dívida") +
      api
        .data!.debts.filter(own)
        .map((d) => opt(d.id, d.name, e.debt_id))
        .join("")
    }</select>`,
  ))}${conditional("debt-installment", field("debt_installment_number", "Parcela deste empréstimo (opcional)", `<select name="debt_installment_number" data-selected="${e.debt_installment_number || ""}"><option value="">Sem parcela vinculada</option></select>`))}<p class="fine wide">${admin() ? "Seus gastos pessoais ficam visíveis para você. Os gastos da casa são compartilhados com a família." : "Gastos da casa são compartilhados automaticamente. Gastos pessoais ficam só para você até escolher compartilhar."}</p>${formEnd("Salvar lançamento")}</form>`;
}
function quickExpenseForm() {
  const cards = api.data!.cards.filter((card) => own(card) && !card.archived_at);
  return `<form id="quick-expense-form" class="form-grid quick-expense-form">${field("description", "O que você comprou?", input("description", "text", "", 'maxlength="160" placeholder="Ex.: vacina do filho" required'), true)}${field("amount", "Valor total (R$)", moneyInput("amount", ""))}${field("date", "Data da compra", input("date", "date", today(), "required"))}${field("category", "Categoria", `<select name="category" required>${opt("", "Escolha uma categoria")}${categoryOptions("")}</select>`)}${field("subcategory", "Subcategoria (opcional)", input("subcategory", "text", "", 'list="quick-subcategories" maxlength="80" placeholder="Ex.: Vacinas"') + `<datalist id="quick-subcategories"></datalist><div class="subcategory-chips" data-quick-subcategory-chips></div>`)}${field("area", "Tipo de gasto", `<select name="area">${opt("household", "Da casa · compartilhado", "household")}${opt("personal", "Pessoal · só para mim")}</select>`)}${field("payment", "Como pagou?", `<select name="payment">${opt("cash", "Pix, débito ou dinheiro", "cash")}${opt("card", "Cartão")}</select>`)}${cards.length ? field("card_id", "Qual cartão?", `<select name="card_id">${cardOptions()}</select>`) : ""}<p class="fine wide">Compras no cartão entram na fatura conforme o fechamento cadastrado.</p><div class="button-row wide"><button type="submit" class="primary">Salvar gasto</button>${button("add-entry", "Mais opções", "secondary")}</div></form>`;
}
function pantryForm(p?: Pantry) {
  const lasts = p ? durationFromDailyUse(p.daily_use) : 0;
  const preset = !p || p.daily_use === 0 ? "0" : durationChoices.some(([days]) => days && dailyUseFromDuration(days) === p.daily_use) ? String(lasts) : "advanced";
  const units = p && !pantryUnits.includes(p.unit) ? [p.unit, ...pantryUnits] : pantryUnits;
  return `<form id="pantry-form" class="form-grid">${input("id", "hidden", p?.id || "")}${field("name", "Produto", input("name", "text", p?.name || "", 'maxlength="151" required'), true)}${field("quantity", p ? "Quantidade contada agora" : "Quantidade que você tem", input("quantity", "number", p ? formatQuantity(forecast(p).stock).replace(/\./g, "").replace(",", ".") : 0, 'min="0" step="0.01" inputmode="decimal" required'))}${field("unit", "Unidade", `<select name="unit">${units.map((u) => opt(u, u, p?.unit || "unidade")).join("")}</select>`)}${api.householdReady ? field("location", "Onde fica guardado", `<select name="location">${locationOrder.map((l) => opt(l, `${pantryLocations[l].emoji} ${pantryLocations[l].label}`, p ? locationOf(p) : "kitchen")).join("")}</select>`) : ""}${field("lasts", "Quanto tempo dura 1 unidade?", `<select name="lasts">${durationChoices.map(([days, label]) => opt(String(days), label, preset)).join("")}${opt("advanced", "Informar consumo por dia", preset)}</select>`)}${field("minimum", "Avisar quando chegar a", input("minimum", "number", p?.minimum ?? 1, 'min="0" step="0.01" inputmode="decimal" required'))}${field("price", "Preço por unidade (R$)", moneyInput("price", p?.price_cents ? (p.price_cents / 100).toFixed(2).replace(".", ",") : ""))}${field("expires_on", "Validade (opcional)", input("expires_on", "date", p?.expires_on || ""))}<details class="more-details wide" ${preset === "advanced" ? "open" : ""}><summary>Consumo por dia (avançado)</summary><div class="form-grid">${field("daily_use", "Consumo por dia", input("daily_use", "number", p?.daily_use || 0, 'min="0" step="0.0001" inputmode="decimal"'))}<p class="fine wide">Usado só quando “Informar consumo por dia” estiver escolhido. Ex.: 0,5 litro de leite por dia.</p></div></details><p class="fine wide">A duração gera uma estimativa da quantidade. “Não sei” mantém a quantidade fixa até a próxima contagem.</p>${formEnd()}</form>`;
}
function taskForm(t?: Task) {
  const people = opt("", "Qualquer pessoa", t?.assignee_id || "") +
    api.data!.members.filter((m) => m.active || m.user_id === t?.assignee_id).map((m) => opt(m.user_id, m.display_name, t?.assignee_id || "")).join("");
  const templates = t ? "" : `<div class="wide template-row"><span class="fine">Modelos (só preenchem o formulário):</span><div class="chips">${taskTemplates.map((x, i) => `<button type="button" class="chip" data-action="task-template" data-id="${i}">${taskKinds[x.kind].emoji} ${esc(x.title)}</button>`).join("")}</div></div>`;
  return `<form id="task-form" class="form-grid">${input("id", "hidden", t?.id || "")}${templates}${field("title", "O que precisa ser feito", input("title", "text", t?.title || taskTitlePreset, 'maxlength="120" required placeholder="Ex.: limpar o banheiro"'), true)}${field("assignee_id", "Quem faz", `<select name="assignee_id">${people}</select>`)}${field("due_date", "Quando", input("due_date", "date", t ? t.due_date || "" : today()))}${field("repeat", "Repetir", `<select name="repeat">${Object.entries(repeatLabels).map(([v, l]) => opt(v, l, t?.repeat || "none")).join("")}</select>`)}${field("kind", "Tipo", `<select name="kind">${Object.entries(taskKinds).map(([v, k]) => opt(v, `${k.emoji} ${k.label}`, t?.kind || "cleaning")).join("")}</select>`)}${field("notes", "Detalhes (opcional)", `<textarea name="notes" maxlength="500" rows="2">${esc(t?.notes || "")}</textarea>`, true)}${field("steps", "Passos (opcional, um por linha)", `<textarea name="steps" rows="3" placeholder="Ex.: separar a roupa&#10;ligar a máquina&#10;estender">${esc((t?.steps || []).map((x) => x.text).join("\n"))}</textarea>`, true)}<p class="fine wide">Tarefa grande assusta: quebre em passos pequenos e marque um de cada vez. A rotina é compartilhada com todos da casa. Tarefas repetidas ganham a próxima data quando forem marcadas como feitas.</p>${formEnd(t ? "Salvar tarefa" : "Criar tarefa")}</form>`;
}
function modalContent() {
  const d = api.data!;
  const p = d.pantry.find((p) => p.id === editId),
    g = d.goals.find((g) => g.id === editId);
  switch (modal) {
    case "quick-expense":
      return quickExpenseForm();
    case "entry":
      return entryForm(editId ? d.entries.find((e) => e.id === editId) : {});
    case "entry-draft":
      return `${draftHint ? `<p class="notice draft-hint" role="status">${esc(draftHint)}</p>` : ""}${entryForm(entryDraft || {})}`;
    case "carne":
      return carneForm(ctx());
    case "simulate":
      return d.cards.filter(own).length ? simulateForm(ctx(), d.cards.filter(own), simulateHtml) : '<p class="fine">Cadastre um cartão para simular uma compra parcelada.</p>';
    case "event":
      return eventForm(ctx(), d.events.find((e) => e.id === editId), eventPreset);
    case "note":
      return noteForm(ctx());
    case "triage":
      return triageContent(d.inbox.find((n) => n.id === editId), ctx());
    case "wish":
      return wishForm(ctx(), wishDraftName);
    case "income":
      return entryForm({ kind: "income", category: "" });
    case "payable":
      return entryForm({ kind: "expense", status: "pending", payment: "cash", category: "" });
    case "card-payment":
      return entryForm({
        kind: "card_payment",
        card_id: editId,
        invoice_month: month,
        description: "Pagamento de fatura",
        category: "Fatura",
        amount_cents: invoice(d, d.cards.find((c) => c.id === editId)!, month)
          .remaining,
      });
    case "debt-payment": {
      const debt = d.debts.find((item) => item.id === editId);
      const next = debt?.installment_count && debt.installment_cents
        ? Array.from({ length: debt.installment_count }, (_, index) => index + 1).find((number) =>
            d.entries.filter((item) => item.kind === "debt_payment" && item.debt_id === editId && item.debt_installment_number === number && item.status === "paid")
              .reduce((sum, item) => sum + item.amount_cents, 0) < debt.installment_cents!) : undefined;
      return entryForm({ kind: "debt_payment", debt_id: editId, debt_installment_number: next || null,
        description: "Pagamento de principal", payee: debt?.creditor || null,
        amount_cents: debt?.installment_cents || undefined, category: "Dívidas" });
    }
    case "transfer":
      return entryForm({ kind: "transfer", account_id: editId || null, description: "Transferência entre contas", category: "Transferência" });
    case "alignment": {
      const card = d.cards.find((item) => item.id === editId)!;
      const current = invoice(d, card, month);
      return `<form id="alignment-form" class="form-grid">${field("invoice_month", "Fatura", input("invoice_month", "month", month, "required"))}${field("cutoff_on", "Data da conferência", input("cutoff_on", "date", today(), "required"))}${field("total", "Total informado na fatura, antes de pagamentos (R$)", moneyInput("total", current.alignment ? (current.total / 100).toFixed(2).replace(".", ",") : ""), true)}${field("note", "Observação (opcional)", input("note", "text", "", 'maxlength="500" placeholder="Ex.: valor visto no app do banco"'), true)}<p class="fine wide">Este total substitui a soma das compras anteriores à data de conferência. Compras posteriores desta fatura serão somadas. Pagamentos serão abatidos à parte. O alinhamento anterior continua no histórico.</p>${formEnd("Alinhar fatura")}</form>`;
    }
    case "merge-card": {
      const source = d.cards.find((item) => item.id === editId)!;
      const targets = d.cards.filter((item) => item.id !== source.id && !item.archived_at && item.owner_id === source.owner_id && item.closing_day === source.closing_day && item.due_day === source.due_day);
      return `<form id="merge-card-form" class="form-grid"><p class="fine wide">As compras, pagamentos e anexos de ${esc(source.name)} passarão para o cartão escolhido. O cartão duplicado ficará arquivado com histórico.</p>${field("target", "Cartão que vai permanecer", `<select name="target" required>${opt("", "Escolha o cartão")}${targets.map((item) => opt(item.id, `${item.name} · ${item.created_at?.slice(0, 10) || "sem data"} · ${d.entries.filter((entry) => entry.card_id === item.id).length} lançamento(s)`)).join("")}</select>`, true)}${targets.length ? formEnd("Consolidar cartões") : '<p class="fine wide">Não há outro cartão do mesmo titular com datas iguais. Confira o cadastro primeiro.</p>'}</form>`;
    }
    case "category-preset": {
      const preset = d.category_presets.find((item) => item.id === editId);
      return `<form id="category-preset-form" class="form-grid">${input("id", "hidden", preset?.id || "")}${field("category", "Categoria", input("category", "text", preset?.category || categoryPresetCategory, 'list="category-names" maxlength="80" placeholder="Ex.: Saúde" required') + `<datalist id="category-names">${categoryOptions("")}</datalist>`, true)}${field("subcategory", "Subcategoria (opcional)", input("subcategory", "text", preset?.subcategory || "", 'maxlength="80" placeholder="Ex.: Vacinas"'), true)}${admin() ? `<label class="wide category-sharing"><input type="checkbox" name="shared" ${(preset?.shared ?? true) ? "checked" : ""}> Disponível para a família</label>` : ""}<p class="fine wide">Use só a categoria para criar um grupo novo. Adicione uma subcategoria para encontrá-la nos próximos gastos. Lançamentos antigos mantêm sua classificação.</p>${formEnd(preset ? "Salvar opção" : "Criar opção")}</form>`;
    }
    case "card": {
      const card = d.cards.find((item) => item.id === editId);
      return `<form id="card-form" class="form-grid">${input("id", "hidden", card?.id || "")}${field("name", "Nome do cartão", input("name", "text", card?.name || "", 'maxlength="160" required'), true)}${field("limit", "Limite (R$, opcional)", moneyInput("limit", card?.limit_cents == null ? "" : (card.limit_cents / 100).toFixed(2).replace(".", ",")))}${field("closing_day", "Dia de fechamento", input("closing_day", "number", card?.closing_day ?? 10, 'min="1" max="31" required'))}${field("due_day", "Dia de vencimento", input("due_day", "number", card?.due_day ?? 17, 'min="1" max="31" required'))}${card ? '<p class="fine wide">Ao mudar o fechamento, as compras antigas mantêm a primeira fatura que já era exibida.</p>' : '<p class="fine wide">Sugestão padrão: fechamento dia 10 e vencimento dia 17. Ajuste conforme a fatura do cartão. Não informe número completo nem código de segurança.</p>'}${formEnd()}</form>`;
    }
    case "account": {
      const a = d.accounts.find((item) => item.id === editId);
      return `<form id="account-form" class="form-grid">${input("id", "hidden", a?.id || "")}${field("name", "Nome", input("name", "text", a?.name || "", 'maxlength="160" required'), true)}${field("area", "Área", `<select name="area">${opt("personal", "Pessoal", a?.area) + opt("household", "Lar", a?.area) + opt("business", "Empresa", a?.area)}</select>`)}${field("opening", "Saldo ao fim da data-base (R$, opcional)", moneyInput("opening", a?.opening_cents == null ? "" : (a.opening_cents / 100).toFixed(2).replace(".", ",")))}${field("date", "Data-base do saldo", input("date", "date", a?.balance_date || today()))}<p class="fine wide">Pagamentos, receitas e transferências após essa data atualizam o saldo. Ao alterar a data-base, informe o saldo que havia no fim daquele dia.</p>${formEnd()}</form>`;
    }
    case "debt": {
      const debt = d.debts.find((item) => item.id === editId);
      return `<form id="debt-form" class="form-grid">${input("id", "hidden", debt?.id || "")}${field("name", "Descrição", input("name", "text", debt?.name || "", 'maxlength="160" required'), true)}${field("creditor", "Credor", input("creditor", "text", debt?.creditor || "", 'maxlength="160" required'))}${field("balance", "Principal devido (R$, opcional)", moneyInput("balance", debt?.balance_cents == null ? "" : (debt.balance_cents / 100).toFixed(2).replace(".", ",")))}${field("due_date", "Vencimento geral", input("due_date", "date", debt?.due_date || ""))}${field("area", "Área", `<select name="area">${opt("household", "Lar", debt?.area) + opt("personal", "Pessoal", debt?.area) + opt("business", "Empresa", debt?.area)}</select>`)}${field("installment_count", "Número de parcelas (opcional)", input("installment_count", "number", debt?.installment_count || "", 'min="1" max="360"'))}${field("installment", "Valor de cada parcela (R$)", moneyInput("installment", debt?.installment_cents ? (debt.installment_cents / 100).toFixed(2).replace(".", ",") : ""))}${field("first_due_date", "Vencimento da primeira parcela", input("first_due_date", "date", debt?.first_due_date || ""))}<p class="fine wide">A agenda de parcelas é uma previsão. Pagamentos de principal abatem o saldo da dívida; juros e taxas são despesas separadas.</p>${formEnd()}</form>`;
    }
    case "pantry":
      return pantryForm(p);
    case "pantry-move": {
      const stock = p ? forecast(p).stock : 0;
      return `<form id="move-form" class="form-grid">${input("id", "hidden", p?.id || "")}<p class="wide">${esc(p?.name)}: estimativa de hoje <strong>${formatQuantity(stock)} ${esc(p?.unit)}</strong>.</p>${field("quantity", moveKind === "lost" ? `Quanto foi perdido (${esc(p?.unit)})` : `Quanto foi usado (${esc(p?.unit)})`, input("quantity", "number", stock > 0 && stock < 1 ? formatQuantity(stock).replace(",", ".") : 1, 'min="0.01" step="0.01" inputmode="decimal" required'), true)}<p class="fine wide">${moveKind === "lost" ? "Perdas entram no total de desperdício do mês, pelo último preço conhecido." : "O uso desconta da estimativa de hoje. Para corrigir a quantidade real, use “Conferir”."}</p>${formEnd(moveKind === "lost" ? "Registrar perda" : "Registrar uso")}</form>`;
    }
    case "task":
      return taskForm(d.tasks.find((t) => t.id === editId));
    case "catalog-add": {
      const card = cardByKey(editId);
      return card ? catalogAddForm(card) : '<p class="fine">Este item não está mais no catálogo.</p>';
    }
    case "catalog-new":
      return catalogNewForm(offerMode);
    case "catalog-find":
      return findContent();
    case "flyer":
      return flyerForm();
    case "flyer-preview":
      return flyerPreview();
    case "reminder": {
      const r = d.reminders.find((item) => item.id === editId);
      const kind = r?.kind || newReminderKind;
      const postIt = kind === "post_it";
      return `<form id="reminder-form" class="form-grid">${input("id", "hidden", r?.id || "")}${field("kind", "Tipo de aviso", `<select name="kind">${opt("reminder", "Lembrete com data", kind) + opt("due_date", "Vencimento", kind) + opt("post_it", "Post-it compartilhado", kind)}</select>`, true)}${field("title", postIt ? "Título do post-it" : kind === "due_date" ? "O que vence?" : "O que lembrar?", input("title", "text", r?.title || "", 'maxlength="120" placeholder="Ex.: pagar conta de luz" required'), true)}<label class="wide"><span>Detalhes ou recado (opcional)</span><textarea name="note" maxlength="3000" rows="3" placeholder="Escreva um recado curto para a família">${esc(r?.note || "")}</textarea></label><div data-reminder-field="date" ${postIt ? "hidden" : ""}>${field("due_on", kind === "due_date" ? "Data de vencimento" : "Data", input("due_on", "date", r?.due_on || (postIt ? "" : page === "calendar" ? calendarSelectedDate : today()), postIt ? "" : "required"))}</div><div data-reminder-field="recurrence" ${postIt ? "hidden" : ""}>${field("recurrence", "Repetir", `<select name="recurrence">${opt("once", "Só uma vez", r?.recurrence || "once") + opt("weekly", "Toda semana", r?.recurrence) + opt("monthly", "Todo mês", r?.recurrence) + opt("yearly", "Todo ano", r?.recurrence)}</select>`)}</div><div data-reminder-field="color" ${postIt ? "" : "hidden"}>${field("color", "Cor do post-it", `<select name="color">${opt("yellow", "Amarelo", r?.color || "yellow") + opt("blue", "Azul", r?.color) + opt("pink", "Rosa", r?.color) + opt("green", "Verde", r?.color)}</select>`)}</div><p class="fine wide">Lembretes, vencimentos e post-its ficam visíveis para os membros ativos da família.</p>${formEnd("Salvar aviso")}</form>`;
    }
    case "shopping": {
      const item = d.shopping.find((row) => row.id === editId);
      return `<form id="shopping-form" class="form-grid">${input("id", "hidden", item?.id || "")}${field("name", "Produto", input("name", "text", item?.name || "", 'maxlength="151" required'), true)}${field("quantity", "Quantidade", input("quantity", "number", item?.quantity || 1, 'min="0.01" step="0.01" required'))}${field("unit", "Unidade", `<select name="unit">${["unidade", "kg", "litro", "pacote", "caixa", "dúzia"].map((u) => opt(u, u, item?.unit || "unidade")).join("")}</select>`)}${field("price", "Preço estimado por unidade (R$)", moneyInput("price", item ? (item.estimate_cents / 100).toFixed(2).replace(".", ",") : ""))}${formEnd()}</form>`;
    }
    case "goal":
      return `<form id="goal-form" class="form-grid">${input("id", "hidden", g?.id || "")}${field("name", "Nome da meta", input("name", "text", g?.name || "", 'maxlength="160" required'), true)}${field("target", "Objetivo (R$)", moneyInput("target", g ? (g.target_cents / 100).toFixed(2).replace(".", ",") : ""))}${field("saved", "Valor guardado (R$)", moneyInput("saved", g ? (g.saved_cents / 100).toFixed(2).replace(".", ",") : "0,00"))}${field("due_date", "Data desejada", input("due_date", "date", g?.due_date || ""))}${formEnd()}</form>`;
    case "document":
      return `<form id="document-form" class="form-grid">${field("file", "Arquivo (até 10 MB)", `<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required>`, true)}${field(
        "entry_id",
        "Vincular a lançamento",
        `<select name="entry_id">${
          opt("", "Sem lançamento") +
          d.entries
            .filter(own)
            .map((e) => opt(e.id, e.description))
            .join("")
        }</select>`,
        true,
      )}${field("card_id", "Ou vincular a cartão", `<select name="card_id">${cardOptions()}</select>`, true)}${formEnd("Enviar documento")}</form>`;
    case "recurring":
      return `<form id="recurring-form" class="form-grid">${field("name", "Descrição", input("name", "text", "", 'maxlength="160" required'), true)}${field("amount", "Valor previsto (R$)", moneyInput("amount"))}${field("day", "Dia do vencimento", input("day", "number", 5, 'min="1" max="31" required'))}${field("start_month", "A partir do mês", input("start_month", "month", month, "required"))}${field("category", "Categoria", input("category", "text", "Moradia", 'maxlength="80" required'))}${field("area", "Área", `<select name="area">${opt("household", "Lar") + opt("personal", "Pessoal") + opt("business", "Empresa")}</select>`)}${formEnd()}</form>`;
    case "member":
      return `<form id="member-form" class="form-grid">${field("name", "Nome", input("name", "text", "", 'maxlength="80" required'), true)}${field("email", "E-mail", input("email", "email", "", 'autocomplete="off" required'), true)}${field("password", "Senha inicial", input("password", "password", "", 'autocomplete="new-password" minlength="8" required'), true)}<p class="fine wide">Envie a senha inicial à pessoa de forma privada. Ela poderá trocá-la no próprio painel. O usuário começa com permissões de gastos, cartões, pagamentos, anexos, despensa e compras.</p>${formEnd("Criar usuário")}</form>`;
    case "import":
      return `<form id="import-form" class="form-grid">${field("file", "Relatório CSV ou backup JSON", `<input type="file" name="file" accept=".csv,.json" required>`, true)}<p class="fine wide">CSV: descrição;valor;data;categoria;área. Data no formato AAAA-MM-DD. Cada registro entra como pendente de revisão. PDFs e imagens podem ser anexados, mas não são interpretados automaticamente.</p>${formEnd("Ver prévia")}</form>`;
    case "import-preview":
      return `<div><p>${importRows.length} registro(s). Serão adicionados ao seu usuário como privados e em revisão.</p><div class="import-list">${importRows
        .slice(0, 30)
        .map(
          (e) =>
            `<p>${esc(e.date)} · ${esc(e.description)} · <strong>${brl(e.amount_cents!)}</strong></p>`,
        )
        .join(
          "",
        )}</div><p class="fine">Confirme os valores e a origem. Possíveis duplicatas são bloqueadas pela prévia.</p><div class="form-actions">${button("close", "Cancelar", "secondary")}${button("confirm-import", "Adicionar para revisão")}</div></div>`;
    default:
      return "";
  }
}
function render() {
  const pref = api.data ? api.preferences : defaultPreferences();
  const surface = document.documentElement;
  surface.dataset.theme = pref.theme;
  surface.dataset.palette = pref.palette;
  surface.dataset.textSize = pref.text_size;
  surface.dataset.comfortable = String(pref.comfortable);
  surface.dataset.hideValues = String(pref.hide_values);
  if (!api.data) {
    root.innerHTML = login();
    return;
  }
  const titles: Record<string, string> = {
    entry: editId ? "Editar lançamento" : "Novo lançamento",
    "quick-expense": "Gasto rápido",
    income: "Registrar receita",
    payable: "Criar conta a pagar",
    transfer: "Transferir entre contas",
    alignment: "Alinhar fatura",
    "merge-card": "Unir cartões duplicados",
    "category-preset": editId ? "Editar classificação" : "Nova categoria ou subcategoria",
    "card-payment": "Pagamento de fatura",
    "debt-payment": "Pagamento de principal",
    card: editId ? "Editar cartão" : "Novo cartão",
    account: editId ? "Conferir saldo ou editar conta" : "Nova conta",
    debt: editId ? "Editar empréstimo ou dívida" : "Novo empréstimo ou dívida",
    pantry: editId ? "Contagem da despensa" : "Novo produto",
    shopping: "Adicionar à lista",
    reminder: editId ? "Editar lembrete" : "Novo lembrete",
    "entry-draft": "Conferir antes de salvar",
    carne: "Carnê ou boleto parcelado",
    simulate: "Cabe no mês?",
    event: editId ? "Editar compromisso" : "Novo compromisso",
    note: "Anotar rápido",
    triage: "Organizar anotação",
    wish: "Quero comprar…",
    "pantry-move": moveKind === "lost" ? "Perdi ou venceu" : "Usei da despensa",
    "catalog-add": "Adicionar à lista",
    "catalog-find": "Escolher produto",
    "catalog-new": offerMode ? "Nova oferta de encarte" : "Criar item no catálogo",
    flyer: "Colar texto do encarte",
    "flyer-preview": "Confira as ofertas",
    task: editId ? "Editar tarefa" : "Nova tarefa da casa",
    goal: "Seu próximo objetivo",
    document: "Anexar documento",
    recurring: "Nova despesa fixa",
    member: "Novo usuário da família",
    import: "Importar relatório",
    "import-preview": "Confira antes de importar",
  };
  const views: Record<string, () => string> = {
    overview: summary,
    agenda: () => agendaView(ctx(), agenda, remindersOn()),
    focus: () => focusPage(queue(), ctx(), doneToday(api.data!, api.userId, today()), timer),
    entries,
    analysis,
    categories,
    cards,
    reminders,
    calendar,
    accounts,
    pantry: house,
    shopping,
    planning,
    goals,
    documents,
    family,
    settings,
  };
  root.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" data-action="nav" data-page="overview"><span class="brand-mark">${icon("goals")}</span>Financeiro<span>360</span></a><span class="nav-label">NOSSA CASA</span><nav>${sidebarNav()}</nav><div class="sidebar-footer"><div class="avatar small">${esc(api.me.display_name.slice(0, 1))}</div><div><strong>${esc(api.me.display_name)}</strong><small>${admin() ? "Administrador" : "Membro da família"}</small></div><button type="button" data-action="logout" aria-label="Sair da conta">${icon("logout")}</button></div></aside><div class="main-shell"><header class="topbar"><div><span class="eyebrow">${esc(api.data.home.name.toLocaleUpperCase())}</span><h1>${esc(nav.find((x) => x[0] === page)?.[1])}</h1></div><div class="topbar-actions"><select class="mobile-more" name="navigate" aria-label="Abrir uma seção">${nav.map(([id, label]) => opt(id, label, page)).join("")}</select><label class="month-picker"><span>Mês</span><input type="month" name="month" value="${month}" aria-label="Mês de referência"></label>${button("toggle-values", pref.hide_values ? "Mostrar valores" : "Ocultar valores", "secondary desktop")}${button("reload", icon("check") + " Atualizar", "secondary desktop")}${api.allowed("entries") ? button("add-entry", icon("plus") + " Lançar", "primary") : ""}</div></header>${api.demo ? `<div class="demo-banner"><strong>Demonstração · dados fictícios e temporários</strong>${button("switch-demo", admin() ? "Ver como esposa" : "Ver como administrador", "text-button")}${button("logout", "Sair da demonstração", "text-button")}</div>` : ""}${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ""}${api.me.password_change_required ? `<div class="password-banner">Defina sua senha pessoal em Configurações. ${button("nav", "Trocar senha", "text-button", 'data-page="settings"')}</div>` : ""}${agendaAlerts.length ? `<div class="reminder-banner" role="alert">${agendaAlerts.map((r) => `<p>⏰ ${esc(r.text)} ${button("reminder-ok", "Ok", "text-button", `data-id="${esc(r.key)}"`)}</p>`).join("")}</div>` : ""}${timer && page !== "focus" ? `<div class="timer-chip" role="timer">${icon("timer")}<span>${esc(timer.label)}</span><strong id="timer-chip-left">${timerText(timerLeft(timer.endsAt, Date.now()))}</strong>${button("timer-stop", "Parar", "text-button")}</div>` : ""}<main class="content">${views[page]()}</main><button type="button" class="fab" data-action="add-note" aria-label="Anotar rápido (atalho: tecla A)">${icon("note")}<span>Anotar</span></button><nav class="mobile-nav">${nav
    .filter(([id]) =>
      mobileNav.has(id),
    )
    .map(
      ([id, label]) =>
        `<button type="button" class="${page === id ? "active" : ""}" data-action="nav" data-page="${id}">${icon(id)}<span>${label.split(" ")[0]}</span></button>`,
    )
    .join(
      "",
    )}</nav></div></div>${modal ? `<dialog open class="modal" aria-labelledby="modal-title"><div class="modal-heading"><h2 id="modal-title">${esc(titles[modal])}</h2><button type="button" class="close" data-action="close" aria-label="Fechar">×</button></div>${notice ? `<div class="notice" role="alert">${esc(notice)}</div>` : ""}${modalContent()}</dialog><div class="scrim"></div>` : ""}`;
  syncCart();
  const dashboard = root.querySelector<HTMLElement>(".dashboard-grid");
  if (dashboard) {
    const tiles = new Map(
      Array.from(dashboard.querySelectorAll<HTMLElement>("[data-widget]"))
        .map((tile) => [tile.dataset.widget!, tile]),
    );
    for (const id of pref.dashboard_order) {
      const tile = tiles.get(id);
      if (tile) dashboard.append(tile);
    }
    for (const [id, tile] of tiles) if (!pref.dashboard_order.includes(id as DashboardWidget)) tile.hidden = true;
  }
  root.querySelectorAll<HTMLElement>(".flow-chart-scroll").forEach((chart) => { chart.scrollLeft = chart.scrollWidth; });
  if (modal) {
    const dialog = root.querySelector<HTMLDialogElement>("dialog")!;
    dialog.removeAttribute("open");
    dialog.showModal();
    dialog
      .querySelector<HTMLInputElement>('input:not([type="hidden"]), textarea')
      ?.focus();
    syncEntryForm();
    syncModalForms();
  }
}
async function run(work: () => Promise<unknown>, message: string | (() => string) = "") {
  if (busy) return;
  const form = root.querySelector<HTMLFormElement>("dialog form");
  const values = form
    ? Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[name]"))
        .filter((control) => control.type !== "file")
        .map((control) => ({ name: control.name, value: control.value, checked: control instanceof HTMLInputElement ? control.checked : false }))
    : null;
  const openDetails = form ? Array.from(form.querySelectorAll("details")).map((details) => details.open) : [];
  let failed = false;
  busy = true;
  root
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((b) => (b.disabled = true));
  try {
    await work();
    notice = typeof message === "function" ? message() : message;
  } catch (e) {
    failed = true;
    notice =
      e instanceof Error
        ? e.message
        : "Não foi possível concluir. Tente novamente.";
  } finally {
    busy = false;
    render();
    if (failed && values && modal) {
      Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("dialog [name]"))
        .filter((control) => control.type !== "file")
        .forEach((control, index) => {
          const saved = values[index];
          if (saved && saved.name === control.name) {
            control.value = saved.value;
            if (control instanceof HTMLInputElement) control.checked = saved.checked;
          }
        });
      root.querySelectorAll<HTMLDetailsElement>("dialog details").forEach((details, index) => {
        details.open = openDetails[index] || false;
      });
      syncEntryForm();
    }
  }
}
function show(type: string, id = "") {
  notice = "";
  modal = type;
  editId = id;
  // Abrir outro formulário fora do "Organizar" desfaz o vínculo com a anotação.
  triageNoteId = "";
  render();
}
// Abre o formulário de lançamento preenchido a partir de um texto livre (lançamento rápido ou anotação).
function openDraft(text: string) {
  const d = api.data!;
  const draft = parseQuick(text, { cards: d.cards.filter(own), accounts: d.accounts.filter(own), entries: d.entries.filter(own), today: today() });
  entryDraft = {
    description: draft.description,
    amount_cents: draft.amount_cents || undefined,
    date: draft.date,
    kind: draft.kind === "income" ? "income" : "expense",
    status: draft.kind === "payable" ? "pending" : "paid",
    payment: draft.payment,
    card_id: draft.card_id,
    account_id: draft.account_id,
    installments: draft.installments,
    category: draft.category,
    due_date: draft.due_date,
  };
  const labels = { amount: "o valor", description: "a descrição", card: "qual cartão", category: "a categoria" };
  draftHint = draft.uncertain.length
    ? `Confira ${draft.uncertain.map((u) => labels[u]).join(", ")}: não deu para entender pelo texto.`
    : "Preenchido pelo que você escreveu. Confira e salve.";
  notice = "";
  editId = "";
  modal = "entry-draft";
  render();
}
async function finishTriage() {
  if (!triageNoteId) return;
  const id = triageNoteId;
  triageNoteId = "";
  await api.saveOwn("inbox", { id, done_at: new Date().toISOString() }).catch(() => undefined);
}
function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Bipe curto sem arquivo de áudio. O som precisa ser liberado por um toque (regra dos navegadores).
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    audio = audio || new AudioContext();
    void audio.resume();
  } catch {
    audio = null;
  }
}
function alarm() {
  navigator.vibrate?.([250, 120, 250]);
  if (!audio) return;
  for (const at of [0, 0.35, 0.7]) {
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, audio.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + 0.3);
    tone.connect(gain).connect(audio.destination);
    tone.start(audio.currentTime + at);
    tone.stop(audio.currentTime + at + 0.3);
  }
}
function notifyDevice(title: string, body: string, tag: string) {
  if (!remindersOn()) return;
  const fallback = () => {
    try {
      new Notification(title, { body, tag });
    } catch {
      /* alguns celulares só aceitam aviso pelo service worker */
    }
  };
  if (navigator.serviceWorker) void navigator.serviceWorker.getRegistration().then((reg) => (reg ? reg.showNotification(title, { body, tag }) : fallback())).catch(fallback);
  else fallback();
}
// Avisos dos compromissos com o app aberto (a cada 30 s). Com o app fechado não há aviso.
function checkReminders() {
  if (!api.data) return;
  const mine = api.data.events.filter((e) => e.owner_id === api.userId || e.people.includes(api.userId));
  const seen = new Set(stored<string[]>("local", SEEN_KEY, []));
  const fresh = dueReminders(mine, new Date(), seen).filter((r) => !agendaAlerts.some((x) => x.key === r.key));
  if (!fresh.length) return;
  for (const r of fresh) {
    const when = r.minutes <= 0 ? "começa agora" : r.minutes >= 1440 ? "é amanhã" : r.minutes >= 60 ? `começa em ${Math.round(r.minutes / 60)} h` : `começa em ${r.minutes} min`;
    agendaAlerts.push({ key: r.key, text: `${r.event.title} ${when}` });
    notifyDevice(r.event.title, `${r.event.title} ${when}`, r.key);
  }
  if (!modal && !root.querySelector("input:focus, textarea:focus, select:focus")) render();
}
// Atalhos do ícone do app (Android) e links: ?acao=lancar | anotar | lista | agenda.
function launchAction() {
  const params = new URLSearchParams(location.search);
  const action = params.get("acao");
  if (!action || !api.data) return;
  history.replaceState(null, "", location.pathname + location.hash);
  if (action === "lancar" && api.allowed("entries")) show("entry");
  else if (action === "anotar") show("note");
  else if (action === "lista" || action === "agenda") {
    page = action === "lista" ? "shopping" : "agenda";
    render();
  }
}
function chooseSubcategory(chip: HTMLElement) {
  const form = chip.closest<HTMLFormElement>("#entry-form, #quick-expense-form");
  const field = form?.querySelector<HTMLInputElement>('[name="subcategory"]');
  if (!form || !field) return;
  form.dataset.lastCategory = form.querySelector<HTMLSelectElement>('[name="category"]')?.value || "";
  field.value = chip.dataset.value || "";
  form.querySelectorAll<HTMLElement>("[data-action='pick-subcategory']").forEach((item) =>
    item.classList.toggle("selected", item === chip));
}
root.addEventListener("pointerdown", (event) => {
  const chip = (event.target as Element).closest<HTMLElement>('[data-action="pick-subcategory"]');
  if (chip) chooseSubcategory(chip);
});
root.addEventListener("click", (event) => {
  const b = (event.target as Element).closest<HTMLElement>("[data-action]");
  if (!b || busy) return;
  const a = b.dataset.action!,
    id = b.dataset.id || "";
  if (a === "pick-subcategory") {
    chooseSubcategory(b);
    return;
  }
  if (a === "nav") {
    page = b.dataset.page!;
    if (b.dataset.house) houseTab = b.dataset.house;
    if (b.dataset.cards) cardsTab = b.dataset.cards;
    notice = "";
    modal = "";
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (a === "analysis-period") {
    analysisPeriod = b.dataset.period === "yearly" ? "yearly" : "monthly";
    render();
    return;
  }
  if (a === "entry-kind") {
    entryKind = b.dataset.kind || "all";
    render();
    return;
  }
  if (a === "calendar-day") {
    const date = b.dataset.date || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) calendarSelectedDate = date;
    render();
    return;
  }
  if (a === "calendar-shift") {
    month = addMonths(month, Number(b.dataset.step || 0));
    calendarSelectedDate = `${month}-01`;
    render();
    return;
  }
  if (a === "calendar-today") {
    month = today().slice(0, 7);
    calendarSelectedDate = today();
    render();
    return;
  }
  if (a === "add-reminder-day") {
    const date = b.dataset.date || calendarSelectedDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) calendarSelectedDate = date;
    newReminderKind = "reminder";
    show("reminder");
    return;
  }
  if (a === "open-invoice") {
    const targetMonth = b.dataset.month;
    if (targetMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      month = targetMonth;
      page = "cards";
      render();
      window.scrollTo(0, 0);
    }
    return;
  }
  if (a === "entry-invoice") {
    const entry = api.data!.entries.find((item) => item.id === id);
    const card = entry?.card_id ? api.data!.cards.find((item) => item.id === entry.card_id) : undefined;
    if (entry && card) {
      month = entry.first_invoice_month || invoiceMonth(entry.date, card.closing_day);
      page = "cards";
      render();
      window.scrollTo(0, 0);
    }
    return;
  }
  if (a === "close") {
    modal = "";
    triageNoteId = "";
    render();
    return;
  }
  if (a === "cards-tab") {
    cardsTab = id;
    render();
    return;
  }
  if (a === "agenda-tab" || a === "agenda-filter") {
    if (a === "agenda-tab") agenda.tab = id as AgendaState["tab"];
    else agenda.filter = id as AgendaFilter;
    render();
    return;
  }
  if (a === "agenda-move") {
    const dir = Number(id);
    agenda.date = agenda.tab === "day" ? addDays(agenda.date, dir) : agenda.tab === "week" ? addDays(agenda.date, 7 * dir) : `${addMonths(agenda.date.slice(0, 7), dir)}-01`;
    render();
    return;
  }
  if (a === "agenda-today" || a === "agenda-open-day") {
    agenda = { ...agenda, date: a === "agenda-today" ? today() : id, tab: a === "agenda-today" ? agenda.tab : "day" };
    render();
    if (a === "agenda-open-day") window.scrollTo(0, 0);
    return;
  }
  if (a === "add-event" || a === "edit-event") {
    eventPreset = a === "add-event" ? { day: agenda.date >= today() ? agenda.date : today() } : {};
    show("event", a === "edit-event" ? id : "");
    return;
  }
  if (a === "delete-event") {
    if (!confirm("Excluir este compromisso? Se ele se repete, todas as datas saem da agenda.")) return;
    void run(async () => {
      await api.removeOwn("events", id);
      modal = "";
    }, "Compromisso excluído.");
    return;
  }
  if (a === "event-ics" || a === "week-ics") {
    const d = api.data!;
    const start = addDays(agenda.date, -weekday(agenda.date));
    const list = a === "event-ics"
      ? d.events.filter((e) => e.id === id)
      : d.events.filter((e) => occurrences(e, start, addDays(start, 6)).length > 0 && (e.owner_id === api.userId || e.people.includes(api.userId) || e.visibility === "home"));
    if (!list.length) {
      notice = "Nenhum compromisso nesta semana para levar ao calendário.";
      render();
      return;
    }
    download(toIcs(list), a === "event-ics" ? "compromisso.ics" : `agenda-semana-${start}.ics`, "text/calendar;charset=utf-8");
    notice = "Arquivo baixado. Abra-o no celular para adicionar ao seu calendário.";
    render();
    return;
  }
  if (a === "enable-reminders") {
    void Notification.requestPermission().then((result) => {
      notice = result === "granted" ? "Avisos ligados neste aparelho enquanto o app estiver aberto." : "O navegador não permitiu avisos. Você pode liberar nas configurações do site.";
      render();
    });
    return;
  }
  if (a === "reminder-ok") {
    store("local", SEEN_KEY, [...stored<string[]>("local", SEEN_KEY, []), id].slice(-200));
    agendaAlerts = agendaAlerts.filter((r) => r.key !== id);
    render();
    return;
  }
  if (a === "add-note") {
    show("note");
    return;
  }
  if (a === "note-done") {
    void run(async () => {
      await api.saveOwn("inbox", { id, done_at: new Date().toISOString() });
      modal = "";
    }, "Pronto. Saiu da caixa de entrada.");
    return;
  }
  if (a === "note-delete") {
    if (!confirm("Apagar esta anotação?")) return;
    void run(() => api.removeOwn("inbox", id), "Anotação apagada.");
    return;
  }
  if (a === "triage") {
    show("triage", id);
    return;
  }
  if (a.startsWith("triage-")) {
    const n = api.data!.inbox.find((x) => x.id === id);
    if (!n) return;
    if (a === "triage-entry") openDraft(n.text);
    else if (a === "triage-event") {
      eventPreset = { title: n.text.slice(0, 120), day: today() };
      show("event");
    } else if (a === "triage-task") {
      taskTitlePreset = n.text.slice(0, 120);
      show("task");
    } else if (a === "triage-wish") {
      wishDraftName = n.text.slice(0, 120);
      show("wish");
    } else if (a === "triage-shopping") {
      void run(async () => {
        await api.addToShopping({ name: n.text.slice(0, 151), unit: "unidade", quantity: 1, estimate_cents: 0 });
        await api.saveOwn("inbox", { id: n.id, done_at: new Date().toISOString() });
        modal = "";
      }, "Foi para a lista de compras.");
      return;
    }
    triageNoteId = id;
    return;
  }
  if (a === "add-wish") {
    wishDraftName = "";
    show("wish");
    return;
  }
  if (a === "wish-bought" || a === "wish-gave-up") {
    void run(
      () => api.saveOwn("wishes", { id, decision: a === "wish-bought" ? "bought" : "gave_up", decided_at: new Date().toISOString() }),
      a === "wish-bought" ? "Decisão registrada. Você esperou e decidiu com calma." : "Desistência registrada. Esse dinheiro ficou com você.",
    );
    return;
  }
  if (a === "wish-wait") {
    void run(() => api.saveOwn("wishes", { id, wait_until: addDays(today(), 7) }), "Mais 7 dias de espera.");
    return;
  }
  if (a === "wish-delete") {
    if (!confirm("Apagar este desejo?")) return;
    void run(() => api.removeOwn("wishes", id), "Desejo apagado.");
    return;
  }
  if (a === "focus-skip") {
    store("session", SKIP_KEY, [...stored<string[]>("session", SKIP_KEY, []), id]);
    render();
    return;
  }
  if (a === "focus-snooze") {
    const kept = Object.fromEntries(Object.entries(stored<Record<string, string>>("local", SNOOZE_KEY, {})).filter(([, until]) => until > today()));
    store("local", SNOOZE_KEY, { ...kept, [id]: addDays(today(), 1) });
    notice = "Fica para amanhã.";
    render();
    return;
  }
  if (a === "timer-start") {
    const seconds = Math.min(3600, Math.max(60, Number(id) || 900));
    timer = { endsAt: Date.now() + seconds * 1000, total: seconds, label: b.dataset.label || "Foco" };
    store("session", TIMER_KEY, timer);
    unlockAudio();
    notice = `Temporizador de ${seconds / 60} min ligado. Só isso até ele acabar.`;
    render();
    return;
  }
  if (a === "timer-stop") {
    timer = null;
    store("session", TIMER_KEY, null);
    render();
    return;
  }
  if (a === "step-toggle") {
    const t = api.data!.tasks.find((x) => x.id === id);
    if (!t?.steps) return;
    const steps = t.steps.map((st, i) => (i === Number(b.dataset.step) ? { ...st, done: (b as HTMLInputElement).checked } : st));
    void run(() => api.saveSteps(id, steps), steps.every((st) => st.done) ? "Todos os passos feitos! Agora é só marcar a tarefa como feita." : "");
    return;
  }
  if (a === "repeat-entry") {
    const e = api.data!.entries.find((x) => x.id === id);
    if (!e) return;
    entryDraft = {
      description: e.description, amount_cents: e.amount_cents, kind: e.kind, category: e.category, area: e.area,
      payment: e.payment, card_id: e.card_id, account_id: e.account_id, installments: e.installments, status: "paid", date: today(),
    };
    draftHint = "Mesmo lançamento, com a data de hoje. Ajuste o valor se mudou.";
    notice = "";
    editId = "";
    modal = "entry-draft";
    render();
    return;
  }
  if (a === "simulate") {
    simulateHtml = "";
    show("simulate");
    return;
  }
  if (a === "add-carne") {
    show("carne");
    return;
  }
  if (a === "add-task") taskTitlePreset = "";
  if (a === "demo") {
    void run(() => api.startDemo());
    return;
  }
  if (a === "logout") {
    void run(async () => {
      await api.logout();
      page = "overview";
      modal = "";
    });
    return;
  }
  if (a === "switch-demo") {
    page = "overview";
    void run(() => api.switchDemo());
    return;
  }
  if (a === "reload") {
    void run(() => api.load(), "Dados atualizados.");
    return;
  }
  if (a === "toggle-values") {
    void run(() => api.savePreferences({ hide_values: !api.preferences.hide_values }), "Aparência salva.");
    return;
  }
  if (a === "reset-preferences") {
    void run(() => api.savePreferences(defaultPreferences()), "Aparência padrão restaurada.");
    return;
  }
  if (a === "widget-up" || a === "widget-down") {
    const form = root.querySelector<HTMLFormElement>("#preferences-form");
    const row = b.closest<HTMLElement>(".preference-row");
    const sibling = a === "widget-up" ? row?.previousElementSibling : row?.nextElementSibling;
    if (!form || !row || !sibling?.classList.contains("preference-row")) return;
    if (a === "widget-up") sibling.before(row);
    else sibling.after(row);
    void run(() => api.savePreferences(readPreferenceForm(form)), "Ordem do painel salva.");
    return;
  }
  if (a === "add-due-date" || a === "add-post-it") {
    newReminderKind = a === "add-due-date" ? "due_date" : "post_it";
    show("reminder");
    return;
  }
  if (a === "calendar-filter") {
    const filter = b.dataset.filter;
    if (filter === "all" || filter === "reminder" || filter === "due_date") calendarFilter = filter;
    render();
    return;
  }
  if (a === "add-reminder") newReminderKind = "reminder";
  if (a === "quick-expense") {
    show("quick-expense");
    return;
  }
  if (a === "add-subcategory") {
    categoryPresetCategory = b.dataset.category || "";
    show("category-preset");
    return;
  }
  if (a === "add-category-preset") categoryPresetCategory = "";
  const map: Record<string, string> = {
    "add-entry": "entry",
    "add-income": "income",
    "add-payable": "payable",
    "edit-entry": "entry",
    "add-category-preset": "category-preset",
    "edit-category-preset": "category-preset",
    "add-card": "card",
    "edit-card": "card",
    "card-payment": "card-payment",
    "align-invoice": "alignment",
    "merge-card": "merge-card",
    "transfer": "transfer",
    "add-account": "account",
    "edit-account": "account",
    "add-debt": "debt",
    "edit-debt": "debt",
    "debt-payment": "debt-payment",
    "add-pantry": "pantry",
    "edit-pantry": "pantry",
    "add-shopping": "shopping",
    "edit-shopping": "shopping",
    "add-reminder": "reminder",
    "edit-reminder": "reminder",
    "add-goal": "goal",
    "edit-goal": "goal",
    "add-document": "document",
    "add-recurring": "recurring",
    "add-member": "member",
    "add-task": "task",
    "edit-task": "task",
    import: "import",
  };
  if (a === "shop-tab") {
    shopTab = id;
    notice = "";
    render();
    return;
  }
  if (a === "catalog-store" || a === "catalog-cat") {
    if (a === "catalog-store") catalogStore = id;
    else catalogCategory = id;
    render();
    return;
  }
  if (a === "catalog-pick") {
    pickedProduct = null;
    show("catalog-add", id);
    return;
  }
  if (a === "catalog-find") {
    const card = cardByKey(id);
    if (card) openPicker(card.name, card.category);
    return;
  }
  if (a === "catalog-search-online") {
    openPicker(catalogTerm.trim(), catalogCategory === "all" ? guessCategory(catalogTerm) : catalogCategory);
    return;
  }
  if (a === "catalog-new-from-picker") {
    offerMode = false;
    catalogDraftName = pickerQuery.trim();
    show("catalog-new");
    return;
  }
  if (a === "find-pick") {
    const product = pickerRows.find((p) => p.code === id);
    if (!product) return;
    pickedProduct = product;
    show("catalog-add", "o:" + product.code);
    return;
  }
  if (a === "find-back") {
    show("catalog-find");
    return;
  }
  if (a === "catalog-refresh") {
    void refreshCatalog();
    return;
  }
  if (a === "catalog-new" || a === "catalog-new-from-term" || a === "offer-new") {
    offerMode = a === "offer-new";
    catalogDraftName = a === "catalog-new-from-term" ? catalogTerm : "";
    if (offerMode && !flyerDraft.until) flyerDraft.until = today();
    show("catalog-new");
    return;
  }
  if (a === "flyer-paste") {
    if (!flyerDraft.until) flyerDraft.until = today();
    show("flyer");
    return;
  }
  if (a === "flyer-back") {
    show("flyer");
    return;
  }
  if (a === "catalog-delete") {
    if (!confirm("Excluir este item do catálogo?")) return;
    void run(() => api.removeCatalog([id]), "Item excluído do catálogo.");
    return;
  }
  if (a === "offers-clean") {
    const ids = api.data!.catalog.map((e) => entryCard(e)).filter((c) => c.source === "offer" && c.expired).map((c) => c.id);
    if (!ids.length || !confirm(`Remover ${ids.length} oferta(s) vencida(s)?`)) return;
    void run(() => api.removeCatalog(ids), "Ofertas vencidas removidas.");
    return;
  }
  if (a === "house-tab" || a === "pantry-place") {
    if (a === "house-tab") houseTab = id;
    else pantryPlace = id;
    notice = "";
    render();
    return;
  }
  if (a === "pantry-use" || a === "pantry-lost") {
    moveKind = a === "pantry-use" ? "used" : "lost";
    show("pantry-move", id);
    return;
  }
  if (a === "pantry-finish") {
    const p = api.data!.pantry.find((x) => x.id === id)!;
    const addToList = api.allowed("shopping") && !api.data!.shopping.some((s) => !s.bought && s.pantry_id === id);
    if (!confirm(addToList ? `Marcar ${p.name} como acabado e colocar na lista de compras?` : `Marcar ${p.name} como acabado?`)) return;
    void run(async () => {
      await api.pantryMove(id, "finished", 0);
      if (addToList)
        await api.save("shopping", {
          name: p.name,
          pantry_id: p.id,
          quantity: Math.max(1, p.minimum),
          unit: p.unit,
          estimate_cents: p.price_cents,
          bought: false,
        });
    }, addToList ? "Produto zerado e colocado na lista." : "Produto marcado como acabado.");
    return;
  }
  if (a === "task-done") {
    void run(() => api.completeTask(id, today()), "Tarefa concluída. Obrigado!");
    return;
  }
  if (a === "task-reopen") {
    void run(() => api.save("tasks", { id, done_at: null, done_by: null }), "Tarefa reaberta.");
    return;
  }
  if (a === "task-template") {
    const form = root.querySelector<HTMLFormElement>("#task-form");
    const template = taskTemplates[Number(id)];
    if (!form || !template) return;
    (form.elements.namedItem("title") as HTMLInputElement).value = template.title;
    (form.elements.namedItem("kind") as HTMLSelectElement).value = template.kind;
    (form.elements.namedItem("repeat") as HTMLSelectElement).value = template.repeat;
    (form.elements.namedItem("steps") as HTMLTextAreaElement).value = (template.steps || []).join("\n");
    (form.elements.namedItem("title") as HTMLInputElement).focus();
    return;
  }
  if (a === "share-list") {
    const d = api.data!;
    const text = shoppingText(d.shopping.filter((s) => !s.bought), d.pantry, d.home.name);
    if (navigator.share) {
      void navigator.share({ title: "Lista de compras", text }).catch(() => undefined);
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => (notice = "Lista copiada. Cole no WhatsApp ou onde preferir."))
      .catch(() => (notice = "Não foi possível copiar a lista neste navegador."))
      .finally(render);
    return;
  }
  if (map[a]) {
    show(map[a], id);
    return;
  }
  if (a === "share") {
    void run(
      () =>
        api.share(
          b.dataset.table as keyof Data,
          id,
          b.dataset.shared !== "true",
        ),
      "Compartilhamento atualizado.",
    );
    return;
  }
  if (a === "quick-shop") {
    const name = b.dataset.name || "";
    const preset = quickGroceries.find(([n]) => n === name);
    if (api.data!.shopping.some((item) => !item.bought && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      notice = "Este item já está na lista.";
      render();
      return;
    }
    void run(() => api.save("shopping", { name, pantry_id: null, quantity: 1, unit: preset?.[1] || "unidade", estimate_cents: 0, bought: false }), "Item adicionado à lista.");
    return;
  }
  if (a === "finish-reminder") {
    const reminder = api.data!.reminders.find((item) => item.id === id)!;
    if (!reminder.due_on) return;
    void run(() => api.save("reminders", reminder.recurrence === "once" ? { id, completed: true } : { id, due_on: nextReminderDate(reminder as Reminder & { due_on: string }), completed: false }), reminder.kind === "due_date" ? "Vencimento concluído." : reminder.recurrence === "once" ? "Lembrete concluído." : "Próximo aviso atualizado.");
    return;
  }
  if (a === "share-balance") {
    const account = api.data!.accounts.find((item) => item.id === id)!;
    void run(() => api.save("accounts", { id, share_balance: !account.share_balance }), "Compartilhamento do saldo atualizado.");
    return;
  }
  if (a === "toggle-alignment-entry") {
    void run(() => api.setAlignmentException(b.dataset.alignment!, id, b.dataset.after !== "true"), "Compra conferida na fatura.");
    return;
  }
  if (a === "archive-card") {
    const linked = api.data!.entries.some((item) => item.card_id === id) ||
      api.data!.documents.some((item) => item.card_id === id) ||
      api.data!.invoice_alignments.some((item) => item.card_id === id);
    if (linked) {
      notice = "Este cartão tem lançamentos ou documentos. Use ‘Unir duplicado’ para preservar e mover os vínculos.";
      render();
      return;
    }
    if (!confirm("Arquivar este cartão vazio? Ele poderá ser restaurado depois.")) return;
    void run(() => api.save("cards", { id, archived_at: new Date().toISOString() }), "Cartão arquivado.");
    return;
  }
  if (a === "restore-card") {
    void run(() => api.save("cards", { id, archived_at: null, merged_into_id: null }), "Cartão restaurado.");
    return;
  }
  if (a === "delete") {
    if (
      !confirm(
        "Excluir este registro? Registros vinculados podem impedir a exclusão.",
      )
    )
      return;
    void run(async () => {
      if (b.dataset.table === "documents" && !api.demo) {
        const doc = api.data!.documents.find((d) => d.id === id)!;
        const result = await api
          .client!.storage.from("fin-family-private")
          .remove([doc.path]);
        if (result.error) throw Error("Não foi possível remover o arquivo.");
      }
      await api.remove(b.dataset.table as keyof Data, id);
    }, "Registro excluído.");
    return;
  }
  if (a === "paid" || a === "confirm-entry") {
    const e = api.data!.entries.find((e) => e.id === id)!;
    if (
      !confirm(
        a === "paid"
          ? "Confirmar que este pagamento foi realizado?"
          : "Confirmar data, valor e categoria e incluir nos totais?",
      )
    )
      return;
    void run(
      () => api.save("entries", { ...e, status: "paid" }),
      "Registro confirmado.",
    );
    return;
  }
  if (a === "toggle-member") {
    const m = api.data!.members.find((m) => m.user_id === id)!;
    if (
      !confirm(
        m.active ? "Suspender o acesso deste usuário?" : "Reativar o acesso?",
      )
    )
      return;
    void run(
      () => api.member({ user_id: id, active: !m.active }),
      "Acesso atualizado.",
    );
    return;
  }
  if (a === "plan-month") {
    void run(
      () => api.planMonth(month),
      "Contas previstas geradas uma vez para este mês.",
    );
    return;
  }
  if (a === "generate-list") {
    void run(async () => {
      const suggestions = recommendations(api.data!.pantry, api.data!.shopping, suggestDays);
      for (const { p, quantity } of suggestions)
        await api.save("shopping", {
          name: p.name,
          pantry_id: p.id,
          quantity,
          unit: p.unit,
          estimate_cents: p.price_cents,
          bought: false,
        });
    }, `Lista sugerida para ${suggestDays} dias a partir da despensa.`);
    return;
  }
  if (a === "shop-item") {
    const p = api.data!.pantry.find((p) => p.id === id)!;
    if (api.data!.shopping.some((s) => s.pantry_id === id && !s.bought)) {
      notice = "Este produto já está na lista.";
      render();
      return;
    }
    void run(
      () =>
        api.save("shopping", {
          name: p.name,
          pantry_id: p.id,
          quantity: Math.max(1, roundUpHundredths(p.minimum - forecast(p).stock)),
          unit: p.unit,
          estimate_cents: p.price_cents,
          bought: false,
        }),
      "Produto adicionado à lista.",
    );
    return;
  }
  if (a === "open-document") {
    if (api.demo) return;
    void run(() => api.download(api.data!.documents.find((d) => d.id === id)!));
    return;
  }
  if (a === "export") {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: "financeiro360-family",
            version: 2,
            exported_at: new Date().toISOString(),
            data: api.data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro360-${today()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (a === "confirm-import") {
    void run(async () => {
      await api.importEntries(importRows);
      modal = "";
      importRows = [];
    }, "Registros adicionados para revisão.");
    return;
  }
});
// "toggle" não borbulha: captura para lembrar quais categorias do catálogo foram abertas.
root.addEventListener("toggle", (event) => {
  const group = event.target as HTMLElement;
  if (!group.classList?.contains("catalog-group")) return;
  // Com busca ou filtro as categorias abrem sozinhas: isso não conta como escolha da pessoa.
  if (catalogTerm.trim() || catalogCategory !== "all") return;
  const id = group.dataset.cat!;
  if ((group as HTMLDetailsElement).open) catalogOpen.add(id);
  else catalogOpen.delete(id);
}, true);
root.addEventListener("change", (event) => {
  const changed = event.target as HTMLInputElement;
  if (changed.closest("#entry-form")) syncEntryForm();
  if (changed.name === "category" && changed.closest("#quick-expense-form")) {
    const form = changed.closest<HTMLFormElement>("#quick-expense-form")!;
    const items = subcategoriesFor(changed.value);
    form.querySelector("#quick-subcategories")!.innerHTML = items.map((item) => `<option value="${esc(item)}"></option>`).join("");
    form.querySelector<HTMLElement>("[data-quick-subcategory-chips]")!.innerHTML = subcategoryChips(changed.value);
  }
  if ((event.target as HTMLInputElement).name === "kind" && (event.target as HTMLInputElement).closest("#reminder-form")) syncReminderForm();
  if ((event.target as HTMLInputElement).closest("#carne-form, #event-form")) syncModalForms();
  if ((event.target as HTMLInputElement).closest("#purchase-form")) {
    syncCart();
    return;
  }
  if (modal) return;
  const el = event.target as HTMLInputElement;
  if (el.name === "suggest_days") {
    suggestDays = Number(el.value) || 14;
    render();
    return;
  }
  if (el.name === "task_person") {
    taskPerson = el.value;
    render();
    return;
  }
  if (el.name === "navigate") {
    page = el.value;
    notice = "";
    render();
    return;
  }
  if (el.name === "month") {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(el.value)) {
      month = el.value;
      calendarSelectedDate = `${month}-01`;
    }
    render();
  }
  if (["area", "owner", "status", "entry_category", "entry_subcategory"].includes(el.name)) {
    entryFiltersOpen = true;
    if (el.name === "area") area = el.value;
    if (el.name === "owner") owner = el.value;
    if (el.name === "status") status = el.value;
    if (el.name === "entry_category") { entryCategory = el.value; entrySubcategory = "all"; }
    if (el.name === "entry_subcategory") entrySubcategory = el.value;
    render();
  }
  if (["card_id_filter", "card_owner_filter", "card_status_filter"].includes(el.name)) {
    if (el.name === "card_id_filter") cardIdFilter = el.value;
    if (el.name === "card_owner_filter") cardOwnerFilter = el.value;
    if (el.name === "card_status_filter") cardStatusFilter = el.value as typeof cardStatusFilter;
    render();
  }
});
root.addEventListener("input", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.closest("#carne-form")) syncModalForms();
  if (
    el.closest("#entry-form") &&
    ["amount", "installments", "date", "first_invoice_month"].includes(el.name)
  )
    syncEntryForm();
  if (el.closest("#purchase-form")) {
    syncCart();
    return;
  }
  if (el.name === "search" || el.name === "pantry_search" || el.name === "catalog_search") {
    const pos = el.selectionStart;
    if (el.name === "search") filter = el.value;
    else if (el.name === "catalog_search") catalogTerm = el.value;
    else pantrySearch = el.value;
    render();
    const next = root.querySelector<HTMLInputElement>(`[name="${el.name}"]`);
    next?.focus();
    if (next?.type === "search") next.setSelectionRange(pos, pos);
  }
});
const val = (f: HTMLFormElement, n: string) =>
  String(new FormData(f).get(n) || "").trim();
function readPreferenceForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    theme: val(form, "theme") as typeof api.preferences.theme,
    palette: val(form, "palette") as typeof api.preferences.palette,
    text_size: val(form, "text_size") as typeof api.preferences.text_size,
    comfortable: data.has("comfortable"),
    simple_mode: data.has("simple_mode"),
    hide_values: data.has("hide_values"),
    focus_mode: data.has("focus_mode"),
    dashboard_order: Array.from(form.querySelectorAll<HTMLInputElement>('[name="widget"]'))
      .filter((item) => item.checked)
      .map((item) => item.value as DashboardWidget),
    quick_actions: data.getAll("quick_action").map((item) => String(item) as QuickAction),
  };
}
// Prévia do carnê e campo "quem vai" do compromisso, atualizados enquanto a pessoa preenche.
function syncModalForms() {
  const carne = root.querySelector<HTMLFormElement>("#carne-form");
  if (carne) {
    const out = root.querySelector<HTMLElement>("#carne-preview")!;
    const amount = parseMoney(val(carne, "amount"));
    const count = Number(val(carne, "count"));
    const first = val(carne, "first_due");
    if (!amount || !Number.isInteger(count) || count < 2 || count > 48 || !validIsoDate(first)) out.textContent = "Informe valor, parcelas (2 a 48) e o primeiro vencimento para ver a previsão.";
    else {
      const total = val(carne, "basis") === "each" ? amount * count : amount;
      const rows = carneSchedule({ description: val(carne, "description") || "Parcela", total, count, firstDue: first });
      out.innerHTML = `Total ${brl(total)} em ${count}x de ${brl(rows[0].amount_cents)}${rows[0].amount_cents !== rows[count - 1].amount_cents ? ` (centavos ajustados nas primeiras)` : ""}. Última parcela em ${formatDate(rows[count - 1].due_date)}.`;
    }
  }
  const event = root.querySelector<HTMLFormElement>("#event-form");
  if (event) {
    const people = event.querySelector<HTMLElement>("[data-people]")!;
    people.hidden = val(event, "visibility") !== "home";
  }
}
function syncReminderForm() {
  const form = root.querySelector<HTMLFormElement>("#reminder-form");
  if (!form) return;
  const kind = (form.elements.namedItem("kind") as HTMLSelectElement).value as Reminder["kind"];
  const isPostIt = kind === "post_it";
  const titleLabel = form.querySelector<HTMLElement>('[name="title"]')?.closest("label")?.querySelector("span");
  if (titleLabel) titleLabel.textContent = isPostIt ? "Título do post-it" : kind === "due_date" ? "O que vence?" : "O que lembrar?";
  const dateLabel = form.querySelector<HTMLElement>('[name="due_on"]')?.closest("label")?.querySelector("span");
  if (dateLabel) dateLabel.textContent = kind === "due_date" ? "Data de vencimento" : "Data";
  for (const [field, visible] of [["date", !isPostIt], ["recurrence", !isPostIt], ["color", isPostIt]] as const) {
    const wrap = form.querySelector<HTMLElement>(`[data-reminder-field="${field}"]`);
    if (!wrap) continue;
    wrap.hidden = !visible;
    wrap.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((el) => {
      el.disabled = !visible;
      if (el.name === "due_on") el.required = visible;
    });
  }
}
function syncEntryForm() {
  const form = root.querySelector<HTMLFormElement>("#entry-form");
  if (!form) return;
  const preview = root.querySelector<HTMLElement>("#installment-preview");
  const raw = (name: string) =>
    form.elements.namedItem(name) instanceof HTMLInputElement ||
    form.elements.namedItem(name) instanceof HTMLSelectElement
      ? (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value
      : "";
  const kind = raw("kind");
  const category = form.elements.namedItem("category");
  const suggestedCategory: Record<string, string> = {
    expense: "", payable: "Moradia", income: "Salário",
    transfer: "Transferência", card_payment: "Fatura", debt_payment: "Dívidas",
  };
  const previousKind = form.dataset.lastKind;
  if (previousKind && previousKind !== kind && category instanceof HTMLSelectElement &&
      category.value === suggestedCategory[previousKind])
    category.value = suggestedCategory[kind] || "";
  const subcategory = form.elements.namedItem("subcategory");
  if (category instanceof HTMLSelectElement && subcategory instanceof HTMLInputElement) {
    if (form.dataset.lastCategory !== undefined && form.dataset.lastCategory !== category.value) subcategory.value = "";
    form.dataset.lastCategory = category.value;
    const list = form.querySelector<HTMLDataListElement>("#subcategories");
    if (list) list.innerHTML = subcategoriesFor(category.value).map((item) => `<option value="${esc(item)}"></option>`).join("");
    const chips = form.querySelector<HTMLElement>("[data-subcategory-chips]");
    if (chips) chips.innerHTML = subcategoryChips(category.value, subcategory.value);
  }
  const installmentSelect = form.elements.namedItem("debt_installment_number");
  if (installmentSelect instanceof HTMLSelectElement) {
    const selected = installmentSelect.dataset.selected || installmentSelect.value;
    delete installmentSelect.dataset.selected;
    const debt = api.data?.debts.find((item) => item.id === raw("debt_id"));
    installmentSelect.innerHTML = opt("", "Sem parcela vinculada", selected) +
      Array.from({ length: debt?.installment_count || 0 }, (_, index) => opt(String(index + 1), `Parcela ${index + 1}/${debt!.installment_count}`, selected)).join("");
  }
  form.dataset.lastKind = kind;
  const enabled =
    kind === "expense" && raw("payment") === "card";
  const visibility: Record<string, boolean> = {
    payment: kind === "expense",
    card: enabled || kind === "card_payment",
    "installment-basis": enabled,
    installments: enabled,
    "first-invoice": enabled,
    "due-date": kind === "payable" || (kind === "expense" && !enabled && raw("status") === "pending"),
    account: !enabled,
    "target-account": kind === "transfer",
    "invoice-month": kind === "card_payment",
    debt: kind === "debt_payment",
    "debt-installment": kind === "debt_payment" && !!api.data?.debts.find((item) => item.id === raw("debt_id"))?.installment_count,
    source: true,
    status: kind !== "payable",
  };
  form.querySelectorAll<HTMLElement>("[data-entry-field]").forEach((field) => {
    const visible = visibility[field.dataset.entryField || ""] ?? false;
    field.hidden = !visible;
    field.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")
      .forEach((control) => (control.disabled = !visible));
  });
  const dateLabel = form.querySelector<HTMLElement>('[name="date"]')?.closest("label")?.querySelector("span");
  if (dateLabel) dateLabel.textContent = kind === "expense" ? "Data da compra" : kind === "income" ? "Data da receita" : kind === "payable" ? "Data do registro" : "Data da operação";
  const amountLabel = root.querySelector<HTMLElement>("#amount-label");
  if (amountLabel)
    amountLabel.textContent = enabled
      ? raw("installment_basis") === "each"
        ? "Valor de cada parcela (R$)"
        : "Valor total da compra (R$)"
      : "Valor (R$)";
  if (preview) preview.hidden = !enabled;
  if (!enabled || !preview) return;
  const entered = parseMoney(val(form, "amount"));
  const count = Number(val(form, "installments"));
  if (
    entered === null ||
    entered <= 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 48
  ) {
    preview.textContent =
      "Informe o valor e o número de parcelas para ver a previsão.";
    return;
  }
  const total =
    raw("installment_basis") === "each" ? entered * count : entered;
  if (!Number.isSafeInteger(total)) {
    preview.textContent = "O valor total ultrapassa o limite permitido.";
    return;
  }
  const card = api.data?.cards.find((c) => c.id === raw("card_id"));
  const date = val(form, "date");
  if (!card) {
    preview.textContent = "Selecione o cartão para conferir as competências.";
    return;
  }
  if (!validIsoDate(date)) {
    preview.textContent = "Informe a data completa da compra para ver a previsão.";
    return;
  }
  const manualFirst = raw("first_invoice_month");
  if (manualFirst && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(manualFirst) || manualFirst < date.slice(0, 7))) {
    preview.textContent = "A primeira fatura deve ser no mês da compra ou depois.";
    return;
  }
  const first = manualFirst || invoiceMonth(date, card.closing_day);
  const last = addMonths(first, count - 1);
  const schedule = Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    month: addMonths(first, index),
    amount: installmentAmount(total, count, index),
  }));
  preview.innerHTML = `<strong>Total da compra: ${brl(total)}</strong><span>Primeira fatura: ${first}; última: ${last}.</span><ol>${schedule.map((item) => `<li><span>Parcela ${item.number}/${count} · ${item.month.split("-").reverse().join("/")}</span><strong>${brl(item.amount)}</strong></li>`).join("")}</ol>`;
}
const cash = (f: HTMLFormElement, n: string, allowZero = false) => {
  const cents = parseMoney(val(f, n));
  if (cents === null || (!allowZero && cents <= 0))
    throw Error("Informe um valor válido em reais.");
  return cents;
};
root.addEventListener("submit", (event) => {
  event.preventDefault();
  const f = event.target as HTMLFormElement;
  submitNotice = "Alteração salva.";
  if (f.getAttribute("id") === "find-form") {
    pickerQuery = val(f, "query");
    pickerCategory = val(f, "category");
    void runPicker();
    return;
  }
  if (f.getAttribute("id") === "quick-form") {
    const text = val(f, "text");
    if (text) openDraft(text);
    return;
  }
  if (f.getAttribute("id") === "simulate-form") {
    simulateHtml = simulationResult(ctx(), { amount: val(f, "amount"), count: val(f, "count"), card_id: val(f, "card_id"), date: val(f, "date") });
    root.querySelector<HTMLElement>("#simulate-result")!.innerHTML = simulateHtml;
    return;
  }
  void run(async () => {
    const id = val(f, "id");
    if (f.getAttribute("id") === "login-form") {
      await api.login(val(f, "email"), val(f, "password"));
      setTimeout(launchAction, 0);
      return;
    }
    if (f.getAttribute("id") === "preferences-form") {
      await api.savePreferences(readPreferenceForm(f));
      return;
    }
    if (f.getAttribute("id") === "password-form") {
      if (val(f, "password") !== val(f, "confirm"))
        throw Error("As novas senhas precisam ser iguais.");
      await api.password(val(f, "current"), val(f, "password"));
      return;
    }
    if (f.getAttribute("id") === "permissions-form") {
      await api.member({
        user_id: f.dataset.id!,
        permissions: Object.fromEntries(
          Object.keys(permissions).map((k) => [k, new FormData(f).has(k)]),
        ) as Member["permissions"],
      });
      return;
    }
    if (f.getAttribute("id") === "budget-form") {
      await api.setBudget(cash(f, "budget", true), val(f, "name"));
      return;
    }
    if (f.getAttribute("id") === "catalog-add-form") {
      const card = cardByKey(val(f, "key"));
      if (!card) throw Error("Este item não está mais no catálogo.");
      const quantity = Number(val(f, "quantity"));
      const price = val(f, "price") ? parseMoney(val(f, "price")) : 0;
      if (!(quantity > 0) || price === null) throw Error("Confira a quantidade e o preço.");
      const name = composeName(composeName(card.name, card.brand, card.size), val(f, "extra"));
      const result = await api.addToShopping({ name, unit: card.unit, quantity, estimate_cents: price });
      let saved = "";
      if (new FormData(f).has("save_item") && card.barcode) {
        const count = await api.addCatalog([{ name: card.name, brand: card.brand, size: card.size, unit: card.unit, category: card.category,
          store: "", price_cents: price || null, offer_until: null, barcode: card.barcode, source: "off" }]).catch(() => 0);
        if (count) saved = " Guardado no seu catálogo.";
      }
      submitNotice = (result === "somou" ? `${name}: quantidade somada na lista.` : `${name} entrou na lista.`) + saved;
      pickedProduct = null;
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "catalog-new-form") {
      const price = val(f, "price") ? parseMoney(val(f, "price")) : null;
      if (val(f, "price") && price === null) throw Error("Confira o preço.");
      const draft = {
        name: val(f, "name"),
        brand: val(f, "brand"),
        size: val(f, "size"),
        unit: val(f, "unit"),
        category: val(f, "category"),
        store: val(f, "store"),
        price_cents: price,
        offer_until: val(f, "offer_until") || null,
        barcode: "",
        source: "manual",
      };
      await api.addCatalog([draft]);
      if (offerMode) flyerDraft = { ...flyerDraft, store: draft.store || flyerDraft.store, until: draft.offer_until || flyerDraft.until };
      if (new FormData(f).has("add_to_list"))
        await api.addToShopping({ name: composeName(draft.name, draft.brand, draft.size), unit: draft.unit, quantity: 1, estimate_cents: price || 0 });
      submitNotice = "Item salvo no catálogo.";
      offerMode = false;
      catalogDraftName = "";
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "flyer-form") {
      flyerDraft = { store: val(f, "store"), until: val(f, "until"), text: String(new FormData(f).get("text") || "") };
      if (!validIsoDate(flyerDraft.until)) throw Error("Informe até quando as ofertas valem.");
      const parsed = parseFlyerText(flyerDraft.text);
      if (!parsed.rows.length)
        throw Error("Não encontrei preços no texto. Cada linha precisa ter o produto e o preço, como “Arroz 5 kg - R$ 24,90”.");
      flyerRows = parsed.rows;
      flyerSkipped = parsed.skipped;
      modal = "flyer-preview";
      return;
    }
    if (f.getAttribute("id") === "flyer-confirm-form") {
      const chosen = new FormData(f).getAll("row").map((i) => flyerRows[Number(i)]).filter(Boolean);
      if (!chosen.length) throw Error("Marque ao menos uma oferta para salvar.");
      await api.addCatalog(chosen.map((r) => ({
        name: r.name, brand: "", size: "", unit: "unidade", category: r.category,
        store: flyerDraft.store, price_cents: r.price_cents, offer_until: flyerDraft.until, barcode: "", source: "flyer",
      })));
      submitNotice = `${chosen.length} oferta(s) de ${flyerDraft.store} salva(s).`;
      flyerDraft = { ...flyerDraft, text: "" };
      flyerRows = [];
      shopTab = "flyers";
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "carne-form") {
      const amount = cash(f, "amount");
      const count = Number(val(f, "count"));
      const firstDue = val(f, "first_due");
      if (!Number.isInteger(count) || count < 2 || count > 48) throw Error("Use de 2 a 48 parcelas.");
      if (!validIsoDate(firstDue)) throw Error("Informe o vencimento da primeira parcela.");
      const total = val(f, "basis") === "each" ? amount * count : amount;
      if (!Number.isSafeInteger(total)) throw Error("O valor total ultrapassa o limite permitido.");
      const ref = CARNE_PREFIX + crypto.randomUUID();
      // A data de cada parcela é o próprio vencimento: assim cada mês conta só a parcela dele.
      await api.addEntries(carneSchedule({ description: val(f, "description"), total, count, firstDue }).map((row) => ({
        ...row, date: row.due_date, kind: "expense", category: val(f, "category"), area: val(f, "area") as Entry["area"], status: "pending",
        payment: "cash", card_id: null, account_id: null, target_account_id: null, debt_id: null, installments: 1, invoice_month: null, source_ref: ref,
      })));
      submitNotice = `${count} parcelas criadas como contas a pagar. A primeira vence em ${formatDate(firstDue)}.`;
      cardsTab = "plans";
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "event-form") {
      const title = val(f, "title");
      const day = val(f, "day");
      const start = val(f, "start_time") || null;
      const end = val(f, "end_time") || null;
      const repeat = val(f, "repeat");
      const until = val(f, "repeat_until") || null;
      if (!title || !validIsoDate(day)) throw Error("Diga o que é e escolha o dia.");
      if (end && !start) throw Error("Informe também o horário de início.");
      if (start && end && end <= start) throw Error("O fim precisa ser depois do início.");
      if (until && (repeat === "none" || until < day)) throw Error("“Repetir até” precisa de uma repetição e de uma data igual ou depois do dia.");
      const visibility = val(f, "visibility");
      await api.saveOwn("events", {
        ...(id ? { id } : {}),
        title, day, start_time: start, end_time: end, place: val(f, "place"), visibility,
        people: visibility === "home" ? new FormData(f).getAll("people").map(String) : [],
        repeat, repeat_until: until, remind_minutes: val(f, "remind") === "" ? null : Number(val(f, "remind")),
        notes: val(f, "notes").slice(0, 500),
      });
      await finishTriage();
      agenda.date = day;
      submitNotice = id ? "Compromisso salvo." : visibility === "home" ? "Compromisso criado para a casa." : "Compromisso criado. Só você vê.";
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "note-form") {
      await api.saveOwn("inbox", { text: val(f, "text").slice(0, 280), done_at: null });
      submitNotice = "Anotado. Organize depois, com calma.";
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "wish-form") {
      const link = val(f, "link");
      if (link && !/^https?:\/\//.test(link)) throw Error("O link precisa começar com http:// ou https://.");
      const days = Number(val(f, "wait")) || 2;
      await api.saveOwn("wishes", {
        name: val(f, "name").slice(0, 120), price_cents: val(f, "price") ? cash(f, "price", true) : 0, link,
        wait_until: addDays(today(), days), decision: null, decided_at: null, shared: new FormData(f).has("shared"),
      });
      await finishTriage();
      submitNotice = `Desejo guardado. Em ${days} dia(s) o app pergunta se você ainda quer.`;
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "purchase-form") {
      const ids = new FormData(f).getAll("items").map(String);
      if (!ids.length) throw Error("Marque os produtos que estão no carrinho.");
      const lines = ids.map((id) => {
        const item = api.data!.shopping.find((s) => s.id === id);
        const quantity = Number(val(f, `qty-${id}`));
        const price = val(f, `price-${id}`) ? parseMoney(val(f, `price-${id}`)) : 0;
        if (!item || !(quantity > 0) || price === null)
          throw Error(`Confira quantidade e preço de ${item?.name || "um item"}.`);
        return { id, quantity, unit_cents: price };
      });
      const byCard = val(f, "pay") === "card";
      const parts = Number(val(f, "parts") || "1");
      if (byCard && (!val(f, "card_id") || !Number.isInteger(parts) || parts < 1 || parts > 48))
        throw Error("Escolha o cartão e o número de parcelas (1 a 48).");
      await api.purchaseItems(lines, cash(f, "total"), val(f, "date"), byCard ? null : val(f, "account_id") || null,
        byCard ? { id: val(f, "card_id"), parts } : null);
      cart.clear();
      Object.assign(cartMeta, { total: "", date: "", account: "", pay: "cash", card: "", parts: "1" });
      submitNotice = byCard ? `Compra concluída no cartão${parts > 1 ? ` em ${parts}x` : ""}. Veja em Cartões → Parcelamentos.` : "Compra concluída.";
      return;
    }
    if (f.getAttribute("id") === "move-form") {
      const quantity = Number(val(f, "quantity"));
      await api.pantryMove(id, moveKind, quantity);
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "member-form") {
      await api.member({
        email: val(f, "email"),
        password: val(f, "password"),
        name: val(f, "name"),
      });
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "document-form") {
      const file = new FormData(f).get("file") as File;
      if (val(f, "entry_id") && val(f, "card_id"))
        throw Error("Vincule a um lançamento ou a um cartão.");
      await api.upload(file, {
        entry_id: val(f, "entry_id") || null,
        card_id: val(f, "card_id") || null,
      });
      modal = "";
      return;
    }
    if (f.getAttribute("id") === "import-form") {
      const file = new FormData(f).get("file") as File;
      if (file.size > 10485760) throw Error("Importe arquivos de até 10 MB.");
      const text = await file.text();
      let rows: Partial<Entry>[] = [];
      if (file.name.endsWith(".json")) {
        const data = JSON.parse(text);
        if (data.version === 1) {
          rows = parseBackup(data).entries.map((e) => ({
            description: e.description,
            amount_cents: e.amountCents,
            date: e.date,
            kind: e.kind,
            category: e.category,
            area: e.scope === "family" ? "household" : "personal",
          }));
        } else if (
          data.format === "financeiro360-family" &&
          data.version === 2 &&
          Array.isArray(data.data?.entries)
        ) {
          rows = data.data.entries.map((e: Entry) => ({
            description: e.description,
            amount_cents: e.amount_cents,
            date: e.date,
            kind: e.kind,
            category: e.category,
            area: e.area,
          }));
        } else throw Error("Backup não reconhecido.");
      } else {
        const lines = text
          .replace(/^\uFEFF/, "")
          .trim()
          .split(/\r?\n/);
        rows = lines
          .slice(1)
          .filter(Boolean)
          .map((line) => {
            const [description, amount, date, category, scope] = line
              .split(";")
              .map((x) => x.trim());
            const cents = parseMoney(amount);
            if (!cents || !validIsoDate(date))
              throw Error(
                "CSV contém data ou valor inválido. Use descrição;valor;data;categoria;área.",
              );
            return {
              description,
              amount_cents: cents,
              date,
              kind: "expense",
              category: category || "Outros",
              area:
                scope === "personal" || scope === "business"
                  ? scope
                  : "household",
            };
          });
      }
      if (rows.length > 500)
        throw Error("Importe até 500 registros de cada vez.");
      const seen = new Set(
        api.data!.entries.map(
          (e) => `${e.date}|${e.description}|${e.amount_cents}`,
        ),
      );
      for (const e of rows) {
        if (
          !e.description ||
          e.description.length > 160 ||
          !["income", "expense"].includes(e.kind!) ||
          !e.amount_cents ||
          !validIsoDate(e.date!)
        )
          throw Error(
            "Confira os campos do relatório. Este importador aceita receitas e despesas; concilie transferências e pagamentos nos módulos próprios.",
          );
        const key = `${e.date}|${e.description}|${e.amount_cents}`;
        if (seen.has(key))
          throw Error("Possível lançamento duplicado: " + e.description);
        seen.add(key);
      }
      importRows = rows.map((e) => ({
        ...e,
        payment: "cash",
        status: "pending_review",
        account_id: null,
        card_id: null,
        target_account_id: null,
        debt_id: null,
        installments: 1,
        due_date: null,
        invoice_month: null,
        source_ref: file.name.slice(0, 160),
      }));
      modal = "import-preview";
      return;
    }
    if (f.getAttribute("id") === "quick-expense-form") {
      const payment: Entry["payment"] = val(f, "payment") === "card" ? "card" : "cash";
      const cardId = payment === "card" ? val(f, "card_id") : "";
      if (payment === "card" && (!cardId || !api.data!.cards.some((card) => card.id === cardId && own(card) && !card.archived_at)))
        throw Error("Escolha um cartão válido para esta compra.");
      await api.save("entries", {
        description: val(f, "description"), payee: null, amount_cents: cash(f, "amount"),
        date: val(f, "date"), due_date: null, kind: "expense", category: val(f, "category"),
        subcategory: val(f, "subcategory") || null, area: val(f, "area"), shared: val(f, "area") !== "personal", status: "paid",
        payment, card_id: cardId || null, account_id: null, target_account_id: null, debt_id: null,
        debt_installment_number: null, installments: 1, first_invoice_month: null,
        invoice_month: null, source_ref: null,
      });
      month = val(f, "date").slice(0, 7);
    } else if (f.getAttribute("id") === "category-preset-form") {
      const category = val(f, "category").trim();
      const subcategory = val(f, "subcategory").trim() || null;
      if (!category || category.length > 80 || (subcategory && subcategory.length > 80))
        throw Error("Confira o nome da categoria e da subcategoria.");
      if (api.data!.category_presets.some((item) => item.id !== id && item.owner_id === api.userId &&
        item.category.trim().toLocaleLowerCase() === category.toLocaleLowerCase() &&
        (item.subcategory?.trim().toLocaleLowerCase() || "") === (subcategory?.toLocaleLowerCase() || "")))
        throw Error("Esta opção já está salva. Escolha outro nome ou edite a existente.");
      await api.save("category_presets", { ...(id ? { id } : {}), category, subcategory,
        ...(admin() ? { shared: f.querySelector<HTMLInputElement>('[name="shared"]')?.checked || false } : {}) });
    } else if (f.getAttribute("id") === "alignment-form") {
      await api.alignInvoice(editId, val(f, "invoice_month"), val(f, "cutoff_on"), cash(f, "total", true), val(f, "note"));
      month = val(f, "invoice_month");
    } else if (f.getAttribute("id") === "merge-card-form") {
      if (!val(f, "target")) throw Error("Escolha o cartão que permanecerá.");
      await api.mergeCards(editId, val(f, "target"));
    } else if (f.getAttribute("id") === "entry-form") {
      const task = val(f, "kind"),
        kind = (task === "payable" ? "expense" : task) as Entry["kind"],
        payment: Entry["payment"] =
          task === "expense" && val(f, "payment") === "card"
            ? "card"
            : "cash";
      const existing = id ? api.data!.entries.find((e) => e.id === id) : null;
      await api.save("entries", {
        ...(existing || {}),
        ...(id ? { id } : {}),
        description: val(f, "description"),
        payee: val(f, "payee") || null,
        amount_cents: (() => {
          const amount = cash(f, "amount");
          const count = payment === "card" ? Number(val(f, "installments")) : 1;
          const total =
            payment === "card" && val(f, "installment_basis") === "each"
              ? amount * count
              : amount;
          if (!Number.isSafeInteger(total))
            throw Error("O valor total ultrapassa o limite permitido.");
          return total;
        })(),
        date: val(f, "date"),
        due_date: val(f, "due_date") || null,
        kind,
        category: val(f, "category"),
        subcategory: val(f, "subcategory") || null,
        area: val(f, "area"),
        shared: admin() ? (existing?.shared ?? false) : val(f, "area") !== "personal" ? true : (existing?.area === "personal" ? existing.shared : false),
        status: task === "payable" ? "pending" : val(f, "status"),
        payment,
        card_id:
          payment === "card" || kind === "card_payment"
            ? val(f, "card_id") || null
            : null,
        account_id: payment === "cash" ? val(f, "account_id") || null : null,
        target_account_id:
          kind === "transfer" ? val(f, "target_account_id") || null : null,
        debt_id: kind === "debt_payment" ? val(f, "debt_id") || null : null,
        debt_installment_number: kind === "debt_payment" && val(f, "debt_installment_number")
          ? Number(val(f, "debt_installment_number")) : null,
        installments: payment === "card" ? Number(val(f, "installments")) : 1,
        first_invoice_month: payment === "card" ? val(f, "first_invoice_month") || null : null,
        invoice_month:
          kind === "card_payment" ? val(f, "invoice_month") || null : null,
        source_ref: val(f, "source_ref") || null,
      });
      month = val(f, "date").slice(0, 7);
      await finishTriage();
    } else if (f.getAttribute("id") === "recurring-form")
      await api.save("recurring", {
        name: val(f, "name"),
        amount_cents: cash(f, "amount"),
        day: Number(val(f, "day")),
        start_month: val(f, "start_month"),
        category: val(f, "category"),
        area: val(f, "area"),
      });
    else if (f.getAttribute("id") === "card-form") {
      if (!id && api.data!.cards.some((item) => !item.archived_at && item.owner_id === api.userId &&
        item.name.trim().toLocaleLowerCase() === val(f, "name").trim().toLocaleLowerCase() &&
        item.closing_day === Number(val(f, "closing_day")) && item.due_day === Number(val(f, "due_day"))))
        throw Error("Este cartão já parece cadastrado. Abra o cartão existente antes de criar outro.");
      await api.save("cards", {
        ...(id ? { id } : {}),
        name: val(f, "name"),
        limit_cents: val(f, "limit") ? cash(f, "limit", true) : null,
        closing_day: Number(val(f, "closing_day")),
        due_day: Number(val(f, "due_day")),
      });
    }
    else if (f.getAttribute("id") === "account-form") {
      const raw = val(f, "opening");
      const negative = raw.startsWith("-");
      const cents = raw ? parseMoney(negative ? raw.slice(1) : raw) : null;
      if (raw && cents === null) throw Error("Saldo inicial inválido.");
      await api.save("accounts", {
        ...(id ? { id } : {}),
        name: val(f, "name"),
        area: val(f, "area"),
        opening_cents: cents === null ? null : negative ? -cents : cents,
        balance_date: raw ? val(f, "date") : null,
      });
    } else if (f.getAttribute("id") === "debt-form") {
      const count = val(f, "installment_count") ? Number(val(f, "installment_count")) : null;
      const installment = val(f, "installment") ? cash(f, "installment", true) : null;
      const firstDue = val(f, "first_due_date") || null;
      if ([count, installment, firstDue].filter((item) => item !== null).length !== 0 &&
        [count, installment, firstDue].filter((item) => item !== null).length !== 3)
        throw Error("Para planejar parcelas, informe quantidade, valor e primeiro vencimento.");
      await api.save("debts", {
        ...(id ? { id } : {}),
        name: val(f, "name"),
        creditor: val(f, "creditor"),
        balance_cents: val(f, "balance") ? cash(f, "balance", true) : null,
        due_date: val(f, "due_date") || null,
        area: val(f, "area"),
        installment_count: count,
        installment_cents: installment,
        first_due_date: firstDue,
      });
    }
    else if (f.getAttribute("id") === "pantry-form") {
      const lasts = val(f, "lasts");
      const dailyUse = lasts === "advanced" ? Number(val(f, "daily_use")) : dailyUseFromDuration(Number(lasts));
      const quantity = Number(val(f, "quantity"));
      if (!(quantity >= 0) || !(Number(val(f, "minimum")) >= 0) || !(dailyUse >= 0))
        throw Error("Confira quantidade, aviso mínimo e consumo.");
      const fields = {
        name: val(f, "name"),
        unit: val(f, "unit"),
        minimum: Number(val(f, "minimum")),
        daily_use: dailyUse,
        price_cents: val(f, "price") ? cash(f, "price", true) : 0,
        expires_on: val(f, "expires_on") || null,
        ...(val(f, "location") ? { location: val(f, "location") } : {}),
      };
      const existing = id ? api.data!.pantry.find((p) => p.id === id) : null;
      if (existing) {
        // Conferir: a contagem nova passa pelo histórico; os demais campos são atualizados à parte.
        const counted = Math.abs(forecast(existing).stock - quantity) > 0.005 || existing.daily_use !== dailyUse;
        await api.save("pantry", { id, ...fields });
        if (counted) await api.pantryMove(id, "counted", quantity);
      } else await api.save("pantry", { ...fields, quantity, updated_at: new Date().toISOString() });
    } else if (f.getAttribute("id") === "task-form") {
      const title = val(f, "title");
      if (!title) throw Error("Diga o que precisa ser feito.");
      if (val(f, "due_date") && !validIsoDate(val(f, "due_date"))) throw Error("Confira a data da tarefa.");
      await api.save("tasks", {
        ...(id ? { id } : {}),
        title,
        kind: val(f, "kind"),
        assignee_id: val(f, "assignee_id") || null,
        due_date: val(f, "due_date") || null,
        repeat: val(f, "repeat"),
        notes: val(f, "notes"),
        steps: parseSteps(String(new FormData(f).get("steps") || ""), id ? api.data!.tasks.find((t) => t.id === id)?.steps : []),
      });
      await finishTriage();
    }
    else if (f.getAttribute("id") === "reminder-form") {
      const kind = val(f, "kind") as Reminder["kind"];
      const dueOn = kind === "post_it" ? null : val(f, "due_on");
      await api.save("reminders", { ...(id ? { id } : {}), kind, title: val(f, "title"), note: val(f, "note"), color: val(f, "color") || "yellow", due_on: dueOn, recurrence: kind === "post_it" ? "once" : val(f, "recurrence"), completed: false });
      if (page === "calendar" && dueOn) {
        calendarSelectedDate = dueOn;
        month = dueOn.slice(0, 7);
      }
      newReminderKind = "reminder";
    }
    else if (f.getAttribute("id") === "shopping-form")
      await api.save("shopping", {
        name: val(f, "name"),
        pantry_id: null,
        quantity: Number(val(f, "quantity")),
        unit: val(f, "unit"),
        estimate_cents: val(f, "price") ? cash(f, "price", true) : 0,
        bought: false,
      });
    else if (f.getAttribute("id") === "goal-form")
      await api.save("goals", {
        ...(id ? { id } : {}),
        name: val(f, "name"),
        target_cents: cash(f, "target"),
        saved_cents: cash(f, "saved", true),
        due_date: val(f, "due_date") || null,
      });
    modal = "";
  }, () => submitNotice);
});
render();
void run(async () => {
  await api.restore();
}).then(() => {
  launchAction();
  checkReminders();
});
setInterval(checkReminders, 30000);
// Temporizador: atualiza só o número e o anel a cada segundo, sem redesenhar a tela.
setInterval(() => {
  if (!timer) return;
  const left = timerLeft(timer.endsAt, Date.now());
  root.querySelectorAll("#timer-left, #timer-chip-left").forEach((el) => (el.textContent = timerText(left)));
  const ring = root.querySelector<SVGCircleElement>(".timer-ring .left");
  if (ring) ring.setAttribute("stroke-dashoffset", String(Number(ring.dataset.circ) * (1 - left / timer.total)));
  if (left > 0) return;
  const label = timer.label;
  timer = null;
  store("session", TIMER_KEY, null);
  alarm();
  notifyDevice("Tempo!", `“${label}” terminou.`, "timer");
  notice = `Tempo! “${label}” terminou. Faça uma pausa curta antes do próximo passo.`;
  if (!modal) render();
}, 1000);
document.addEventListener("keydown", (event) => {
  if (!api.data || modal || busy || event.ctrlKey || event.metaKey || event.altKey) return;
  if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
  if (event.key === "n" && api.allowed("entries")) {
    event.preventDefault();
    show("entry");
  } else if (event.key === "a") {
    event.preventDefault();
    show("note");
  } else if (event.key === "/") {
    const target = root.querySelector<HTMLInputElement>("#quick-text, [name=search], [name=pantry_search], [name=catalog_search]");
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }
});

if ("serviceWorker" in navigator && import.meta.env.PROD)
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
setInterval(() => {
  // Não recarrega enquanto alguém digita no mercado ou em uma busca: a tela seria redesenhada.
  if (api.data && !api.demo && !busy && !modal && !root.querySelector("input:focus, select:focus"))
    void run(async () => {
      try {
        await api.load();
      } catch {
        await api.logout();
        throw Error("Sua sessão ou seu acesso expirou. Entre novamente.");
      }
    });
}, 60000);

root.addEventListener(
  "cancel",
  (event) => {
    if ((event.target as Element).tagName === "DIALOG") {
      event.preventDefault();
      modal = "";
      render();
    }
  },
  true,
);
