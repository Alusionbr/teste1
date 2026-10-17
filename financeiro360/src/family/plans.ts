// Parcelamentos e compromissos futuros: o que já está comprometido nos próximos meses.
// Funções puras, sem tela nem banco. Dinheiro sempre em centavos inteiros.
import { addMonths, installmentAmount, invoiceMonth, recurrenceDate } from "../logic.ts";
import { invoiceInstallments, type Card, type Data, type Entry } from "./model.ts";

export const monthLabel = (month: string) => {
  const [y, m] = month.split("-");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1]}/${y}`;
};

export interface ActivePlan {
  key: string;
  kind: "card" | "carne";
  description: string;
  card: Card | null;
  entries: Entry[];
  total: number;
  count: number;
  // Parcelas já cobradas antes do mês de referência.
  paidCount: number;
  remainingCount: number;
  remainingCents: number;
  // Valor da próxima parcela a vencer (a do mês de referência, se houver).
  nextCents: number;
  firstMonth: string;
  lastMonth: string;
}

// Carnê, boleto parcelado ou financiamento: N contas a pagar agrupadas por source_ref "parc:<id>".
export const CARNE_PREFIX = "parc:";
const carneSuffix = /\s*\((\d{1,2})\/(\d{1,2})\)$/;
export const carneBase = (description: string) => description.replace(carneSuffix, "");
const dueMonth = (e: Entry) => (e.due_date || e.date).slice(0, 7);

export function activeInstallments(data: Data, month: string): ActivePlan[] {
  const plans: ActivePlan[] = [];
  for (const e of data.entries) {
    if (e.kind !== "expense" || e.payment !== "card" || e.installments < 2 || e.status === "pending_review") continue;
    const card = data.cards.find((c) => c.id === e.card_id);
    if (!card) continue;
    const first = invoiceMonth(e.date, card.closing_day);
    const months = Array.from({ length: e.installments }, (_, i) => addMonths(first, i));
    const remaining = months.map((m, i) => ({ m, i })).filter(({ m }) => m >= month);
    if (!remaining.length) continue;
    plans.push({
      key: e.id,
      kind: "card",
      description: e.description,
      card,
      entries: [e],
      total: e.amount_cents,
      count: e.installments,
      paidCount: e.installments - remaining.length,
      remainingCount: remaining.length,
      remainingCents: remaining.reduce((s, { i }) => s + installmentAmount(e.amount_cents, e.installments, i), 0),
      nextCents: installmentAmount(e.amount_cents, e.installments, remaining[0].i),
      firstMonth: first,
      lastMonth: months[months.length - 1],
    });
  }
  const groups = new Map<string, Entry[]>();
  for (const e of data.entries)
    if (e.source_ref?.startsWith(CARNE_PREFIX) && e.kind === "expense")
      groups.set(e.source_ref, [...(groups.get(e.source_ref) || []), e]);
  for (const [key, rows] of groups) {
    const sorted = [...rows].sort((a, b) => (a.due_date || a.date).localeCompare(b.due_date || b.date));
    const open = sorted.filter((e) => e.status === "pending");
    if (!open.length) continue;
    const declared = Number(sorted[0].description.match(carneSuffix)?.[2]) || sorted.length;
    plans.push({
      key,
      kind: "carne",
      description: carneBase(sorted[0].description),
      card: null,
      entries: sorted,
      total: sorted.reduce((s, e) => s + e.amount_cents, 0),
      count: Math.max(declared, sorted.length),
      paidCount: sorted.length - open.length,
      remainingCount: open.length,
      remainingCents: open.reduce((s, e) => s + e.amount_cents, 0),
      nextCents: open[0].amount_cents,
      firstMonth: dueMonth(sorted[0]),
      lastMonth: dueMonth(sorted[sorted.length - 1]),
    });
  }
  return plans.sort((a, b) => a.lastMonth.localeCompare(b.lastMonth) || a.description.localeCompare(b.description));
}

// Uma conta gerada por despesa fixa (no banco: recurring_id/recurring_month; na demonstração: source_ref).
function generatedFor(e: Entry, recurringId: string, month: string) {
  const row = e as Entry & { recurring_id?: string | null; recurring_month?: string | null };
  return (row.recurring_id === recurringId && row.recurring_month === month) || e.source_ref === `recurring:${recurringId}:${month}`;
}

export interface MonthCommitment {
  month: string;
  // Parcelas e compras no cartão da fatura deste mês (competência pelo fechamento).
  card: number;
  // Contas a pagar já registradas que vencem no mês (inclui carnês e contas geradas).
  bills: number;
  // Despesas fixas cadastradas que ainda não viraram conta no mês.
  fixed: number;
  total: number;
}
export function commitments(data: Data, from: string, months = 12): MonthCommitment[] {
  return Array.from({ length: months }, (_, i) => {
    const month = addMonths(from, i);
    const card = data.cards.reduce(
      (s, c) => s + invoiceInstallments(data.entries, c, month).reduce((t, line) => t + line.amount_cents, 0),
      0,
    );
    const bills = data.entries
      .filter((e) => e.kind === "expense" && e.payment === "cash" && e.status === "pending" && dueMonth(e) === month)
      .reduce((s, e) => s + e.amount_cents, 0);
    const fixed = data.recurring
      .filter((r) => r.start_month <= month && !data.entries.some((e) => generatedFor(e, r.id, month)))
      .reduce((s, r) => s + r.amount_cents, 0);
    return { month, card, bills, fixed, total: card + bills + fixed };
  });
}

// Parcelamentos que terminam em breve: quanto "sobra" por mês a partir do mês seguinte ao fim.
export function freedUp(plans: ActivePlan[], from: string, months = 3) {
  const until = addMonths(from, months - 1);
  return plans
    .filter((p) => p.lastMonth >= from && p.lastMonth <= until)
    .map((p) => ({ plan: p, from: addMonths(p.lastMonth, 1), cents: p.nextCents }));
}

// Limite estimado: limite informado menos as parcelas ainda não pagas a partir do mês de referência.
export function cardLimitUse(data: Data, card: Card, month: string) {
  let used = 0;
  for (const p of activeInstallments(data, month)) if (p.card?.id === card.id) used += p.remainingCents;
  // Compras à vista no cartão da fatura atual ainda em aberto também ocupam o limite.
  used += invoiceInstallments(data.entries, card, month)
    .filter((line) => line.total === 1)
    .reduce((s, line) => s + line.amount_cents, 0);
  const paid = data.entries
    .filter((e) => e.kind === "card_payment" && e.card_id === card.id && e.status === "paid" && (e.invoice_month || "") >= month)
    .reduce((s, e) => s + e.amount_cents, 0);
  used = Math.max(0, used - paid);
  return { used, available: card.limit_cents === null ? null : card.limit_cents - used, limit: card.limit_cents };
}

// Média das receitas registradas nos 3 meses completos anteriores (só meses com alguma receita).
export function averageIncome(data: Data, month: string) {
  const totals = [1, 2, 3]
    .map((back) => addMonths(month, -back))
    .map((m) => data.entries.filter((e) => e.kind === "income" && e.status !== "pending_review" && e.date.startsWith(m)).reduce((s, e) => s + e.amount_cents, 0))
    .filter((v) => v > 0);
  return totals.length ? { cents: Math.round(totals.reduce((s, v) => s + v, 0) / totals.length), months: totals.length } : null;
}

export interface Simulation {
  rows: { month: string; existing: number; added: number; total: number }[];
  income: { cents: number; months: number } | null;
  // Maior fatia da renda média que os compromissos ocupariam (null sem receita registrada).
  peakShare: number | null;
}
// "Cabe no mês?": mostra cada mês da compra com o que já estava comprometido e a nova parcela.
export function simulatePurchase(data: Data, input: { total: number; count: number; card: Card; date: string }, current: string): Simulation {
  const first = invoiceMonth(input.date, input.card.closing_day);
  const existing = new Map(commitments(data, first, input.count).map((c) => [c.month, c.total]));
  const rows = Array.from({ length: input.count }, (_, i) => {
    const month = addMonths(first, i);
    const added = installmentAmount(input.total, input.count, i);
    const before = existing.get(month) || 0;
    return { month, existing: before, added, total: before + added };
  });
  const income = averageIncome(data, current);
  const peak = income ? Math.max(...rows.map((r) => r.total)) / income.cents : null;
  return { rows, income, peakShare: peak === null ? null : Math.round(peak * 100) / 100 };
}

// Cronograma de carnê: N contas mensais a partir do primeiro vencimento, dia limitado ao fim do mês.
export function carneSchedule(input: { description: string; total: number; count: number; firstDue: string }) {
  const day = Number(input.firstDue.slice(8, 10));
  const start = input.firstDue.slice(0, 7);
  return Array.from({ length: input.count }, (_, i) => ({
    description: `${carneBase(input.description).slice(0, 150)} (${i + 1}/${input.count})`,
    amount_cents: installmentAmount(input.total, input.count, i),
    due_date: recurrenceDate(addMonths(start, i), day),
  }));
}
