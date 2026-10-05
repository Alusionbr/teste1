import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "./demo.ts";
import {
  addDays,
  attention,
  dailyUseFromDuration,
  durationFromDailyUse,
  expiry,
  lineCents,
  nextDue,
  pantryStatus,
  shoppingGroups,
  shoppingText,
  suggestionReason,
  taskGroups,
  wasteThisMonth,
} from "./home.ts";
import { recommendations, roundUpHundredths, type Pantry, type Task } from "./model.ts";

const item = (over: Partial<Pantry> = {}): Pantry => ({
  id: "p", home_id: "h", name: "Arroz", unit: "kg", quantity: 4, minimum: 1, daily_use: 0,
  price_cents: 700, expires_on: null, updated_at: "2026-10-01T12:00:00Z", location: "kitchen", ...over,
});
const task = (over: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(), home_id: "h", title: "Tarefa", notes: "", kind: "other", assignee_id: null,
  due_date: null, repeat: "none", done_at: null, done_by: null, previous_id: null, created_by: "a",
  created_at: "2026-10-01T12:00:00Z", ...over,
});

test("duration in plain words converts to daily use and back", () => {
  assert.equal(dailyUseFromDuration(14), 0.0714);
  assert.equal(durationFromDailyUse(0.0714), 14);
  assert.equal(dailyUseFromDuration(0), 0);
  assert.equal(durationFromDailyUse(0), 0);
});

test("expiry levels and pantry status put the most urgent situation first", () => {
  assert.equal(expiry(item(), "2026-10-05"), null);
  assert.deepEqual(expiry(item({ expires_on: "2026-10-04" }), "2026-10-05")?.level, "expired");
  assert.equal(expiry(item({ expires_on: "2026-10-05" }), "2026-10-05")?.label, "Vence hoje");
  assert.equal(expiry(item({ expires_on: "2026-10-08" }), "2026-10-05")?.level, "soon");
  assert.equal(expiry(item({ expires_on: "2026-10-11" }), "2026-10-05")?.level, "week");
  assert.equal(pantryStatus(item({ quantity: 0 }), "2026-10-05").level, "out");
  assert.equal(pantryStatus(item({ expires_on: "2026-10-01" }), "2026-10-05").level, "expired");
  assert.equal(pantryStatus(item({ quantity: 1 }), "2026-10-05").level, "low");
  // 4 kg counted on the 1st, 0.5 kg/day: 2 kg left on the 5th, lasting 4 days.
  assert.equal(pantryStatus(item({ daily_use: 0.5 }), "2026-10-05").level, "low");
  assert.equal(pantryStatus(item(), "2026-10-05").level, "ok");
});

test("attention lists restock and expiring items, ignoring expired stock already finished", () => {
  const list = [
    item({ id: "a", quantity: 0, expires_on: "2026-10-06" }),
    item({ id: "b", expires_on: "2026-10-06" }),
    item({ id: "c" }),
  ];
  const result = attention(list, "2026-10-05");
  assert.deepEqual(result.restock.map((p) => p.id), ["a"]);
  assert.deepEqual(result.expiring.map((p) => p.id), ["b"]);
});

test("suggestion reasons explain why each product is on the list", () => {
  assert.equal(suggestionReason(item({ quantity: 0 }), "2026-10-05"), "acabou");
  assert.match(suggestionReason(item({ quantity: 1 }), "2026-10-05"), /abaixo do mínimo/);
  assert.match(suggestionReason(item({ quantity: 10, minimum: 1, daily_use: 1 }), "2026-10-05"), /6 dia/);
});

test("market list groups by storage place and shares as plain text", () => {
  const d = demoData();
  d.pantry[1].location = "fridge";
  const items = [
    { id: "1", home_id: "h", name: "Leite", pantry_id: d.pantry[1].id, quantity: 2, unit: "litro", estimate_cents: 599, bought: false },
    { id: "2", home_id: "h", name: "Pilhas", pantry_id: null, quantity: 1, unit: "pacote", estimate_cents: 0, bought: false },
    { id: "3", home_id: "h", name: "Arroz", pantry_id: d.pantry[0].id, quantity: 1.5, unit: "kg", estimate_cents: 650, bought: false },
  ];
  assert.deepEqual(shoppingGroups(items, d.pantry).map((g) => g.key), ["kitchen", "fridge", "other"]);
  const text = shoppingText(items, d.pantry, "Casa teste");
  assert.match(text, /Lista de compras — Casa teste/);
  assert.match(text, /☐ Arroz — 1,5 kg/);
  assert.ok(text.indexOf("Geladeira") < text.indexOf("Outros"));
  assert.equal(lineCents(1.5, 650), 975);
  assert.equal(lineCents(0.333, 1000), 333);
});

test("waste counts only losses of the chosen month", () => {
  const base = { home_id: "h", pantry_id: null, name: "x", actor_id: "a", quantity: 1 };
  const events = [
    { ...base, id: "1", kind: "lost" as const, value_cents: 500, created_at: "2026-10-02T10:00:00Z" },
    { ...base, id: "2", kind: "used" as const, value_cents: 0, created_at: "2026-10-02T10:00:00Z" },
    { ...base, id: "3", kind: "lost" as const, value_cents: 300, created_at: "2026-09-30T10:00:00Z" },
  ];
  assert.deepEqual(wasteThisMonth(events, "2026-10"), { count: 1, cents: 500 });
});

test("next occurrence counts from the completion day, matching the database rule", () => {
  assert.equal(nextDue("none", "2026-10-05"), null);
  assert.equal(nextDue("daily", "2026-12-31"), "2027-01-01");
  assert.equal(nextDue("weekly", "2026-10-05"), "2026-10-12");
  assert.equal(nextDue("biweekly", "2026-10-25"), "2026-11-08");
  assert.equal(nextDue("monthly", "2026-01-31"), "2026-02-28");
  assert.equal(nextDue("monthly", "2026-12-15"), "2027-01-15");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("tasks are grouped by urgency and filtered by person", () => {
  const list = [
    task({ title: "late", due_date: "2026-10-01", assignee_id: "ana" }),
    task({ title: "today", due_date: "2026-10-05" }),
    task({ title: "week", due_date: "2026-10-12" }),
    task({ title: "later", due_date: "2026-10-13" }),
    task({ title: "undated" }),
    task({ title: "done", due_date: "2026-10-01", done_at: "2026-10-04T10:00:00Z", done_by: "ana" }),
  ];
  const g = taskGroups(list, "2026-10-05");
  assert.deepEqual(
    [g.overdue, g.today, g.week, g.later, g.undated, g.done].map((x) => x.map((t) => t.title)),
    [["late"], ["today"], ["week"], ["later"], ["undated"], ["done"]],
  );
  assert.deepEqual(taskGroups(list, "2026-10-05", "ana").overdue.map((t) => t.title), ["late"]);
  assert.equal(taskGroups(list, "2026-10-05", "ana").today.length, 0);
  assert.equal(taskGroups(list, "2026-10-05", "none").today.length, 1);
});

test("suggested quantities round up without floating point noise", () => {
  assert.equal(roundUpHundredths(2.1 - 1.2), 0.9);
  assert.equal(roundUpHundredths(0.901), 0.91);
  const [suggestion] = recommendations([item({ quantity: 1.2, minimum: 2.1, updated_at: "2026-10-05T12:00:00Z" })], [], 14, "2026-10-05");
  assert.equal(suggestion.quantity, 0.9);
});
