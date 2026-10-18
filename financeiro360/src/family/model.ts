import {
  invoiceMonth,
  installmentAmount,
  addMonths,
  parseMoney,
  validIsoDate,
} from "../logic.ts";
export { parseMoney, validIsoDate };
export type Permission =
  | "entries"
  | "cards"
  | "payments"
  | "documents"
  | "pantry"
  | "shopping";
export const permissions: Record<Permission, string> = {
  entries: "Registrar e editar seus gastos",
  cards: "Cadastrar seus cartões e contas",
  payments: "Informar pagamentos",
  documents: "Anexar comprovantes e faturas",
  pantry: "Atualizar a despensa",
  shopping: "Organizar e concluir compras",
};
export interface Member {
  home_id: string;
  user_id: string;
  display_name: string;
  role: "admin" | "member";
  active: boolean;
  permissions: Record<Permission, boolean>;
  password_change_required: boolean;
}
export interface Home {
  id: string;
  name: string;
  owner_id: string;
  budget_cents: number;
}
export interface RecordBase {
  id: string;
  home_id: string;
  owner_id: string;
  shared: boolean;
  created_at?: string;
}
export interface Account extends RecordBase {
  name: string;
  area: string;
  opening_cents: number | null;
  balance_date: string | null;
  share_balance?: boolean;
  current_balance_cents?: number | null;
}
export interface AccountBalanceCheck {
  id: string;
  home_id: string;
  owner_id: string;
  account_id: string;
  previous_cents: number | null;
  previous_date: string | null;
  balance_cents: number | null;
  balance_date: string | null;
  created_at: string;
}
export interface Card extends RecordBase {
  name: string;
  limit_cents: number | null;
  closing_day: number;
  due_day: number;
  archived_at?: string | null;
  merged_into_id?: string | null;
}
export interface Entry extends RecordBase {
  description: string;
  payee?: string | null;
  amount_cents: number;
  date: string;
  due_date: string | null;
  kind: "expense" | "income" | "card_payment" | "transfer" | "debt_payment";
  category: string;
  subcategory?: string | null;
  area: string;
  status: "paid" | "pending" | "pending_review";
  payment: "cash" | "card";
  card_id: string | null;
  account_id: string | null;
  target_account_id: string | null;
  debt_id: string | null;
  debt_installment_number?: number | null;
  installments: number;
  invoice_month: string | null;
  first_invoice_month?: string | null;
  source_ref: string | null;
}
export interface Debt extends RecordBase {
  name: string;
  creditor: string;
  balance_cents: number | null;
  due_date: string | null;
  area: string;
  installment_count?: number | null;
  installment_cents?: number | null;
  first_due_date?: string | null;
}
export interface InvoiceAlignment {
  id: string;
  home_id: string;
  owner_id: string;
  card_id: string;
  invoice_month: string;
  cutoff_on: string;
  total_cents: number;
  note: string;
  active: boolean;
  created_at: string;
}
export interface InvoiceAlignmentException {
  id: string;
  home_id: string;
  owner_id: string;
  alignment_id: string;
  entry_id: string;
  count_after: boolean;
}
export interface CategoryPreset extends RecordBase {
  category: string;
  subcategory: string | null;
}
export interface Goal extends RecordBase {
  name: string;
  target_cents: number;
  saved_cents: number;
  due_date: string | null;
}
export interface Pantry {
  id: string;
  home_id: string;
  name: string;
  unit: string;
  quantity: number;
  minimum: number;
  daily_use: number;
  price_cents: number;
  expires_on: string | null;
  updated_at: string;
  location?: PantryLocation;
}
export type PantryLocation = "kitchen" | "fridge" | "freezer" | "cleaning" | "hygiene" | "other";
export interface PantryEvent {
  id: string;
  home_id: string;
  pantry_id: string | null;
  name: string;
  kind: "used" | "lost" | "finished" | "counted";
  quantity: number;
  value_cents: number;
  actor_id: string;
  created_at: string;
}
export type TaskRepeat = "none" | "daily" | "weekly" | "biweekly" | "monthly";
export type TaskKind = "cleaning" | "laundry" | "kitchen" | "maintenance" | "shopping" | "other";
export interface Task {
  id: string;
  home_id: string;
  title: string;
  notes: string;
  kind: TaskKind;
  assignee_id: string | null;
  due_date: string | null;
  repeat: TaskRepeat;
  done_at: string | null;
  done_by: string | null;
  previous_id: string | null;
  created_by: string;
  created_at: string;
  // Passos marcáveis (até 20). Ausente enquanto a atualização da agenda não estiver no banco.
  steps?: TaskStep[];
}
export interface TaskStep {
  text: string;
  done: boolean;
}
// Agenda: data e hora locais da casa (sem fuso). Hora vazia = dia todo.
export type EventVisibility = "private" | "busy" | "home";
export type EventRepeat = "none" | "daily" | "weekly" | "monthly" | "yearly";
export interface CalendarEvent {
  id: string;
  home_id: string;
  owner_id: string;
  title: string;
  notes: string;
  day: string;
  start_time: string | null;
  end_time: string | null;
  place: string;
  visibility: EventVisibility;
  people: string[];
  repeat: EventRepeat;
  repeat_until: string | null;
  remind_minutes: number | null;
  created_at: string;
}
// Compromisso de outra pessoa marcado como "ocupado": só horário e dono, nunca o título.
export interface BusySlot {
  id: string;
  owner_id: string;
  day: string;
  start_time: string | null;
  end_time: string | null;
  repeat: EventRepeat;
  repeat_until: string | null;
}
// Caixa de entrada: anotação rápida, privada, para organizar depois.
export interface InboxItem {
  id: string;
  home_id: string;
  owner_id: string;
  text: string;
  created_at: string;
  done_at: string | null;
}
// Lista de desejos com espera antes de comprar.
export interface Wish {
  id: string;
  home_id: string;
  owner_id: string;
  name: string;
  price_cents: number;
  link: string;
  wait_until: string;
  decision: "bought" | "gave_up" | null;
  decided_at: string | null;
  shared: boolean;
  created_at: string;
}
export interface Shopping {
  id: string;
  home_id: string;
  name: string;
  pantry_id: string | null;
  quantity: number;
  unit: string;
  estimate_cents: number;
  bought: boolean;
}
// Item criado pela casa ou oferta de encarte. Com offer_until é uma oferta e exige preço.
export interface CatalogEntry {
  id: string;
  home_id: string;
  name: string;
  brand: string;
  size: string;
  unit: string;
  category: string;
  store: string;
  price_cents: number | null;
  offer_until: string | null;
  // Código de barras e origem: "off" = produto das bases abertas (pode ser atualizado pela API).
  barcode: string;
  source: string;
  created_by: string;
  created_at: string;
}
export interface Document extends RecordBase {
  name: string;
  path: string;
  entry_id: string | null;
  card_id: string | null;
  mime: string;
  size: number;
}
export interface Audit {
  id: string;
  actor_id: string;
  action: string;
  table_name: string;
  created_at: string;
}
export interface Recurring extends RecordBase {
  name: string;
  amount_cents: number;
  category: string;
  area: string;
  day: number;
  start_month: string;
}
export interface Reminder {
  id: string;
  home_id: string;
  owner_id: string;
  title: string;
  due_on: string | null;
  recurrence: "once" | "weekly" | "monthly" | "yearly";
  kind: "reminder" | "due_date" | "post_it";
  note: string;
  color: "yellow" | "blue" | "pink" | "green";
  completed: boolean;
  created_at?: string;
}
export interface Data {
  home: Home;
  members: Member[];
  accounts: Account[];
  account_balance_checks: AccountBalanceCheck[];
  cards: Card[];
  invoice_alignments: InvoiceAlignment[];
  invoice_alignment_exceptions: InvoiceAlignmentException[];
  category_presets: CategoryPreset[];
  entries: Entry[];
  debts: Debt[];
  goals: Goal[];
  pantry: Pantry[];
  shopping: Shopping[];
  documents: Document[];
  audit: Audit[];
  recurring: Recurring[];
  tasks: Task[];
  pantryEvents: PantryEvent[];
  catalog: CatalogEntry[];
  events: CalendarEvent[];
  busy: BusySlot[];
  inbox: InboxItem[];
  wishes: Wish[];
  reminders: Reminder[];
}
export function entryVisibleTo(
  entry: Entry,
  viewerId: string,
  viewerRole: Member["role"],
  members: Member[],
) {
  return entry.owner_id === viewerId || entry.shared ||
    (viewerRole === "admin" && members.some((member) => member.user_id === entry.owner_id && member.role === "admin"));
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function forecast(p: Pantry, date = today()) {
  const elapsed = Math.max(
    0,
    Math.floor(
      (Date.parse(date + "T12:00:00Z") - Date.parse(p.updated_at)) / 86400000,
    ),
  );
  const stock = Math.max(0, p.quantity - elapsed * p.daily_use);
  return {
    stock,
    days: p.daily_use > 0 ? Math.floor(stock / p.daily_use) : null,
  };
}
// Arredonda para cima em centésimos sem herdar ruído de ponto flutuante (2,1 − 1,2 não vira 0,91).
export const roundUpHundredths = (n: number) => Math.ceil(Number((n * 100).toFixed(6))) / 100;
export function recommendations(
  items: Pantry[],
  existing: Shopping[],
  days = 14,
  date = today(),
) {
  return items
    .filter((p) => !existing.some((s) => !s.bought && s.pantry_id === p.id))
    .map((p) => {
      const f = forecast(p, date);
      const target = Math.max(p.minimum, p.daily_use * days);
      return {
        p,
        quantity: roundUpHundredths(Math.max(0, target - f.stock)),
      };
    })
    .filter((x) => x.quantity > 0);
}
export function installments(e: Entry, c: Card, month: string) {
  return invoiceInstallments([e], c, month)[0]?.amount_cents || 0;
}

export interface InvoiceInstallment {
  entry: Entry;
  number: number;
  total: number;
  amount_cents: number;
}

export function invoiceInstallments(entries: Entry[], c: Card, month: string) {
  const lines: InvoiceInstallment[] = [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return lines;
  for (const e of entries) {
    if (
      e.kind !== "expense" ||
      e.payment !== "card" ||
      e.card_id !== c.id ||
      e.status === "pending_review" ||
      !validIsoDate(e.date) ||
      !Number.isInteger(e.installments) ||
      e.installments < 1
    )
      continue;
    const first = e.first_invoice_month || invoiceMonth(e.date, c.closing_day);
    for (let i = 0; i < e.installments; i++)
      if (addMonths(first, i) === month)
        lines.push({
          entry: e,
          number: i + 1,
          total: e.installments,
          amount_cents: installmentAmount(e.amount_cents, e.installments, i),
        });
  }
  return lines;
}
export function invoice(data: Data, c: Card, month: string) {
  const lines = invoiceInstallments(data.entries, c, month);
  const listed = lines.reduce(
    (sum, line) => sum + line.amount_cents,
    0,
  );
  const alignment = data.invoice_alignments?.find((item) => item.card_id === c.id && item.invoice_month === month && item.active);
  const exceptions = new Map(data.invoice_alignment_exceptions?.filter((item) => item.alignment_id === alignment?.id).map((item) => [item.entry_id, item.count_after]) || []);
  const added = alignment ? lines.filter((line) => exceptions.get(line.entry.id) ?? line.entry.date > alignment.cutoff_on)
    .reduce((sum, line) => sum + line.amount_cents, 0) : 0;
  const included = alignment ? lines.filter((line) => !(exceptions.get(line.entry.id) ?? line.entry.date > alignment.cutoff_on))
    .reduce((sum, line) => sum + line.amount_cents, 0) : 0;
  const total = alignment ? alignment.total_cents + added : listed;
  const paid = data.entries
    .filter(
      (e) =>
        e.kind === "card_payment" &&
        e.card_id === c.id &&
        e.invoice_month === month &&
        e.status === "paid",
    )
    .reduce((s, e) => s + e.amount_cents, 0);
  return { total, paid, remaining: Math.max(0, total - paid), listed, added, included,
    untracked: alignment ? alignment.total_cents - included : 0, alignment,
    overpaid: Math.max(0, paid - total) };
}
export function balance(data: Data, a: Account) {
  if ("current_balance_cents" in a) return a.current_balance_cents ?? null;
  if (a.opening_cents === null || !a.balance_date) return null;
  return data.entries
    .filter((e) => e.status === "paid" && e.date > a.balance_date!)
    .reduce((s, e) => {
      if (e.kind === "transfer")
        return (
          s +
          (e.target_account_id === a.id ? e.amount_cents : 0) -
          (e.account_id === a.id ? e.amount_cents : 0)
        );
      if (e.account_id !== a.id || e.payment === "card") return s;
      return s + (e.kind === "income" ? e.amount_cents : -e.amount_cents);
    }, a.opening_cents);
}
export function metrics(data: Data, month: string, date = today()) {
  const valid = data.entries.filter((e) => e.status !== "pending_review");
  const current = valid.filter((e) => e.date.startsWith(month));
  const expenses = current.filter((e) => e.kind === "expense");
  const spend = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const income = current
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + e.amount_cents, 0);
  const home = expenses
    .filter((e) => e.area === "household")
    .reduce((s, e) => s + e.amount_cents, 0);
  const categories = new Map<string, number>();
  expenses.forEach((e) =>
    categories.set(
      e.category,
      (categories.get(e.category) || 0) + e.amount_cents,
    ),
  );
  return {
    spend,
    income,
    home,
    categories: [...categories].sort((a, b) => b[1] - a[1]),
    overdue: valid.filter(
      (e) => e.status === "pending" && e.due_date && e.due_date < date,
    ),
    pending: data.entries.filter((e) => e.status === "pending_review"),
    cash: current
      .filter(
        (e) =>
          e.status === "paid" && e.payment === "cash" && e.kind !== "transfer",
      )
      .reduce(
        (s, e) => s + (e.kind === "income" ? e.amount_cents : -e.amount_cents),
        0,
      ),
  };
}
export function financialOverview(data: Data, month: string) {
  const current = data.entries.filter(
    (e) => e.date.startsWith(month) && e.status !== "pending_review",
  );
  const expenses = current.filter((e) => e.kind === "expense");
  const sum = (rows: Entry[]) =>
    rows.reduce((total, e) => total + e.amount_cents, 0);
  const byArea = (area: string) =>
    sum(expenses.filter((e) => e.area === area));
  const payments = current.filter(
    (e) => e.kind === "card_payment" || e.kind === "debt_payment",
  );
  const transfers = current.filter((e) => e.kind === "transfer");
  const investments = transfers.filter((e) =>
    /investimento|renan/i.test(e.category),
  );
  const internalTransfers = transfers.filter((e) =>
    /transferência interna|estorno de transferência/i.test(e.category),
  );
  const unresolvedRows = data.entries.filter(
    (e) =>
      e.date.startsWith(month) &&
      (e.status === "pending_review" || /revisar|confirmar/i.test(e.category)),
  );
  const income = sum(current.filter((e) => e.kind === "income"));
  const spend = sum(expenses);
  const knownBalances = data.accounts
    .map((account) => ({ account, value: balance(data, account) }))
    .filter(
      (
        item,
      ): item is { account: Account; value: number } => item.value !== null,
    );
  return {
    personal: byArea("personal"),
    household: byArea("household"),
    business: byArea("business"),
    payments: sum(payments),
    transfers: sum(transfers),
    internalTransfers: sum(internalTransfers),
    investments: sum(investments),
    unresolved: sum(unresolvedRows),
    unresolvedCount: unresolvedRows.length,
    income,
    spend,
    result: income - spend,
    knownBalance: knownBalances.reduce((total, item) => total + item.value, 0),
    knownAccountCount: knownBalances.length,
  };
}

export function monthPicture(data: Data, month: string) {
  const visible = data.entries.filter((e) => e.status !== "pending_review");
  const purchased = visible
    .filter((e) => e.kind === "expense" && e.date.startsWith(month))
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const cashDue = visible
    .filter((e) => e.kind === "expense" && e.payment === "cash" &&
      e.status === "pending" && (e.due_date || e.date).startsWith(month))
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const cardDue = data.cards.reduce((sum, card) => {
    const cycles = [month, addMonths(month, -1)];
    return sum + cycles
      .filter((cycle) => (card.due_day <= card.closing_day ? addMonths(cycle, 1) : cycle) === month)
      .reduce((subtotal, cycle) => subtotal + invoice(data, card, cycle).remaining, 0);
  }, 0);
  const cashOut = visible
    .filter((e) => e.status === "paid" && e.payment === "cash" &&
      e.date.startsWith(month) &&
      (e.kind === "expense" || e.kind === "card_payment" || e.kind === "debt_payment"))
    .reduce((sum, e) => sum + e.amount_cents, 0);
  return { purchased, due: cashDue + cardDue, cashDue, cardDue, cashOut };
}

export function validateEntry(e: Entry) {
  if (
    !e.description.trim() ||
    e.description.length > 160 ||
    !e.category.trim() ||
    e.category.length > 80 ||
    (e.subcategory != null && e.subcategory.length > 80) ||
    (e.payee != null && e.payee.length > 160) ||
    !Number.isSafeInteger(e.amount_cents) ||
    e.amount_cents <= 0 ||
    !validIsoDate(e.date) ||
    (e.due_date && !validIsoDate(e.due_date)) ||
    !Number.isInteger(e.installments) ||
    e.installments < 1 ||
    e.installments > 48
  )
    throw Error("Confira descrição, valor, data e parcelas.");
  if (e.payment === "card" && (e.kind !== "expense" || !e.card_id))
    throw Error("Compra no cartão exige um cartão cadastrado.");
  if (e.first_invoice_month &&
      (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.first_invoice_month) ||
        e.first_invoice_month < e.date.slice(0, 7)))
    throw Error("A primeira fatura deve ser no mês da compra ou depois.");
  if (
    e.kind === "card_payment" &&
    (!e.card_id ||
      !e.invoice_month ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(e.invoice_month))
  )
    throw Error("Selecione o cartão e o mês da fatura.");
  if (
    e.kind === "transfer" &&
    (!e.account_id ||
      !e.target_account_id ||
      e.account_id === e.target_account_id)
  )
    throw Error("Transferência exige duas contas diferentes.");
  if (e.kind === "debt_payment" && !e.debt_id)
    throw Error("Selecione a dívida.");
  if (e.debt_installment_number != null &&
    (e.kind !== "debt_payment" || !Number.isInteger(e.debt_installment_number) || e.debt_installment_number < 1 || e.debt_installment_number > 360))
    throw Error("Selecione uma parcela válida deste empréstimo.");
  return e;
}
