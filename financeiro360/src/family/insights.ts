import { addMonths } from "../logic.ts";
import type { Data, Entry } from "./model.ts";

export interface FlowPoint {
  key: string;
  label: string;
  received: number;
  paid: number;
  spending: number;
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

export function financialSeries(data: Data, selectedMonth: string, period: "monthly" | "yearly"): FlowPoint[] {
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const keys = period === "monthly"
    ? Array.from({ length: 12 }, (_, index) => addMonths(selectedMonth, index - 11))
    : Array.from({ length: 5 }, (_, index) => String(Number(selectedMonth.slice(0, 4)) + index - 4));
  return keys.map((key) => ({ key,
    label: period === "monthly" ? `${monthNames[Number(key.slice(5)) - 1]}/${key.slice(2, 4)}` : key,
    ...financialTotals(data.entries, key) }));
}

export function spendingGroups(data: Data, prefix: string) {
  const expenses = data.entries.filter((entry) => entry.kind === "expense" &&
    entry.status !== "pending_review" && entry.date.startsWith(prefix));
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
