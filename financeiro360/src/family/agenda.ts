// Agenda da casa: compromissos (pessoais ou da família) junto com tarefas, contas e faturas do dia.
// Datas e horas são locais da casa ("2026-10-17", "14:30"); hora vazia significa o dia todo.
import { addMonths, dueDate, recurrenceDate, validIsoDate } from "../logic.ts";
import { addDays, daysBetween } from "./home.ts";
import { invoice, type BusySlot, type CalendarEvent, type Data, type EventRepeat } from "./model.ts";

export const repeatNames: Record<EventRepeat, string> = {
  none: "Não repete",
  daily: "Todo dia",
  weekly: "Toda semana",
  monthly: "Todo mês",
  yearly: "Todo ano",
};
export const visibilityNames = {
  private: "Só eu",
  busy: "Os outros veem “ocupado”",
  home: "Toda a casa",
} as const;
export const reminderChoices = [
  [null, "Sem aviso"],
  [0, "Na hora"],
  [10, "10 minutos antes"],
  [30, "30 minutos antes"],
  [60, "1 hora antes"],
  [1440, "1 dia antes"],
] as const;
export const weekdayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const cleanTime = (t: string | null | undefined) => (t && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : null);
export const weekday = (date: string) => new Date(date + "T12:00:00Z").getUTCDay();

// Datas em que um compromisso acontece dentro do intervalo [from, to].
export function occurrences(e: Pick<CalendarEvent, "day" | "repeat" | "repeat_until">, from: string, to: string) {
  if (!validIsoDate(e.day)) return [];
  const until = e.repeat_until && e.repeat_until < to ? e.repeat_until : to;
  if (e.repeat === "none") return e.day >= from && e.day <= until ? [e.day] : [];
  const dates: string[] = [];
  if (e.repeat === "daily" || e.repeat === "weekly") {
    const step = e.repeat === "daily" ? 1 : 7;
    const gap = Math.max(0, daysBetween(e.day, from));
    let d = addDays(e.day, Math.ceil(gap / step) * step);
    for (; d <= until && dates.length < 400; d = addDays(d, step)) dates.push(d);
    return dates;
  }
  const day = Number(e.day.slice(8, 10));
  const startMonth = e.day.slice(0, 7);
  const every = e.repeat === "monthly" ? 1 : 12;
  // Anda mês a mês desde o início, mantendo o dia original (31 vira o último dia dos meses curtos).
  const fromMonth = from.slice(0, 7) > startMonth ? from.slice(0, 7) : startMonth;
  const offset = monthsBetween(startMonth, fromMonth);
  for (let i = Math.ceil(offset / every) * every; dates.length < 400; i += every) {
    const d = recurrenceDate(addMonths(startMonth, i), day);
    if (d > until) break;
    if (d >= from && d >= e.day) dates.push(d);
  }
  return dates;
}
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

export type AgendaKind = "event" | "busy" | "task" | "bill" | "invoice" | "reminder";
export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  id: string;
  date: string;
  time: string | null;
  end: string | null;
  title: string;
  detail: string;
  cents: number | null;
  // Pertence a quem está vendo (dono, participante ou responsável).
  mine: boolean;
  // Visível à casa inteira (compromisso da casa, tarefa, conta compartilhada).
  shared: boolean;
  private: boolean;
}
export type AgendaFilter = "all" | "mine" | "home";

