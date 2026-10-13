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
  parseMoney,
  permissions,
  validIsoDate,
  type Data,
  type Entry,
  type Debt,
  type Permission,
  type Member,
  type Reminder,
} from "./model.ts";
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
  analysisPeriod: "monthly" | "yearly" = "monthly",
  editId = "",
  modal = "",
  importRows: Partial<Entry>[] = [];
const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const brl = (cents: number) => `<span class="private-amount">${formatBrl(cents)}</span>`;
const icon = (name: string) => {
  const paths: Record<string, string> = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    entries: "M7 3h10l3 3v15H4V3z M8 10h8 M8 14h8 M8 18h5",
    cards: "M3 5h18v14H3z M3 9h18 M7 15h4",
    accounts: "M3 9l9-6 9 6 M4 21h16 M6 10v8 M12 10v8 M18 10v8",
    pantry: "M4 4h16v16H4z M4 12h16 M12 4v16",
    shopping: "M3 3h2l3 13h11l2-9H7 M9 21h1 M18 21h1",
    goals: "M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l9-9 M17 3h4v4",
    documents: "M7 3h9l4 4v14H4V3z M9 12l3-3 3 3 M12 9v9",
    reminders: "M12 8v4l3 2 M12 3a9 9 0 1 0 9 9 M12 3v2 M21 12h-2",
    calendar: "M7 3v3 M17 3v3 M4 9h16 M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z M8 13h2 M14 13h2 M8 17h2",
    family:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
    settings:
      "M12 8a4 4 0 1 0 0 8 M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    plus: "M12 5v14 M5 12h14",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    logout: "M9 3H3v18h6 M10 12h11 M16 7l5 5-5 5",
    check: "M4 12l5 5L20 6",
    debt: "M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8 M8 12h6",
    analysis: "M4 20V11 M10 20V5 M16 20v-8 M22 20v-13 M2 20h20",
    categories: "M4 5h16 M4 12h11 M4 19h16 M18 10l3 3-3 3",
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ? `<path d="${paths[name]}"/>` : '<circle cx="12" cy="12" r="9"/>'}</svg>`;
};
const nav = [
  ["overview", "Início"],
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
];
const primaryNav = new Set(["overview", "entries", "analysis", "shopping", "pantry", "settings"]);
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
const button = (action: string, label: string, kind = "primary", extra = "") =>
  `<button class="${kind}" type="button" data-action="${action}" ${extra}>${label}</button>`;
const opt = (value: unknown, label: unknown, current?: unknown) =>
  `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
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
const categoryOptions = (current: string) => Array.from(new Set([
  ...commonCategories,
  ...(api.data?.category_presets || []).map((item) => item.category),
  ...(api.data?.entries || []).map((entry) => entry.category),
  ...(api.data?.recurring || []).map((entry) => entry.category),
])).filter(Boolean).map((category) => opt(category, category, current)).join("");
const subcategoriesFor = (category: string) => Array.from(new Set([
  ...(api.data?.category_presets || []).filter((item) => item.category === category).map((item) => item.subcategory || ""),
  ...(subcategorySuggestions[category] || []),
  ...(api.data?.entries || []).filter((entry) => entry.category === category).map((entry) => entry.subcategory || ""),
])).filter(Boolean);
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
const field = (_name: string, label: string, input: string, wide = false) =>
  `<label class="${wide ? "wide" : ""}"><span>${label}</span>${input}</label>`;
