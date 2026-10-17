import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "./demo.ts";
import type { CalendarEvent, Data, Entry, Task, Wish } from "./model.ts";
import { doneToday, focusQueue, parseSteps, timerLeft, timerText, wishState, wishSummary } from "./focus.ts";

const ME = "me";
function data(): Data {
  const d = demoData();
  d.entries = [];
  d.tasks = [];
  d.events = [];
  d.inbox = [];
  d.wishes = [];
  return d;
}
const bill = (over: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), home_id: "h", owner_id: ME, shared: false, description: "Luz", amount_cents: 1000, date: "2026-10-01",
  due_date: "2026-10-17", kind: "expense", category: "Moradia", area: "household", status: "pending", payment: "cash", card_id: null,
  account_id: null, target_account_id: null, debt_id: null, installments: 1, invoice_month: null, source_ref: null, ...over,
});
const task = (over: Partial<Task>): Task => ({
  id: crypto.randomUUID(), home_id: "h", title: "Tarefa", notes: "", kind: "other", assignee_id: ME, due_date: "2026-10-17",
  repeat: "none", done_at: null, done_by: null, previous_id: null, created_by: ME, created_at: "", ...over,
});
const wish = (over: Partial<Wish>): Wish => ({
  id: crypto.randomUUID(), home_id: "h", owner_id: ME, name: "Fone", price_cents: 20000, link: "", wait_until: "2026-10-17",
  decision: null, decided_at: null, shared: false, created_at: "", ...over,
});

test("one thing at a time, in the order that avoids the worst consequence", () => {
  const d = data();
  const now = new Date("2026-10-17T10:00:00");
  d.wishes.push(wish({}));
  d.inbox.push({ id: "n1", home_id: "h", owner_id: ME, text: "Ligar para a escola", created_at: "2026-10-16T09:00:00Z", done_at: null });
  d.tasks.push(task({ id: "t1", title: "Lavar roupa", due_date: "2026-10-15", steps: [{ text: "Separar", done: true }, { text: "Ligar máquina", done: false }] }));
  d.tasks.push(task({ title: "De outra pessoa", assignee_id: "bia" }));
  d.events.push({ id: "e1", home_id: "h", owner_id: ME, title: "Dentista", notes: "", day: "2026-10-17", start_time: "11:30", end_time: null, place: "",
    visibility: "private", people: [], repeat: "none", repeat_until: null, remind_minutes: null, created_at: "" } as CalendarEvent);
  d.entries.push(bill({ id: "b1" }), bill({ due_date: "2026-10-20" }), bill({ owner_id: "bia" }));
  const q = focusQueue(d, ME, now, "2026-10-17");
  assert.deepEqual(q.map((i) => i.kind), ["bill", "event", "task", "inbox", "wish"]);
  assert.equal(q[0].why, "Vence hoje");
  assert.equal(q[1].why, "Começa em 1 h 30 min");
  assert.equal(q[2].why, "Atrasada 2 dia(s) · 1/2 passos");
  // Pular esconde só aquele item; o próximo assume o lugar.
  assert.equal(focusQueue(d, ME, now, "2026-10-17", new Set(["bill:b1"]))[0].kind, "event");
  // Compromisso que já passou há mais de 10 minutos sai da fila.
  assert.ok(!focusQueue(d, ME, new Date("2026-10-17T11:45:00"), "2026-10-17").some((i) => i.kind === "event"));
});

test("done today counts tasks and organized notes without streaks", () => {
  const d = data();
  d.tasks.push(task({ done_at: "2026-10-17T13:00:00", done_by: ME }), task({ done_at: "2026-10-16T13:00:00", done_by: ME }));
  d.inbox.push({ id: "n", home_id: "h", owner_id: ME, text: "x", created_at: "", done_at: "2026-10-17T09:00:00" });
  assert.equal(doneToday(d, ME, "2026-10-17"), 2);
});

test("wishes wait, become ready and count what was not spent", () => {
  const list = [wish({ wait_until: "2026-10-20" }), wish({}), wish({ decision: "gave_up", price_cents: 15000 }), wish({ decision: "bought" })];
  assert.equal(wishState(list[0], "2026-10-17"), "waiting");
  assert.equal(wishState(list[1], "2026-10-17"), "ready");
  const s = wishSummary(list, "2026-10-17");
  assert.equal(s.waiting.length, 1);
  assert.equal(s.ready.length, 1);
  assert.equal(s.decided.length, 2);
  assert.equal(s.savedCents, 15000);
});

test("timer and steps helpers", () => {
  assert.equal(timerLeft(10_000, 1_500), 9);
  assert.equal(timerLeft(10_000, 20_000), 0);
  assert.equal(timerText(905), "15:05");
  const steps = parseSteps("Separar roupa\n\n  Ligar máquina \nEstender", [{ text: "Separar roupa", done: true }]);
  assert.deepEqual(steps, [{ text: "Separar roupa", done: true }, { text: "Ligar máquina", done: false }, { text: "Estender", done: false }]);
  assert.equal(parseSteps(Array.from({ length: 30 }, (_, i) => `p${i}`).join("\n")).length, 20);
});
