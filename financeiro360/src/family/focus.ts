// Foco: escolhe UMA próxima coisa para fazer agora, com o motivo, para quem se perde em listas longas.
// Também cuida da lista de desejos com espera (evitar compra por impulso) e do temporizador visual.
import { addDays, daysBetween } from "./home.ts";
import { cleanTime, occurrences } from "./agenda.ts";
import type { Data, Wish } from "./model.ts";

export type FocusKind = "bill" | "event" | "task" | "inbox" | "wish";
export interface FocusItem {
  key: string;
  kind: FocusKind;
  id: string;
  title: string;
  why: string;
  // Ações possíveis: concluir (pagar, fazer, organizar, decidir) e adiar para amanhã.
  canSnooze: boolean;
}

const minutesUntil = (date: string, time: string, now: Date) =>
  Math.round((new Date(`${date}T${time}:00`).getTime() - now.getTime()) / 60000);

// Ordem: conta vencida/de hoje → compromisso nas próximas 2 h → minha tarefa atrasada/de hoje →
// anotação sem destino → desejo cuja espera acabou. "Pular" e "amanhã" escondem só nesta tela.
export function focusQueue(data: Data, userId: string, now: Date, today: string, hidden: Set<string> = new Set()): FocusItem[] {
  const out: FocusItem[] = [];
  const bills = data.entries
    .filter((e) => e.kind === "expense" && e.status === "pending" && e.owner_id === userId && (e.due_date || e.date) <= today)
    .sort((a, b) => (a.due_date || a.date).localeCompare(b.due_date || b.date));
  for (const e of bills) {
    const late = daysBetween(e.due_date || e.date, today);
    out.push({ key: `bill:${e.id}`, kind: "bill", id: e.id, title: `Pagar ${e.description}`,
      why: late > 0 ? `Venceu há ${late} dia(s)` : "Vence hoje", canSnooze: false });
  }
  const soon: { key: string; id: string; title: string; minutes: number }[] = [];
  for (const ev of data.events) {
    const time = cleanTime(ev.start_time);
    if (!time || !(ev.owner_id === userId || ev.people.includes(userId))) continue;
    for (const day of occurrences(ev, today, addDays(today, 1))) {
      const minutes = minutesUntil(day, time, now);
      if (minutes >= -10 && minutes <= 120) soon.push({ key: `event:${ev.id}:${day}`, id: ev.id, title: ev.title, minutes });
    }
  }
  for (const s of soon.sort((a, b) => a.minutes - b.minutes))
    out.push({ key: s.key, kind: "event", id: s.id, title: s.title,
      why: s.minutes <= 0 ? "Está começando agora" : s.minutes < 60 ? `Começa em ${s.minutes} min` : `Começa em ${Math.floor(s.minutes / 60)} h ${s.minutes % 60} min`,
      canSnooze: false });
  const tasks = data.tasks
    .filter((t) => !t.done_at && t.due_date && t.due_date <= today && t.assignee_id === userId)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  for (const t of tasks) {
    const late = daysBetween(t.due_date!, today);
    const steps = t.steps?.length ? ` · ${t.steps.filter((s) => s.done).length}/${t.steps.length} passos` : "";
    out.push({ key: `task:${t.id}`, kind: "task", id: t.id, title: t.title, why: (late > 0 ? `Atrasada ${late} dia(s)` : "Para hoje") + steps, canSnooze: true });
  }
  for (const n of data.inbox.filter((n) => !n.done_at && n.owner_id === userId).sort((a, b) => a.created_at.localeCompare(b.created_at)))
    out.push({ key: `inbox:${n.id}`, kind: "inbox", id: n.id, title: n.text, why: "Anotação esperando um destino", canSnooze: true });
  for (const w of data.wishes.filter((w) => w.owner_id === userId && wishState(w, today) === "ready"))
    out.push({ key: `wish:${w.id}`, kind: "wish", id: w.id, title: `Ainda quer ${w.name}?`, why: "A espera terminou: decida com calma", canSnooze: true });
  return out.filter((i) => !hidden.has(i.key));
}

// Quantas coisas a pessoa concluiu hoje (só contagem, sem sequência que pune quem falha).
export function doneToday(data: Data, userId: string, today: string) {
  return data.tasks.filter((t) => t.done_by === userId && t.done_at && localDay(t.done_at) === today).length +
    data.inbox.filter((n) => n.owner_id === userId && n.done_at && localDay(n.done_at) === today).length;
}
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Desejos: esperando → pronto para decidir → decidido. O valor de quem desistiu vira "deixou de gastar".
export const waitChoices = [
  [2, "2 dias"],
  [7, "1 semana"],
  [30, "1 mês"],
] as const;
export function wishState(w: Wish, today: string) {
  if (w.decision) return "decided" as const;
  return w.wait_until <= today ? ("ready" as const) : ("waiting" as const);
}
export function wishSummary(wishes: Wish[], today: string) {
  const mine = (state: string) => wishes.filter((w) => wishState(w, today) === state);
  const gaveUp = wishes.filter((w) => w.decision === "gave_up");
  return {
    waiting: mine("waiting"),
    ready: mine("ready"),
    decided: mine("decided"),
    savedCents: gaveUp.reduce((s, w) => s + w.price_cents, 0),
    gaveUpCount: gaveUp.length,
  };
}

// Temporizador visual: o fim é guardado como horário, então sobrevive a recarregar a tela.
export function timerLeft(endsAt: number, now: number) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
export const timerText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Passos de uma tarefa: um por linha, até 20, sem linhas vazias.
export function parseSteps(text: string, previous: { text: string; done: boolean }[] = []) {
  return text
    .split(/\r?\n/)
    .map((t) => t.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 20)
    .map((t) => ({ text: t, done: previous.find((p) => p.text === t)?.done || false }));
}