export function agendaItems(data: Data, from: string, to: string, userId: string, filter: AgendaFilter = "all", today = from) {
  const name = (id: string) => data.members.find((m) => m.user_id === id)?.display_name || "Alguém";
  const items: AgendaItem[] = [];
  for (const e of data.events)
    for (const date of occurrences(e, from, to))
      items.push({
        key: `event:${e.id}:${date}`, kind: "event", id: e.id, date, time: cleanTime(e.start_time), end: cleanTime(e.end_time),
        title: e.title, detail: [e.place, e.owner_id !== userId ? name(e.owner_id) : ""].filter(Boolean).join(" · "), cents: null,
        mine: e.owner_id === userId || e.people.includes(userId), shared: e.visibility === "home", private: e.visibility !== "home",
      });
  for (const b of data.busy as BusySlot[])
    if (b.owner_id !== userId)
      for (const date of occurrences(b, from, to))
        items.push({ key: `busy:${b.id}:${date}`, kind: "busy", id: b.id, date, time: cleanTime(b.start_time), end: cleanTime(b.end_time),
          title: `${name(b.owner_id)} ocupado(a)`, detail: "Compromisso pessoal", cents: null, mine: false, shared: true, private: false });
  // Lembretes e vencimentos da casa (tela "Avisos e lembretes"): são de todos os membros e não têm hora.
  for (const r of data.reminders || []) {
    if (r.completed || r.kind === "post_it" || !r.due_on) continue;
    const repeat = r.recurrence === "once" ? "none" : r.recurrence;
    for (const date of occurrences({ day: r.due_on, repeat, repeat_until: null }, from, to))
      items.push({ key: `reminder:${r.id}:${date}`, kind: "reminder", id: r.id, date, time: null, end: null, title: r.title,
        detail: r.kind === "due_date" ? "Vencimento" : "Lembrete", cents: null, mine: r.owner_id === userId, shared: true, private: false });
  }
  for (const t of data.tasks)
    if (!t.done_at && t.due_date && t.due_date <= to && (t.due_date >= from || (from === today && t.due_date < today)))
      items.push({ key: `task:${t.id}`, kind: "task", id: t.id, date: t.due_date < from ? from : t.due_date, time: null, end: null,
        title: t.title, detail: t.due_date < from ? `Atrasada desde ${t.due_date.split("-").reverse().join("/")}` : t.assignee_id ? name(t.assignee_id) : "Qualquer pessoa",
        cents: null, mine: t.assignee_id === userId || (!t.assignee_id && t.created_by === userId), shared: true, private: false });
  for (const e of data.entries) {
    const due = e.due_date || e.date;
    if (e.status !== "pending" || e.kind !== "expense" || due > to || (due < from && !(from === today && due < today))) continue;
    items.push({ key: `bill:${e.id}`, kind: "bill", id: e.id, date: due < from ? from : due, time: null, end: null,
      title: `Pagar: ${e.description}`, detail: due < from ? `Venceu em ${due.split("-").reverse().join("/")}` : e.category, cents: e.amount_cents,
      mine: e.owner_id === userId, shared: e.shared, private: !e.shared });
  }
  // Faturas: vencimento de cada competência que cai no intervalo e ainda tem saldo a pagar.
  for (const c of data.cards)
    for (let m = addMonths(from.slice(0, 7), -1); m <= to.slice(0, 7); m = addMonths(m, 1)) {
      const date = dueDate(m, { id: c.id, name: c.name, owner: "wife", limitCents: c.limit_cents || 0, closingDay: c.closing_day, dueDay: c.due_day });
      if (date < from || date > to) continue;
      const left = invoice(data, c, m).remaining;
      if (left > 0)
        items.push({ key: `invoice:${c.id}:${m}`, kind: "invoice", id: c.id, date, time: null, end: null, title: `Fatura ${c.name}`,
          detail: `Competência ${m.split("-").reverse().join("/")}`, cents: left, mine: c.owner_id === userId, shared: c.shared, private: !c.shared });
    }
  const kept = items.filter((i) => filter === "all" || (filter === "mine" ? i.mine : i.shared));
  // No mesmo dia: primeiro o que vale o dia todo (contas, faturas, tarefas), depois por horário.
  const order: AgendaKind[] = ["bill", "invoice", "reminder", "task", "event", "busy"];
  return kept.sort((a, b) => a.date.localeCompare(b.date) || (a.time ? 1 : 0) - (b.time ? 1 : 0) || (a.time || "").localeCompare(b.time || "") ||
    order.indexOf(a.kind) - order.indexOf(b.kind) || a.title.localeCompare(b.title));
}

