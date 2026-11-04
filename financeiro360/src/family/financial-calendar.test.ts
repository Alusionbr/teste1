import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "./demo.ts";
import { financialCalendarEvents, upcomingFinanceAlerts, financialCashCoverage } from "./financial-calendar.ts";

test("Atacadao invoices keep purchases after card merging, with correct month and due day", () => {
  const data = demoData();
  const card = { ...data.cards[0], id: "atacadao", name: "Atacadão", closing_day: 1, due_day: 11 };
  data.cards = [card, { ...card, id: "archived", archived_at: "2026-10-14", merged_into_id: "atacadao" }];
  const original = data.entries.find((entry) => entry.payment === "card")!;
  data.entries = [
    { ...original, id: "paraiba", description: "Paraíba", card_id: card.id,
      date: "2026-10-05", first_invoice_month: "2026-11", amount_cents: 7689, installments: 1 },
    { ...original, id: "pijama", description: "Pijama + secante", card_id: card.id,
      date: "2026-10-10", first_invoice_month: "2026-11", amount_cents: 7878, installments: 1 },
  ];
  const events = financialCalendarEvents(data, "2026-11").filter((item) => item.kind === "card");
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].date, events[0].total_cents, events[0].amount_cents, events[0].status],
    ["2026-11-11", 15567, 15567, "pending"]);
  assert.equal(upcomingFinanceAlerts(data, "2026-11-06", 5).length, 1);
  assert.equal(upcomingFinanceAlerts(data, "2026-11-05", 5).length, 0);
  data.entries.push({ ...original, id: "paid", description: "Pagamento da fatura", kind: "card_payment",
    payment: "cash", status: "paid", card_id: card.id, invoice_month: "2026-11",
    amount_cents: 15567 });
  const after = financialCalendarEvents(data, "2026-11").find((item) => item.card_id === card.id)!;
  assert.equal(after.status, "paid");
  assert.equal(after.amount_cents, 0);
});

test("unknown invoices are not incorrectly marked as paid", () => {
  const data = demoData();
  data.entries = [];
  const event = financialCalendarEvents(data, "2026-11").find((e) => e.kind === "card");
  assert.equal(event?.status, "unconfirmed");
});

test("coverage remains unconfirmed with unknown bank balances", () => {
  const data = demoData();
  data.accounts = [{ ...data.accounts[0], opening_cents: null, balance_date: null }];
  const events = [{ id: "test", kind: "bill" as const, date: "2026-11-11", title: "Conta", detail: "",
    amount_cents: 10000, total_cents: 10000, status: "pending" as const }];
  const coverage = financialCashCoverage(data, events);
  assert.equal(coverage.status, "unconfirmed");
  assert.equal(coverage.dueCents, 10000);
});
