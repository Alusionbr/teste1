// Tela da agenda: Hoje (ou o dia escolhido), Semana e Mês, e o formulário de compromisso.
import { agendaItems, cleanTime, monthGrid, reminderChoices, repeatNames, visibilityNames, weekday, weekdayNames, type AgendaFilter, type AgendaItem } from "../agenda.ts";
import { addDays, formatDate } from "../home.ts";
import type { CalendarEvent } from "../model.ts";
import { brl, button, esc, field, formActions, icon, input, opt, segmented } from "../ui.ts";
import type { ViewCtx } from "./context.ts";

export interface AgendaState {
  tab: "day" | "week" | "month";
  date: string;
  filter: AgendaFilter;
}
const kindIcon: Record<AgendaItem["kind"], string> = { event: "📅", busy: "⏳", task: "🧹", bill: "💸", invoice: "💳" };
const dayTitle = (date: string, today: string) =>
  date === today ? "Hoje" : date === addDays(today, 1) ? "Amanhã" : date === addDays(today, -1) ? "Ontem" : `${weekdayNames[weekday(date)]} · ${formatDate(date)}`;

function itemRow(i: AgendaItem, ctx: ViewCtx, compact = false) {
  const d = ctx.api.data!;
  let actions = "";
  if (i.kind === "event") {
    const e = d.events.find((x) => x.id === i.id);
    if (e && e.owner_id === ctx.api.userId) actions += button("edit-event", "Editar", "text-button", `data-id="${e.id}"`);
    actions += button("event-ics", "Pôr no calendário", "text-button", `data-id="${i.id}" aria-label="Baixar ${esc(i.title)} para o calendário do celular"`);
  } else if (i.kind === "task") actions = button("task-done", icon("check") + " Feito", "secondary", `data-id="${i.id}"`);
  else if (i.kind === "bill") {
    const e = d.entries.find((x) => x.id === i.id);
    if (e && ctx.own(e) && ctx.api.allowed("payments")) actions = button("paid", "Já paguei", "secondary", `data-id="${i.id}"`);
  } else if (i.kind === "invoice") actions = button("nav", "Ver fatura", "text-button", 'data-page="cards"');
  const time = i.time ? `${i.time}${i.end ? `–${i.end}` : ""}` : "Dia todo";
  const lock = i.kind === "event" && i.private ? ' <span class="badge private" title="Só você vê">só você</span>' : "";
  return `<article class="record agenda-item kind-${i.kind}"><span class="agenda-time">${esc(time)}</span><div class="record-info"><strong>${kindIcon[i.kind]} ${esc(i.title)}${lock}</strong>${i.detail && !compact ? `<small>${esc(i.detail)}</small>` : ""}</div>${i.cents !== null ? `<strong class="record-value">${brl(i.cents)}</strong>` : ""}${actions && !compact ? `<div class="record-actions">${actions}</div>` : ""}</article>`;
}

const startOfWeek = (date: string) => addDays(date, -weekday(date));

