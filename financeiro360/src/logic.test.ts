import assert from "node:assert/strict";
import test from "node:test";
import { accountBalance, backupSummary, dueDate, emptyState, obligationBalance, obligationStatus, expenseTotal, installmentAmount, invoiceLines, invoiceMonth, monthEntries, parseBackup, parseMoney, pendingRecurring, recurrenceDate, type Card, type Entry } from "./logic.ts";

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

test("prévia de importação resume período e preserva origem informada", () => {
  const backup = emptyState();
  backup.entries.push({ id: "a", date: "2026-02-15", description: "Conta", amountCents: 12500, kind: "expense", category: "Moradia", buyer: "wife", scope: "family", payment: "cash", installments: 1 });
  backup.entries.push({ id: "b", date: "2025-12-01", description: "Receita", amountCents: 50000, kind: "income", category: "Outros", buyer: "husband", scope: "personal", payment: "cash", installments: 1 });
  backup.importInfo = { source: "Arquivo privado revisado", importedAt: "2026-09-22T12:00:00.000Z", entryCount: 2 };
  const restored = parseBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(backupSummary(restored), { entries: 2, cards: 0, market: 0, recurring: 0, accounts: 0, transfers: 0, obligations: 0, pending: 0, firstDate: "2025-12-01", lastDate: "2026-02-15" });
  assert.deepEqual(restored.importInfo, backup.importInfo);
});

test("contas separadas e transferência não duplicam receitas ou despesas", () => {
  const state = emptyState();
  state.accounts = [
    { id: "personal", name: "Conta pessoal", kind: "personal", owner: "husband", openingBalanceCents: 100000, asOfDate: "2026-01-01" },
    { id: "business", name: "Conta empresa", kind: "business", owner: "husband", openingBalanceCents: 50000, asOfDate: "2026-01-01" },
    { id: "unknown", name: "Conta sem base", kind: "family", owner: null, openingBalanceCents: null, asOfDate: null },
  ];
  state.cards.push({ id: "card", name: "Cartão", owner: "wife", limitCents: 100000, closingDay: 20, dueDay: 10 });
  state.entries.push(
    { id: "expense", date: "2026-01-02", description: "Mercado", amountCents: 20000, kind: "expense", category: "Mercado", buyer: "husband", scope: "family", payment: "cash", accountId: "personal", installments: 1 },
    { id: "income", date: "2026-01-03", description: "Receita", amountCents: 10000, kind: "income", category: "Outros", buyer: "husband", scope: "personal", payment: "cash", accountId: "personal", installments: 1 },
    { id: "card", date: "2026-01-04", description: "Cartão", amountCents: 6000, kind: "expense", category: "Lazer", buyer: "wife", scope: "family", payment: "card", cardId: "card", installments: 1 },
  );
  state.transfers.push({ id: "transfer", date: "2026-01-05", description: "Entre contas", fromAccountId: "personal", toAccountId: "business", amountCents: 30000 });
  state.obligations.push({ id: "debt", name: "Dívida", creditor: "Credor", owner: "husband", scope: "personal", startingBalanceCents: 100000, dueDate: null, payments: [{ id: "pay", date: "2026-01-06", amountCents: 25000, accountId: "personal" }] });
  assert.equal(accountBalance(state, state.accounts[0]), 35000);
  assert.equal(accountBalance(state, state.accounts[1]), 80000);
  assert.equal(accountBalance(state, state.accounts[2]), null);
  assert.equal(expenseTotal(state.entries), 26000);
  assert.equal(obligationBalance(state.obligations[0]), 75000);
  assert.equal(obligationStatus(state.obligations[0]), "aberta");
  state.obligations[0].payments.push({ id: "last", date: "2026-01-07", amountCents: 75000 });
  assert.equal(obligationStatus(state.obligations[0]), "quitada");
  const restored = parseBackup(JSON.parse(JSON.stringify(state)));
  assert.equal(accountBalance(restored, restored.accounts[0]), 35000);
  assert.equal(obligationStatus(restored.obligations[0]), "quitada");
});

test("backup antigo e pendência incerta preservam ausência explícita de saldo, data e valor", () => {
  const legacy: Record<string, unknown> = { ...emptyState() };
  for (const key of ["accounts", "transfers", "obligations", "pending"]) delete legacy[key];
  const loaded = parseBackup(legacy);
  assert.deepEqual([loaded.accounts, loaded.transfers, loaded.obligations, loaded.pending], [[], [], [], []]);
  loaded.pending.push({ id: "candidate", description: "Lançamento a conferir", date: null, amountCents: null, kind: "transfer", category: "", buyer: null, scope: null, payment: null, accountId: null, cardId: null, sourceRef: "conversa privada", sourceDate: "2026-01-10", confidence: "probable", status: "pending_review", notes: "falta extrato" });
  const restored = parseBackup(JSON.parse(JSON.stringify(loaded)));
  assert.deepEqual(restored.pending, loaded.pending);
  assert.equal(backupSummary(restored).pending, 1);
  assert.equal(expenseTotal(restored.entries), 0);
});
