import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "./demo.ts";
import { addMonths, invoiceMonth } from "../logic.ts";
import {
  forecast,
  recommendations,
  invoice,
  invoiceInstallments,
  balance,
  metrics,
  financialOverview,
  monthPicture,
  validateEntry,
} from "./model.ts";
test("pantry forecast estimates consumption without mutating counted stock", () => {
  const p = demoData().pantry[0];
  p.quantity = 3;
  p.daily_use = 0.5;
  p.updated_at = "2026-10-01T12:00:00Z";
  assert.deepEqual(forecast(p, "2026-10-04"), { stock: 1.5, days: 3 });
  assert.equal(p.quantity, 3);
  p.daily_use = 0;
  assert.equal(forecast(p, "2026-10-04").days, null);
});
test("shopping suggestions avoid duplicates and restock consumption horizon", () => {
  const d = demoData();
  d.pantry[0].quantity = 0;
  d.pantry[0].daily_use = 0.5;
  const items = recommendations(d.pantry, [], 14);
  assert.equal(items.find((i) => i.p.id === d.pantry[0].id)!.quantity, 7);
  assert.equal(
    recommendations(d.pantry, [
      {
        id: "s",
        home_id: d.home.id,
        name: "Rice",
        pantry_id: d.pantry[0].id,
        quantity: 1,
        unit: "kg",
        estimate_cents: 0,
        bought: false,
      },
    ]).some((i) => i.p.id === d.pantry[0].id),
    false,
  );
});
test("card payment updates invoice and account without double counting expenses", () => {
  const d = demoData(),
    c = d.cards[0],
    date = d.entries[0].date,
    m = date.slice(0, 7);
  const before = metrics(d, m).spend;
  const f = invoice(d, c, m);
  const opening = balance(d, d.accounts[0]);
  d.entries.push({
    ...d.entries[0],
    id: "payment",
    kind: "card_payment",
    amount_cents: 10000,
    card_id: c.id,
    invoice_month: m,
    date: d.accounts[0].balance_date! + "",
    description: "Payment",
  });
  assert.equal(metrics(d, m).spend, before);
  assert.equal(invoice(d, c, m).paid, 10000);
  assert.equal(invoice(d, c, m).remaining, Math.max(0, f.total - 10000));
  assert.equal(balance(d, d.accounts[0]), opening);
});
test("invoice detail includes only the exact installment for the selected month", () => {
  const d = demoData();
  const card = d.cards[0];
  const purchase = {
    ...d.entries[0],
    id: "cent-installments",
    kind: "expense" as const,
    payment: "card" as const,
    card_id: card.id,
    date: "2026-12-01",
    amount_cents: 10001,
    installments: 3,
    status: "paid" as const,
  };
  d.entries = [purchase];
  const firstMonth = invoiceMonth(purchase.date, card.closing_day);
  const months = [firstMonth, addMonths(firstMonth, 1), addMonths(firstMonth, 2)];
  const lines = months.map((selected) => invoiceInstallments(d.entries, card, selected));
  assert.deepEqual(lines.map((monthLines) => monthLines.length), [1, 1, 1]);
  assert.deepEqual(lines.map(([line]) => line.number), [1, 2, 3]);
  assert.deepEqual(lines.map(([line]) => line.amount_cents), [3334, 3334, 3333]);
  assert.equal(lines.flat().reduce((sum, line) => sum + line.amount_cents, 0), 10001);
  assert.deepEqual(invoiceInstallments(d.entries, card, addMonths(firstMonth, 3)), []);
});

test("invoice detail ignores incomplete purchase dates", () => {
  const d = demoData();
  const card = d.cards[0];
  const purchase = d.entries.find((entry) => entry.payment === "card")!;
  assert.deepEqual(
    invoiceInstallments([{ ...purchase, date: "2026-" }], card, "2026-10"),
    [],
  );
});
test("reviewed entries alone enter totals; unknown opening balance remains unknown", () => {
  const d = demoData(),
    m = d.entries[0].date.slice(0, 7),
    before = metrics(d, m).spend;
  d.entries.push({
    ...d.entries[1],
    id: "pending",
    status: "pending_review",
    amount_cents: 50000,
  });
  assert.equal(metrics(d, m).spend, before);
  d.accounts[0].opening_cents = null;
  assert.equal(balance(d, d.accounts[0]), null);
});
test("transfer and card payment require valid targets", () => {
  const e = demoData().entries[0];
  assert.throws(() =>
    validateEntry({ ...e, kind: "transfer", target_account_id: e.account_id }),
  );
  assert.throws(() =>
    validateEntry({ ...e, kind: "card_payment", card_id: null }),
  );
  assert.throws(() => validateEntry({ ...e, installments: 49 }));
});

