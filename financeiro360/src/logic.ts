export type Person = "wife" | "husband";
export type Scope = "family" | "personal";
export type Kind = "expense" | "income";
export type Payment = "cash" | "card";

export interface Card {
  id: string;
  name: string;
  owner: Person;
  limitCents: number;
  closingDay: number;
  dueDay: number;
}

export interface Entry {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  kind: Kind;
  category: string;
  buyer: Person;
  scope: Scope;
  payment: Payment;
  cardId?: string;
  accountId?: string;
  sourceRef?: string;
  sourceDate?: string;
  installments: number;
  marketItemId?: string;
  recurringId?: string;
  recurringMonth?: string;
}

export interface MarketItem {
  id: string;
  name: string;
  quantity: number;
  estimatedCents: number;
  actualCents?: number;
  boughtDate?: string;
  entryId?: string;
}

export interface RecurringItem {
  id: string;
  name: string;
  amountCents: number;
  category: string;
  buyer: Person;
  scope: Scope;
  startMonth: string;
  day: number;
}

export interface Account {
  id: string;
  name: string;
  kind: "personal" | "business" | "family";
  owner: Person | null;
  openingBalanceCents: number | null;
  asOfDate: string | null;
}

export interface Transfer {
  id: string;
  date: string;
  description: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  sourceRef?: string;
}

export interface ObligationPayment {
  id: string;
  date: string;
  amountCents: number;
  accountId?: string;
  sourceRef?: string;
}

export interface Obligation {
  id: string;
  name: string;
  creditor: string;
  owner: Person;
  scope: Scope;
  startingBalanceCents: number | null;
  dueDate: string | null;
  sourceRef?: string;
  payments: ObligationPayment[];
}

export interface ReviewItem {
  id: string;
  description: string;
  date: string | null;
  amountCents: number | null;
  kind: Kind | "transfer" | "obligation" | null;
  category: string;
  buyer: Person | null;
  scope: Scope | null;
  payment: Payment | null;
  accountId: string | null;
  cardId: string | null;
  sourceRef: string;
  notes: string;
  sourceDate: string | null;
  confidence: "unknown" | "probable" | "verified";
  status: "pending_review";
}

export interface ImportInfo {
  source: string;
  importedAt: string;
  entryCount: number;
}

export interface State {
  version: 1;
  names: Record<Person, string>;
  budgetCents: number;
  cards: Card[];
  entries: Entry[];
  market: MarketItem[];
  recurring: RecurringItem[];
  accounts: Account[];
  transfers: Transfer[];
  obligations: Obligation[];
  pending: ReviewItem[];
  importInfo?: ImportInfo;
}

export const emptyState = (): State => ({
  version: 1,
  names: { wife: "Esposa", husband: "Marido" },
  budgetCents: 0,
  cards: [],
  entries: [],
  market: [],
  recurring: [],
  accounts: [],
  transfers: [],
  obligations: [],
  pending: [],
});

