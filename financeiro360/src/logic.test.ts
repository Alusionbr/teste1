import assert from "node:assert/strict";
import test from "node:test";
import { dueDate, emptyState, expenseTotal, installmentAmount, invoiceLines, invoiceMonth, monthEntries, parseBackup, parseMoney, type Card, type Entry } from "./logic.ts";

const card: Card = { id: "wife-card", name: "Cartão", owner: "wife", limitCents: 300000, closingDay: 20, dueDay: 10 };
const purchase: Entry = { id: "a", date: "2026-01-21", description: "Compra do lar", amountCents: 10001, kind: "expense", category: "Mercado", buyer: "husband", scope: "family", payment: "card", cardId: card.id, installments: 3 };

test("compra após fechamento começa na fatura seguinte e vence no próximo mês", () => {
  assert.equal(invoiceMonth("2026-01-20", 20), "2026-01");
  assert.equal(invoiceMonth(purchase.date, 20), "2026-02");
  assert.equal(dueDate("2026-02", card), "2026-03-10");
});

test("parcelas distribuem centavos sem perder valor e sem duplicar o custo do mês da compra", () => {
  assert.deepEqual([0, 1, 2].map((index) => installmentAmount(10001, 3, index)), [3334, 3334, 3333]);
  const invoiceTotals = ["2026-01", "2026-02", "2026-03", "2026-04"].map((month) => invoiceLines([purchase], card, month).reduce((sum, line) => sum + line.amountCents, 0));
  assert.deepEqual(invoiceTotals, [0, 3334, 3334, 3333]);
  assert.equal(expenseTotal(monthEntries([purchase], "2026-01")), 10001);
  assert.equal(expenseTotal(monthEntries([purchase], "2026-02")), 0);
});

test("vencimento respeita meses curtos", () => {
  assert.equal(dueDate("2026-02", { ...card, closingDay: 5, dueDay: 31 }), "2026-02-28");
});

test("importação rejeita cartão referenciado que não existe", () => {
  const backup = emptyState();
  backup.entries.push(purchase);
  assert.throws(() => parseBackup(backup), /cartão inválido/);
});

test("valores monetários em português são exatos em centavos", () => {
  assert.equal(parseMoney("1.234,56"), 123456);
  assert.equal(parseMoney("0,01"), 1);
  assert.equal(parseMoney("-1,00"), null);
});
