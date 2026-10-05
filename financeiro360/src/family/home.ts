// Regras da casa: despensa, lista de mercado e rotina doméstica.
// Funções puras, sem tela nem banco, para serem testadas isoladamente.
import { addMonths, validIsoDate } from "../logic.ts";
import {
  forecast,
  today,
  type Pantry,
  type PantryEvent,
  type PantryLocation,
  type Shopping,
  type Task,
  type TaskKind,
  type TaskRepeat,
} from "./model.ts";

export const pantryLocations: Record<PantryLocation, { label: string; emoji: string }> = {
  kitchen: { label: "Armário da cozinha", emoji: "🥫" },
  fridge: { label: "Geladeira", emoji: "🧊" },
  freezer: { label: "Freezer", emoji: "❄️" },
  cleaning: { label: "Limpeza", emoji: "🧽" },
  hygiene: { label: "Higiene", emoji: "🧴" },
  other: { label: "Outros", emoji: "📦" },
};
export const locationOrder = Object.keys(pantryLocations) as PantryLocation[];
export const locationOf = (p: Pantry): PantryLocation =>
  p.location && p.location in pantryLocations ? p.location : "kitchen";

export const pantryUnits = ["unidade", "kg", "g", "litro", "ml", "pacote", "caixa", "lata", "garrafa", "rolo", "dúzia"];

const DAY = 86400000;
const dayNumber = (date: string) => Date.parse(date + "T12:00:00Z") / DAY;
export const daysBetween = (from: string, to: string) => Math.round(dayNumber(to) - dayNumber(from));
export function addDays(date: string, days: number) {
  return new Date((dayNumber(date) + days) * DAY).toISOString().slice(0, 10);
}
export const formatDate = (date: string) => date.split("-").reverse().join("/");
export const formatQuantity = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Leigos pensam em "um pacote dura duas semanas", não em consumo por dia.
export const durationChoices = [
  [0, "Não sei / não acompanhar"],
  [3, "Uns 3 dias"],
  [7, "Uma semana"],
  [14, "Duas semanas"],
  [30, "Um mês"],
  [60, "Dois meses"],
] as const;
export function dailyUseFromDuration(days: number) {
  return days > 0 ? Math.round((1 / days) * 10000) / 10000 : 0;
}
export function durationFromDailyUse(dailyUse: number) {
  return dailyUse > 0 ? Math.round(1 / dailyUse) : 0;
}

export function expiry(p: Pantry, date = today()) {
  if (!p.expires_on || !validIsoDate(p.expires_on)) return null;
  const days = daysBetween(date, p.expires_on);
  const label = days < 0 ? `Venceu há ${-days} dia(s)` : days === 0 ? "Vence hoje" : days === 1 ? "Vence amanhã" : `Vence em ${days} dias`;
  return { days, label, level: days < 0 ? "expired" : days <= 3 ? "soon" : days <= 7 ? "week" : "ok" };
}

// Situação única, na ordem em que a pessoa precisa agir.
export function pantryStatus(p: Pantry, date = today()) {
  const f = forecast(p, date);
  const e = expiry(p, date);
  if (f.stock <= 0) return { level: "out", label: "Acabou", ...f };
  if (e && e.level === "expired") return { level: "expired", label: "Vencido", ...f };
  if (e && e.level === "soon") return { level: "soon", label: e.label, ...f };
  if (f.stock <= p.minimum || (f.days !== null && f.days < 7)) return { level: "low", label: "Repor em breve", ...f };
  return { level: "ok", label: "Em estoque", ...f };
}

export function attention(items: Pantry[], date = today()) {
  const statuses = items.map((p) => ({ p, s: pantryStatus(p, date) }));
  return {
    restock: statuses.filter(({ s }) => s.level === "out" || s.level === "low").map(({ p }) => p),
    expiring: items.filter((p) => {
      const e = expiry(p, date);
      return e !== null && e.days <= 7 && forecast(p, date).stock > 0;
    }),
  };
}

// Explica por que um produto aparece na lista sugerida.
export function suggestionReason(p: Pantry, date = today()) {
  const s = pantryStatus(p, date);
  if (s.level === "out") return "acabou";
  if (s.stock <= p.minimum) return `abaixo do mínimo (${formatQuantity(p.minimum)} ${p.unit})`;
  if (s.days !== null) return `deve acabar em ${s.days} dia(s)`;
  return "reposição planejada";
}