// Semanas do mês (domingo a sábado), com os dias de fora do mês para completar a grade.
export function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, -weekday(first));
  const weeks: { date: string; inMonth: boolean }[][] = [];
  for (let d = start; weeks.length < 6; ) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(d, i);
      return { date, inMonth: date.startsWith(month) };
    });
    weeks.push(week);
    d = addDays(d, 7);
    if (!d.startsWith(month)) break;
  }
  return weeks;
}

// Avisos com o app aberto: compromissos cujo horário de aviso já chegou e que ainda não começaram.
export function dueReminders(events: CalendarEvent[], now: Date, dismissed: Set<string>) {
  const date = localDate(now);
  const out: { key: string; event: CalendarEvent; date: string; minutes: number }[] = [];
  for (const e of events) {
    if (e.remind_minutes === null || e.remind_minutes === undefined) continue;
    for (const day of occurrences(e, addDays(date, -1), addDays(date, 1))) {
      const start = new Date(`${day}T${cleanTime(e.start_time) || "08:00"}:00`);
      const minutes = Math.round((start.getTime() - now.getTime()) / 60000);
      const key = `${e.id}:${day}`;
      if (minutes <= e.remind_minutes && minutes > -15 && !dismissed.has(key)) out.push({ key, event: e, date: day, minutes });
    }
  }
  return out;
}
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Arquivo .ics (RFC 5545) para importar no calendário do celular. Hora "flutuante": vale a hora local do aparelho.
const icsEscape = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (date: string) => date.replace(/-/g, "");
const stampOf = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Linhas com mais de 75 bytes continuam na linha seguinte, iniciada por espaço, sem partir caracteres.
export function foldLine(line: string) {
  const out: string[] = [];
  let current = "",
    size = 0;
  for (const ch of line) {
    const bytes = new TextEncoder().encode(ch).length;
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += bytes;
  }
  out.push(current);
  return out.join("\r\n ");
}
function rrule(e: CalendarEvent) {
  if (e.repeat === "none") return "";
  const day = Number(e.day.slice(8, 10));
  const until = e.repeat_until ? `;UNTIL=${compact(e.repeat_until)}${cleanTime(e.start_time) ? "T235959" : ""}` : "";
  // No app, o dia 31 vira o último dia dos meses curtos; no calendário isso exige BYSETPOS.
  if (e.repeat === "monthly" && day >= 29)
    return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${Array.from({ length: day - 27 }, (_, i) => 28 + i).join(",")};BYSETPOS=-1${until}`;
  if (e.repeat === "yearly" && e.day.slice(5) === "02-29") return `RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1${until}`;
  return `RRULE:FREQ=${e.repeat.toUpperCase()}${until}`;
}
export function toIcs(events: CalendarEvent[], now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Financeiro360//Agenda da casa//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    const start = cleanTime(e.start_time);
    const end = cleanTime(e.end_time);
    lines.push("BEGIN:VEVENT", `UID:${e.id}@financeiro360`, `DTSTAMP:${stampOf(now)}`);
    if (start) {
      lines.push(`DTSTART:${compact(e.day)}T${start.replace(":", "")}00`);
      const finish = end && end > start ? end : plusHour(start);
      lines.push(finish ? `DTEND:${compact(e.day)}T${finish.replace(":", "")}00` : `DURATION:PT1H`);
    } else lines.push(`DTSTART;VALUE=DATE:${compact(e.day)}`, `DTEND;VALUE=DATE:${compact(addDays(e.day, 1))}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.place) lines.push(`LOCATION:${icsEscape(e.place)}`);
    if (e.notes) lines.push(`DESCRIPTION:${icsEscape(e.notes)}`);
    if (e.visibility !== "home") lines.push("CLASS:PRIVATE");
    const rule = rrule(e);
    if (rule) lines.push(rule);
    if (e.remind_minutes !== null && e.remind_minutes !== undefined)
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title)}`, `TRIGGER:-PT${e.remind_minutes}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
// Uma hora depois, sem passar da meia-noite (nesse caso o calendário usa DURATION).
function plusHour(time: string) {
  const h = Number(time.slice(0, 2)) + 1;
  return h > 23 ? null : `${String(h).padStart(2, "0")}${time.slice(2)}`;
}
