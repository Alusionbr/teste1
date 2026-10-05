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
  type Permission,
  type Member,
  type Pantry,
  type PantryEvent,
  type Shopping,
  type Task,
} from "./model.ts";
import {
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
  importRows: Partial<Entry>[] = [],
  houseTab = "pantry",
  pantryPlace = "all",
  pantrySearch = "",
  taskPerson = "all",
  suggestDays = 14,
  moveKind: PantryEvent["kind"] = "used";
// Carrinho do modo mercado: sobrevive a re-renderizações, atualização automática e falhas de envio.
const cart = new Map<string, { checked: boolean; qty: string; price: string }>();
const cartMeta = { total: "", date: "", account: "" };
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
  ["accounts", "Contas e dívidas"],
  ["planning", "Planejamento"],
  ["goals", "Metas"],
  ["documents", "Comprovantes"],
  ["family", "Família e acesso"],
];
const primaryNav = new Set(["overview", "entries", "shopping", "pantry", "settings"]);
const navButton = ([id, label]: string[]) => `<button type="button" class="nav-item ${page === id ? "active" : ""}" data-action="nav" data-page="${id}">${icon(id)}<span>${label}</span>${id === "shopping" && api.data!.shopping.some((s) => !s.bought) ? "<i></i>" : ""}</button>`;
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
const share = (collection: string, r: { id: string; shared: boolean }) =>
  admin()
    ? button(
        "share",
        r.shared ? "Compartilhado" : "Privado",
        r.shared ? "badge shared" : "badge private",
        `data-table="${collection}" data-id="${esc(r.id)}" data-shared="${r.shared}" aria-label="${r.shared ? "Tornar privado" : "Compartilhar com a família"}"`,
      )
    : `<span class="badge ${r.shared ? "shared" : "private"}">${r.shared ? "Compartilhado" : "Seu registro"}</span>`;
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
  const care = attention(d.pantry);
  const chores = taskGroups(d.tasks);
  const choresNow = [...chores.overdue, ...chores.today];
  const cards = d.cards.reduce((s, c) => s + invoice(d, c, month).remaining, 0);
  const picture = monthPicture(d, month);
  const prevMonth = new Date(month + "-01T12:00:00");
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const pm = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const previous = metrics(d, pm).spend;
  const trend = previous
    ? Math.round(((m.spend - previous) / previous) * 100)
    : null;
  return `<section class="hero"><div><span class="eyebrow">CADA ESCOLHA CONTA</span><h2>Sua casa em equilíbrio.</h2><p>${admin() ? "Todos os gastos da família, com a privacidade sob seu controle." : "Seus gastos e os registros compartilhados com você."}</p>${button("add-entry", icon("plus") + " Lançar um gasto", "light")}</div><div class="hero-visual"><div class="orbit o1"></div><div class="orbit o2"></div><div class="hero-ring"><span>Orçamento do lar</span><strong>${d.home.budget_cents ? Math.max(0, 100 - percent) + "%" : "—"}</strong><small>${d.home.budget_cents ? "disponível sobre os gastos visíveis" : "defina seu planejamento"}</small></div></div></section>${quickPanel()}<div class="kpi-grid"><article class="kpi"><div><span>Gastos lançados no mês</span>${icon("entries")}</div><strong>${brl(m.spend)}</strong><small>${trend === null ? "Sem base no mês anterior" : `${Math.abs(trend)}% ${trend > 0 ? "acima" : "abaixo"} do mês anterior`}</small></article><article class="kpi"><div><span>Receitas do mês</span>${icon("accounts")}</div><strong>${brl(m.income)}</strong><small>Valores registrados por data</small></article><article class="kpi"><div><span>Faturas em aberto</span>${icon("cards")}</div><strong>${brl(cards)}</strong><small>Parcelas menos pagamentos informados</small></article><article class="kpi"><div><span>Orçamento do lar</span>${icon("goals")}</div><strong>${d.home.budget_cents ? brl(Math.max(0, d.home.budget_cents - m.home)) : "Não definido"}</strong><small>${d.home.budget_cents ? `${percent}% utilizado · apenas gastos do lar` : "Planeje um limite mensal"}</small></article></div><details class="panel numbers-explained"><summary>Entenda os valores deste mês</summary><div class="number-explanations"><div><span>Gastos lançados</span><strong>${brl(picture.purchased)}</strong><p>Valor integral pela data da compra ou do lançamento.</p></div><div><span>A pagar</span><strong>${brl(picture.due)}</strong><p>${brl(picture.cashDue)} em contas pendentes e ${brl(picture.cardDue)} em faturas previstas pelo vencimento.</p></div><div><span>Saiu das contas</span><strong>${brl(picture.cashOut)}</strong><p>Despesas pagas, faturas e dívidas informadas como pagas. Transferências entre suas contas ficam fora deste número.</p></div></div><p class="fine">Estes três números mostram etapas diferentes do mesmo dinheiro e não devem ser somados.</p></details><div class="dashboard-grid"><section class="panel" data-widget="categories"><div class="panel-title"><div><span class="eyebrow">PARA ONDE VAI O DINHEIRO</span><h3>Gastos por categoria</h3></div><span class="badge">${month.split("-").reverse().join("/")}</span></div>${
    m.categories.length
      ? `<div class="category-chart">${m.categories
          .slice(0, 6)
          .map(
            ([cat, total], i) =>
              `<div class="category-row"><span><i style="background:var(--chart-${i % 4})"></i>${esc(cat)}</span><strong>${brl(total)}</strong><div class="bar"><b style="width:${Math.round((total / m.spend) * 100)}%;background:var(--chart-${i % 4})"></b></div></div>`,
          )
          .join("")}</div>`
      : empty("Seu primeiro gasto conta a história", "add-entry")
  }</section><section class="panel intelligence" data-widget="insights"><div class="panel-title"><div><span class="eyebrow">OLHAR INTELIGENTE</span><h3>Seu próximo passo</h3></div><span class="spark">✦</span></div>${m.overdue.length ? `<article class="insight warning"><span>${icon("debt")}</span><div><strong>${m.overdue.length} conta(s) para conferir</strong><p>${brl(m.overdue.reduce((s, e) => s + e.amount_cents, 0))} com vencimento anterior a hoje. Confira antes de marcar como pago.</p></div></article>` : `<article class="insight"><span>${icon("check")}</span><div><strong>Sem atrasos registrados</strong><p>Os registros disponíveis não mostram contas pendentes vencidas.</p></div></article>`}${percent >= 80 ? `<article class="insight warning"><span>${icon("goals")}</span><div><strong>Orçamento merece atenção</strong><p>Os gastos visíveis do lar já usam ${percent}% do limite mensal.</p></div></article>` : ""}<article class="insight ${care.restock.length ? "warning" : ""}"><span>${icon("pantry")}</span><div><strong>${care.restock.length ? `${care.restock.length} produto(s) para repor` : "Despensa sob controle"}</strong><p>${
    care.restock.length
      ? care.restock
          .slice(0, 3)
          .map((p) => esc(p.name))
          .join(", ")
      : "Informe quanto tempo cada produto dura para prever reposições."
  }</p>${care.restock.length ? button("nav", "Ver lista de compras", "text-button", 'data-page="shopping"') : ""}</div></article>${care.expiring.length ? `<article class="insight warning"><span>${icon("check")}</span><div><strong>${care.expiring.length} produto(s) vencendo</strong><p>${care.expiring.slice(0, 3).map((p) => `${esc(p.name)} (${esc(expiry(p)!.label.toLocaleLowerCase())})`).join(", ")}. Use primeiro para não desperdiçar.</p>${button("nav", "Ver despensa", "text-button", 'data-page="pantry" data-house="pantry"')}</div></article>` : ""}${api.householdReady ? `<article class="insight ${chores.overdue.length ? "warning" : ""}"><span>${icon("family")}</span><div><strong>${choresNow.length ? `${choresNow.length} tarefa(s) da casa para hoje` : "Rotina da casa em dia"}</strong><p>${choresNow.length ? choresNow.slice(0, 3).map((t) => `${esc(t.title)}${t.assignee_id ? ` · ${esc(names(t.assignee_id))}` : ""}`).join("; ") + (chores.overdue.length ? `. ${chores.overdue.length} atrasada(s).` : ".") : "Nenhuma tarefa atrasada ou marcada para hoje."}</p>${button("nav", "Ver rotina", "text-button", 'data-page="pantry" data-house="tasks"')}</div></article>` : ""}<article class="insight"><span>${icon("entries")}</span><div><strong>${m.pending.length} lançamento(s) em revisão</strong><p>Registros em revisão ficam fora de todos os totais.</p></div></article></section><section class="panel wide-panel" data-widget="recent"><div class="panel-title"><div><span class="eyebrow">MOVIMENTO DA CASA</span><h3>Últimos lançamentos</h3></div>${button("nav", "Ver todos", "text-button", 'data-page="entries"')}</div>${entryList([...d.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5))}</section></div><p class="fine">${admin() ? "Totais incluem os registros da família." : "Totais calculados somente sobre os registros que você pode acessar."} Gastos são contabilizados na data da compra; pagamentos de fatura, principal e transferências não duplicam despesas.</p>`;
}
function entryList(rows: Entry[]) {
  return rows.length
    ? `<div class="records">${rows.map((e) => `<article class="record"><span class="record-icon ${e.kind === "income" ? "income" : ""}">${icon(e.payment === "card" ? "cards" : "entries")}</span><div class="record-info"><strong>${esc(e.description)}</strong><small>${e.date.split("-").reverse().join("/")} · ${esc(e.category)} · ${esc(names(e.owner_id))} · ${{ household: "Lar", personal: "Pessoal", business: "Empresa" }[e.area]}</small></div><div class="record-value"><strong class="${e.kind === "income" ? "positive" : ""}">${e.kind === "income" ? "+" : ""}${brl(e.amount_cents)}</strong><small>${e.status === "pending_review" ? "Em revisão" : e.status === "pending" ? "A pagar" : e.payment === "card" ? "Compra no cartão" : "Confirmado"}${e.installments > 1 ? ` · ${e.installments}x` : ""}</small></div><div class="record-actions">${share("entries", e)}${own(e) && api.allowed("entries") ? button("edit-entry", "Editar", "text-button", `data-id="${e.id}"`) : ""}${e.status === "pending" && own(e) && api.allowed("payments") ? button("paid", "Informar pagamento", "text-button", `data-id="${e.id}"`) : ""}${e.status === "pending_review" && own(e) && api.allowed("entries") ? button("confirm-entry", "Confirmar", "text-button", `data-id="${e.id}"`) : ""}${own(e) && api.allowed("entries") ? deleteButton("entries", e.id) : ""}</div></article>`).join("")}</div>`
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
          lines = invoiceInstallments(d.entries, c, month);
        return `<section class="panel card-panel"><div class="credit-card cc-${i % 3}"><span>${esc(c.name)}</span>${icon("cards")}<strong>•••• &nbsp; •••• &nbsp; ••••</strong><small>${esc(names(c.owner_id))}</small></div><div class="invoice-stats"><div><span>Fatura prevista</span><strong>${brl(f.total)}</strong></div><div><span>A pagar</span><strong>${brl(f.remaining)}</strong></div></div><p class="fine">Fecha dia ${c.closing_day} · vence ${dueDate(
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
        )} · limite ${c.limit_cents === null ? "não informado" : brl(c.limit_cents)}</p><p class="fine">Competência ${month.split("-").reverse().join("/")} · ciclo definido pelo fechamento dia ${c.closing_day} · vencimento acima. ${own(c) ? "Compras feitas após o fechamento entram na competência seguinte." : "Os valores mostram somente compras visíveis."}</p><div class="button-row">${share("cards", c)}${own(c) && api.allowed("payments") ? button("card-payment", "Registrar pagamento", "secondary", `data-id="${c.id}"`) : ""}${own(c) && api.allowed("cards") ? deleteButton("cards", c.id) : ""}</div><details><summary>${lines.length} parcela(s) nesta fatura</summary>${lines.length ? lines.map((line) => `<p class="detail-line">${esc(line.entry.description)} <strong>Parcela ${line.number}/${line.total} · ${brl(line.amount_cents)}</strong><small>Total da compra: ${brl(line.entry.amount_cents)}</small></p>`).join("") : '<p class="fine">Nenhuma parcela prevista para esta competência.</p>'}</details></section>`;
      })
      .join("") || empty("Cadastre seu primeiro cartão", "add-card")
  }</div>`;
}
function accounts() {
  const d = api.data!;
  return `<section class="page-intro"><div><h2>Cada conta, cada compromisso.</h2><p>Saldos conhecidos, transferências e pagamentos de principal.</p></div><div class="button-row">${api.allowed("cards") ? button("add-account", "Nova conta") : ""}${api.allowed("entries") ? button("add-debt", "Nova dívida", "secondary") : ""}</div></section><div class="card-grid">${d.accounts
    .map((a) => {
      const b = balance(d, a);
      return `<section class="panel"><span class="eyebrow">${esc(a.area === "business" ? "EMPRESA" : a.area === "household" ? "LAR" : "PESSOAL")}</span><h3>${esc(a.name)}</h3><strong class="large-number">${b === null ? "Saldo desconhecido" : brl(b)}</strong><p class="fine">${a.balance_date ? `Base em ${a.balance_date}. ${own(a) ? "Movimentos posteriores informados." : "Movimentos privados podem não estar incluídos."}` : "Informe saldo e data-base para calcular movimentos."}</p><div class="button-row">${share("accounts", a)}${own(a) && api.allowed("cards") ? deleteButton("accounts", a.id) : ""}</div></section>`;
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
const centsText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
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
  return `<article class="record task ${overdue ? "overdue" : ""}"><span class="record-icon" aria-hidden="true">${kind.emoji}</span><div class="record-info"><strong>${esc(t.title)}</strong><small>${esc(dueLabel(t))} · ${t.assignee_id ? esc(names(t.assignee_id)) : "Qualquer pessoa"}${t.repeat !== "none" ? ` · ${repeatLabels[t.repeat]}` : ""}</small>${t.notes ? `<small>${esc(t.notes)}</small>` : ""}</div><div class="record-actions">${button("task-done", icon("check") + " Feito", "secondary", `data-id="${t.id}" aria-label="Marcar ${esc(t.title)} como feita"`)}${button("edit-task", "Editar", "text-button", `data-id="${t.id}"`)}${removable ? deleteButton("tasks", t.id) : ""}</div></article>`;
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
function shopping() {
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
  return `<section class="page-intro"><div><h2>Compras com propósito.</h2><p>Monte a lista em casa e marque no mercado só o que entrou no carrinho.</p></div><div class="button-row">${api.allowed("shopping") ? `<label class="inline-select"><span>Sugerir para</span><select name="suggest_days">${[7, 14, 30].map((n) => opt(String(n), `${n} dias`, String(suggestDays))).join("")}</select></label>${button("generate-list", "✦ Sugerir lista")}${button("add-shopping", "Adicionar item", "secondary")}` : ""}${items.length ? button("share-list", "Enviar lista", "secondary") : ""}</div></section><div class="shopping-layout"><section class="panel"><div class="panel-title"><h3>Modo mercado</h3><span class="badge">${items.length} item(s)</span></div>${
    items.length
      ? `<form id="purchase-form"><p class="fine">Marque o que já está no carrinho. Ajuste quantidade e preço se mudaram. O que não for marcado continua na lista.</p>${list}<div class="cart-summary"><span>No carrinho: <strong id="cart-count">0</strong> item(s)</span><span>Soma dos itens: <strong id="cart-sum">${formatBrl(0)}</strong></span></div><div class="form-grid section-gap">${field("total", "Total pago no caixa (R$)", moneyInput("total", cartMeta.total))}${field("date", "Data da compra", input("date", "date", cartMeta.date || today(), "required"))}${field("account_id", "Conta utilizada", `<select name="account_id">${accountOptions(cartMeta.account)}</select>`, true)}</div><p class="fine" id="cart-diff" aria-live="polite"></p>${canBuy ? `<button class="primary full section-gap" type="submit">Concluir compra dos itens marcados</button>` : '<p class="fine">Concluir compra exige permissões de compras, despensa e lançamentos.</p>'}</form>`
      : empty("Sua próxima lista começa aqui", "add-shopping")
  }</section><aside class="panel shopping-aside"><span class="eyebrow">PLANEJE ANTES DE SAIR</span><h3>Estimativa da lista inteira</h3><strong class="large-number">${brl(estimate)}</strong><p>Ao concluir, o total pago vira uma única despesa do lar, os produtos marcados entram na despensa e o preço pago fica guardado para a próxima estimativa.</p><div class="insight"><span>✦</span><p>A sugestão completa o estoque para ${suggestDays} dias de consumo ou o mínimo definido, e explica o motivo de cada item.</p></div><p class="fine">Histórico: ${d.shopping.filter((s) => s.bought).length} item(s) comprado(s). Compra no cartão: registre como gasto em Dinheiro e use “Conferir” na despensa.</p></aside></div>`;
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
  const paid = parseMoney(total.value);
  const diff = root.querySelector<HTMLElement>("#cart-diff")!;
  diff.textContent = paid !== null && sum && paid !== sum
    ? `O total pago difere da soma dos itens em ${formatBrl(Math.abs(paid - sum))} (descontos, itens sem preço ou erro de digitação). Será registrado o total pago.`
    : "";
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
  return `<section class="page-intro"><div><h2>Uma família. Acessos diferentes.</h2><p>Seu espaço é pessoal. Compartilhe o que faz sentido.</p></div>${admin() ? button("add-member", "Criar usuário") : ""}</section><div class="hint-banner">${icon("family")}<div><strong>Privacidade desde o primeiro lançamento</strong><p>O administrador vê todos os registros. Cada membro vê seus próprios dados e o que foi compartilhado. Tipos de conta e áreas não concedem acesso.</p></div></div><div class="card-grid">${d.members
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
    category: "Mercado",
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
  )}${conditional("payment", field("payment", "Como pagou?", `<select name="payment">${opt("cash", "Pix, débito ou dinheiro", e.payment) + opt("card", "Cartão", e.payment)}</select>`))}${conditional("card", field("card_id", "Cartão", `<select name="card_id">${cardOptions(e.card_id)}</select>`))}${conditional("installment-basis", field("installment_basis", "Qual valor você tem?", `<select name="installment_basis">${opt("total", "Tenho o total da compra", "total") + opt("each", "Tenho o valor da parcela", "total")}</select>`))}<label><span id="amount-label">Valor (R$)</span>${moneyInput("amount", e.amount_cents ? (e.amount_cents / 100).toFixed(2).replace(".", ",") : "")}</label>${conditional("installments", field("installments", "Número de parcelas", input("installments", "number", e.installments, 'min="1" max="48" required')))}${field("description", "Descrição", input("description", "text", e.description || "", 'maxlength="160" placeholder="Ex.: compras da semana" required'), true)}${field("date", "Data da compra", input("date", "date", e.date, "required"))}${conditional("due-date", field("due_date", "Vencimento", input("due_date", "date", e.due_date || "")))}<details class="more-details wide" ${api.preferences.simple_mode ? "" : "open"}><summary>Mais detalhes</summary><div class="form-grid">${field("category", "Categoria", input("category", "text", e.category, 'list="categories" maxlength="80" required') + '<datalist id="categories">' + ["Mercado", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Salário", "Outros"].map((c) => `<option>${c}</option>`).join("") + "</datalist>")}${field(
    "area",
    "Área",
    `<select name="area">${[
      ["household", "Lar / família"],
      ["personal", "Pessoal"],
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
  ))}<p class="fine wide">O registro começa privado e pode ser compartilhado depois.</p>${formEnd("Salvar lançamento")}</form>`;
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
  return `<form id="task-form" class="form-grid">${input("id", "hidden", t?.id || "")}${templates}${field("title", "O que precisa ser feito", input("title", "text", t?.title || "", 'maxlength="120" required placeholder="Ex.: limpar o banheiro"'), true)}${field("assignee_id", "Quem faz", `<select name="assignee_id">${people}</select>`)}${field("due_date", "Quando", input("due_date", "date", t ? t.due_date || "" : today()))}${field("repeat", "Repetir", `<select name="repeat">${Object.entries(repeatLabels).map(([v, l]) => opt(v, l, t?.repeat || "none")).join("")}</select>`)}${field("kind", "Tipo", `<select name="kind">${Object.entries(taskKinds).map(([v, k]) => opt(v, `${k.emoji} ${k.label}`, t?.kind || "cleaning")).join("")}</select>`)}${field("notes", "Detalhes (opcional)", `<textarea name="notes" maxlength="500" rows="2">${esc(t?.notes || "")}</textarea>`, true)}<p class="fine wide">A rotina é compartilhada com todos da casa. Tarefas repetidas ganham a próxima data quando forem marcadas como feitas.</p>${formEnd(t ? "Salvar tarefa" : "Criar tarefa")}</form>`;
}
function modalContent() {
  const d = api.data!;
  const p = d.pantry.find((p) => p.id === editId),
    g = d.goals.find((g) => g.id === editId);
  switch (modal) {
    case "entry":
      return entryForm(editId ? d.entries.find((e) => e.id === editId) : {});
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
    case "debt-payment":
      return entryForm({
        kind: "debt_payment",
        debt_id: editId,
        description: "Pagamento de principal",
        category: "Dívidas",
      });
    case "card":
      return `<form id="card-form" class="form-grid">${field("name", "Nome do cartão", input("name", "text", "", 'maxlength="160" required'), true)}${field("limit", "Limite (R$, opcional)", moneyInput("limit"))}${field("closing_day", "Dia de fechamento", input("closing_day", "number", 10, 'min="1" max="31" required'))}${field("due_day", "Dia de vencimento", input("due_day", "number", 17, 'min="1" max="31" required'))}${formEnd()}</form>`;
    case "account":
      return `<form id="account-form" class="form-grid">${field("name", "Nome", input("name", "text", "", 'maxlength="160" required'), true)}${field("area", "Área", `<select name="area">${opt("personal", "Pessoal") + opt("household", "Lar") + opt("business", "Empresa")}</select>`)}${field("opening", "Saldo inicial (R$, opcional)", moneyInput("opening"))}${field("date", "Data-base do saldo", input("date", "date", today()))}<p class="fine wide">Em branco significa desconhecido. A base representa o saldo ao fim do dia informado.</p>${formEnd()}</form>`;
    case "debt":
      return `<form id="debt-form" class="form-grid">${field("name", "Descrição", input("name", "text", "", 'maxlength="160" required'), true)}${field("creditor", "Credor", input("creditor", "text", "", 'maxlength="160" required'))}${field("balance", "Principal devido (R$, opcional)", moneyInput("balance"))}${field("due_date", "Vencimento", input("due_date", "date"))}${field("area", "Área", `<select name="area">${opt("household", "Lar") + opt("personal", "Pessoal") + opt("business", "Empresa")}</select>`)}${formEnd()}</form>`;
    case "pantry":
      return pantryForm(p);
    case "pantry-move": {
      const stock = p ? forecast(p).stock : 0;
      return `<form id="move-form" class="form-grid">${input("id", "hidden", p?.id || "")}<p class="wide">${esc(p?.name)}: estimativa de hoje <strong>${formatQuantity(stock)} ${esc(p?.unit)}</strong>.</p>${field("quantity", moveKind === "lost" ? `Quanto foi perdido (${esc(p?.unit)})` : `Quanto foi usado (${esc(p?.unit)})`, input("quantity", "number", stock > 0 && stock < 1 ? formatQuantity(stock).replace(",", ".") : 1, 'min="0.01" step="0.01" inputmode="decimal" required'), true)}<p class="fine wide">${moveKind === "lost" ? "Perdas entram no total de desperdício do mês, pelo último preço conhecido." : "O uso desconta da estimativa de hoje. Para corrigir a quantidade real, use “Conferir”."}</p>${formEnd(moveKind === "lost" ? "Registrar perda" : "Registrar uso")}</form>`;
    }
    case "task":
      return taskForm(d.tasks.find((t) => t.id === editId));
    case "shopping":
      return `<form id="shopping-form" class="form-grid">${field("name", "Produto", input("name", "text", "", 'maxlength="151" required'), true)}${field("quantity", "Quantidade", input("quantity", "number", 1, 'min="0.01" step="0.01" required'))}${field("unit", "Unidade", input("unit", "text", "unidade", 'maxlength="20" required'))}${field("price", "Preço estimado por unidade (R$)", moneyInput("price"))}${formEnd()}</form>`;
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
    "card-payment": "Pagamento de fatura",
    "debt-payment": "Pagamento de principal",
    card: "Novo cartão",
    account: "Nova conta",
    debt: "Nova dívida",
    pantry: editId ? "Conferir produto" : "Novo produto",
    shopping: "Adicionar à lista",
    "pantry-move": moveKind === "lost" ? "Perdi ou venceu" : "Usei da despensa",
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
    entries,
    cards,
    accounts,
    pantry: house,
    shopping,
    planning,
    goals,
    documents,
    family,
    settings,
  };
  root.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" data-action="nav" data-page="overview"><span class="brand-mark">${icon("goals")}</span>Financeiro<span>360</span></a><span class="nav-label">NOSSA CASA</span><nav>${sidebarNav()}</nav><div class="sidebar-footer"><div class="avatar small">${esc(api.me.display_name.slice(0, 1))}</div><div><strong>${esc(api.me.display_name)}</strong><small>${admin() ? "Administrador" : "Membro da família"}</small></div><button type="button" data-action="logout" aria-label="Sair da conta">${icon("logout")}</button></div></aside><div class="main-shell"><header class="topbar"><div><span class="eyebrow">${esc(api.data.home.name.toLocaleUpperCase())}</span><h1>${esc(nav.find((x) => x[0] === page)?.[1])}</h1></div><div class="topbar-actions"><select class="mobile-more" name="navigate" aria-label="Abrir uma seção">${nav.map(([id, label]) => opt(id, label, page)).join("")}</select><label class="month-picker"><span>Mês</span><input type="month" name="month" value="${month}" aria-label="Mês de referência"></label>${button("toggle-values", pref.hide_values ? "Mostrar valores" : "Ocultar valores", "secondary desktop")}${button("reload", icon("check") + " Atualizar", "secondary desktop")}${api.allowed("entries") ? button("add-entry", icon("plus") + " Lançar", "primary") : ""}</div></header>${api.demo ? `<div class="demo-banner"><strong>Demonstração · dados fictícios e temporários</strong>${button("switch-demo", admin() ? "Ver como esposa" : "Ver como administrador", "text-button")}${button("logout", "Sair da demonstração", "text-button")}</div>` : ""}${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ""}${api.me.password_change_required ? `<div class="password-banner">Defina sua senha pessoal em Configurações. ${button("nav", "Trocar senha", "text-button", 'data-page="settings"')}</div>` : ""}<main class="content">${views[page]()}</main><nav class="mobile-nav">${nav
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
    if (b.dataset.house) houseTab = b.dataset.house;
    notice = "";
    modal = "";
    render();
    window.scrollTo(0, 0);
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
    "card-payment": "card-payment",
    "add-account": "account",
    "add-debt": "debt",
    "debt-payment": "debt-payment",
    "add-pantry": "pantry",
    "edit-pantry": "pantry",
    "add-shopping": "shopping",
    "add-goal": "goal",
    "edit-goal": "goal",
    "add-document": "document",
    "add-recurring": "recurring",
    "add-member": "member",
    "add-task": "task",
    "edit-task": "task",
    import: "import",
  };
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
      "Visibilidade atualizada.",
    );
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
root.addEventListener("change", (event) => {
  if ((event.target as HTMLInputElement).closest("#entry-form"))
    syncEntryForm();
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
    ["amount", "installments", "date"].includes(el.name)
  )
    syncEntryForm();
  if (el.closest("#purchase-form")) {
    syncCart();
    return;
  }
  if (el.name === "search" || el.name === "pantry_search") {
    const pos = el.selectionStart;
    if (el.name === "search") filter = el.value;
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
  const first = invoiceMonth(date, card.closing_day);
  const last = addMonths(first, count - 1);
  const schedule = Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    month: addMonths(first, index),
    amount: installmentAmount(total, count, index),
  }));
  preview.innerHTML = `<strong>Total da compra: ${brl(total)}</strong><span>Primeira competência pela regra atual: ${first}; última: ${last}.</span><ol>${schedule.map((item) => `<li><span>Parcela ${item.number}/${count} · ${item.month.split("-").reverse().join("/")}</span><strong>${brl(item.amount)}</strong></li>`).join("")}</ol>`;
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
      if (!ids.length) throw Error("Marque os produtos que estão no carrinho.");
      const lines = ids.map((id) => {
        const item = api.data!.shopping.find((s) => s.id === id);
        const quantity = Number(val(f, `qty-${id}`));
        const price = val(f, `price-${id}`) ? parseMoney(val(f, `price-${id}`)) : 0;
        if (!item || !(quantity > 0) || price === null)
          throw Error(`Confira quantidade e preço de ${item?.name || "um item"}.`);
        return { id, quantity, unit_cents: price };
      });
      await api.purchaseItems(lines, cash(f, "total"), val(f, "date"), val(f, "account_id") || null);
      cart.clear();
      Object.assign(cartMeta, { total: "", date: "", account: "" });
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
      });
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