export function wasteThisMonth(events: PantryEvent[], month: string) {
  const lost = events.filter((e) => e.kind === "lost" && e.created_at.slice(0, 7) === month);
  return { count: lost.length, cents: lost.reduce((sum, e) => sum + Number(e.value_cents || 0), 0) };
}

// Mercado: valor de cada linha em centavos inteiros e total dos itens marcados.
export function lineCents(quantity: number, unitCents: number) {
  return Math.round(quantity * unitCents);
}
export function shoppingGroups(items: Shopping[], pantry: Pantry[]) {
  const groups = new Map<PantryLocation, Shopping[]>();
  for (const s of items) {
    const p = pantry.find((x) => x.id === s.pantry_id);
    const key = p ? locationOf(p) : "other";
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  return locationOrder.filter((key) => groups.has(key)).map((key) => ({ key, ...pantryLocations[key], items: groups.get(key)! }));
}
export function shoppingText(items: Shopping[], pantry: Pantry[], home: string) {
  const lines = [`🛒 Lista de compras — ${home}`];
  for (const g of shoppingGroups(items, pantry)) {
    lines.push("", `${g.emoji} ${g.label}`);
    for (const s of g.items) lines.push(`☐ ${s.name} — ${formatQuantity(s.quantity)} ${s.unit}`);
  }
  return lines.join("\n");
}

// Rotina doméstica.
export const taskKinds: Record<TaskKind, { label: string; emoji: string }> = {
  cleaning: { label: "Limpeza", emoji: "🧹" },
  laundry: { label: "Roupas", emoji: "🧺" },
  kitchen: { label: "Cozinha", emoji: "🍳" },
  maintenance: { label: "Manutenção", emoji: "🔧" },
  shopping: { label: "Compras", emoji: "🛒" },
  other: { label: "Outros", emoji: "📌" },
};
export const repeatLabels: Record<TaskRepeat, string> = {
  none: "Não repete",
  daily: "Todo dia",
  weekly: "Toda semana",
  biweekly: "A cada 15 dias",
  monthly: "Todo mês",
};
// Modelos só preenchem o formulário; nada é cadastrado sem a pessoa salvar.
export const taskTemplates: { title: string; kind: TaskKind; repeat: TaskRepeat }[] = [
  { title: "Tirar o lixo", kind: "cleaning", repeat: "daily" },
  { title: "Limpar o banheiro", kind: "cleaning", repeat: "weekly" },
  { title: "Trocar a roupa de cama", kind: "laundry", repeat: "biweekly" },
  { title: "Lavar roupas", kind: "laundry", repeat: "weekly" },
  { title: "Limpar a geladeira", kind: "kitchen", repeat: "monthly" },
  { title: "Regar as plantas", kind: "other", repeat: "weekly" },
  { title: "Conferir a despensa", kind: "shopping", repeat: "weekly" },
  { title: "Trocar o filtro de água", kind: "maintenance", repeat: "none" },
];

// Mesma regra do banco (fin_private.next_due): conta a partir do dia em que foi feita.
export function nextDue(repeat: TaskRepeat, doneOn: string) {
  if (repeat === "none") return null;
  if (repeat === "monthly") {
    const month = addMonths(doneOn.slice(0, 7), 1);
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${month}-${String(Math.min(Number(doneOn.slice(8, 10)), last)).padStart(2, "0")}`;
  }
  return addDays(doneOn, repeat === "daily" ? 1 : repeat === "weekly" ? 7 : 14);
}

export function dueLabel(t: Task, date = today()) {
  if (!t.due_date) return "Sem data";
  const days = daysBetween(date, t.due_date);
  if (days < 0) return `Atrasada ${-days} dia(s)`;
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `${formatDate(t.due_date)} · em ${days} dias`;
}

export function taskGroups(tasks: Task[], date = today(), assignee = "all") {
  const open = tasks
    .filter((t) => !t.done_at && (assignee === "all" || t.assignee_id === assignee || (assignee === "none" && !t.assignee_id)))
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || a.title.localeCompare(b.title));
  const week = addDays(date, 7);
  return {
    overdue: open.filter((t) => t.due_date && t.due_date < date),
    today: open.filter((t) => t.due_date === date),
    week: open.filter((t) => t.due_date && t.due_date > date && t.due_date <= week),
    later: open.filter((t) => t.due_date && t.due_date > week),
    undated: open.filter((t) => !t.due_date),
    done: tasks
      .filter((t) => t.done_at)
      .sort((a, b) => b.done_at!.localeCompare(a.done_at!))
      .slice(0, 10),
  };
}