export function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function addMonths(month: string, offset: number): string {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

export function invoiceMonth(date: string, closingDay: number): string {
  return addMonths(date.slice(0, 7), Number(date.slice(8, 10)) > closingDay ? 1 : 0);
}

export function dueDate(month: string, card: Card): string {
  const dueMonth = addMonths(month, card.dueDay <= card.closingDay ? 1 : 0);
  const [year, index] = dueMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return `${dueMonth}-${String(Math.min(card.dueDay, lastDay)).padStart(2, "0")}`;
}

export function recurrenceDate(month: string, day: number): string {
  const [year, index] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function pendingRecurring(state: State, month: string): RecurringItem[] {
  return state.recurring.filter((item) => item.startMonth <= month && !state.entries.some((entry) => entry.recurringId === item.id && entry.recurringMonth === month));
}

export function installmentAmount(amountCents: number, count: number, index: number): number {
  const base = Math.floor(amountCents / count);
  return base + (index < amountCents % count ? 1 : 0);
}

export interface InvoiceLine {
  entry: Entry;
  installment: number;
  amountCents: number;
}

export function invoiceLines(entries: Entry[], card: Card, month: string): InvoiceLine[] {
  const lines: InvoiceLine[] = [];
  for (const entry of entries) {
    if (entry.kind !== "expense" || entry.payment !== "card" || entry.cardId !== card.id) continue;
    const first = invoiceMonth(entry.date, card.closingDay);
    for (let index = 0; index < entry.installments; index++) {
      if (addMonths(first, index) === month) {
        lines.push({ entry, installment: index + 1, amountCents: installmentAmount(entry.amountCents, entry.installments, index) });
      }
    }
  }
  return lines;
}

export function totalCents(values: { amountCents: number }[]): number {
  return values.reduce((sum, value) => sum + value.amountCents, 0);
}

export function monthEntries(entries: Entry[], month: string): Entry[] {
  return entries.filter((entry) => entry.date.startsWith(month));
}

export function expenseTotal(entries: Entry[]): number {
  return totalCents(entries.filter((entry) => entry.kind === "expense"));
}

export function incomeTotal(entries: Entry[]): number {
  return totalCents(entries.filter((entry) => entry.kind === "income"));
}

export function parseSignedMoney(value: string): number | null {
  const raw = value.trim();
  const negative = raw.startsWith("-");
  const cents = parseMoney(negative ? raw.slice(1) : raw);
  return cents === null ? null : negative ? -cents : cents;
}

export function parseMoney(value: string): number | null {
  const raw = value.trim().replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

const cents = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const signedCents = (value: unknown): value is number => Number.isSafeInteger(value);
const person = (value: unknown): value is Person => value === "wife" || value === "husband";
const text = (value: unknown, max = 160): value is string => typeof value === "string" && value.length <= max;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function accountBalance(state: State, account: Account): number | null {
  if (account.openingBalanceCents === null || account.asOfDate === null) return null;
  let balance = account.openingBalanceCents;
  for (const entry of state.entries) {
    if (entry.accountId !== account.id || entry.payment !== "cash" || entry.date <= account.asOfDate) continue;
    balance += entry.kind === "income" ? entry.amountCents : -entry.amountCents;
  }
  for (const transfer of state.transfers) {
    if (transfer.date <= account.asOfDate) continue;
    if (transfer.fromAccountId === account.id) balance -= transfer.amountCents;
    if (transfer.toAccountId === account.id) balance += transfer.amountCents;
  }
  for (const obligation of state.obligations) {
    for (const payment of obligation.payments) {
      if (payment.accountId === account.id && payment.date > account.asOfDate) balance -= payment.amountCents;
    }
  }
  return balance;
}

export function obligationBalance(obligation: Obligation): number | null {
  if (obligation.startingBalanceCents === null) return null;
  return obligation.startingBalanceCents - obligation.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function obligationStatus(obligation: Obligation): "pendente" | "aberta" | "quitada" {
  const balance = obligationBalance(obligation);
  return balance === null ? "pendente" : balance === 0 ? "quitada" : "aberta";
}

export function parseBackup(input: unknown): State {
  if (!record(input) || input.version !== 1 || !record(input.names) || !text(input.names.wife, 80) || !text(input.names.husband, 80) || !cents(input.budgetCents) || !Array.isArray(input.cards) || !Array.isArray(input.entries) || !Array.isArray(input.market)) {
    throw new Error("Arquivo de backup inválido ou incompatível.");
  }
  const rawRecurring = input.recurring === undefined ? [] : input.recurring;
  const rawAccounts = input.accounts === undefined ? [] : input.accounts;
  const rawTransfers = input.transfers === undefined ? [] : input.transfers;
  const rawObligations = input.obligations === undefined ? [] : input.obligations;
  const rawPending = input.pending === undefined ? [] : input.pending;
  if (!Array.isArray(rawRecurring) || !Array.isArray(rawAccounts) || !Array.isArray(rawTransfers) || !Array.isArray(rawObligations) || !Array.isArray(rawPending) || input.cards.length > 100 || input.entries.length > 20000 || input.market.length > 5000 || rawRecurring.length > 500 || rawAccounts.length > 100 || rawTransfers.length > 10000 || rawObligations.length > 1000 || rawPending.length > 5000) throw new Error("Backup excede os limites de importação ou contém coleções inválidas.");
  const cards: Card[] = input.cards.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.name) || !person(item.owner) || !cents(item.limitCents) || !Number.isInteger(item.closingDay) || !Number.isInteger(item.dueDay) || (item.closingDay as number) < 1 || (item.closingDay as number) > 31 || (item.dueDay as number) < 1 || (item.dueDay as number) > 31) throw new Error("Cartão inválido no backup.");
    return { id: item.id, name: item.name, owner: item.owner, limitCents: item.limitCents, closingDay: item.closingDay as number, dueDay: item.dueDay as number };
  });
  const cardIds = new Set(cards.map((card) => card.id));
  const accounts: Account[] = rawAccounts.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.name) || (item.kind !== "personal" && item.kind !== "business" && item.kind !== "family") || (item.owner !== null && !person(item.owner)) || (item.openingBalanceCents !== null && !signedCents(item.openingBalanceCents)) || (item.asOfDate !== null && (!text(item.asOfDate, 10) || !validIsoDate(item.asOfDate))) || (item.openingBalanceCents !== null && item.asOfDate === null)) throw new Error("Conta inválida no backup.");
    return { id: item.id, name: item.name, kind: item.kind, owner: item.owner, openingBalanceCents: item.openingBalanceCents, asOfDate: item.asOfDate };
  });
  const accountIds = new Set(accounts.map((account) => account.id));
  const entries: Entry[] = input.entries.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.date, 10) || !validIsoDate(item.date) || !text(item.description) || !cents(item.amountCents) || item.amountCents === 0 || (item.kind !== "expense" && item.kind !== "income") || !text(item.category, 80) || !person(item.buyer) || (item.scope !== "family" && item.scope !== "personal") || (item.payment !== "cash" && item.payment !== "card") || !Number.isInteger(item.installments) || (item.installments as number) < 1 || (item.installments as number) > 48) throw new Error("Lançamento inválido no backup.");
    if (item.payment === "card" && (item.kind !== "expense" || !text(item.cardId, 80) || !cardIds.has(item.cardId))) throw new Error("Lançamento vinculado a cartão inválido.");
    if (item.accountId !== undefined && (!text(item.accountId, 80) || !accountIds.has(item.accountId) || item.payment !== "cash")) throw new Error("Conta inválida em lançamento.");
    if (item.sourceRef !== undefined && !text(item.sourceRef, 160)) throw new Error("Origem inválida em lançamento.");
    if (item.sourceDate !== undefined && (!text(item.sourceDate, 10) || !validIsoDate(item.sourceDate))) throw new Error("Data da fonte inválida em lançamento.");
    return { id: item.id, date: item.date, description: item.description, amountCents: item.amountCents, kind: item.kind, category: item.category, buyer: item.buyer, scope: item.scope, payment: item.payment, cardId: item.payment === "card" ? item.cardId as string : undefined, accountId: item.accountId as string | undefined, sourceRef: item.sourceRef as string | undefined, sourceDate: item.sourceDate as string | undefined, installments: item.installments as number, marketItemId: text(item.marketItemId, 80) ? item.marketItemId : undefined, recurringId: text(item.recurringId, 80) ? item.recurringId : undefined, recurringMonth: text(item.recurringMonth, 7) && /^\d{4}-\d{2}$/.test(item.recurringMonth) ? item.recurringMonth : undefined };
  });
  const entryIds = new Set(entries.map((entry) => entry.id));
  const market: MarketItem[] = input.market.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.name) || typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0 || !cents(item.estimatedCents) || (item.actualCents !== undefined && !cents(item.actualCents)) || (item.boughtDate !== undefined && (!text(item.boughtDate, 10) || !validIsoDate(item.boughtDate))) || (item.entryId !== undefined && (!text(item.entryId, 80) || !entryIds.has(item.entryId)))) throw new Error("Item de mercado inválido no backup.");
    return { id: item.id, name: item.name, quantity: item.quantity, estimatedCents: item.estimatedCents, actualCents: item.actualCents, boughtDate: item.boughtDate, entryId: item.entryId };
  });
  const recurring: RecurringItem[] = rawRecurring.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.name) || !cents(item.amountCents) || item.amountCents === 0 || !text(item.category, 80) || !person(item.buyer) || (item.scope !== "family" && item.scope !== "personal") || !text(item.startMonth, 7) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.startMonth) || !Number.isInteger(item.day) || (item.day as number) < 1 || (item.day as number) > 31) throw new Error("Recorrência inválida no backup.");
    return { id: item.id, name: item.name, amountCents: item.amountCents, category: item.category, buyer: item.buyer, scope: item.scope, startMonth: item.startMonth, day: item.day as number };
  });
  const transfers: Transfer[] = rawTransfers.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.date, 10) || !validIsoDate(item.date) || !text(item.description) || !text(item.fromAccountId, 80) || !text(item.toAccountId, 80) || item.fromAccountId === item.toAccountId || !accountIds.has(item.fromAccountId) || !accountIds.has(item.toAccountId) || !cents(item.amountCents) || item.amountCents === 0 || (item.sourceRef !== undefined && !text(item.sourceRef, 160))) throw new Error("Transferência inválida no backup.");
    return { id: item.id, date: item.date, description: item.description, fromAccountId: item.fromAccountId, toAccountId: item.toAccountId, amountCents: item.amountCents, sourceRef: item.sourceRef as string | undefined };
  });
  const obligations: Obligation[] = rawObligations.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.name) || !text(item.creditor) || !person(item.owner) || (item.scope !== "family" && item.scope !== "personal") || (item.startingBalanceCents !== null && !cents(item.startingBalanceCents)) || (item.dueDate !== null && (!text(item.dueDate, 10) || !validIsoDate(item.dueDate))) || !Array.isArray(item.payments) || item.payments.length > 1000 || (item.sourceRef !== undefined && !text(item.sourceRef, 160))) throw new Error("Dívida inválida no backup.");
    const payments: ObligationPayment[] = item.payments.map((payment: unknown) => {
      if (!record(payment) || !text(payment.id, 80) || !text(payment.date, 10) || !validIsoDate(payment.date) || !cents(payment.amountCents) || payment.amountCents === 0 || (payment.accountId !== undefined && (!text(payment.accountId, 80) || !accountIds.has(payment.accountId))) || (payment.sourceRef !== undefined && !text(payment.sourceRef, 160))) throw new Error("Pagamento de dívida inválido no backup.");
      return { id: payment.id, date: payment.date, amountCents: payment.amountCents, accountId: payment.accountId as string | undefined, sourceRef: payment.sourceRef as string | undefined };
    });
    if (new Set(payments.map((payment) => payment.id)).size !== payments.length || (item.startingBalanceCents !== null && payments.reduce((sum, payment) => sum + payment.amountCents, 0) > item.startingBalanceCents)) throw new Error("Pagamentos de dívida duplicados ou maiores que o saldo inicial.");
    return { id: item.id, name: item.name, creditor: item.creditor, owner: item.owner, scope: item.scope, startingBalanceCents: item.startingBalanceCents, dueDate: item.dueDate, sourceRef: item.sourceRef as string | undefined, payments };
  });
  const pending: ReviewItem[] = rawPending.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.description) || (item.date !== null && (!text(item.date, 10) || !validIsoDate(item.date))) || (item.amountCents !== null && (!cents(item.amountCents) || item.amountCents === 0)) || (item.kind !== null && item.kind !== "income" && item.kind !== "expense" && item.kind !== "transfer" && item.kind !== "obligation") || !text(item.category, 80) || (item.buyer !== null && !person(item.buyer)) || (item.scope !== null && item.scope !== "family" && item.scope !== "personal") || (item.payment !== null && item.payment !== "cash" && item.payment !== "card") || (item.accountId !== null && (!text(item.accountId, 80) || !accountIds.has(item.accountId))) || (item.cardId !== null && (!text(item.cardId, 80) || !cardIds.has(item.cardId))) || !text(item.sourceRef, 160) || !item.sourceRef.trim() || !text(item.notes, 500) || (item.sourceDate !== undefined && item.sourceDate !== null && (!text(item.sourceDate, 10) || !validIsoDate(item.sourceDate))) || (item.confidence !== undefined && item.confidence !== "unknown" && item.confidence !== "probable" && item.confidence !== "verified") || (item.status !== undefined && item.status !== "pending_review")) throw new Error("Registro pendente inválido no backup.");
    return { id: item.id, description: item.description, date: item.date, amountCents: item.amountCents, kind: item.kind, category: item.category, buyer: item.buyer, scope: item.scope, payment: item.payment, accountId: item.accountId, cardId: item.cardId, sourceRef: item.sourceRef, notes: item.notes, sourceDate: item.sourceDate === undefined ? null : item.sourceDate, confidence: item.confidence === undefined ? "unknown" : item.confidence, status: "pending_review" };
  });
  if (new Set(cards.map((card) => card.id)).size !== cards.length || new Set(accounts.map((account) => account.id)).size !== accounts.length || entryIds.size !== entries.length || new Set(market.map((item) => item.id)).size !== market.length || new Set(recurring.map((item) => item.id)).size !== recurring.length || new Set(transfers.map((item) => item.id)).size !== transfers.length || new Set(obligations.map((item) => item.id)).size !== obligations.length || new Set(pending.map((item) => item.id)).size !== pending.length) throw new Error("Backup contém identificadores duplicados.");
  let importInfo: ImportInfo | undefined;
  if (input.importInfo !== undefined) {
    const info = input.importInfo;
    if (!record(info) || !text(info.source, 160) || !text(info.importedAt, 40) || !Number.isSafeInteger(info.entryCount) || (info.entryCount as number) < 0) throw new Error("Histórico de importação inválido no backup.");
    importInfo = { source: info.source, importedAt: info.importedAt, entryCount: info.entryCount as number };
  }
  return { version: 1, names: { wife: input.names.wife, husband: input.names.husband }, budgetCents: input.budgetCents, cards, entries, market, recurring, accounts, transfers, obligations, pending, ...(importInfo ? { importInfo } : {}) };
}

export function backupSummary(state: State) {
  const dates = state.entries.map((entry) => entry.date).sort();
  return {
    entries: state.entries.length,
    cards: state.cards.length,
    market: state.market.length,
    recurring: state.recurring.length,
    accounts: state.accounts.length,
    transfers: state.transfers.length,
    obligations: state.obligations.length,
    pending: state.pending.length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
  };
}
