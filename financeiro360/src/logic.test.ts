import assert from "node:assert/strict";
import test from "node:test";
import { dueDate, emptyState, expenseTotal, installmentAmount, invoiceLines, invoiceMonth, monthEntries, parseBackup, parseMoney, pendingRecurring, recurrenceDate, type Card, type Entry } from "./logic.ts";

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

test("recorrência atravessa o ano sem virar gasto real antes da confirmação", () => {
  const state = emptyState();
  state.recurring.push({ id: "rent", name: "Aluguel", amountCents: 150000, category: "Moradia", buyer: "wife", scope: "family", startMonth: "2026-12", day: 31 });
  assert.equal(pendingRecurring(state, "2026-11").length, 0);
  assert.equal(pendingRecurring(state, "2026-12").length, 1);
  assert.equal(pendingRecurring(state, "2027-01").length, 1);
  assert.equal(recurrenceDate("2027-02", 31), "2027-02-28");
  assert.equal(expenseTotal(monthEntries(state.entries, "2027-01")), 0);
  state.entries.push({ id: "rent-jan", date: "2027-01-31", description: "Aluguel", amountCents: 150000, kind: "expense", category: "Moradia", buyer: "wife", scope: "family", payment: "cash", installments: 1, recurringId: "rent", recurringMonth: "2027-01" });
  assert.equal(pendingRecurring(state, "2027-01").length, 0);
  assert.equal(pendingRecurring(state, "2027-02").length, 1);
  assert.equal(expenseTotal(monthEntries(state.entries, "2027-01")), 150000);
});

test("backup anterior sem recorrências permanece importável", () => {
  const backup: Record<string, unknown> = { ...emptyState() };
  delete backup.recurring;
  assert.deepEqual(parseBackup(backup).recurring, []);
});

test("backup com recorrência confirmada sobrevive ao recarregamento", () => {
  const state = emptyState();
  state.recurring.push({ id: "internet", name: "Internet", amountCents: 9990, category: "Moradia", buyer: "husband", scope: "family", startMonth: "2026-12", day: 10 });
  state.entries.push({ id: "internet-jan", date: "2027-01-10", description: "Internet", amountCents: 9990, kind: "expense", category: "Moradia", buyer: "husband", scope: "family", payment: "cash", installments: 1, recurringId: "internet", recurringMonth: "2027-01" });
  const restored = parseBackup(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.recurring, state.recurring);
  assert.equal(restored.entries[0].recurringMonth, "2027-01");
  assert.equal(restored.entries[0].recurringId, "internet");
  assert.equal(pendingRecurring(restored, "2027-01").length, 0);
  assert.equal(pendingRecurring(restored, "2027-02").length, 1);
});
