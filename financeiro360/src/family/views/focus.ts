// Ferramentas de foco: "Agora" (uma coisa por vez), anotação rápida, organizar anotações,
// temporizador visual e lista de desejos com espera.
import { addDays, formatDate } from "../home.ts";
import { timerLeft, timerText, waitChoices, wishState, wishSummary, type FocusItem } from "../focus.ts";
import type { Data, InboxItem, Task, Wish } from "../model.ts";
import { brl, button, esc, field, formActions, icon, input, moneyInput, opt } from "../ui.ts";
import type { ViewCtx } from "./context.ts";

export interface TimerState {
  endsAt: number;
  total: number;
  label: string;
}

// Ação principal de cada tipo de item, com palavras de quem faz (não de sistema).
function mainActions(item: FocusItem, d: Data, ctx: ViewCtx) {
  switch (item.kind) {
    case "bill": {
      const e = d.entries.find((x) => x.id === item.id);
      return e && ctx.own(e) && ctx.api.allowed("payments") ? button("paid", icon("check") + " Já paguei", "primary big", `data-id="${item.id}"`) : "";
    }
    case "event":
      return button("focus-skip", "Ok, estou indo", "primary big", `data-id="${esc(item.key)}"`) + button("nav", "Ver na agenda", "secondary", 'data-page="agenda"');
    case "task":
      return button("task-done", icon("check") + " Feito", "primary big", `data-id="${item.id}"`) + button("timer-start", icon("timer") + " Começar 15 min", "secondary", `data-id="900" data-label="${esc(item.title)}"`);
    case "inbox":
      return button("triage", "Organizar", "primary big", `data-id="${item.id}"`) + button("note-done", "Já resolvi", "secondary", `data-id="${item.id}"`);
    case "wish":
      return button("wish-bought", "Ainda quero", "secondary", `data-id="${item.id}"`) + button("wish-gave-up", "Desisti", "primary big", `data-id="${item.id}"`) +
        button("wish-wait", "Esperar mais 7 dias", "text-button", `data-id="${item.id}"`);
  }
}

function stepsList(t: Task) {
  if (!t.steps?.length) return "";
  return `<ul class="steps">${t.steps
    .map((s, i) => `<li><label><input type="checkbox" data-action="step-toggle" data-id="${t.id}" data-step="${i}" ${s.done ? "checked" : ""}> <span>${esc(s.text)}</span></label></li>`)
    .join("")}</ul>`;
}

export function focusCard(queue: FocusItem[], ctx: ViewCtx, done: number, big: boolean) {
  const d = ctx.api.data!;
  const item = queue[0];
  if (!item)
    return `<section class="panel focus-card calm"><span class="eyebrow">AGORA</span><h2>Nada urgente agora.</h2><p>${done ? `Você já concluiu ${done} coisa(s) hoje. Pode respirar.` : "Quando lembrar de algo, toque em “Anotar” e siga em frente."}</p>${big ? "" : button("nav", "Abrir o modo foco", "text-button", 'data-page="focus"')}</section>`;
  const task = item.kind === "task" ? d.tasks.find((t) => t.id === item.id) : undefined;
  return `<section class="panel focus-card ${big ? "big" : ""}" aria-live="polite"><span class="eyebrow">AGORA · ${queue.length > 1 ? `mais ${queue.length - 1} depois` : "só isto"}</span><h2>${esc(item.title)}</h2><p class="focus-why">${esc(item.why)}</p>${task ? stepsList(task) : ""}<div class="button-row focus-actions">${mainActions(item, d, ctx)}</div><div class="button-row">${item.canSnooze ? button("focus-snooze", "Amanhã", "text-button", `data-id="${esc(item.key)}"`) : ""}${button("focus-skip", "Pular por agora", "text-button", `data-id="${esc(item.key)}"`)}${big ? "" : button("nav", "Modo foco", "text-button", 'data-page="focus"')}</div>${done ? `<p class="fine">✓ ${done} feita(s) hoje.</p>` : ""}</section>`;
}

