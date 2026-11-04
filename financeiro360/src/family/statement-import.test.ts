import assert from "node:assert/strict";
import test from "node:test";
import { parseStatement, statementFingerprint } from "./statement-import.ts";

test("CSV brasileiro registra compras, reconhece parcelas e ignora totais e pagamentos", () => {
  const content = [
    "Data;Descrição;Valor;Parcela",
    "05/10/2026;Paraíba;76,89;",
    "10/10/2026;Pijama + secante;78,78;2/3",
    "11/10/2026;Pagamento recebido;-50,00;",
    "Total;Valor da fatura;155,67;",
  ].join("\n");
  const result = parseStatement(content, "2026-11");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((row) => row.amount_cents), [7689, 7878]);
  assert.equal(result.rows[1].installment_label, "2/3");
  assert.equal(result.rows[0].date, "2026-10-05");
});
test("Texto copiado de fatura aceita compra e valor em reais", () => {
  const result = parseStatement("05/10/2026 Paraíba 76,89\n10/10/2026 Pijama + secante R$ 78,78", "2026-11");
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1].amount_cents, 7878);
});
test("CSV com vírgula e decimal ponto não confunde valor", () => {
  const result = parseStatement('date,description,amount\n2026-10-15,"Uber Trip",22.50', "2026-11");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].category, "Transporte");
  assert.equal(result.rows[0].amount_cents, 2250);
});
test("Datas sem ano usam exercício anterior para fatura de janeiro", () => {
  const result = parseStatement("29/12 Mercado 134,50", "2027-01");
  assert.equal(result.rows[0]?.date, "2026-12-29");
});
test("Não importa valores negativos nem datas impossíveis", () => {
  const result = parseStatement("31/02/2026 Compra 25,00\n03/10/2026 Estorno -99,90\n04/10/2026 Mercado 75,50", "2026-11");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].amount_cents, 7550);
});
test("Chave de similaridade ignora marcação de parcela da descrição", () => {
  assert.equal(statementFingerprint({date:"2026-10-05",description:"Loja XP 2/3",amount_cents:5000}),
    statementFingerprint({date:"2026-10-05",description:"Loja XP",amount_cents:5000}));
});
