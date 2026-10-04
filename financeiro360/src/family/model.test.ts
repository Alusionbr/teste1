import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "./demo.ts";
import {
  forecast,
  recommendations,
  invoice,
  balance,
  metrics,
  financialOverview,
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