test("financial overview separates consumption from financial movements", () => {
  const d = demoData(),
    m = d.entries[0].date.slice(0, 7),
    account = d.accounts[0];
  const personalExpense = d.entries.find((e) => e.area === "personal" && e.kind === "expense")!;
  d.entries.push(
    {
      ...personalExpense,
      id: "business-expense",
      area: "business",
      amount_cents: 20000,
      description: "Business",
    },
    {
      ...personalExpense,
      id: "payment-flow",
      kind: "debt_payment",
      debt_id: "debt",
      area: "household",
      amount_cents: 30000,
      description: "Debt payment",
    },
    {
      ...personalExpense,
      id: "internal-flow",
      kind: "transfer",
      payment: "cash",
      account_id: account.id,
      target_account_id: "target",
      category: "Transferência interna",
      amount_cents: 40000,
      description: "Transfer",
    },
  );
  const o = financialOverview(d, m);
  assert.equal(o.business, 20000);
  assert.equal(o.payments, 30000);
  assert.equal(o.internalTransfers, 40000);
  assert.equal(o.spend, metrics(d, m).spend);
  assert.equal(o.result, o.income - o.spend);
});
test("monthly picture keeps purchases, due amounts and account outflows distinct", () => {
  const d = demoData();
  const card = d.cards[0];
  const base = d.entries[0];
  d.entries = [
    { ...base, id: "purchase", kind: "expense", payment: "card", card_id: card.id,
      date: "2026-12-11", due_date: null, amount_cents: 10001, installments: 1, status: "paid" },
    { ...base, id: "cash-pending", kind: "expense", payment: "cash", card_id: null,
      date: "2026-12-15", due_date: "2027-01-20", amount_cents: 1234, status: "pending" },
    { ...base, id: "settlement", kind: "card_payment", payment: "cash", card_id: card.id,
      invoice_month: "2027-01", date: "2027-01-05", amount_cents: 5000, status: "paid" },
    { ...base, id: "internal", kind: "transfer", payment: "cash", card_id: null,
      date: "2027-01-09", amount_cents: 2000, status: "paid" },
  ];
  assert.equal(monthPicture(d, "2026-12").purchased, 11235);
  assert.deepEqual(monthPicture(d, "2027-01"), {
    purchased: 0, cashDue: 1234, cardDue: 5001, due: 6235, cashOut: 5000,
  });
});


test("invoice closing boundary preserves current competence over year change", () => {
  const d = demoData(), card = { ...d.cards[0], closing_day: 20 };
  const base = { ...d.entries[0], kind: "expense" as const, payment: "card" as const,
    card_id: card.id, installments: 4, amount_cents: 80000, status: "paid" as const };
  const atClosing = { ...base, id: "closing", date: "2026-12-20" };
  const afterClosing = { ...base, id: "after", date: "2026-12-21" };
  assert.equal(invoiceInstallments([atClosing], card, "2026-12")[0].number, 1);
  assert.deepEqual(invoiceInstallments([afterClosing], card, "2026-12"), []);
  assert.equal(invoiceInstallments([afterClosing], card, "2027-01")[0].number, 1);
  assert.equal(invoiceInstallments([afterClosing], card, "2027-04")[0].number, 4);
  for (const invalid of ["", "2026-", "2026-02-30", "2026-13-01"]) {
    assert.deepEqual(invoiceInstallments([{ ...base, date: invalid }], card, "2026-12"), []);
    assert.throws(() => validateEntry({ ...base, date: invalid }));
  }
  assert.deepEqual(invoiceInstallments([atClosing], card, "2026-13"), []);
  const reviewed = { ...atClosing, status: "pending_review" as const };
  assert.deepEqual(invoiceInstallments([reviewed], card, "2026-12"), []);
});