export function timerWidget(t: TimerState | null) {
  if (!t)
    return `<section class="panel timer-panel"><h3>${icon("timer")} Temporizador</h3><p class="fine">Escolha um tempo curto e faça só uma coisa até ele acabar.</p><div class="button-row">${[5, 15, 25]
      .map((m) => button("timer-start", `${m} min`, "secondary", `data-id="${m * 60}" data-label="Foco de ${m} min"`))
      .join("")}</div></section>`;
  const left = timerLeft(t.endsAt, Date.now());
  const ratio = t.total ? left / t.total : 0;
  const r = 52,
    c = 2 * Math.PI * r;
  return `<section class="panel timer-panel running"><h3>${esc(t.label)}</h3><div class="timer-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="track"/><circle cx="60" cy="60" r="${r}" class="left" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - ratio)).toFixed(1)}" data-circ="${c.toFixed(1)}"/></svg><strong id="timer-left" role="timer" aria-live="off">${timerText(left)}</strong></div><div class="button-row">${button("timer-stop", "Parar", "secondary")}</div></section>`;
}

export function inboxList(items: InboxItem[]) {
  const open = items.filter((n) => !n.done_at);
  return `<section class="panel"><div class="panel-title"><h3>${icon("note")} Caixa de entrada</h3><span class="badge">${open.length}</span></div>${
    open.length
      ? `<div class="records">${open
          .map((n) => `<article class="record"><div class="record-info"><strong>${esc(n.text)}</strong><small>Anotado em ${new Date(n.created_at).toLocaleDateString("pt-BR")}</small></div><div class="record-actions">${button("triage", "Organizar", "secondary", `data-id="${n.id}"`)}${button("note-done", "Já resolvi", "text-button", `data-id="${n.id}"`)}${button("note-delete", "Apagar", "text-button danger", `data-id="${n.id}"`)}</div></article>`)
          .join("")}</div>`
      : '<p class="fine">Vazia. Tudo o que passar pela cabeça pode ir para o botão “Anotar”, sem precisar decidir na hora.</p>'
  }</section>`;
}

export function noteForm(ctx: ViewCtx) {
  return `<form id="note-form" class="form-grid">${field("text", "O que você não quer esquecer?", `<textarea name="text" maxlength="280" rows="3" required placeholder="Ex.: pagar a escola, comprar pilha, ligar para a mãe"></textarea>`, true)}<p class="fine wide">Só você vê. Depois, com calma, você decide se vira gasto, tarefa, compromisso ou item da lista.</p>${formActions("Guardar anotação", ctx.busy)}</form>`;
}

export function triageContent(n: InboxItem | undefined, ctx: ViewCtx) {
  if (!n) return '<p class="fine">Esta anotação não existe mais.</p>';
  const can = (cond: boolean, action: string, label: string, hint: string) =>
    cond ? `<button type="button" class="triage-option" data-action="${action}" data-id="${n.id}"><strong>${label}</strong><small>${hint}</small></button>` : "";
  return `<div class="triage"><p class="triage-text">“${esc(n.text)}”</p><div class="triage-grid">${can(ctx.api.allowed("entries"), "triage-entry", "💸 É um gasto ou conta", "Abre o lançamento já preenchido")}${can(true, "triage-event", "📅 É um compromisso", "Escolha dia e hora")}${can(ctx.api.householdReady, "triage-task", "🧹 É uma tarefa da casa", "Com responsável e prazo")}${can(ctx.api.allowed("shopping"), "triage-shopping", "🛒 É para comprar", "Vai para a lista de compras")}${can(true, "triage-wish", "⏳ É um desejo", "Esperar antes de comprar")}${can(true, "note-done", "✓ Já resolvi", "Sai da caixa de entrada")}</div><p class="fine">A anotação sai da caixa de entrada quando o destino for salvo.</p></div>`;
}

