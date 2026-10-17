import assert from "node:assert/strict";
import test from "node:test";
import type { Entry } from "./model.ts";
import { frequentEntries, parseQuick, type QuickContext } from "./quick.ts";

const entry = (over: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), home_id: "h", owner_id: "a", shared: false, description: "Compra", amount_cents: 1000,
  date: "2026-10-05", due_date: null, kind: "expense", category: "Outros", area: "household", status: "paid",
  payment: "cash", card_id: null, account_id: null, target_account_id: null, debt_id: null, installments: 1,
  invoice_month: null, source_ref: null, ...over,
});
const ctx = (over: Partial<QuickContext> = {}): QuickContext => ({
  cards: [{ id: "nu", name: "Nubank" }, { id: "it", name: "Itaú Click" }],
  accounts: [{ id: "cc", name: "Conta Inter" }],
  entries: [],
  today: "2026-10-17",
  ...over,
});

test("card purchase with installments in one line", () => {
  const d = parseQuick("mercado 52,30 nubank 3x", ctx());
  assert.equal(d.kind, "expense");
  assert.equal(d.description, "Mercado");
  assert.equal(d.amount_cents, 5230);
  assert.equal(d.payment, "card");
  assert.equal(d.card_id, "nu");
  assert.equal(d.installments, 3);
  assert.equal(d.category, "Mercado");
  assert.deepEqual(d.uncertain, []);
});

test("relative dates and keyword categories", () => {
  const d = parseQuick("Uber 18 ontem", ctx());
  assert.equal(d.date, "2026-10-16");
  assert.equal(d.amount_cents, 1800);
  assert.equal(d.description, "Uber");
  assert.equal(d.category, "Transporte");
  assert.equal(d.payment, "cash");
  assert.equal(parseQuick("farmácia 35 15/10", ctx()).date, "2026-10-15");
  // Sem ano e muito à frente: é do ano anterior.
  assert.equal(parseQuick("presente 80 20/12", ctx()).date, "2025-12-20");
});

test("income and bills to pay", () => {
  const income = parseQuick("recebi salário 3.500,00", ctx());
  assert.equal(income.kind, "income");
  assert.equal(income.amount_cents, 350000);
  assert.equal(income.description, "Salário");
  assert.equal(income.category, "Salário");
  const bill = parseQuick("luz 120 vence 10", ctx());
  assert.equal(bill.kind, "payable");
  assert.equal(bill.due_date, "2026-11-10", "day 10 already passed this month");
  assert.equal(bill.category, "Moradia");
  assert.equal(parseQuick("internet 99,90 vence dia 25", ctx()).due_date, "2026-10-25");
});

test("ambiguous or missing information is flagged instead of guessed", () => {
  const d = parseQuick("tênis 300 no cartão 2x", ctx());
  assert.equal(d.payment, "card");
  assert.equal(d.card_id, null);
  assert.ok(d.uncertain.includes("card"));
  assert.equal(d.description, "Tênis");
  assert.equal(parseQuick("tênis 300 cartão", ctx({ cards: [{ id: "nu", name: "Nubank" }] })).card_id, "nu");
  const blank = parseQuick("coisa", ctx());
  assert.equal(blank.amount_cents, null);
  assert.ok(blank.uncertain.includes("amount"));
  assert.ok(blank.uncertain.includes("category"));
  assert.ok(parseQuick("45", ctx()).uncertain.includes("description"));
  // Conta citada por nome em pagamento à vista.
  assert.equal(parseQuick("padaria 12 pix inter", ctx()).account_id, "cc");
  assert.equal(parseQuick("padaria 12 pix inter", ctx()).description, "Padaria");
});

test("history wins over keywords for the category", () => {
  const entries = [entry({ description: "Mercado do bairro", category: "Casa" }), entry({ description: "mercado", category: "Casa" })];
  assert.equal(parseQuick("mercado 20", ctx({ entries })).category, "Casa");
});

test("frequent entries need at least two uses in the last 90 days", () => {
  const rows = [
    entry({ description: "Padaria", date: "2026-10-10" }),
    entry({ description: "padaria", date: "2026-10-14", amount_cents: 1250 }),
    entry({ description: "Cinema", date: "2026-10-01" }),
    entry({ description: "Uber", date: "2026-05-01" }),
    entry({ description: "Uber", date: "2026-05-02" }),
    entry({ description: "Conta gerada", date: "2026-10-01", source_ref: "recurring:r:2026-10" }),
    entry({ description: "Conta gerada", date: "2026-10-02", source_ref: "recurring:r:2026-10" }),
  ];
  const list = frequentEntries(rows, "2026-10-17");
  assert.deepEqual(list.map((e) => e.amount_cents), [1250]);
});
