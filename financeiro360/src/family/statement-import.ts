/** Import statements in CSV or copyable text. Nothing leaves the browser until review is confirmed. */
export interface StatementRow {
  date: string;
  description: string;
  amount_cents: number;
  category: string;
  installment_label: string | null;
}
export interface StatementResult {
  rows: StatementRow[];
  ignored: number;
  warnings: string[];
}
const cleanHeader = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const normalizeDescription = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 160);
export const statementFingerprint = (row: Pick<StatementRow, "date" | "description" | "amount_cents">) =>
  row.date + "|" + row.amount_cents + "|" +
  cleanHeader(row.description).replace(/\b(?:parcela\s*)?\d{1,2}\s*\/\s*\d{1,2}\b/g, "").trim();

function isoDate(value: string, invoiceMonth: string): string | null {
  const text = value.trim();
  let year: number, month: number, day: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    [year, month, day] = text.split("-").map(Number);
  } else {
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/);
    if (!match) return null;
    day = Number(match[1]); month = Number(match[2]);
    year = match[3] ? Number(match[3]) : Number(invoiceMonth.slice(0, 4));
    if (year < 100) year += year > 70 ? 1900 : 2000;
    if (!match[3] && month > Number(invoiceMonth.slice(5))) year -= 1;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
  const iso = [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  return iso.slice(0, 7) > invoiceMonth ? null : iso;
}
function cents(value: string): number | null {
  const v = value.replace(/\s/g, "").replace(/R\$/gi, "").replace(/^\+/, "");
  if (!v || /^[-(]/.test(v)) return null;
  const normalized = /^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(v)
    ? v.replace(/\./g, "").replace(",", ".")
    : /^\d+(?:,\d{1,2})$/.test(v) ? v.replace(",", ".") : v;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parts = normalized.split(".");
  const amount = Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
function category(description: string): string {
  if (/uber|99app|posto|shell|ipiranga|combust[ií]vel|estacionamento|ped[aá]gio/i.test(description)) return "Transporte";
  if (/mercado|atacad|supermercado|assai|assa[ií]|carrefour|hortifruti|padaria/i.test(description)) return "Mercado";
  if (/ifood|restaurante|lanch|pizz|sushi|mcdonald|cafeteria/i.test(description)) return "Alimentação fora";
  if (/farm[aá]c|droga|hospital|consulta|cl[ií]nica/i.test(description)) return "Saúde";
  if (/netflix|spotify|apple.com|google|prime video|chatgpt|assinatura/i.test(description)) return "Assinaturas";
  return "Outros";
}
const excluded = /^(?:pagamento(?:\s|$)|total(?:\s|$)|subtotal(?:\s|$)|valor total|saldo(?:\s|$)|limite(?:\s|$)|cr[eé]dito recebido|estorno(?:\s|$)|fechamento(?:\s|$)|vencimento(?:\s|$)|fatura(?:\s|$))/i;
function splitCsv(line: string, delimiter: string): string[] {
  const cells: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += c;
  }
  cells.push(cell.trim()); return cells;
}
const headers = {
  date: /^(data(?: da)? (?:compra|transacao|lan[cç]amento)|data|date|transaction date)$/,
  desc: /^(descri[cç][aã]o|historico|lan[cç]amento|estabelecimento|comerciante|merchant|titulo|title|description)$/,
  value: /^(valor(?: da)? (?:compra|parcela|lan[cç]amento)|valor|valor r|amount|value)$/,
  parcel: /^(parcela|parcelas|installment|installments)$/,
};
function validRow(dateText: string, descText: string, amountText: string, month: string, parcelText = ""): StatementRow | null {
  const date = isoDate(dateText, month), amount_cents = cents(amountText);
  const description = normalizeDescription(descText);
  if (!date || !amount_cents || !description || excluded.test(description)) return null;
  return { date, description, amount_cents, category: category(description),
    installment_label: parcelText.trim().slice(0, 20) || null };
}
export function parseStatement(text: string, invoiceMonth: string): StatementResult {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(invoiceMonth)) throw Error("Mês de fatura inválido.");
  if (text.length > 1000000) throw Error("A fatura é muito grande. Use um arquivo de até 1 MB de texto.");
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines.length > 2500) throw Error("Arquivo extenso demais. Divida por fatura.");
  const rows: StatementRow[] = []; let ignored = 0;
  const warnings: string[] = [];
  let columnMap: { delimiter: string; date: number; desc: number; value: number; parcel: number } | null = null;
  for (const line of lines) {
    let row: StatementRow | null = null;
    const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cells = splitCsv(line, delimiter);
    if (!columnMap && cells.length >= 3) {
      const labels = cells.map(cleanHeader);
      const date = labels.findIndex(x => headers.date.test(x));
      const desc = labels.findIndex(x => headers.desc.test(x));
      const value = labels.findIndex(x => headers.value.test(x));
      if (date !== -1 && desc !== -1 && value !== -1) {
        columnMap = { delimiter, date, desc, value,
          parcel: labels.findIndex(x => headers.parcel.test(x)) };
        continue;
      }
    }
    if (columnMap) {
      const cols = splitCsv(line, columnMap.delimiter);
      row = validRow(cols[columnMap.date] || "", cols[columnMap.desc] || "",
        cols[columnMap.value] || "", invoiceMonth,
        columnMap.parcel >= 0 ? cols[columnMap.parcel] || "" : "");
    } else {
      const match = line.match(/^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2})\s*[;|\t ]+\s*(.+?)\s*[;|\t ]+\s*(?:R\$\s*)?([+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{2}))$/);
      if (match) row = validRow(match[1], match[2], match[3], invoiceMonth);
    }
    if (row) rows.push(row);
    else ignored++;
  }
  if (!rows.length) warnings.push("Nenhuma compra identificada. Confira o formato e copie somente os lançamentos da fatura.");
  if (ignored > 0) warnings.push(ignored + " linha(s) ignoradas (cabeçalhos, totais, estornos ou formatos não reconhecidos).");
  if (rows.some(r => r.installment_label)) warnings.push("Parcelas que já vieram na fatura são registradas apenas pelo valor deste mês, sem gerar parcelas futuras.");
  return { rows, ignored, warnings };
}