export function wishesSection(ctx: ViewCtx) {
  const d = ctx.api.data!;
  const s = wishSummary(d.wishes.filter((w) => w.owner_id === ctx.api.userId), ctx.today);
  const others = d.wishes.filter((w) => w.owner_id !== ctx.api.userId && !w.decision);
  const row = (w: Wish) => {
    const state = wishState(w, ctx.today);
    const actions = w.owner_id !== ctx.api.userId
      ? ""
      : state === "ready"
        ? button("wish-bought", "Ainda quero", "secondary", `data-id="${w.id}"`) + button("wish-gave-up", "Desisti", "secondary", `data-id="${w.id}"`) + button("wish-wait", "Mais 7 dias", "text-button", `data-id="${w.id}"`)
        : state === "waiting"
          ? button("wish-gave-up", "Desisti", "text-button", `data-id="${w.id}"`)
          : button("wish-delete", "Apagar", "text-button danger", `data-id="${w.id}"`);
    const when = state === "waiting" ? `Esperando até ${formatDate(w.wait_until)}` : state === "ready" ? "Espera concluída: ainda faz sentido?" : w.decision === "gave_up" ? "Desistiu" : "Comprou depois de esperar";
    return `<article class="record ${state === "ready" ? "ready" : ""}"><span class="record-icon">⏳</span><div class="record-info"><strong>${esc(w.name)}</strong><small>${when}${w.owner_id !== ctx.api.userId ? ` · ${esc(ctx.names(w.owner_id))}` : ""}${w.shared ? " · compartilhado" : ""}</small>${w.link ? `<small><a href="${esc(w.link)}" target="_blank" rel="noopener noreferrer">Ver produto</a></small>` : ""}</div><strong class="record-value">${w.price_cents ? brl(w.price_cents) : ""}</strong><div class="record-actions">${actions}</div></article>`;
  };
  const list = [...s.ready, ...s.waiting, ...others, ...s.decided.slice(0, 5)];
  return `<section class="panel section-gap"><div class="panel-title"><div><span class="eyebrow">ANTES DE COMPRAR</span><h3>Desejos em espera</h3></div>${button("add-wish", icon("plus") + " Quero comprar…", "secondary")}</div><p class="fine">Deu vontade de comprar? Guarde aqui e espere alguns dias. Se ainda fizer sentido depois, compre sem culpa.</p>${
    s.gaveUpCount ? `<div class="hint-banner">✦<div><strong>Você deixou de gastar ${brl(s.savedCents)}</strong><p>${s.gaveUpCount} desejo(s) que perderam a graça durante a espera.</p></div></div>` : ""
  }${list.length ? `<div class="records">${list.map(row).join("")}</div>` : ""}</section>`;
}

export function wishForm(ctx: ViewCtx, name = "") {
  return `<form id="wish-form" class="form-grid">${field("name", "O que você quer comprar", input("name", "text", name, 'maxlength="120" required'), true)}${field("price", "Preço (R$, opcional)", moneyInput("price"))}${field("wait", "Esperar", `<select name="wait">${waitChoices.map(([days, label]) => opt(String(days), label, "2")).join("")}</select>`)}${field("link", "Link (opcional)", input("link", "url", "", 'maxlength="300" placeholder="https://"'), true)}<label class="wide check"><input type="checkbox" name="shared"> Mostrar para a casa</label><p class="fine wide">Quando a espera acabar, o app pergunta se você ainda quer. Até lá, nada é lançado.</p>${formActions("Guardar desejo", ctx.busy)}</form>`;
}

export function focusPage(queue: FocusItem[], ctx: ViewCtx, done: number, timer: TimerState | null) {
  const d = ctx.api.data!;
  const later = queue.slice(1, 4);
  const local = !ctx.api.agendaReady && !ctx.api.demo
    ? `<div class="hint-banner">${icon("settings")}<div><strong>Anotações e desejos guardados só neste aparelho</strong><p>Funcionam normalmente; só não aparecem em outro celular até a atualização do banco.</p></div></div>`
    : "";
  return `<section class="page-intro"><div><h2>Uma coisa de cada vez.</h2><p>O app escolhe o próximo passo pela urgência. Você faz, adia ou pula, sem culpa.</p></div><div class="button-row">${button("add-note", icon("note") + " Anotar")}</div></section>${local}${focusCard(queue, ctx, done, true)}${
    later.length ? `<details class="panel"><summary>Depois disso (${queue.length - 1})</summary><ol class="later-list">${later.map((i) => `<li>${esc(i.title)} <small>${esc(i.why)}</small></li>`).join("")}</ol></details>` : ""
  }<div class="card-grid section-gap">${timerWidget(timer)}${inboxList(d.inbox)}</div>${wishesSection(ctx)}<p class="fine">Dicas: quebre tarefas grandes em passos (no formulário da tarefa), use o temporizador para começar e anote tudo o que interromper você. Nada aqui substitui orientação profissional.</p>`;
}
export const tomorrow = (today: string) => addDays(today, 1);
