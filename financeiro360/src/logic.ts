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

export function parseMoney(value: string): number | null {
  const raw = value.trim().replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

const cents = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const person = (value: unknown): value is Person => value === "wife" || value === "husband";
const text = (value: unknown, max = 160): value is string => typeof value === "string" && value.length <= max;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function parseBackup(input: unknown): State {
  if (!record(input) || input.version !== 1 || !record(input.names) || !text(input.names.wife, 80) || !text(input.names.husband, 80) || !cents(input.budgetCents) || !Array.isArray(input.cards) || !Array.isArray(input.entries) || !Array.isArray(input.market)) {
    throw new Error("Arquivo de backup inválido ou incompatível.");
  }
  const rawRecurring = input.recurring === undefined ? [] : input.recurring;
  if (!Array.isArray(rawRecurring) || input.cards.length > 100 || input.entries.length > 20000 || input.market.length > 5000 || rawRecurring.length > 500) throw new Error("Backup excede os limites de importação ou contém recorrências inválidas.");
  const cards: Card[] = input.cards.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.name) || !person(item.owner) || !cents(item.limitCents) || !Number.isInteger(item.closingDay) || !Number.isInteger(item.dueDay) || (item.closingDay as number) < 1 || (item.closingDay as number) > 31 || (item.dueDay as number) < 1 || (item.dueDay as number) > 31) throw new Error("Cartão inválido no backup.");
    return { id: item.id, name: item.name, owner: item.owner, limitCents: item.limitCents, closingDay: item.closingDay as number, dueDay: item.dueDay as number };
  });
  const cardIds = new Set(cards.map((card) => card.id));
  const entries: Entry[] = input.entries.map((item: unknown) => {
    if (!record(item) || !text(item.id, 80) || !text(item.date, 10) || !validIsoDate(item.date) || !text(item.description) || !cents(item.amountCents) || item.amountCents === 0 || (item.kind !== "expense" && item.kind !== "income") || !text(item.category, 80) || !person(item.buyer) || (item.scope !== "family" && item.scope !== "personal") || (item.payment !== "cash" && item.payment !== "card") || !Number.isInteger(item.installments) || (item.installments as number) < 1 || (item.installments as number) > 48) throw new Error("Lançamento inválido no backup.");
    if (item.payment === "card" && (item.kind !== "expense" || !text(item.cardId, 80) || !cardIds.has(item.cardId))) throw new Error("Lançamento vinculado a cartão inválido.");
    return { id: item.id, date: item.date, description: item.description, amountCents: item.amountCents, kind: item.kind, category: item.category, buyer: item.buyer, scope: item.scope, payment: item.payment, cardId: item.payment === "card" ? item.cardId as string : undefined, installments: item.installments as number, marketItemId: text(item.marketItemId, 80) ? item.marketItemId : undefined, recurringId: text(item.recurringId, 80) ? item.recurringId : undefined, recurringMonth: text(item.recurringMonth, 7) && /^\d{4}-\d{2}$/.test(item.recurringMonth) ? item.recurringMonth : undefined };
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
  if (new Set(cards.map((card) => card.id)).size !== cards.length || entryIds.size !== entries.length || new Set(market.map((item) => item.id)).size !== market.length || new Set(recurring.map((item) => item.id)).size !== recurring.length) throw new Error("Backup contém identificadores duplicados.");
  let importInfo: ImportInfo | undefined;
  if (input.importInfo !== undefined) {
    const info = input.importInfo;
    if (!record(info) || !text(info.source, 160) || !text(info.importedAt, 40) || !Number.isSafeInteger(info.entryCount) || (info.entryCount as number) < 0) throw new Error("Histórico de importação inválido no backup.");
    importInfo = { source: info.source, importedAt: info.importedAt, entryCount: info.entryCount as number };
  }
  return { version: 1, names: { wife: input.names.wife, husband: input.names.husband }, budgetCents: input.budgetCents, cards, entries, market, recurring, ...(importInfo ? { importInfo } : {}) };
}

export function backupSummary(state: State) {
  const dates = state.entries.map((entry) => entry.date).sort();
  return {
    entries: state.entries.length,
    cards: state.cards.length,
    market: state.market.length,
    recurring: state.recurring.length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
  };
}
