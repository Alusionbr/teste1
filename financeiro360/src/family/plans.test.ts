import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "./demo.ts";
import type { Data, Entry } from "./model.ts";
import {
  activeInstallments,
  averageIncome,
  cardLimitUse,
  carneSchedule,
  commitments,
  freedUp,
  monthLabel,
  simulatePurchase,
} from "./plans.ts";

const entry = (over: Partial<Entry>): Entry => ({
  id: crypto.randomUUID(), home_id: "h", owner_id: "a", shared: false, description: "Compra", amount_cents: 1000,
  date: "2026-10-05", due_date: null, kind: "expense", category: "Outros", area: "household", status: "paid",
  payment: "cash", card_id: null, account_id: null, target_account_id: null, debt_id: null, installments: 1,
  invoice_month: null, source_ref: null, ...over,
});
function base(): Data {
  const d = demoData();
  d.entries = [];
  d.recurring = [];
  d.cards = [{ id: "c1", home_id: "h", owner_id: "a", shared: false, name: "Nubank", limit_cents: 500000, closing_day: 10, due_day: 17 }];
  return d;
}

test("active card installments show remaining value with exact cents", () => {
  const d = base();
  // R$ 100,00 em 3x: 33,34 + 33,33 + 33,33. Comprada dia 05/10, antes do fechamento: faturas out, nov, dez.
  d.entries.push(entry({ id: "tv", description: "TV", amount_cents: 10000, payment: "card", card_id: "c1", installments: 3 }));
  const [plan] = activeInstallments(d, "2026-11");
  assert.equal(plan.paidCount, 1);
  assert.equal(plan.remainingCount, 2);
  assert.equal(plan.remainingCents, 6666);
  assert.equal(plan.nextCents, 3333);
  assert.equal(plan.lastMonth, "2026-12");
  assert.equal(activeInstallments(d, "2027-01").length, 0, "finished plans leave the list");
  // Compra depois do fechamento começa na fatura seguinte; virada de ano.
  d.entries.push(entry({ description: "Sofá", amount_cents: 12000, payment: "card", card_id: "c1", installments: 4, date: "2026-11-25" }));
  const sofa = activeInstallments(d, "2026-12").find((p) => p.description === "Sofá")!;
  assert.equal(sofa.firstMonth, "2026-12");
  assert.equal(sofa.lastMonth, "2027-03");
  assert.equal(sofa.remainingCents, 12000);
});

test("a purchase keeps its frozen first invoice even if the card closing day changes", () => {
  const d = base();
  // Fechamento mudou de 10 para 25: a compra de 20/10 hoje cairia em out, mas foi congelada em nov.
  d.cards[0].closing_day = 25;
  d.entries.push(entry({ description: "Notebook", amount_cents: 9000, payment: "card", card_id: "c1", installments: 3, date: "2026-10-20", first_invoice_month: "2026-11" }));
  const [plan] = activeInstallments(d, "2026-10");
  assert.equal(plan.firstMonth, "2026-11");
  assert.equal(plan.lastMonth, "2027-01");
  assert.equal(commitments(d, "2026-10", 1)[0].card, 0);
  assert.equal(commitments(d, "2026-11", 1)[0].card, 3000);
});

test("commitments follow the aligned invoice total and discount what was already paid", () => {
  const d = base();
  d.entries.push(entry({ amount_cents: 10000, payment: "card", card_id: "c1", installments: 2 }));
  d.invoice_alignments = [{ id: "a1", home_id: "h", owner_id: "a", card_id: "c1", invoice_month: "2026-10", cutoff_on: "2026-10-05",
    total_cents: 80000, note: "", active: true, created_at: "" }];
  assert.equal(commitments(d, "2026-10", 1)[0].card, 80000, "uses the real invoice total informed by the bank");
  d.entries.push(entry({ kind: "card_payment", amount_cents: 30000, card_id: "c1", invoice_month: "2026-10" }));
  assert.equal(commitments(d, "2026-10", 1)[0].card, 50000);
});

test("entries under review and single purchases are not installment plans", () => {
  const d = base();
  d.entries.push(entry({ payment: "card", card_id: "c1", installments: 1 }));
  d.entries.push(entry({ payment: "card", card_id: "c1", installments: 5, status: "pending_review" }));
  assert.equal(activeInstallments(d, "2026-10").length, 0);
});

test("carnê schedule clamps the due day to the end of short months and keeps the exact total", () => {
  const rows = carneSchedule({ description: "Geladeira", total: 100000, count: 3, firstDue: "2027-01-31" });
  assert.deepEqual(rows.map((r) => r.due_date), ["2027-01-31", "2027-02-28", "2027-03-31"]);
  assert.deepEqual(rows.map((r) => r.description), ["Geladeira (1/3)", "Geladeira (2/3)", "Geladeira (3/3)"]);
  assert.equal(rows.reduce((s, r) => s + r.amount_cents, 0), 100000);
  assert.equal(rows[0].amount_cents, 33334);
});