export function agendaView(ctx: ViewCtx, s: AgendaState, remindersOn: boolean) {
  const d = ctx.api.data!;
  const me = ctx.api.userId;
  const filters = `<div class="chips" role="group" aria-label="Filtrar agenda">${([["all", "Tudo"], ["mine", "Só meus"], ["home", "Da casa"]] as const)
    .map(([id, label]) => `<button type="button" class="chip ${s.filter === id ? "active" : ""}" aria-pressed="${s.filter === id}" data-action="agenda-filter" data-id="${id}">${label}</button>`)
    .join("")}</div>`;
  const nav = `<div class="agenda-nav">${button("agenda-move", icon("back"), "secondary icon-only", `data-id="-1" aria-label="Anterior"`)}<strong>${
    s.tab === "day" ? dayTitle(s.date, ctx.today) : s.tab === "week" ? `Semana de ${formatDate(startOfWeek(s.date))}` : monthName(s.date.slice(0, 7))
  }</strong>${button("agenda-move", icon("next"), "secondary icon-only", `data-id="1" aria-label="Próximo"`)}${s.date !== ctx.today ? button("agenda-today", "Hoje", "text-button") : ""}</div>`;
  let body = "";
  if (s.tab === "day") {
    const items = agendaItems(d, s.date, s.date, me, s.filter, ctx.today);
    body = items.length
      ? `<section class="panel"><div class="records">${items.map((i) => itemRow(i, ctx)).join("")}</div></section>`
      : ctx.empty(s.date === ctx.today ? "Dia livre por aqui" : "Nada marcado neste dia", "add-event");
  } else if (s.tab === "week") {
    const start = startOfWeek(s.date);
    const items = agendaItems(d, start, addDays(start, 6), me, s.filter, ctx.today);
    body = Array.from({ length: 7 }, (_, i) => addDays(start, i))
      .map((date) => {
        const list = items.filter((x) => x.date === date);
        return `<section class="panel agenda-day ${date === ctx.today ? "is-today" : ""}"><div class="panel-title"><h3>${dayTitle(date, ctx.today)}</h3>${button("agenda-open-day", "Abrir", "text-button", `data-id="${date}"`)}</div>${
          list.length ? `<div class="records">${list.map((x) => itemRow(x, ctx, true)).join("")}</div>` : '<p class="fine">Livre.</p>'
        }</section>`;
      })
      .join("");
  } else {
    const month = s.date.slice(0, 7);
    const weeks = monthGrid(month);
    const items = agendaItems(d, weeks[0][0].date, weeks[weeks.length - 1][6].date, me, s.filter, ctx.today);
    body = `<section class="panel"><div class="month-grid" role="grid" aria-label="${monthName(month)}"><div class="month-head" role="row">${weekdayNames.map((w) => `<span role="columnheader">${w}</span>`).join("")}</div>${weeks
      .map(
        (w) =>
          `<div class="month-week" role="row">${w
            .map(({ date, inMonth }) => {
              const list = items.filter((x) => x.date === date);
              return `<button type="button" role="gridcell" class="month-day ${inMonth ? "" : "outside"} ${date === ctx.today ? "is-today" : ""}" data-action="agenda-open-day" data-id="${date}" aria-label="${formatDate(date)}: ${list.length} item(s)"><span>${Number(date.slice(8))}</span><i>${list
                .slice(0, 4)
                .map((x) => `<b class="dot kind-${x.kind}"></b>`)
                .join("")}</i></button>`;
            })
            .join("")}</div>`,
      )
      .join("")}</div><div class="legend"><span><b class="dot kind-event"></b>Compromisso</span><span><b class="dot kind-task"></b>Tarefa</span><span><b class="dot kind-bill"></b>Conta</span><span><b class="dot kind-invoice"></b>Fatura</span><span><b class="dot kind-busy"></b>Ocupado</span></div></section>`;
  }
  const local = !ctx.api.agendaReady && !ctx.api.demo
    ? `<div class="hint-banner">${icon("settings")}<div><strong>Agenda guardada só neste aparelho</strong><p>Até a atualização do banco ser aplicada, seus compromissos não aparecem nos outros celulares da casa.</p></div></div>`
    : "";
  const notify = "Notification" in window
    ? remindersOn
      ? '<p class="fine">Avisos ligados neste aparelho enquanto o app estiver aberto.</p>'
      : button("enable-reminders", "Avisar neste aparelho", "text-button")
    : "";
  return `<section class="page-intro"><div><h2>O dia de todo mundo, num lugar só.</h2><p>Compromissos, tarefas, contas e faturas por data. O que é pessoal fica só com você.</p></div><div class="button-row">${button("add-event", icon("plus") + " Novo compromisso")}${button("week-ics", "Baixar a semana (.ics)", "secondary")}</div></section>${local}${segmented("agenda-tab", s.tab, [["day", "Dia"], ["week", "Semana"], ["month", "Mês"]], "Visão da agenda")}${nav}${filters}${body}<p class="fine">“Pôr no calendário” baixa um arquivo que o Google Agenda e o calendário do iPhone importam. Mudanças feitas depois aqui não atualizam a cópia do calendário. ${notify}</p>`;
}
export const monthName = (month: string) =>
  new Date(month + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export function eventForm(ctx: ViewCtx, e: Partial<CalendarEvent> | undefined, preset: Partial<CalendarEvent> = {}) {
  const v = { title: "", day: ctx.today, start_time: "", end_time: "", place: "", visibility: "private", people: [] as string[], repeat: "none",
    repeat_until: "", remind_minutes: 30 as number | null, notes: "", ...preset, ...(e || {}) };
  const members = ctx.api.data!.members.filter((m) => m.active);
  return `<form id="event-form" class="form-grid">${input("id", "hidden", e?.id || "")}${field("title", "O quê", input("title", "text", v.title, 'maxlength="120" required placeholder="Ex.: dentista da Ana"'), true)}${field("day", "Dia", input("day", "date", v.day, "required"))}${field("start_time", "Começa (vazio = dia todo)", input("start_time", "time", cleanTime(v.start_time) || ""))}${field("end_time", "Termina (opcional)", input("end_time", "time", cleanTime(v.end_time) || ""))}${field("place", "Onde (opcional)", input("place", "text", v.place, 'maxlength="120"'))}${field("visibility", "Quem pode ver", `<select name="visibility">${Object.entries(visibilityNames).map(([id, label]) => opt(id, label, v.visibility)).join("")}</select>`)}${field("remind", "Avisar", `<select name="remind">${reminderChoices.map(([m, label]) => opt(m === null ? "" : String(m), label, v.remind_minutes === null ? "" : String(v.remind_minutes))).join("")}</select>`)}${field("repeat", "Repetir", `<select name="repeat">${Object.entries(repeatNames).map(([id, label]) => opt(id, label, v.repeat)).join("")}</select>`)}${field("repeat_until", "Repetir até (opcional)", input("repeat_until", "date", v.repeat_until || ""))}<fieldset class="wide people-field" data-people><legend>Quem vai (só em compromisso da casa)</legend>${members
    .map((m) => `<label><input type="checkbox" name="people" value="${esc(m.user_id)}" ${v.people.includes(m.user_id) ? "checked" : ""}> ${esc(m.display_name)}</label>`)
    .join("")}</fieldset>${field("notes", "Detalhes (opcional)", `<textarea name="notes" maxlength="500" rows="2">${esc(v.notes)}</textarea>`, true)}<p class="fine wide">“Só eu”: ninguém mais vê, nem o administrador. “Ocupado”: os outros veem só o horário. “Toda a casa”: todos veem tudo.</p>${e?.id ? `<div class="wide">${button("delete-event", "Excluir compromisso", "text-button danger", `data-id="${e.id}"`)}</div>` : ""}${formActions(e?.id ? "Salvar compromisso" : "Criar compromisso", ctx.busy)}</form>`;
}