const input = (name: string, type = "text", value: unknown = "", extra = "") =>
  `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
const moneyInput = (name: string, value: unknown = "") =>
  input(name, "text", value, 'inputmode="decimal" placeholder="0,00"');
const empty = (text: string, action?: string) =>
  `<div class="empty"><span class="empty-icon">${icon(page)}</span><h3>${text}</h3><p>Um passo de cada vez. Comece com o que você já sabe.</p>${action ? button(action, "Adicionar agora") : ""}</div>`;
const formEnd = (label = "Salvar") =>
  `<div class="form-actions wide"><button class="secondary" type="button" data-action="close">Cancelar</button><button class="primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Salvando…" : label}</button></div>`;
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
function summary() {
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
  <section class="quick-create"><div><span class="eyebrow">REGISTRE EM SEGUNDOS</span><h3>O que aconteceu agora?</h3></div><div class="quick-create-actions">${api.allowed("entries") ? (api.preferences.quick_actions.includes("expense") ? button("add-entry", `${icon("plus")} Gasto`, "primary") : "") + button("add-income", `${icon("accounts")} Receita`, "secondary") + button("add-payable", `${icon("calendar")} Conta a pagar`, "secondary") + button("transfer", `${icon("arrow")} Transferência`, "secondary") : ""}</div></section>${quickPanel()}
  <div class="overview-status"><article><span>A pagar neste mês</span><strong>${brl(picture.due)}</strong><small>Contas pendentes e faturas por vencimento</small></article><article><span>Saldo conhecido em contas</span><strong>${accountBalances.length ? brl(knownBalance) : "Ainda não informado"}</strong><small>${accountBalances.length} conta(s) com saldo visível</small></article><article><span>Para conferir</span><strong>${pendingReviews}</strong><small>Lançamentos fora dos totais até confirmar</small></article></div>
  ${data.home.budget_cents ? `<section class="budget-strip"><div><span>Orçamento do lar</span><strong>${brl(monthly.home)} de ${brl(data.home.budget_cents)}</strong></div><div class="bar"><b style="width:${householdPercent}%"></b></div><small>${householdPercent}% usado pelos gastos visíveis da casa</small></section>` : ""}
  ${urgentReminders.length ? `<section class="overview-alert"><span>${icon("reminders")}</span><div><strong>${urgentReminders.length} aviso(s) próximos</strong><p>${urgentReminders.slice(0, 2).map((item) => `${esc(item.title)} · ${reminderTiming(item.due_on!)}`).join("<br>")}</p></div>${button("nav", "Abrir calendário", "text-button", 'data-page="calendar"')}</section>` : ""}
  <div class="overview-chart">${flowChart(financialSeries(data, month, "monthly").slice(-6), "Entradas e saídas · 6 meses")}${button("nav", "Explorar meses e anos", "text-button", 'data-page="analysis"')}</div>
  <div class="dashboard-grid"><section class="panel" data-widget="categories"><div class="panel-title"><div><span class="eyebrow">ONDE FOI GASTO</span><h3>Principais categorias</h3></div>${button("nav", "Ver detalhes", "text-button", 'data-page="analysis"')}</div>${groups.length ? `<div class="category-chart">${groups.slice(0, 5).map((group, index) => `<div class="category-row"><span><i style="background:var(--chart-${index % 4})"></i>${esc(group.name)}</span><strong>${brl(group.total)}</strong><div class="bar"><b style="width:${monthly.spend ? Math.round(group.total / monthly.spend * 100) : 0}%;background:var(--chart-${index % 4})"></b></div></div>`).join("")}</div>` : '<p class="fine">Os gastos classificados aparecerão aqui.</p>'}</section><section class="panel intelligence" data-widget="insights"><div class="panel-title"><div><span class="eyebrow">PRECISA DE ATENÇÃO</span><h3>Próximos passos</h3></div></div>${monthly.overdue.length ? `<article class="insight warning"><span>${icon("calendar")}</span><div><strong>${monthly.overdue.length} conta(s) vencida(s)</strong><p>Confira ${brl(monthly.overdue.reduce((sum, item) => sum + item.amount_cents, 0))} em pendências.</p></div></article>` : `<article class="insight"><span>${icon("check")}</span><div><strong>Sem vencimentos atrasados</strong><p>Os registros visíveis estão em dia.</p></div></article>`}<article class="insight"><span>${icon("pantry")}</span><div><strong>${lowPantry.length ? `${lowPantry.length} produto(s) para repor` : "Despensa em ordem"}</strong><p>${lowPantry.length ? lowPantry.slice(0, 3).map((item) => esc(item.name)).join(", ") : "O estoque cadastrado não pede reposição agora."}</p></div></article></section><section class="panel wide-panel" data-widget="recent"><div class="panel-title"><div><span class="eyebrow">ÚLTIMOS REGISTROS</span><h3>Movimentações recentes</h3></div>${button("nav", "Ver todos", "text-button", 'data-page="entries"')}</div>${entryList([...data.entries].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5))}</section></div><p class="fine overview-footnote">Recebido e pago consideram apenas operações confirmadas. Transferências entre contas não entram como receita ou despesa. Gastos incluem o valor integral da compra na data do lançamento.</p>`;
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
    const entryActions = `${share("entries", entry)}${invoiceMonthLabel ? button("entry-invoice", "Ver fatura", "text-button", `data-id="${entry.id}"`) : ""}${canManage ? button("edit-entry", "Editar lançamento", "text-button", `data-id="${entry.id}"`) : ""}${entry.status === "pending_review" && canManage ? button("confirm-entry", "Confirmar lançamento", "text-button", `data-id="${entry.id}"`) : ""}${canManage ? deleteButton("entries", entry.id) : ""}`;
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
  const names = Array.from(new Set([...commonCategories, ...presets.map((item) => item.category),
    ...api.data!.entries.map((item) => item.category)])).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return `<section class="page-intro"><div><h2>Classifique sem esforço.</h2><p>Escolha sugestões prontas ou crie opções para usar nos próximos lançamentos.</p></div>${api.allowed("entries") ? button("add-category-preset", icon("plus") + " Criar opção") : ""}</section><div class="category-library">${names.map((name) => {
    const custom = presets.filter((item) => item.category === name);
    const suggestions = Array.from(new Set([...(subcategorySuggestions[name] || []),
      ...custom.map((item) => item.subcategory || ""),
      ...api.data!.entries.filter((item) => item.category === name).map((item) => item.subcategory || "")])).filter(Boolean);
    return `<section class="panel category-library-card"><div class="panel-title"><h3>${esc(name)}</h3><span class="badge">${suggestions.length} tipo(s)</span></div><div class="category-tags">${suggestions.length ? suggestions.map((item) => `<span>${esc(item)}</span>`).join("") : '<span>Sem subcategoria ainda</span>'}</div>${custom.length ? `<details><summary>Minhas opções salvas (${custom.length})</summary>${custom.map((item) => `<div class="category-custom-row"><span>${esc(item.subcategory || "Categoria personalizada")}${item.shared ? " · Família" : ""}</span>${item.owner_id === api.userId && api.allowed("entries") ? button("edit-category-preset", "Editar", "text-button", `data-id="${item.id}"`) + deleteButton("category_presets", item.id) : ""}</div>`).join("")}</details>` : ""}</section>`;
  }).join("")}</div><p class="fine section-gap">Crie aqui as opções que deseja encontrar facilmente nos próximos lançamentos. Editar uma opção não altera lançamentos antigos.</p>`;
}
function entries() {
  const data = api.data!;
  const categoryNames = Array.from(new Set(data.entries.map((item) => item.category))).sort((a, b) => a.localeCompare(b, "pt-BR"));
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
function cards() {
  const d = api.data!;
  const duplicates = d.cards.filter((card) => !card.archived_at && d.cards.some((other) => other.id !== card.id && !other.archived_at && other.owner_id === card.owner_id && other.name.trim().toLocaleLowerCase() === card.name.trim().toLocaleLowerCase() && other.closing_day === card.closing_day && other.due_day === card.due_day));
  return `<section class="page-intro"><div><h2>Cartões sem surpresas.</h2><p>Parcelas previstas e pagamentos informados em um só lugar.</p></div>${api.allowed("cards") ? button("add-card", icon("plus") + " Adicionar cartão") : ""}</section>${duplicates.length ? `<div class="hint-banner">${icon("cards")}<div><strong>Possíveis cartões duplicados</strong><p>${[...new Set(duplicates.map((item) => item.name))].map(esc).join(", ")}. Abra o cartão que será removido e toque em “Unir duplicado”. Compras e anexos serão preservados.</p></div></div>` : ""}<div class="card-grid">${
    d.cards.filter((c) => !c.archived_at)
      .map((c, i) => {
        const f = invoice(d, c, month),
          openMonth = invoiceMonth(today(), c.closing_day),
          lines = invoiceInstallments(d.entries, c, month),
          categoryTotals = Array.from(lines.reduce((totals, line) =>
            totals.set(line.entry.category, (totals.get(line.entry.category) || 0) + line.amount_cents),
          new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);
        return `<section class="panel card-panel"><div class="credit-card cc-${i % 3}"><span>${esc(c.name)}</span>${icon("cards")}<strong>•••• &nbsp; •••• &nbsp; ••••</strong><small>${esc(names(c.owner_id))}</small></div><p class="invoice-open-hint">Compras feitas agora entram na fatura de <strong>${openMonth.split("-").reverse().join("/")}</strong> ${month !== openMonth ? button("open-invoice", "Abrir fatura em aberto", "text-button", `data-month="${openMonth}"`) : ""}</p><div class="invoice-stats"><div><span>Fatura prevista · ${month.split("-").reverse().join("/")}</span><strong>${brl(f.total)}</strong></div><div><span>A pagar</span><strong>${brl(f.remaining)}</strong></div></div>${f.alignment ? `<p class="fine">Alinhada em ${f.alignment.cutoff_on.split("-").reverse().join("/")}: ${brl(f.alignment.total_cents)} + ${brl(f.added)} em compras posteriores. ${f.untracked > 0 ? `${brl(f.untracked)} sem compra detalhada.` : f.untracked < 0 ? `Confira ${brl(-f.untracked)} em compras anteriores acima do valor informado.` : "Compras anteriores conferidas."}${f.overpaid ? ` Crédito: ${brl(f.overpaid)}.` : ""}</p>` : ""}<p class="fine">Fecha dia ${c.closing_day} · vence ${dueDate(
          month,
          {
            id: c.id,
            name: c.name,
            owner: "wife",
            limitCents: c.limit_cents || 0,
            closingDay: c.closing_day,
            dueDay: c.due_day,
          },
        )
          .split("-")
          .reverse()
          .join(
            "/",
        )} · limite ${c.limit_cents === null ? "não informado" : brl(c.limit_cents)}${c.created_at ? ` · cadastrado em ${c.created_at.slice(0, 10).split("-").reverse().join("/")}` : ""}</p><p class="fine">Fatura selecionada: ${month.split("-").reverse().join("/")} · compras até o fechamento entram nela; depois do fechamento, passam para a próxima competência.</p><div class="button-row">${share("cards", c)}${own(c) && api.allowed("cards") ? button("align-invoice", "Alinhar fatura", "secondary", `data-id="${c.id}"`) : ""}${own(c) && api.allowed("payments") ? button("card-payment", "Registrar pagamento", "secondary", `data-id="${c.id}"`) : ""}${own(c) && api.allowed("cards") ? button("edit-card", "Editar cartão", "text-button", `data-id="${c.id}"`) + button("merge-card", "Unir duplicado", "text-button", `data-id="${c.id}"`) + button("archive-card", "Arquivar", "text-button", `data-id="${c.id}"`) + (!d.entries.some((item) => item.card_id === c.id) && !d.documents.some((item) => item.card_id === c.id) && !d.invoice_alignments.some((item) => item.card_id === c.id) ? deleteButton("cards", c.id) : "") : ""}</div><details><summary>Ver ${lines.length} compra(s) e categorias</summary>${categoryTotals.length ? `<div class="card-category-breakdown"><h4>Gastos por categoria</h4><div class="category-chart">${categoryTotals.map(([category, amount], index) => `<div class="category-row"><span><i style="background:var(--chart-${index % 4})"></i>${esc(category)}</span><strong>${brl(amount)}</strong><div class="bar"><b style="width:${f.total ? Math.round((amount / f.total) * 100) : 0}%;background:var(--chart-${index % 4})"></b></div></div>`).join("")}</div></div>` : '<p class="fine">Ainda não há compras nesta fatura.</p>'}${lines.length ? lines.map((line) => { const ex = f.alignment && d.invoice_alignment_exceptions.find((item) => item.alignment_id === f.alignment!.id && item.entry_id === line.entry.id); const after = ex?.count_after ?? (f.alignment ? line.entry.date > f.alignment.cutoff_on : false); return `<p class="detail-line">${esc(line.entry.description)} <strong>Parcela ${line.number}/${line.total} · ${brl(line.amount_cents)}</strong><small>${esc(line.entry.category)} · compra em ${line.entry.date.split("-").reverse().join("/")}</small>${f.alignment && own(c) ? button("toggle-alignment-entry", after ? "Já estava no valor alinhado" : "Somar ao valor alinhado", "text-button", `data-id="${line.entry.id}" data-alignment="${f.alignment.id}" data-after="${after}"`) : ""}</p>`; }).join("") : ""}</details></section>`;
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
function pantry() {
  const d = api.data!;
  return `<section class="page-intro"><div><h2>Uma despensa bem cuidada.</h2><p>Saiba o que tem, o que acaba e o que precisa comprar.</p></div>${api.allowed("pantry") ? button("add-pantry", icon("plus") + " Cadastrar produto") : ""}</section><div class="hint-banner">${icon("pantry")}<div><strong>Previsões que respeitam sua rotina</strong><p>A quantidade estimada usa o consumo diário cadastrado. Faça uma contagem e ajuste sempre que necessário.</p></div></div><div class="pantry-grid">${
    d.pantry
      .map((p) => {
        const f = forecast(p),
          low = f.stock <= p.minimum;
        return `<section class="panel pantry-card"><div class="panel-title"><span class="pantry-emoji">${/leite/i.test(p.name) ? "🥛" : /café/i.test(p.name) ? "☕" : /arroz/i.test(p.name) ? "🍚" : "📦"}</span><span class="badge ${low ? "warning-badge" : ""}">${low ? "Repor em breve" : "Em estoque"}</span></div><h3>${esc(p.name)}</h3><strong class="large-number">${f.stock.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}<small> ${esc(p.unit)}</small></strong><p class="fine">${f.days === null ? "Consumo diário ainda não informado" : `Duração estimada: ${f.days} dia(s)`}${p.expires_on ? " · validade " + p.expires_on : ""}</p><div class="bar"><b style="width:${Math.min(100, (f.stock / Math.max(p.minimum * 2, 1)) * 100)}%"></b></div><p class="fine">Mínimo ${p.minimum} ${esc(p.unit)} · ${brl(p.price_cents)} por unidade</p><div class="button-row">${api.allowed("pantry") ? button("edit-pantry", "Ajustar estoque", "secondary", `data-id="${p.id}"`) : ""}${api.allowed("shopping") ? button("shop-item", "Comprar", "text-button", `data-id="${p.id}"`) : ""}${api.allowed("pantry") ? deleteButton("pantry", p.id) : ""}</div></section>`;
      })
      .join("") || empty("Comece pelo que está na sua casa", "add-pantry")
  }</div>`;
}
function shopping() {
  const d = api.data!,
    items = d.shopping.filter((s) => !s.bought),
    total = items.reduce((s, x) => s + x.estimate_cents * x.quantity, 0);
  return `<section class="page-intro"><div><h2>Compras com propósito.</h2><p>Uma lista da casa para comprar melhor e desperdiçar menos.</p></div><div class="button-row">${api.allowed("shopping") ? button("generate-list", "✦ Sugerir para 14 dias") + button("add-shopping", "Adicionar item", "secondary") : ""}</div></section>${api.allowed("shopping") ? `<section class="panel quick-grocery-panel"><div class="panel-title"><div><h3>Adicionar item rápido</h3><p>Toque em um produto para colocar uma unidade na lista. Ajuste quantidade e preço depois.</p></div></div><div class="quick-grocery-list">${quickGroceries.map(([name]) => button("quick-shop", name, "secondary", `data-name="${esc(name)}"`)).join("")}</div></section>` : ""}<div class="shopping-layout"><section class="panel"><div class="panel-title"><h3>Próxima ida ao mercado</h3><span class="badge">${items.length} item(s)</span></div>${items.length ? `<form id="purchase-form">${items.map((s) => `<div class="shopping-row"><label class="shopping-item"><input type="checkbox" name="items" value="${s.id}" checked><span><strong>${esc(s.name)}</strong><small>${s.quantity} ${esc(s.unit)} · ${brl(s.estimate_cents)} / unidade</small></span><strong>${brl(Math.round(s.estimate_cents * s.quantity))}</strong></label>${api.allowed("shopping") ? button("edit-shopping", "Editar", "text-button", `data-id="${s.id}"`) : ""}</div>`).join("")}<div class="form-grid section-gap">${field("total", "Total real pago (R$)", moneyInput("total", (total / 100).toFixed(2).replace(".", ",")))}${field("date", "Data da compra", input("date", "date", today(), "required"))}${field("account_id", "Conta utilizada", `<select name="account_id">${accountOptions()}</select>`, true)}</div>${api.allowed("shopping") && api.allowed("entries") && api.allowed("pantry") ? `<button class="primary full section-gap" type="submit">Concluir compra e atualizar estoque</button>` : '<p class="fine">Concluir compra exige permissões de compras, despensa e lançamentos.</p>'}</form>` : empty("Sua próxima lista começa aqui", "add-shopping")}</section><aside class="panel shopping-aside"><span class="eyebrow">PLANEJE ANTES DE SAIR</span><h3>Estimativa da compra</h3><strong class="large-number">${brl(Math.round(total))}</strong><p>O total real será registrado uma única vez como despesa do lar e os produtos serão adicionados ao estoque.</p><div class="insight"><span>✦</span><p>A sugestão completa o estoque para 14 dias de consumo ou o mínimo que você definiu.</p></div><p class="fine">Histórico: ${d.shopping.filter((s) => s.bought).length} item(s) comprado(s). Itens manuais sem produto vinculado não alteram a despensa.</p>${items.map((s) => (api.allowed("shopping") ? `<p class="detail-line">${esc(s.name)} ${deleteButton("shopping", s.id)}</p>` : "")).join("")}</aside></div>`;
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
  return `<section class="page-intro"><div><h2>Planos que ganham forma.</h2><p>Acompanhe sua reserva e os objetivos da família.</p></div>${api.allowed("entries") ? button("add-goal", "Nova meta") : ""}</section><div class="card-grid">${api.data!.goals.map((g) => `<section class="panel"><span class="record-icon">${icon("goals")}</span><h3>${esc(g.name)}</h3><strong class="large-number">${brl(g.saved_cents)}</strong><p>de ${brl(g.target_cents)}${g.due_date ? " · até " + g.due_date : ""}</p><div class="bar"><b style="width:${Math.min(100, (g.saved_cents / g.target_cents) * 100)}%"></b></div><p class="fine">${Math.round((g.saved_cents / g.target_cents) * 100)}% da meta · progresso informado manualmente</p><div class="button-row">${share("goals", g)}${own(g) && api.allowed("entries") ? button("edit-goal", "Atualizar progresso", "secondary", `data-id="${g.id}"`) + deleteButton("goals", g.id) : ""}</div></section>`).join("") || empty("Dê um nome ao seu próximo objetivo", "add-goal")}</div>`;
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
  return `<section class="panel appearance-settings"><h3>Aparência e atalhos</h3><p>Estas escolhas pertencem somente à sua conta.</p><form id="preferences-form" class="form-grid">${field("theme", "Tema", `<select name="theme">${opt("system", "Acompanhar aparelho", pref.theme) + opt("light", "Claro", pref.theme) + opt("dark", "Escuro", pref.theme)}</select>`)}${field("palette", "Cor", `<select name="palette">${opt("forest", "Verde", pref.palette) + opt("ocean", "Azul", pref.palette) + opt("plum", "Ameixa", pref.palette)}</select>`)}${field("text_size", "Tamanho do texto", `<select name="text_size">${opt("standard", "Padrão", pref.text_size) + opt("large", "Maior", pref.text_size)}</select>`)}<div class="preference-checks wide"><label><input type="checkbox" name="comfortable" ${pref.comfortable ? "checked" : ""}> Mais espaço entre elementos</label><label><input type="checkbox" name="simple_mode" ${pref.simple_mode ? "checked" : ""}> Modo simples</label><label><input type="checkbox" name="hide_values" ${pref.hide_values ? "checked" : ""}> Ocultar valores na tela</label></div><fieldset class="wide preference-list"><legend>Blocos do painel</legend><p>Marque o que deseja ver. Use as setas para mudar a ordem.</p>${pref.dashboard_order.concat(dashboardWidgets.filter((item) => !pref.dashboard_order.includes(item))).map((id) => `<div class="preference-row"><label><input type="checkbox" name="widget" value="${id}" ${pref.dashboard_order.includes(id) ? "checked" : ""}> ${widgetNames[id]}</label><span>${button("widget-up", "↑", "secondary", `data-id="${id}" aria-label="Subir ${widgetNames[id]}"`)}${button("widget-down", "↓", "secondary", `data-id="${id}" aria-label="Descer ${widgetNames[id]}"`)}</span></div>`).join("")}</fieldset><fieldset class="wide preference-list"><legend>Atalhos do início</legend>${quickActions.map((id) => `<label><input type="checkbox" name="quick_action" value="${id}" ${pref.quick_actions.includes(id) ? "checked" : ""}> ${actionNames[id]}</label>`).join("")}</fieldset><div class="button-row wide"><button type="submit" class="primary">Salvar aparência</button>${button("reset-preferences", "Restaurar padrão", "secondary")}</div></form></section>`;
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
function modalContent() {
  const d = api.data!;
  const p = d.pantry.find((p) => p.id === editId),
    g = d.goals.find((g) => g.id === editId);
  switch (modal) {
    case "entry":
      return entryForm(editId ? d.entries.find((e) => e.id === editId) : {});
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
      return `<form id="category-preset-form" class="form-grid">${input("id", "hidden", preset?.id || "")}${field("category", "Categoria", input("category", "text", preset?.category || "", 'list="category-names" maxlength="80" placeholder="Ex.: Saúde" required') + `<datalist id="category-names">${categoryOptions("")}</datalist>`, true)}${field("subcategory", "Subcategoria (opcional)", input("subcategory", "text", preset?.subcategory || "", 'maxlength="80" placeholder="Ex.: Vacinas"'), true)}${admin() ? `<label class="wide category-sharing"><input type="checkbox" name="shared" ${(preset?.shared ?? true) ? "checked" : ""}> Disponível para a família</label>` : ""}<p class="fine wide">Use só a categoria para criar um grupo novo. Adicione uma subcategoria para encontrá-la nos próximos gastos. Lançamentos antigos mantêm sua classificação.</p>${formEnd(preset ? "Salvar opção" : "Criar opção")}</form>`;
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
      return `<form id="pantry-form" class="form-grid">${input("id", "hidden", p?.id || "")}${field("name", "Produto", input("name", "text", p?.name || "", 'maxlength="151" required'), true)}${field("quantity", "Estoque contado hoje", input("quantity", "number", p ? forecast(p).stock : 0, 'min="0" step="0.01" required'))}${field("unit", "Unidade", `<select name="unit">${["unidade", "kg", "litro", "pacote", "caixa"].map((u) => opt(u, u, p?.unit)).join("")}</select>`)}${field("minimum", "Estoque mínimo", input("minimum", "number", p?.minimum || 1, 'min="0" step="0.01" required'))}${field("daily_use", "Consumo por dia", input("daily_use", "number", p?.daily_use || 0, 'min="0" step="0.01" required'))}${field("price", "Preço por unidade (R$)", moneyInput("price", p ? (p.price_cents / 100).toFixed(2).replace(".", ",") : ""))}${field("expires_on", "Validade (opcional)", input("expires_on", "date", p?.expires_on || ""))}<p class="fine wide">O consumo diário gera uma estimativa. Zero mantém o estoque fixo até a próxima contagem.</p>${formEnd()}</form>`;
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
    entry: "Novo lançamento",
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
    goal: "Seu próximo objetivo",
    document: "Anexar documento",
    recurring: "Nova despesa fixa",
    member: "Novo usuário da família",
    import: "Importar relatório",
    "import-preview": "Confira antes de importar",
  };
  const views: Record<string, () => string> = {
    overview: summary,
    entries,
    analysis,
    categories,
    cards,
    reminders,
    calendar,
    accounts,
    pantry,
    shopping,
    planning,
    goals,
    documents,
    family,
    settings,
  };
  root.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" data-action="nav" data-page="overview"><span class="brand-mark">${icon("goals")}</span>Financeiro<span>360</span></a><span class="nav-label">NOSSA CASA</span><nav>${sidebarNav()}</nav><div class="sidebar-footer"><div class="avatar small">${esc(api.me.display_name.slice(0, 1))}</div><div><strong>${esc(api.me.display_name)}</strong><small>${admin() ? "Administrador" : "Membro da família"}</small></div><button type="button" data-action="logout" aria-label="Sair da conta">${icon("logout")}</button></div></aside><div class="main-shell"><header class="topbar"><div><span class="eyebrow">${esc(api.data.home.name.toLocaleUpperCase())}</span><h1>${esc(nav.find((x) => x[0] === page)?.[1])}</h1></div><div class="topbar-actions"><select class="mobile-more" name="navigate" aria-label="Abrir uma seção">${nav.map(([id, label]) => opt(id, label, page)).join("")}</select><label class="month-picker"><span>Mês</span><input type="month" name="month" value="${month}" aria-label="Mês de referência"></label>${button("toggle-values", pref.hide_values ? "Mostrar valores" : "Ocultar valores", "secondary desktop")}${button("reload", icon("check") + " Atualizar", "secondary desktop")}${api.allowed("entries") ? button("add-entry", icon("plus") + " Lançar", "primary") : ""}</div></header>${api.demo ? `<div class="demo-banner"><strong>Demonstração · dados fictícios e temporários</strong>${button("switch-demo", admin() ? "Ver como esposa" : "Ver como administrador", "text-button")}${button("logout", "Sair da demonstração", "text-button")}</div>` : ""}${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ""}${api.me.password_change_required ? `<div class="password-banner">Defina sua senha pessoal em Configurações. ${button("nav", "Trocar senha", "text-button", 'data-page="settings"')}</div>` : ""}<main class="content">${views[page]()}</main><nav class="mobile-nav">${nav
    .filter(([id]) =>
      ["overview", "entries", "analysis", "shopping", "settings"].includes(id),
    )
    .map(
      ([id, label]) =>
        `<button type="button" class="${page === id ? "active" : ""}" data-action="nav" data-page="${id}">${icon(id)}<span>${label.split(" ")[0]}</span></button>`,
    )
    .join(
      "",
    )}</nav></div></div>${modal ? `<dialog open class="modal" aria-labelledby="modal-title"><div class="modal-heading"><h2 id="modal-title">${esc(titles[modal])}</h2><button type="button" class="close" data-action="close" aria-label="Fechar">×</button></div>${notice ? `<div class="notice" role="alert">${esc(notice)}</div>` : ""}${modalContent()}</dialog><div class="scrim"></div>` : ""}`;
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
      .querySelector<HTMLInputElement>('input:not([type="hidden"])')
      ?.focus();
      syncEntryForm();
  }
}
async function run(work: () => Promise<unknown>, message = "") {
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
    notice = message;
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
  render();
}
function chooseSubcategory(chip: HTMLElement) {
  const form = chip.closest<HTMLFormElement>("#entry-form");
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
    render();
    return;
  }
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
    import: "import",
  };
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
      const suggestions = recommendations(api.data!.pantry, api.data!.shopping);
      for (const { p, quantity } of suggestions)
        await api.save("shopping", {
          name: p.name,
          pantry_id: p.id,
          quantity,
          unit: p.unit,
          estimate_cents: p.price_cents,
          bought: false,
        });
    }, "Lista sugerida a partir da despensa.");
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
          quantity: Math.max(1, p.minimum - forecast(p).stock),
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
root.addEventListener("change", (event) => {
  if ((event.target as HTMLInputElement).closest("#entry-form")) syncEntryForm();
  if ((event.target as HTMLInputElement).name === "kind" && (event.target as HTMLInputElement).closest("#reminder-form")) syncReminderForm();
  if (modal) return;
  const el = event.target as HTMLInputElement;
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
});
root.addEventListener("input", (event) => {
  const el = event.target as HTMLInputElement;
  if (
    el.closest("#entry-form") &&
    ["amount", "installments", "date", "first_invoice_month"].includes(el.name)
  )
    syncEntryForm();
  if (el.name === "search") {
    const pos = el.selectionStart;
    filter = el.value;
    render();
    const next = root.querySelector<HTMLInputElement>('[name="search"]');
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
    dashboard_order: Array.from(form.querySelectorAll<HTMLInputElement>('[name="widget"]'))
      .filter((item) => item.checked)
      .map((item) => item.value as DashboardWidget),
    quick_actions: data.getAll("quick_action").map((item) => String(item) as QuickAction),
  };
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
  void run(async () => {
    const id = val(f, "id");
    if (f.getAttribute("id") === "login-form") {
      await api.login(val(f, "email"), val(f, "password"));
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
    if (f.getAttribute("id") === "purchase-form") {
      const ids = new FormData(f).getAll("items").map(String);
      if (!ids.length) throw Error("Selecione os produtos comprados.");
      await api.purchase(
        ids,
        cash(f, "total"),
        val(f, "date"),
        val(f, "account_id") || null,
      );
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
    if (f.getAttribute("id") === "category-preset-form") {
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
    else if (f.getAttribute("id") === "pantry-form")
      await api.save("pantry", {
        ...(id ? { id } : {}),
        name: val(f, "name"),
        quantity: Number(val(f, "quantity")),
        unit: val(f, "unit"),
        minimum: Number(val(f, "minimum")),
        daily_use: Number(val(f, "daily_use")),
        price_cents: val(f, "price") ? cash(f, "price", true) : 0,
        expires_on: val(f, "expires_on") || null,
        updated_at: new Date().toISOString(),
      });
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
  }, "Alteração salva.");
});
render();
void run(async () => {
  await api.restore();
});

if ("serviceWorker" in navigator && import.meta.env.PROD)
  void navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
setInterval(() => {
  if (api.data && !api.demo && !busy && !modal)
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
