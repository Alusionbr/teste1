import assert from "node:assert/strict";
import test from "node:test";
import {
  financialTotalsInRange,
  weekRange,
  weeklyFinancialSeries,
} from "./insights.ts";
import type { Data, Entry } from "./model.ts";

const entry = (date: string, kind: Entry["kind"], amount_cents: number,
  payment: Entry["payment"], status: Entry["status"] = "paid"): Entry => ({
  id: `${date}-${kind}-${amount_cents}`,
  home_id: "home",
  owner_id: "member",
  shared: true,
  date,
  description: kind,
  category: kind === "income" ? "Renda" : "Casa",
  amount_cents,
  due_date: null,
  kind,
  payment,
  status,
  card_id: null,
  account_id: null,
  target_account_id: null,
  debt_id: null,
  area: "household",
  installments: 1,
  invoice_month: null,
  source_ref: null,
});

test("semana começa na segunda e termina no domingo, inclusive na virada do mês", () => {
  assert.deepEqual(weekRange("2026-11-01"), { start: "2026-10-26", end: "2026-11-01" });
  assert.deepEqual(weekRange("2026-11-08"), { start: "2026-11-02", end: "2026-11-08" });
});

test("totais do intervalo incluem os dois extremos e excluem datas vizinhas", () => {
  const rows = [
    entry("2026-11-01", "expense", 4000, "card"),
    entry("2026-11-02", "expense", 2500, "cash"),
    entry("2026-11-02", "income", 9000, "cash"),
    entry("2026-11-08", "card_payment", 2500, "cash"),
    entry("2026-11-09", "expense", 7000, "cash"),
  ];
  assert.deepEqual(financialTotalsInRange(rows, "2026-11-02", "2026-11-08"), {
    received: 9000,
    paid: 5000,
    spending: 2500,
  });
});

test("gráfico semanal retorna sete dias em ordem e mantém compras no cartão como gastos", () => {
  const data = { entries: [
    entry("2026-11-02", "expense", 1250, "card"),
    entry("2026-11-03", "income", 6000, "cash"),
  ] } as Data;
  const points = weeklyFinancialSeries(data, "2026-11-04");
  assert.equal(points.length, 7);
  assert.deepEqual(points.map((point) => point.key), [
    "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
    "2026-11-06", "2026-11-07", "2026-11-08",
  ]);
  assert.equal(points[0].spending, 1250);
  assert.equal(points[1].received, 6000);
});
