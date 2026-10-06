Warning: truncated output (original token count: 22790)
Total output lines: 1396

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
  type Permission,
  type Member,
  type Reminder,
} from "./model.ts";
import { dashboardWidgets, quickActions, defaultPreferences, type DashboardWidget, type QuickAction } from "./preferences.ts";
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
  notice = "",
  busy = false,
  filter = "",
  area = "all",
  owner = "all",
  status = "all",
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
    family:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-4",
    settings:
      "M12 8a4 4 0 1 0 0 8 M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    plus: "M12 5v14 M5 12h14",
    arrow: "M5 12h14 M13 6l6 6-6 6",
    logout: "M9 3H3v18h6 M10 12h11 M16 7l5 5-5 5",
    check: "M4 12l5 5L20 6",
    debt: "M5 3h14v18l-3-2-4 2-4-2-3 2z M8 8h8 M8 12h6",
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ? `<path d="${paths[name]}"/>` : '<circle cx="12" cy="12" r="9"/>'}</svg>`;
};
const nav = [
  ["overview", "Início"],
  ["entries", "Dinheiro"],
  ["shopping", "Compras"],
  ["pantry", "Casa"],
  ["settings", "Perfil"],
  ["cards", "Cartões e faturas"],
  ["reminders", "Avisos e lembretes"],
  ["accounts", "Contas e dívidas"],
  ["planning", "Planejamento"],
  ["goals", "Metas"],
  ["documents", "Comprovantes"],
  ["family", "Família e acesso"],
];
const primaryNav = new Set(["overview", "entries", "shopping", "pantry", "settings"]);
const navButton = ([id, label]: string[]) => `<button type="button" class="nav-item ${page === id ? "active" : ""}" data-action="nav" data-page="${id}">${icon(id)}<span>${label}</span>${id === "shopping" && api.data!.shopping.some((s) => !s.bought) || id === "reminders" && api.data!.reminders.some((r) => !r.completed && daysFromToday(r.due_on) <= 7) ? "<i></i>" : ""}</button>`;
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
    .data!.cards.filter(own)
    .map((c) => opt(c.id, c.name, current))
    .join("");
const commonCategories = [
  "Mercado", "Moradia", "Contas da casa", "Delivery", "Restaurantes",
  "Transporte", "Combustível", "Saúde", "Farmácia", "Educação",
  "Crianças", "Pets", "Roupas", "Cuidados pessoais", "Lazer",
  "Assinaturas", "Impostos", "Salário", "Investimentos", "Dívidas",
  "Fatura", "Transferência", "Outros",
];
const categoryList = () => `<datalist id="categories">${Array.from(new Set([
  ...commonCategories,
  ...(api.data?.entries || []).map((entry) => entry.category),
  ...(api.data?.recurring || []).map((entry) => entry.category),
])).filter(Boolean).map((category) => `<option value="${esc(category)}"></option>`).join("")}</datalist>`;
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
const nextReminderDate = (reminder: Reminder) => {
  if (reminder.recurrence === "weekly")
    return new Date(Date.parse(`${reminder.due_on}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const months = reminder.recurrence === "yearly" ? 12 : 1;
  const targetMonth = addMonths(reminder.due_on.slice(0, 7), months);
  const [year, month] = targetMonth.split("-").map(Number);
  const day = Number(reminder.due_on.slice(8, 10));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${targetMonth}-${String(Math.min(day, last)).padStart(2, "0")}`;
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
  const visible = api.preferences.quick_actions.filter((id) => allowed[id]);
  return visible.length ? `<nav class="quick-panel" aria-label="Seus atalhos">${visible.map((id) => button(id === "expense" ? "add-entry" : "nav", actionNames[id], "secondary", id === "expense" ? "" : `data-page="${id === "cards" ? "cards" : id === "shopping" ? "shopping" : "pantry"}"`)).join("")}</nav>` : "";
}
function summary() {
  const d = api.data!,
    m = metrics(d, month);
  const percent = d.home.budget_cents
    ? Math.round((m.home / d.home.budget_cents) * 100)
    : 0;
  const low = d.pantry.filter((p) => {
    const f = forecast(p);
    return f.stock <= p.minimum || (f.days !== null && f.days < 7);
  });
  const cards = d.cards.reduce((s, c) => s + invoice(d, c, month).remaining, 0);
  const picture = monthPicture(d, month);
  const prevMonth = new Date(month + "-01T12:00:00");
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const pm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const previous = metrics(d, pm).spend;
  const trend = previous
    ? Math.round(((m.spend - previous) / previous) * 100)
    : null;
  const dueReminders = d.reminders.filter((r) => !r.completed && daysFromToday(r.due_on) <= 7).sort((a, b) => a.due_on.localeCompare(b.due_on));
  return `<section class="hero"><div><span class="eyebrow">CADA ESCOLHA CONTA</span><h2>Sua casa em equilíbrio.</h2><p>${admin() ? "Gastos compartilhados da família e seus próprios registros." : "Seus gastos e os registros compartilhados com você."}</p>${button("add-entry", icon("plus") + " Lançar um gasto", "light")}</div><div class="hero-visual"><div class="orbit o1"></div><div class="orbit o2"></div><div class="hero-ring"><span>Orçamento do lar</span><strong>${d.home.budget_cents ? Math.max(0, 100 - percent) + "%" : "—"}</strong><small>${d.home.budget_cents ? "disponível sobre os gastos visíveis" : "defina seu planejamento"}</small></div></div></section>${quickPanel()}${dueReminders.length ? `<section class="panel reminder-banner"><div><span class="eyebrow">PRÓXIMOS AVISOS</span><p>${dueReminders.slice(0, 3).map((r) => `<strong>${esc(r.title)}</strong> · ${reminderTiming(r.due_on)}`).join("<br>")}</p></div>${button("nav", "Ver lembretes", "secondary", 'data-page="reminders"')}</section>` : ""}<div class="kpi-grid"><article class="kpi"><div><span>Gastos lançados no mês</span>${icon("entries")}</div><strong>${brl(m.spend)}</strong><small>${trend === null ? "Sem base no mês anterior" : `${Math.abs(trend)}% ${trend > 0 ? "acima" : "abaixo"} do mês anterior`}</small></article><article class="kpi"><div><span>Receitas do mês</span>${icon("accounts")}</div><strong>${brl(m.income)}</strong><small>Valores registrados por data</small></article><article class="kpi"><div><span>Faturas em aberto</span>${icon("cards")}</div><strong>${brl(cards)}</strong><small>Parcelas menos pagamentos informados</small></article><article class="kpi"><div><span>Orçamento do lar</span>${icon("goals")}</div><strong>${d.home.budget_cents ? brl(Math.max(0, d.home.budget_cents - m.home)) : "Não definido"}</strong><small>${d.home.budget_cents ? `${percent}% utilizado · apenas gastos do lar` : "Planeje um limite mensal"}</small></article></div><details class="panel numbers-explained"><summary>Entenda os valores deste mês</summary><div class="number-explanations"><div><span>Gastos lançados</span><strong>${brl(picture.purchased)}</strong><p>Valor integral pela data da compra ou do lançamento.</p></div><div><span>A pagar</span><strong>${brl(picture.due)}</strong><p>${brl(picture.cashDue)} em contas pendentes e ${brl(picture.cardDue)} em faturas previstas pelo vencimento.</p></div><div><span>Saiu das contas</span><strong>${brl(picture.cashOut)}</strong><p>Despesas pagas, faturas e dívidas informadas como pagas. Transferências entre suas contas ficam fora deste número.</p></div></div><p class="fine">Estes três números mostram etapas diferentes do mesmo dinheiro e não devem ser somados.</p></details><div class="dashboard-grid"><section class="panel" data-widget="categories"><div class="panel-title"><div><span class="eyebrow">PARA ONDE VAI O DINHEIRO</span><h3>Gastos por categoria</h3></div><span class="badge">${month.split("-").reverse().join("/")}</span></div>${
    m.categories.length
      ? `<div class="category-chart">${m.categories
          .slice(0, 6)
          .map(
            ([cat, total], i) =>
              `<div class="category-row"><span><i style="background:var(--chart-${i % 4})"></i>${esc(cat)}</span><strong>${brl(total)}</strong><div class="bar"><b style="width:${Math.round((total / m.spend) * 100)}%;background:var(--chart-${i % 4})"></b></div></div>`,
          )
          .join("")}</div>`
      : empty("Seu primeiro gasto conta a história", "add-entry")
  }</section><section class="panel intelligence" data-widget="insights"><div class="panel-title"><div><span class="eyebrow">OLHAR INTELIGENTE</span><h3>Seu próximo passo</h3></div><span class="spark">✦</span></div>${m.overdue.length ? `<article class="insight warning"><span>${icon("debt")}</span><div><strong>${m.overdue.length} conta(s) para conferir</strong><p>${brl(m.overdue.reduce((s, e) => s + e.amount_cents, 0))} com vencimento anterior a hoje. Confira antes de marcar como pago.</p></div></article>` : `<article class="insight"><span>${icon("check")}</span><div><strong>Sem atrasos registrados</strong><p>Os registros disponíveis não mostram contas pendentes vencidas.</p></div></article>`}${percent >= 80 ? `<article class="insight warning"><span>${icon("goals")}</span><div><strong>Orçamento merece atenção</strong><p>Os gastos visíveis do lar já usam ${percent}% do limite mensal.</p></div></article>` : ""}<article class="insight"><span>${icon("pantry")}</span><div><strong>${low.length ? `${low.length} produto(s) para repor` : "Despensa sob controle"}</strong><p>${
    low.length
      ? low
          .slice(0, 3)
          .map((p) => esc(p.name))
          .join(", ")
      : "Cadastre consumo diário para estimar reposições."
  }</p></div></article><article class="insight"><span>${icon("entries")}</span><div><strong>${m.pending.length} lançamento(s) em revisão</strong><p>Registros em revisão ficam fora de todos os totais.</p></div></article></section><section class="panel wide-panel" data-widget="recent"><div class="panel-title"><div><span class="eyebrow">MOVIMENTO DA CASA</span><h3>Últimos lançamentos</h3></div>${button("nav", "Ver todos", "text-button", 'data-page="entries"')}</div>${entryList([...d.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5))}</section></div><p class="fine">${admin() ? "Totais incluem os registros da família." : "Totais calculados somente sobre os registros que você pode acessar."} Gastos são contabilizados na data da compra; pagamentos de fatura, principal e transferências não duplicam despesas.</p>`;
}
function entryList(rows: Entry[]) {
  return rows.length
    ? `<div class="records">${rows.map((e) => {
        const card = e.card_id ? api.data?.cards.find((c) => c.id === e.card_id) : undefined;
        const invoice = e.kind === "expense" && e.payment === "card" && card
          ? e.first_invoice_month || invoiceMonth(e.date, card.closing_day)
          : null;
        const invoiceLabel = invoice ? ` · ${esc(card!.name)} · fatura ${invoice.split("-").reverse().join("/")}` : "";
        const canManage = (admin() || own(e)) && api.allowed("entries");
        return `<article class="record"><span class="record-icon ${e.kind === "income" ? "income" : ""}">${icon(e.payment === "card" ? "cards" : "entries")}</span><div class="record-info"><strong>${esc(e.description)}</strong><small>${e.date.split("-").reverse().join("/")} · ${esc(e.category)} · ${esc(names(e.owner_id))} · ${{ household: "Lar", personal: "Pessoal", business: "Empresa" }[e.area]}${invoiceLabel}</small></div><div class="record-value"><strong class="${e.kind === "income" ? "positive" : ""}">${e.kind === "income" ? "+" : ""}${brl(e.amount_cents)}</strong><small>${e.status === "pending_review" ? "Em revisão" : e.status === "pending" ? "A pagar" : e.payment === "card" ? "Compra no cartão" : "Confirmado"}${e.installments > 1 ? ` · ${e.installments}x` : ""}</small></div><div class="record-actions">${share("entries", e)}${invoice ? button("entry-invoice", `Ver fatura ${invoice.split("-").reverse().join("/")}`, "text-button", `data-id="${e.id}"`) : ""}${canManage ? button("edit-entry", "Editar", "text-button", `data-id="${e.id}"`) : ""}${e.status === "pending" && canManage && api.allowed("payments") ? button("paid", "Informar pagamento", "text-button", `data-id="${e.id}"`) : ""}${e.status === "pending_review" && canManage ? button("confirm-entry", "Confirmar", "text-button", `data-id="${e.id}"`) : ""}${canManage ? deleteButton("entries", e.id) : ""}</div></article>`;
      }).join("")}</div>`
    : empty("Nenhum lançamento por aqui", "add-entry");
}
function entries() {
  const rows = api.data!.entries.filter(
    (e) =>
      e.date.startsWith(month) &&
      (area === "all" || e.area === area) &&
      (owner === "all" || e.owner_id === owner) &&
      (status === "all" || e.status === status) &&
      `${e.description} ${e.category}`
        .toLocaleLowerCase()
        .includes(filter.toLocaleLowerCase()),
  );
  return `<section class="page-intro"><div><h2>O dia a dia, registrado.</h2><p>Gastos, receitas e pagamentos com clareza.</p></div>${api.allowed("entries") ? button("add-entry", icon("plus") + " Novo lançamento") : ""}</section><section class="panel"><div class="filters">${input("search", "search", filter, 'placeholder="Buscar descrição ou categoria" aria-label="Buscar lançamentos"')}<select name="area" aria-label="Filtrar área">${opt("all", "Todas as áreas", area) + opt("household", "Lar", area) + opt("personal", "Pessoal", area) + opt("business", "Empresa", area)}</select><select name="owner" aria-label="Filtrar responsável">${opt("all", "Todos os responsáveis", owner) + api.data!.members.map((m) => opt(m.user_id, m.display_name, owner)).join("")}</select><select name="status" aria-label="Filtrar situação">${opt("all", "Todas as situações", status) + opt("paid", "Confirmados", status) + opt("pending", "A pagar", status) + opt("pending_review", "Em revisão", status)}</select></div>${entryList(rows)}</section>`;
}
function cards() {
  const d = api.data!;
  return `<section class="page-intro"><div><h2>Cartões sem surpresas.</h2><p>Parcelas previstas e pagamentos informados em um só lugar.</p></div>${api.allowed("cards") ? button("add-card", icon("plus") + " Adicionar cartão") : ""}</section><div class="card-grid">${
    d.cards
      .map((c, i) => {
        const f = invoice(d, c, month),
          openMonth = invoiceMonth(today(), c.closing_day),
          lines = invoiceInstallments(d.entries, c, month),
          categoryTotals = Array.from(lines.reduce((totals, line) =>
            totals.set(line.entry.category, (totals.get(line.entry.category) || 0) + line.amount_cents),
          new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);
        return `<section class="panel card-panel"><div class="credit-card cc-${i % 3}"><span>${esc(c.name)}</span>${icon("cards")}<strong>•••• &nbsp; •••• &nbsp; ••••</strong><small>${esc(names(c.owner_id))}</small></div><p class="invoice-open-hint">Compras feitas agora entram na fatura de <strong>${openMonth.split("-").reverse().join("/")}</strong> ${month !== openMonth ? button("open-invoice", "Abrir fatura em aberto", "text-button", `data-month="${openMonth}"`) : ""}</p><div class="invoice-stats"><div><span>Fatura prevista · ${month.split("-").reverse().join("/")}</span><strong>${brl(f.total)}</strong></div><div><span>A pagar</span><strong>${brl(f.remaining)}</strong></div></div><p class="fine">Fecha dia ${c.closing_day} · vence ${dueDate(
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
        )} · limite ${c.limit_cents === null ? "não informado" : brl(c.limit_cents)}</p><p class="fine">Fatura selecionada: ${month.split("-").reverse().join("/")} · compras até o fechamento entram nela; depois do fechamento, passam para a próxima competência.</p><div class="button-row">${share("cards", c)}${own(c) && api.allowed("payments") ? button("card-payment", "Registrar pagamento", "secondary", `data-id="${c.id}"`) : ""}${own(c) && api.allowed("cards") ? button("edit-card", "Editar cartão", "text-button", `data-id="${c.id}"`) + deleteButton("cards", c.id) : ""}</div><details><summary>Ver ${lines.length} compra(s) e categorias</summary>${categoryTotals.length ? `<div class="card-category-breakdown"><h4>Gastos por categoria</h4><div class="category-chart">${categoryTotals.map(([category, amount], index) => `<div class="category-row"><span><i style="background:var(--chart-${index % 4})"></i>${esc(category)}</span><strong>${brl(amount)}</strong><div class="bar"><b style="width:${f.total ? Math.round((amount / f.total) * 100) : 0}%;background:var(--chart-${index % 4})"></b></div></div>`).join("")}</div></div>` : '<p class="fine">Ainda não há compras nesta fatura.</p>'}${lines.length ? lines.map((line) => `<p class="detail-line">${esc(line.entry.description)} <strong>Parcela ${line.number}/${line.total} · ${brl(line.amount_cents)}</strong><small>${esc(line.entry.category)} · compra em ${line.entry.date.split("-").reverse().join("/")}</small></p>`).join("") : ""}</details></section>`;
      })
      .join("") || empty("Cadastre seu primeiro cartão", "add-card")
  }</div>`;
}
function accounts() {
  const d = api.data!;
  return `<section class="page-intro"><div><h2>Cada conta, cada compromisso.</h2><p>Saldos conhecidos, transferências e pagamentos de principal.</p></div><div class="button-row">${api.allowed("cards") ? button("add-account", "Nova conta") : ""}${api.allowed("entries") ? button("add-debt", "Nova dívida", "secondary") : ""}</div></section><div class="card-grid">${d.accounts
    .map((a) => {
      const canSeeBalance = own(a) || admin() || (a.shared && a.share_balance);
      const b = canSeeBalance ? balance(d, a) : null;
      return `<section class="panel"><span class="eyebrow">${esc(a.area === "business" ? "EMPRESA" : a.area === "household" ? "LAR" : "PESSOAL")}</span><h3>${esc(a.name)}</h3><strong class="large-number">${!canSeeBalance ? "Saldo privado" : b === null ? "Saldo desconhecido" : brl(b)}</strong><p class="fine">${!canSeeBalance ? "O titular não compartilhou o saldo desta conta." : a.balance_date ? `Base em ${a.balance_date}. Pagamentos, receitas e transferências posteriores já entram no saldo.` : "Informe saldo e data-base para calcular movimentos."}</p><div class="button-row">${share("accounts", a)}${admin() && a.shared ? button("share-balance", a.share_balance ? "Ocultar saldo da família" : "Compartilhar saldo com a família", "text-button", `data-id="${a.id}"`) : ""}${own(a) && api.allowed("cards") ? button("edit-account", "Editar conta ou saldo-base", "text-button", `data-id="${a.id}"`) + deleteButton("accounts", a.id) : ""}</div></section>`;
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
        return `<article class="record"><span class="record-icon">${icon("debt")}</span><div class="record-info"><strong>${esc(debt.name)}</strong><small>${esc(debt.creditor)} · ${esc(names(debt.owner_id))}${debt.due_date ? " · vence " + debt.due_date : ""}</small></div><strong>${debt.balance_cents === null ? "Saldo desconhecido" : brl(debt.balance_cents - paid)}</strong><div class="record-actions">${share("debts", debt)}${own(debt) && api.allowed("payments") ? button("debt-payment", "Pagar principal", "secondary", `data-id="${debt.id}"`) : ""}${own(debt) && api.allowed("entries") ? deleteButton("debts", debt.id) : ""}</div></article>`;
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
  return `<section class="page-intro"><div><h2>Compras com propósito.</h2><p>Uma lista da casa para comprar melhor e desperdiçar menos.</p></div><div class="button-row">${api.allowed("shopping") ? button("generate-list", "✦ Sugerir para 14 dias") + button("add-shopping", "…7790 tokens truncated…id, label, page)).join("")}</select><label class="month-picker"><span>Mês</span><input type="month" name="month" value="${month}" aria-label="Mês de referência"></label>${button("toggle-values", pref.hide_values ? "Mostrar valores" : "Ocultar valores", "secondary desktop")}${button("reload", icon("check") + " Atualizar", "secondary desktop")}${api.allowed("entries") ? button("add-entry", icon("plus") + " Lançar", "primary") : ""}</div></header>${api.demo ? `<div class="demo-banner"><strong>Demonstração · dados fictícios e temporários</strong>${button("switch-demo", admin() ? "Ver como esposa" : "Ver como administrador", "text-button")}${button("logout", "Sair da demonstração", "text-button")}</div>` : ""}${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ""}${api.me.password_change_required ? `<div class="password-banner">Defina sua senha pessoal em Configurações. ${button("nav", "Trocar senha", "text-button", 'data-page="settings"')}</div>` : ""}<main class="content">${views[page]()}</main><nav class="mobile-nav">${nav
    .filter(([id]) =>
      ["overview", "entries", "pantry", "shopping", "settings"].includes(id),
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
root.addEventListener("click", (event) => {
  const b = (event.target as Element).closest<HTMLElement>("[data-action]");
  if (!b || busy) return;
  const a = b.dataset.action!,
    id = b.dataset.id || "";
  if (a === "nav") {
    page = b.dataset.page!;
    notice = "";
    modal = "";
    render();
    window.scrollTo(0, 0);
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
  const map: Record<string, string> = {
    "add-entry": "entry",
    "edit-entry": "entry",
    "add-card": "card",
    "edit-card": "card",
    "card-payment": "card-payment",
    "add-account": "account",
    "edit-account": "account",
    "add-debt": "debt",
    "debt-payment": "debt-payment",
    "add-pantry": "pantry",
    "edit-pantry": "pantry",
    "add-shopping": "shopping",
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
    void run(() => api.save("reminders", reminder.recurrence === "once" ? { id, completed: true } : { id, due_on: nextReminderDate(reminder), completed: false }), reminder.recurrence === "once" ? "Lembrete concluído." : "Próximo aviso atualizado.");
    return;
  }
  if (a === "share-balance") {
    const account = api.data!.accounts.find((item) => item.id === id)!;
    void run(() => api.save("accounts", { id, share_balance: !account.share_balance }), "Compartilhamento do saldo atualizado.");
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
  if ((event.target as HTMLInputElement).closest("#entry-form"))
    syncEntryForm();
  if (modal) return;
  const el = event.target as HTMLInputElement;
  if (el.name === "navigate") {
    page = el.value;
    notice = "";
    render();
    return;
  }
  if (el.name === "month") {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(el.value)) month = el.value;
    render();
  }
  if (["area", "owner", "status"].includes(el.name)) {
    if (el.name === "area") area = el.value;
    if (el.name === "owner") owner = el.value;
    if (el.name === "status") status = el.value;
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
    expense: "Mercado", payable: "Moradia", income: "Salário",
    transfer: "Transferência", card_payment: "Fatura", debt_payment: "Dívidas",
  };
  const previousKind = form.dataset.lastKind;
  if (previousKind && previousKind !== kind && category instanceof HTMLInputElement &&
      category.value === suggestedCategory[previousKind])
    category.value = suggestedCategory[kind] || "Outros";
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
    if (f.getAttribute("id") === "entry-form") {
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
    else if (f.getAttribute("id") === "card-form")
      await api.save("cards", {
        ...(id ? { id } : {}),
        name: val(f, "name"),
        limit_cents: val(f, "limit") ? cash(f, "limit", true) : null,
        closing_day: Number(val(f, "closing_day")),
        due_day: Number(val(f, "due_day")),
      });
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
    } else if (f.getAttribute("id") === "debt-form")
      await api.save("debts", {
        name: val(f, "name"),
        creditor: val(f, "creditor"),
        balance_cents: val(f, "balance") ? cash(f, "balance", true) : null,
        due_date: val(f, "due_date") || null,
        area: val(f, "area"),
      });
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
    else if (f.getAttribute("id") === "reminder-form")
      await api.save("reminders", { ...(id ? { id } : {}), title: val(f, "title"), due_on: val(f, "due_on"), recurrence: val(f, "recurrence"), completed: false });
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