test("carnê plans are grouped and count only open installments", () => {
  const d = base();
  const rows = carneSchedule({ description: "Geladeira", total: 90000, count: 3, firstDue: "2026-10-20" });
  rows.forEach((r, i) =>
    d.entries.push(entry({ ...r, date: "2026-10-01", status: i === 0 ? "paid" : "pending", source_ref: "parc:g1", category: "Casa" })));
  const [plan] = activeInstallments(d, "2026-10");
  assert.equal(plan.kind, "carne");
  assert.equal(plan.description, "Geladeira");
  assert.equal(plan.count, 3);
  assert.equal(plan.paidCount, 1);
  assert.equal(plan.remainingCents, 60000);
  assert.equal(plan.lastMonth, "2026-12");
});

test("commitments add card invoices, open bills and fixed bills not yet generated", () => {
  const d = base();
  d.entries.push(entry({ amount_cents: 10000, payment: "card", card_id: "c1", installments: 2 }));
  d.entries.push(entry({ amount_cents: 5000, status: "pending", due_date: "2026-11-10" }));
  d.entries.push(entry({ amount_cents: 7000, status: "paid", due_date: "2026-11-10" }));
  d.recurring.push({ id: "r1", home_id: "h", owner_id: "a", shared: false, name: "Internet", amount_cents: 9990, category: "Moradia", area: "household", day: 5, start_month: "2026-11" });
  // A conta da internet de dezembro já foi gerada: não pode contar duas vezes.
  d.entries.push(entry({ amount_cents: 9990, status: "pending", due_date: "2026-12-05", source_ref: "recurring:r1:2026-12" }));
  const [oct, nov, dec] = commitments(d, "2026-10", 3);
  assert.deepEqual(oct, { month: "2026-10", card: 5000, bills: 0, fixed: 0, total: 5000 });
  assert.deepEqual(nov, { month: "2026-11", card: 5000, bills: 5000, fixed: 9990, total: 19990 });
  assert.deepEqual(dec, { month: "2026-12", card: 0, bills: 9990, fixed: 0, total: 9990 });
});

test("ending plans free a monthly amount from the following month", () => {
  const d = base();
  d.entries.push(entry({ amount_cents: 10000, payment: "card", card_id: "c1", installments: 2 }));
  const [freed] = freedUp(activeInstallments(d, "2026-10"), "2026-10");
  assert.equal(freed.from, "2026-12");
  assert.equal(freed.cents, 5000);
  assert.equal(monthLabel("2026-12"), "dez/2026");
});

test("estimated card limit subtracts unpaid installments", () => {
  const d = base();
  d.entries.push(entry({ amount_cents: 30000, payment: "card", card_id: "c1", installments: 3 }));
  d.entries.push(entry({ amount_cents: 2000, payment: "card", card_id: "c1" }));
  assert.deepEqual(cardLimitUse(d, d.cards[0], "2026-10"), { used: 32000, available: 468000, limit: 500000 });
  d.entries.push(entry({ kind: "card_payment", amount_cents: 12000, card_id: "c1", invoice_month: "2026-10" }));
  assert.equal(cardLimitUse(d, d.cards[0], "2026-10").used, 20000);
  d.cards[0].limit_cents = null;
  assert.equal(cardLimitUse(d, d.cards[0], "2026-10").available, null);
});

test("purchase simulation compares each month with the average recorded income", () => {
  const d = base();
  const card = d.cards[0];
  assert.equal(averageIncome(d, "2026-10"), null);
  const empty = simulatePurchase(d, { total: 30000, count: 3, card, date: "2026-10-12" }, "2026-10");
  assert.equal(empty.peakShare, null, "without income the simulator does not judge");
  assert.deepEqual(empty.rows.map((r) => r.month), ["2026-11", "2026-12", "2027-01"]);
  d.entries.push(entry({ kind: "income", amount_cents: 400000, date: "2026-09-05" }));
  d.entries.push(entry({ kind: "income", amount_cents: 200000, date: "2026-08-05" }));
  d.entries.push(entry({ amount_cents: 20000, payment: "card", card_id: "c1", installments: 2, date: "2026-10-12" }));
  assert.deepEqual(averageIncome(d, "2026-10"), { cents: 300000, months: 2 });
  const sim = simulatePurchase(d, { total: 30000, count: 3, card, date: "2026-10-12" }, "2026-10");
  assert.deepEqual(sim.rows[0], { month: "2026-11", existing: 10000, added: 10000, total: 20000 });
  assert.equal(sim.peakShare, 0.07);
});
