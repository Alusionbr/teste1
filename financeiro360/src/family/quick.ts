// Lançamento rápido em uma linha ("mercado 52,30 nubank 3x"): vira um rascunho para conferir.
// Nada é salvo daqui; campos que o texto não deixou claros vão em `uncertain`.
import { parseMoney, validIsoDate } from "../logic.ts";
import type { Entry } from "./model.ts";
import { addDays, daysBetween } from "./home.ts";
import { recurrenceDate } from "../logic.ts";

export const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface QuickContext {
  cards: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  entries: Entry[];
  today: string;
}
export interface QuickDraft {
  kind: "expense" | "income" | "payable";
  description: string;
  amount_cents: number | null;
  date: string;
  due_date: string | null;
  payment: "cash" | "card";
  card_id: string | null;
  account_id: string | null;
  installments: number;
  category: string;
  uncertain: ("amount" | "description" | "card" | "category")[];
}

// Palavras de nomes de cartão/conta que não identificam nada sozinhas.
const generic = new Set(["cartao", "cartoes", "credito", "debito", "conta", "meu", "minha", "da", "do", "de", "banco", "corrente", "poupanca", "pessoal", "esposa", "marido"]);
const keywords: [RegExp, string][] = [
  [/\b(mercado|supermercado|atacadao|assai|sams|feira|hortifruti|padaria|acougue)\b/, "Mercado"],
  [/\b(uber|99|taxi|gasolina|combustivel|onibus|metro|estacionamento|pedagio)\b/, "Transporte"],
  [/\b(farmacia|remedio|medico|consulta|exame|dentista|plano de saude)\b/, "Saúde"],
  [/\b(aluguel|condominio|luz|energia|agua|internet|gas|iptu)\b/, "Moradia"],
  [/\b(escola|curso|livro|faculdade|material escolar|mensalidade)\b/, "Educação"],
  [/\b(cinema|restaurante|ifood|lanche|bar|viagem|show|pizza)\b/, "Lazer"],
  [/\b(salario|freela|pagamento recebido)\b/, "Salário"],
];
const incomeWords = /\b(recebi|receita|salario|entrada|ganhei|reembolso)\b/;

function nameMatch(text: string, items: { id: string; name: string }[]) {
  const words = new Set(text.split(/\s+/));
  return items.filter((item) => fold(item.name).split(/\s+/).some((w) => w.length >= 2 && !generic.has(w) && words.has(w)));
}
const removeWords = (text: string, name: string) => {
  let out = ` ${text} `;
  for (const w of fold(name).split(/\s+/)) if (w.length >= 2 && !generic.has(w)) out = out.replace(` ${w} `, " ");
  return out.trim();
};

