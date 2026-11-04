import { addMonths, dueDate } from "../logic.ts";
import { balance, invoice, type Data } from "./model.ts";

export type FinanceCalendarStatus = "paid" | "pending" | "unconfirmed";
export interface FinanceCalendarEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  amount_cents: number;
  total_cents: number;
  status: FinanceCalendarStatus;
  kind: "card" | "bill" | "loan";
  card_id?: string;
  invoice_month?: string;
  entry_id?: string;
}

const isoMonth = (date: string) => date.slice(0, 7);
const dayDiff = (target: string, start: string) =>
  Math.round((Date.parse(target + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) / 86400000);
const localDue = (date: string, day: number) => {
  const [year, month] = date.split("-").map(Number);
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return date + "-" + String(Math.min(day, maxDay)).padStart(2, "0");
};

/** Calendar dates are financial due dates, not purchase dates. Zero-value invoices are not assumed paid. */
export function financialCalendarEvents(data: Data, month: string): FinanceCalendarEvent[] {
  const events: FinanceCalendarEvent[] = [];
  for (const card of data.cards.filter((item) => !item.archived_at)) {
    for (const cycle of [addMonths(month, -1), month, addMonths(month, 1)]) {
      const date = dueDate(cycle, {
        id: card.id, name: card.name, owner: "wife", limitCents: card.limit_cents || 0,
        closingDay: card.closing_day, dueDay: card.due_day,
      });
      if (isoMonth(date) !== month) continue;
      const bill = invoice(data, card, cycle);
      events.push({
        id: "card:" + card.id + ":" + cycle, kind: "card", card_id: card.id,
        invoice_month: cycle, date, title: "Fatura " + card.name,
        detail: "Fatura " + cycle + " · fecha dia " + card.closing_day,
        amount_cents: bill.remaining, total_cents: bill.total,
        status: bill.total === 0 ? "unconfirmed" : bill.remaining === 0 ? "paid" : "pending",
      });
    }
  }
  for (const entry of data.entries) {
    if (entry.kind !== "expense" || entry.payment !== "cash" || !entry.due_date ||
        isoMonth(entry.due_date) !== month || entry.status === "pending_review") continue;
    events.push({
      id: "bill:" + entry.id, kind: "bill", entry_id: entry.id,
      date: entry.due_date, title: entry.description, detail: entry.category,
      amount_cents: entry.status === "paid" ? 0 : entry.amount_cents,
      total_cents: entry.amount_cents, status: entry.status === "paid" ? "paid" : "pending",
    });
  }
  for (const debt of data.debts) {
    if (debt.installment_count && debt.installment_cents && debt.first_due_date) {
      const firstMonth = isoMonth(debt.first_due_date);
      const initialDay = Number(debt.first_due_date.slice(-2));
      for (let n = 1; n <= debt.installment_count; n++) {
        const cycle = addMonths(firstMonth, n - 1);
        if (cycle !== month) continue;
        const date = localDue(cycle, initialDay);
        const payments = data.entries.filter((e) => e.kind === "debt_payment" && e.debt_id === debt.id && e.status === "paid");
        const matched = payments.filter((e) => e.debt_installment_number === n).reduce((s, e) => s + e.amount_cents, 0);
        const unassigned = payments.some((e) => !e.debt_installment_number);
        const remaining = Math.max(0, debt.installment_cents - matched);
        events.push({
          id: "loan:" + debt.id + ":" + n, kind: "loan",
          date, title: debt.name + " · " + n + "/" + debt.installment_count,
          detail: "Parcela de empréstimo",
          amount_cents: remaining, total_cents: debt.installment_cents,
          status: remaining === 0 ? "paid" : unassigned ? "unconfirmed" : "pending",
        });
      }
    } else if (debt.due_date && isoMonth(debt.due_date) === month) {
      events.push({
        id: "loan:" + debt.id, kind: "loan", date: debt.due_date,
        title: debt.name, detail: "Dívida sem parcelas detalhadas",
        amount_cents: debt.balance_cents || 0, total_cents: debt.balance_cents || 0,
        status: "unconfirmed",
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "pt-BR"));
}

export function upcomingFinanceAlerts(data: Data, referenceDate: string, days: number): FinanceCalendarEvent[] {
  const current = isoMonth(referenceDate);
  const months = [-3, -2, -1, 0, 1, 2].map((n) => addMonths(current, n));
  return months.flatMap((m) => financialCalendarEvents(data, m))
    .filter((event) => event.status === "pending" && dayDiff(event.date, referenceDate) <= days &&
      dayDiff(event.date, referenceDate) >= -90)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Household/personal accounts only; partial or missing balances never imply enough money. */
export function financialCashCoverage(data: Data, events: FinanceCalendarEvent[]) {
  const eligible = data.accounts.filter((account) => account.area !== "business");
  const balances = eligible.map((account) => balance(data, account));
  const knownCents = balances.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const dueCents = events.filter((event) => event.status === "pending")
    .reduce((sum, event) => sum + event.amount_cents, 0);
  const incomplete = eligible.length === 0 || balances.some((value) => value === null);
  return {
    dueCents, knownCents,
    status: incomplete ? "unconfirmed" as const : knownCents >= dueCents ? "covered" as const : "short" as const,
    missingCents: Math.max(0, dueCents - knownCents),
  };
}
