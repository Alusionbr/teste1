import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "./demo.ts";
import type { CalendarEvent, Data, Entry, Task } from "./model.ts";
import { agendaItems, dueReminders, foldLine, monthGrid, occurrences, toIcs } from "./agenda.ts";

const ev = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e1", home_id: "h", owner_id: "me", title: "Dentista", notes: "", day: "2026-10-17", start_time: "14:30:00",
  end_time: null, place: "", visibility: "private", people: [], repeat: "none", repeat_until: null, remind_minutes: null,
  created_at: "2026-10-01T10:00:00Z", ...over,
});
function data(): Data {
  const d = demoData();
  d.members = [
    { ...d.members[0], user_id: "me", display_name: "Ana" },
    { ...d.members[1], user_id: "bia", display_name: "Bia" },
  ];
  d.entries = [];
  d.cards = [];
  d.tasks = [];
  d.events = [];
  d.busy = [];
  return d;
}

test("repetitions keep the original day and stop at the end date", () => {
  assert.deepEqual(occurrences(ev({ repeat: "monthly", day: "2026-01-31" }), "2026-01-01", "2026-04-30"),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(occurrences(ev({ repeat: "weekly", day: "2026-10-01" }), "2026-10-10", "2026-10-31"), ["2026-10-15", "2026-10-22", "2026-10-29"]);
  assert.deepEqual(occurrences(ev({ repeat: "daily", day: "2026-10-01", repeat_until: "2026-10-03" }), "2026-09-01", "2026-12-31"),
    ["2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.deepEqual(occurrences(ev({ repeat: "yearly", day: "2024-02-29" }), "2025-01-01", "2028-12-31"), ["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  assert.deepEqual(occurrences(ev(), "2026-10-18", "2026-10-30"), []);
});

test("the day view joins events, tasks, bills and invoices, with overdue items on today", () => {
  const d = data();
  d.events.push(ev(), ev({ id: "e2", owner_id: "bia", title: "Reunião escolar", visibility: "home", start_time: "08:00", people: ["me"] }));
  d.busy.push({ id: "b1", owner_id: "bia", day: "2026-10-17", start_time: "18:00", end_time: "19:00", repeat: "none", repeat_until: null });
  d.tasks.push({ id: "t1", home_id: "h", title: "Lixo", notes: "", kind: "cleaning", assignee_id: "me", due_date: "2026-10-15", repeat: "none",
    done_at: null, done_by: null, previous_id: null, created_by: "bia", created_at: "" } as Task);
  d.entries.push({ id: "x", home_id: "h", owner_id: "me", shared: false, description: "Luz", amount_cents: 12000, date: "2026-10-01",
    due_date: "2026-10-17", kind: "expense", category: "Moradia", area: "household", status: "pending", payment: "cash", card_id: null,
    account_id: null, target_account_id: null, debt_id: null, installments: 1, invoice_month: null, source_ref: null } as Entry);
  d.cards.push({ id: "c", home_id: "h", owner_id: "me", shared: false, name: "Nubank", limit_cents: null, closing_day: 10, due_day: 17 });
  d.entries.push({ ...d.entries[0], id: "y", description: "Livro", status: "paid", payment: "card", card_id: "c", date: "2026-10-05", due_date: null, amount_cents: 5000 });
  const items = agendaItems(d, "2026-10-17", "2026-10-17", "me");
  assert.deepEqual(items.map((i) => i.kind), ["bill", "invoice", "task", "event", "event", "busy"]);
  assert.equal(items.find((i) => i.kind === "task")!.detail, "Atrasada desde 15/10/2026");
  assert.equal(items.find((i) => i.kind === "busy")!.title, "Bia ocupado(a)");
  assert.equal(items.find((i) => i.kind === "invoice")!.cents, 5000);
  // "Só meus": a reunião entra porque a pessoa é participante.
  assert.deepEqual(agendaItems(d, "2026-10-17", "2026-10-17", "me", "mine").map((i) => i.title),
    ["Pagar: Luz", "Fatura Nubank", "Lixo", "Reunião escolar", "Dentista"]);
  assert.deepEqual(agendaItems(d, "2026-10-17", "2026-10-17", "me", "home").map((i) => i.kind), ["task", "event", "busy"]);
  // Fora de hoje, atrasados não são repetidos em outros dias.
  assert.equal(agendaItems(d, "2026-10-18", "2026-10-20", "me", "all", "2026-10-17").length, 0);
});

test("month grid starts on Sunday and covers the whole month", () => {
  const weeks = monthGrid("2026-10");
  assert.equal(weeks[0][0].date, "2026-09-27");
  assert.equal(weeks[0][4].date, "2026-10-01");
  assert.ok(weeks.at(-1)!.some((d) => d.date === "2026-10-31"));
  assert.equal(monthGrid("2026-02").length, 4);
});

test("reminders fire inside the warning window and only once", () => {
  const e = ev({ remind_minutes: 30, start_time: "14:30" });
  assert.equal(dueReminders([e], new Date("2026-10-17T13:59:00"), new Set()).length, 0);
  const [r] = dueReminders([e], new Date("2026-10-17T14:05:00"), new Set());
  assert.equal(r.minutes, 25);
  assert.equal(dueReminders([e], new Date("2026-10-17T14:05:00"), new Set([r.key])).length, 0);
  assert.equal(dueReminders([e], new Date("2026-10-17T15:00:00"), new Set()).length, 0);
});

test("ics export escapes text, folds long lines and keeps the app repeat rule", () => {
  const ics = toIcs([
    ev({ title: "Consulta; retorno, sala 2", notes: "Levar exames\nE a carteirinha", place: "Clínica São José", remind_minutes: 30,
      end_time: "15:15", repeat: "monthly", day: "2026-10-31", repeat_until: "2027-03-31" }),
    ev({ id: "e2", title: "Aniversário da vó", start_time: null, visibility: "home", repeat: "yearly" }),
  ], new Date("2026-10-17T12:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /SUMMARY:Consulta\\; retorno\\, sala 2\r\n/);
  assert.match(ics, /DESCRIPTION:Levar exames\\nE a carteirinha/);
  assert.match(ics, /DTSTART:20261031T143000\r\nDTEND:20261031T151500/);
  assert.match(ics, /RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1;UNTIL=20270331T235959/);
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /CLASS:PRIVATE/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261017\r\nDTEND;VALUE=DATE:20261018/);
  assert.match(ics, /UID:e2@financeiro360\r\nDTSTAMP:20261017T120000Z/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const folded = foldLine("DESCRIPTION:" + "ção".repeat(40));
  assert.equal(folded.split("\r\n ").join(""), "DESCRIPTION:" + "ção".repeat(40));
});
