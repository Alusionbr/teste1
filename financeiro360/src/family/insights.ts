import { addMonths } from "../logic.ts";
import type { Data, Entry } from "./model.ts";

export interface FlowPoint {
  key: string;
  label: string;
  received: number;
  paid: number;
  spending: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekRange(date: string): DateRange {
  const value = new Date(`${date}T12:00:00Z`);
  const offset = (value.getUTCDay() + 6) % 7;
  const start = shiftDate(date, -offset);
  return { start, end: shiftDate(start, 6) };
}

export function financialTotals(entries: Entry[], prefix: string) {
  const rows = entries.filter((entry) => entry.date.startsWith(prefix) && entry.status !== "pending_review");
  return {
    received: rows.filter((entry) => entry.kind === "income" && entry.status === "paid")
      .reduce((sum, entry) => sum + entry.amount_cents, 0),
    paid: rows.filter((entry) => entry.status === "paid" && entry.payment === "cash" &&
      ["expense", "card_payment", "debt_payment"].includes(entry.kind))
      .reduce((sum, entry) => sum + entry.amount_cents, 0),
    spending: rows.filter((entry) => entry.kind === "expense")
      .reduce((sum, entry) => sum + entry.amount_cents, 0),
  };
}

export function financialTotalsInRange(entries: Entry[], start: string, end: string) {
  return financialTotals(entries.filter((entry) => entry.date >= start && entry.date <= end), "");
}

export function weeklyFinancialSeries(data: Data, date: string): FlowPoint[] {
  const range = weekRange(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDate(range.start, index);
    const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });
    return {
      key: day,
      label: `${label.replace(".", "")} ${day.slice(8, 10)}`,
      ...financialTotalsInRange(data.entries, day, day),
    };
  });
}

export function financialSeries(data: Data, selectedMonth: string, period: "monthly" | "yearly"): FlowPoint[] {
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const keys = period === "monthly"
    ? Array.from({ length: 12 }, (_, index) => addMonths(selectedMonth, index - 11))
    : Array.from({ length: 5 }, (_, index) => String(Number(selectedMonth.slice(0, 4)) + index - 4));
  return keys.map((key) => ({ key,
    label: period === "monthly" ? `${monthNames[Number(key.slice(5)) - 1]}/${key.slice(2, 4)}` : key,
    ...financialTotals(data.entries, key) }));
}

function groupExpenses(expenses: Entry[]) {
  const groups = new Map<string, { total: number; subcategories: Map<string, number> }>();
  for (const entry of expenses) {
    const group = groups.get(entry.category) || { total: 0, subcategories: new Map<string, number>() };
    group.total += entry.amount_cents;
    const subcategory = entry.subcategory?.trim() || "Sem subcategoria";
    group.subcategories.set(subcategory, (group.subcategories.get(subcategory) || 0) + entry.amount_cents);
    groups.set(entry.category, group);
  }
  return [...groups].map(([name, value]) => ({ name, total: value.total,
    subcategories: [...value.subcategories].sort((a, b) => b[1] - a[1]) }))
    .sort((a, b) => b.total - a.total);
}

export function spendingGroups(data: Data, prefix: string) {
  return groupExpenses(data.entries.filter((entry) => entry.kind === "expense" &&
    entry.status !== "pending_review" && entry.date.startsWith(prefix)));
}

export function spendingGroupsInRange(data: Data, start: string, end: string) {
  return groupExpenses(data.entries.filter((entry) => entry.kind === "expense" &&
    entry.status !== "pending_review" && entry.date >= start && entry.date <= end));
}