// Categoria mais usada no histórico para a mesma descrição (ou a mesma primeira palavra).
function historyCategory(description: string, entries: Entry[]) {
  const target = fold(description);
  const first = target.split(" ")[0];
  const count = new Map<string, number>();
  for (const e of entries) {
    const d = fold(e.description);
    if (d === target || (first.length >= 3 && d.split(" ")[0] === first)) count.set(e.category, (count.get(e.category) || 0) + (d === target ? 3 : 1));
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

// Próxima vez que o dia `day` chega, a partir de hoje (hoje conta).
function nextDay(today: string, day: number) {
  const thisMonth = recurrenceDate(today.slice(0, 7), day);
  if (thisMonth >= today) return thisMonth;
  const [y, m] = today.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return recurrenceDate(next, day);
}

export function parseQuick(input: string, ctx: QuickContext): QuickDraft {
  let text = ` ${fold(input).replace(/[;]+/g, " ").replace(/\s+/g, " ")} `;
  const uncertain: QuickDraft["uncertain"] = [];
  let date = ctx.today,
    due: string | null = null,
    installments = 1,
    kind: QuickDraft["kind"] = "expense";
  const take = (re: RegExp) => {
    const m = text.match(re);
    if (m) text = text.replace(m[0], " ");
    return m;
  };
  const dueMatch = take(/\s(?:vence|vencimento|vencendo)(?:\s+(?:dia|em|no dia))?\s+(\d{1,2})(?:\/(\d{1,2}))?\s/);
  if (dueMatch) {
    kind = "payable";
    const day = Number(dueMatch[1]);
    if (day >= 1 && day <= 31) due = dueMatch[2] ? explicitDate(day, Number(dueMatch[2]), ctx.today) : nextDay(ctx.today, day);
  }
  const times = take(/\s(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\s/);
  if (times) installments = Math.min(48, Math.max(1, Number(times[1])));
  if (take(/\santeontem\s/)) date = addDays(ctx.today, -2);
  else if (take(/\sontem\s/)) date = addDays(ctx.today, -1);
  else if (take(/\shoje\s/)) date = ctx.today;
  else {
    const d = take(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\s/);
    if (d) {
      const found = explicitDate(Number(d[1]), Number(d[2]), ctx.today, d[3]);
      if (found) date = found;
    }
  }
  // Valor: prefere o número com centavos ("52,30"); senão o último número que sobrou.
  const money = [...text.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+[.,]\d{1,2}|\d+)(?=\s)/g)];
  const chosen = money.find((m) => /[.,]\d{1,2}$/.test(m[1])) || money[money.length - 1];
  let amount: number | null = null;
  if (chosen) {
    const raw = chosen[1].includes(",") || /\.\d{3}/.test(chosen[1]) ? chosen[1] : chosen[1].replace(".", ",");
    amount = parseMoney(raw);
    text = text.replace(chosen[0], " ");
  }
  if (!amount) uncertain.push("amount");
  if (incomeWords.test(text) && kind !== "payable") kind = "income";
  const cardWord = take(/\s(?:no\s+)?(?:cartao|credito)\s/);
  let card_id: string | null = null,
    account_id: string | null = null;
  const cards = nameMatch(text, ctx.cards);
  if (kind === "expense" && (cards.length || cardWord || installments > 1)) {
    if (cards.length === 1) {
      card_id = cards[0].id;
      text = ` ${removeWords(text, cards[0].name)} `;
    } else if (ctx.cards.length === 1) card_id = ctx.cards[0].id;
    else uncertain.push("card");
  } else {
    const accounts = nameMatch(text, ctx.accounts);
    if (accounts.length === 1) {
      account_id = accounts[0].id;
      text = ` ${removeWords(text, accounts[0].name)} `;
    }
  }
  const payment: QuickDraft["payment"] = kind === "expense" && (card_id || uncertain.includes("card")) ? "card" : "cash";
  if (payment === "cash") installments = 1;
  text = text.replace(/\s(?:pix|dinheiro|debito)(?=\s)/g, " ");
  if (kind === "income") text = text.replace(/\s(?:recebi|ganhei)(?=\s)/g, " ");
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/^(?:(?:no|na|em|com|de)\s)+|(?:\s(?:no|na|em|com|de|do|da))+$/g, "");
  // Mantém a grafia original do que a pessoa digitou para a descrição.
  const original = input.trim().split(/\s+/).filter((w) => cleaned.split(" ").includes(fold(w)));
  let description = original.join(" ").slice(0, 160);
  if (!description) {
    description = kind === "income" ? "Receita" : "";
    if (!description) uncertain.push("description");
  }
  if (description) description = description[0].toLocaleUpperCase("pt-BR") + description.slice(1);
  const folded = fold(description || input);
  let category = description ? historyCategory(description, ctx.entries) : "";
  if (!category) category = keywords.find(([re]) => re.test(` ${folded} `))?.[1] || "";
  if (!category && kind === "income") category = "Salário";
  if (!category) {
    category = "Outros";
    uncertain.push("category");
  }
  return { kind, description, amount_cents: amount, date, due_date: due, payment, card_id, account_id, installments, category, uncertain };
}

function explicitDate(day: number, month: number, today: string, year?: string) {
  const y = year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) : Number(today.slice(0, 4));
  const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!validIsoDate(iso)) return null;
  // Sem ano e muito no futuro ("20/12" digitado em janeiro): era o ano passado.
  if (!year && daysBetween(today, iso) > 60) return `${y - 1}${iso.slice(4)}`;
  return iso;
}

// Gastos que se repetem: os mais frequentes dos últimos 90 dias, para lançar com um toque.
export function frequentEntries(entries: Entry[], today: string, limit = 5) {
  const since = addDays(today, -90);
  const groups = new Map<string, { entry: Entry; count: number }>();
  for (const e of entries) {
    if (e.kind !== "expense" || e.status === "pending_review" || e.date < since || e.source_ref) continue;
    const key = `${fold(e.description)}|${e.payment}|${e.card_id || ""}`;
    const g = groups.get(key);
    if (!g) groups.set(key, { entry: e, count: 1 });
    else {
      g.count++;
      if (e.date > g.entry.date) g.entry = e;
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.entry.date.localeCompare(a.entry.date))
    .slice(0, limit)
    .map((g) => g.entry);
}
