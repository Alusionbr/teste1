import "./style.css";
import { readStored, writeStored, STORAGE_KEY } from "./storage";
import {
  accountBalance, backupSummary, dueDate, expenseTotal, incomeTotal, invoiceLines, monthEntries, obligationBalance, obligationStatus, parseSignedMoney,
  parseBackup, parseMoney, pendingRecurring, recurrenceDate, totalCents, validIsoDate,
  type Account, type Entry, type Person, type ReviewItem, type State,
} from "./logic";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Elemento #app não encontrado.");

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const today = localDate();
let month = today.slice(0, 7);
let tab = "overview";
const loaded = readStored(() => localStorage.getItem(STORAGE_KEY));
let state = loaded.state;
let storageBlocked = loaded.blocked;
let notice = storageBlocked ? "Os dados locais não puderam ser lidos. Importe um backup válido em Dados antes de lançar novos registros; o conteúdo anterior foi preservado." : "";
let pendingImport: State | null = null;
let importFilename = "";
let selectedReviewId: string | null = null;

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
const id = () => crypto.randomUUID();
const value = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? "").trim();
const personName = (person: Person) => state.names[person] || (person === "wife" ? "Esposa" : "Marido");
const peopleOptions = (selected: Person = "wife") => (["wife", "husband"] as const).map((person) => `<option value="${person}" ${selected === person ? "selected" : ""}>${escapeHtml(personName(person))}</option>`).join("");
const monthLabel = (selected: string) => new Date(`${selected}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function save(): boolean {
  const saved = writeStored((serialized) => localStorage.setItem(STORAGE_KEY, serialized), state, storageBlocked);
  if (!saved) notice = storageBlocked ? "Gravação bloqueada: importe um backup válido para preservar os dados existentes." : "Não foi possível salvar neste navegador. Exporte um backup e verifique o espaço disponível.";
  return saved;
}

function commitChange(change: () => void, successMessage: string) {
  if (storageBlocked) { notice = "Gravação bloqueada: importe um backup válido antes de alterar dados."; render(); return; }
  const before = structuredClone(state);
  change();
  if (save()) notice = successMessage;
  else state = before;
  render();
}

function accountOptions() {
  return state.accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}</option>`).join("");
}

function cardOptions() {
  return state.cards.map((card) => `<option value="${escapeHtml(card.id)}">${escapeHtml(card.name)} · ${escapeHtml(personName(card.owner))}</option>`).join("");
}

function overview() {
  const entries = monthEntries(state.entries, month);
  const family = entries.filter((entry) => entry.kind === "expense" && entry.scope === "family");
  const personal = entries.filter((entry) => entry.kind === "expense" && entry.scope === "personal");
  const spent = expenseTotal(family);
  const ratio = state.budgetCents ? spent / state.budgetCents : 0;
  const pending = state.market.filter((item) => !item.boughtDate).reduce((sum, item) => sum + Math.round(item.quantity * item.estimatedCents), 0);
  const recurringPending = pendingRecurring(state, month);
  const recurringFamilyForecast = recurringPending.filter((item) => item.scope === "family").reduce((sum, item) => sum + item.amountCents, 0);
  const byCategory = new Map<string, number>();
  for (const entry of family) byCategory.set(entry.category, (byCategory.get(entry.category) || 0) + entry.amountCents);
  const categories = [...byCategory].sort((a, b) => b[1] - a[1]);
  const alerts = [
    ratio >= 1 ? "Orçamento do lar ultrapassado neste mês." : ratio >= .8 ? "O lar já usou pelo menos 80% do orçamento mensal." : "",
    pending ? `Lista de mercado pendente: ${money(pending)} estimados.` : "",
  ].filter(Boolean);
  return `
    <section class="intro"><h2>Visão do lar · ${escapeHtml(monthLabel(month))}</h2><p>Os números são calculados dos lançamentos manuais salvos neste navegador.</p></section>
    <div class="metrics">
      <article class="metric"><span>Despesas do lar</span><strong>${money(spent)}</strong><small>Por data da compra; inclui cartão uma vez</small></article>
      <article class="metric"><span>Orçamento restante</span><strong>${money(state.budgetCents - spent)}</strong><small>Meta mensal ${money(state.budgetCents)} · previsto com fixas: ${money(state.budgetCents - spent - recurringFamilyForecast)}</small></article>
      <article class="metric"><span>Despesas pessoais</span><strong>${money(expenseTotal(personal))}</strong><small>Fora do orçamento do lar</small></article>
      <article class="metric"><span>Receitas lançadas</span><strong>${money(incomeTotal(entries))}</strong><small>Saldo previsto: ${money(incomeTotal(entries) - expenseTotal(entries))}</small></article>
    </div>
    ${alerts.length ? `<div class="alert" role="status">${alerts.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>` : ""}
    <div class="two-col">
      <section class="panel"><h3>Custos do lar por categoria</h3>${categories.length ? `<ul class="summary-list">${categories.map(([category, total]) => `<li><span>${escapeHtml(category)}</span><strong>${money(total)}</strong></li>`).join("")}</ul>` : `<p class="empty">Nenhuma despesa do lar neste mês.</p>`}</section>
      <section class="panel"><h3>Como funciona o cartão</h3><p>Uma compra entra no custo do mês em que foi feita. Sua parcela aparece na fatura do mês correspondente. Pagar a fatura não cria uma segunda despesa.</p><button type="button" data-tab="cards" class="secondary">Ver faturas</button></section>
    </div>
    <section class="panel recurring-panel"><h3>Despesas fixas previstas neste mês</h3><p>A previsão não entra no gasto real até você confirmar o lançamento.</p>${recurringPending.length ? `<ul class="summary-list">${recurringPending.map((item) => `<li><span>${escapeHtml(item.name)} · ${recurrenceDate(month, item.day).split("-").reverse().join("/")} · ${item.scope === "family" ? "Lar" : "Pessoal"}</span><strong>${money(item.amountCents)}</strong><button type="button" data-confirm-recurring="${escapeHtml(item.id)}">Confirmar</button></li>`).join("")}</ul>` : `<p class="empty">Nenhuma despesa fixa pendente neste mês.</p>`}</section>
  `;
}

function entriesView() {
  const entries = monthEntries(state.entries, month).sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="two-col top-align">
      <section class="panel"><h2>Novo lançamento manual</h2>
        <form id="entry-form" class="form-grid">
          <label>Tipo<select name="kind"><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
          <label>Data<input name="date" type="date" value="${today}" required></label>
          <label class="wide">Descrição<input name="description" maxlength="160" placeholder="Ex.: compras da semana" required></label>
          <label>Valor total (R$)<input name="amount" inputmode="decimal" placeholder="0,00" required></label>
          <label>Categoria<input name="category" maxlength="80" list="categories" placeholder="Ex.: Mercado" required></label>
          <datalist id="categories"><option value="Mercado"><option value="Moradia"><option value="Saúde"><option value="Transporte"><option value="Lazer"><option value="Educação"><option value="Salário"><option value="Outros"></datalist>
          <label>Quem fez o lançamento<select name="buyer">${peopleOptions()}</select></label>
          <label>Uso<select name="scope"><option value="family">Lar / família</option><option value="personal">Pessoal</option></select></label>
          <label>Pagamento<select name="payment"><option value="cash">Dinheiro / débito / Pix</option><option value="card">Cartão de crédito</option></select></label>
          <label>Cartão<select name="cardId"><option value="">Selecione</option>${cardOptions()}</select></label>
          <label>Conta de origem/destino<select name="accountId"><option value="">Sem conta vinculada</option>${accountOptions()}</select></label>
          <label>Parcelas<select name="installments" type="number"><option value="1">1×</option>${Array.from({ length: 23 }, (_, index) => `<option value="${index + 2}">${index + 2}×</option>`).join("")}</select></label>
          <p class="hint wide">Parcelas só se aplicam a despesas no cartão. Cadastre o cartão antes de usar.</p>
          <button type="submit">Salvar lançamento</button>
        </form>
      </section>
      <section class="panel"><h2>Lançamentos de ${escapeHtml(monthLabel(month))}</h2>
        ${entries.length ? `<ul class="records">${entries.map((entry) => `<li><div><strong>${escapeHtml(entry.description)}</strong><small>${entry.date.split("-").reverse().join("/")} · ${escapeHtml(entry.category)} · ${escapeHtml(personName(entry.buyer))} · ${entry.scope === "family" ? "Lar" : "Pessoal"} · ${entry.payment === "card" ? `Cartão ${entry.installments}×` : "À vista"}</small></div><strong class="${entry.kind}">${entry.kind === "expense" ? "−" : "+"}${money(entry.amountCents)}</strong><button type="button" class="icon-button" data-delete-entry="${escapeHtml(entry.id)}" aria-label="Excluir lançamento">×</button></li>`).join("")}</ul>` : `<p class="empty">Sem lançamentos neste mês.</p>`}
      </section>
    </div>
  `;
}

function cardsView() {
  return `
    <div class="two-col top-align"><section class="panel"><h2>Cartões da casa</h2><p>O titular e quem fez cada compra são informações separadas.</p>
      <form id="card-form" class="form-grid">
        <label class="wide">Nome do cartão<input name="name" maxlength="160" placeholder="Ex.: Cartão da esposa" required></label>
        <label>Titular<select name="owner">${peopleOptions()}</select></label>
        <label>Limite (R$)<input name="limit" inputmode="decimal" placeholder="0,00" required></label>
        <label>Dia do fechamento<input name="closingDay" type="number" min="1" max="31" value="20" required></label>
        <label>Dia do vencimento<input name="dueDay" type="number" min="1" max="31" value="10" required></label>
        <button type="submit">Adicionar cartão</button>
      </form>
    </section><section class="panel"><h2>Faturas · ${escapeHtml(monthLabel(month))}</h2>
      ${state.cards.length ? state.cards.map((card) => {
        const lines = invoiceLines(state.entries, card, month);
        const total = totalCents(lines);
        const byWife = totalCents(lines.filter((line) => line.entry.buyer === "wife"));
        const byHusband = total - byWife;
        return `<div class="card-block"><div class="card-heading"><h3>${escapeHtml(card.name)}</h3><button type="button" class="icon-button" data-delete-card="${escapeHtml(card.id)}" aria-label="Excluir cartão">×</button></div><p>Titular: ${escapeHtml(personName(card.owner))} · Fecha dia ${card.closingDay} · Vence ${dueDate(month, card).split("-").reverse().join("/")}</p><p>Limite cadastrado: ${money(card.limitCents)}</p><strong>Total da fatura: ${money(total)}</strong><p>${escapeHtml(personName("wife"))}: ${money(byWife)} · ${escapeHtml(personName("husband"))}: ${money(byHusband)}</p>${lines.length ? `<ul class="summary-list">${lines.map((line) => `<li><span>${escapeHtml(line.entry.description)} · ${line.installment}/${line.entry.installments} · ${escapeHtml(personName(line.entry.buyer))}</span><strong>${money(line.amountCents)}</strong></li>`).join("")}</ul>` : `<p class="empty">Sem parcelas nesta fatura.</p>`}</div>`;
      }).join("") : `<p class="empty">Cadastre um cartão para lançar compras na fatura.</p>`}
      <p class="hint">Fatura prevista pelas compras registradas. Não indica pagamento, saldo bancário nem limite disponível em tempo real.</p>
    </section></div>
  `;
}

function marketView() {
  const pending = state.market.filter((item) => !item.boughtDate);
  const bought = state.market.filter((item) => item.boughtDate);
  return `
    <div class="two-col top-align"><section class="panel"><h2>Lista de mercado</h2>
      <form id="market-form" class="form-grid">
        <label class="wide">Produto<input name="name" maxlength="160" placeholder="Ex.: arroz" required></label>
        <label>Quantidade<input name="quantity" type="number" min="0.01" step="0.01" value="1" required></label>
        <label>Preço estimado por unidade (R$)<input name="estimate" inputmode="decimal" placeholder="0,00" required></label>
        <button type="submit">Adicionar à lista</button>
      </form>
      <h3>Pendentes</h3>
      ${pending.length ? `<ul class="market-list">${pending.map((item) => `<li><div><strong>${escapeHtml(item.name)}</strong><small>${item.quantity} × ${money(item.estimatedCents)} = ${money(Math.round(item.quantity * item.estimatedCents))} estimados</small></div><button type="button" class="secondary" data-buy="${escapeHtml(item.id)}">Registrar compra</button><button type="button" class="icon-button" data-delete-market="${escapeHtml(item.id)}" aria-label="Remover item">×</button></li>`).join("")}</ul>` : `<p class="empty">Lista vazia.</p>`}
    </section><section class="panel"><h2>Compras registradas</h2><p>Ao registrar, o custo real entra automaticamente como despesa do lar na categoria Mercado.</p>
      ${bought.length ? `<ul class="summary-list">${bought.map((item) => `<li><span>${escapeHtml(item.name)} · ${item.boughtDate?.split("-").reverse().join("/")}</span><strong>${money(item.actualCents || 0)}</strong></li>`).join("")}</ul>` : `<p class="empty">Nenhuma compra registrada.</p>`}
      <p class="hint">O preço real é o total pago pelo item, não o preço unitário. Para corrigir um lançamento, exclua a despesa em Lançamentos e registre o item novamente.</p>
    </section></div>
    <dialog id="buy-dialog"><form id="buy-form" class="form-grid"><h2 class="wide">Registrar compra</h2><input type="hidden" name="itemId"><label>Data<input name="date" type="date" value="${today}" required></label><label>Total real pago (R$)<input name="actual" inputmode="decimal" placeholder="0,00" required></label><label>Quem comprou<select name="buyer">${peopleOptions()}</select></label><label>Pagamento<select name="payment"><option value="cash">Dinheiro / débito / Pix</option><option value="card">Cartão de crédito</option></select></label><label>Cartão<select name="cardId"><option value="">Selecione</option>${cardOptions()}</select></label><label>Conta usada à vista<select name="accountId"><option value="">Sem conta vinculada</option>${accountOptions()}</select></label><div class="dialog-actions wide"><button type="button" class="secondary" data-close-dialog>Cancelar</button><button type="submit">Salvar compra</button></div></form></dialog>
  `;
}

function accountsView() {
  const transfers = state.transfers.filter((transfer) => transfer.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  return `<section class="intro"><h2>Contas e transferências</h2><p>Os rótulos pessoal, empresa e família organizam os dados neste dispositivo; não controlam quem pode acessá-los.</p></section>
    <div class="two-col top-align"><section class="panel"><h3>Contas</h3>
      <form id="account-form" class="form-grid">
        <label class="wide">Nome<input name="name" maxlength="160" placeholder="Ex.: conta pessoal" required></label>
        <label>Tipo<select name="kind"><option value="personal">Pessoal</option><option value="business">Empresa</option><option value="family">Família</option></select></label>
        <label>Titular<select name="owner"><option value="">Conjunto / sem titular definido</option>${peopleOptions()}</select></label>
        <label>Saldo inicial (R$)<input name="opening" inputmode="decimal" placeholder="Deixe vazio se desconhecido"></label>
        <label>Saldo conhecido ao fim de<input name="asOfDate" type="date" value="${today}"></label>
        <p class="hint wide">Saldo vazio permanece desconhecido. Com saldo informado, lançamentos após a data-base alteram o valor exibido.</p>
        <button type="submit">Adicionar conta</button>
      </form>
      ${state.accounts.length ? `<ul class="records account-list">${state.accounts.map((account) => {
        const balance = accountBalance(state, account);
        return `<li><div><strong>${escapeHtml(account.name)}</strong><small>${account.kind === "business" ? "Empresa" : account.kind === "family" ? "Família" : "Pessoal"} · ${account.owner ? escapeHtml(personName(account.owner)) : "Conjunta"} · ${account.asOfDate ? `base ${account.asOfDate}` : "sem saldo-base"}</small></div><strong>${balance === null ? "Saldo desconhecido" : money(balance)}</strong><button type="button" class="icon-button" data-delete-account="${escapeHtml(account.id)}" aria-label="Excluir conta">×</button></li>`;
      }).join("")}</ul>` : `<p class="empty">Nenhuma conta cadastrada.</p>`}
    </section><section class="panel"><h3>Transferir entre contas próprias</h3><p>Transferência muda saldos conhecidos, sem entrar em receitas, despesas ou orçamento.</p>
      <form id="transfer-form" class="form-grid">
        <label>Data<input name="date" type="date" value="${today}" required></label>
        <label>Valor (R$)<input name="amount" inputmode="decimal" placeholder="0,00" required></label>
        <label>De<select name="fromAccountId"><option value="">Selecione</option>${accountOptions()}</select></label>
        <label>Para<select name="toAccountId"><option value="">Selecione</option>${accountOptions()}</select></label>
        <label class="wide">Descrição<input name="description" maxlength="160" placeholder="Ex.: transferência interna" required></label>
        <label class="wide">Origem / referência (opcional)<input name="sourceRef" maxlength="160"></label>
        <button type="submit">Registrar transferência</button>
      </form>
      <h3>Transferências de ${escapeHtml(monthLabel(month))}</h3>
      ${transfers.length ? `<ul class="records">${transfers.map((transfer) => `<li><div><strong>${escapeHtml(transfer.description)}</strong><small>${transfer.date} · ${escapeHtml(state.accounts.find((account) => account.id === transfer.fromAccountId)?.name || "?")} → ${escapeHtml(state.accounts.find((account) => account.id === transfer.toAccountId)?.name || "?")}</small></div><strong>${money(transfer.amountCents)}</strong><button type="button" class="icon-button" data-delete-transfer="${escapeHtml(transfer.id)}" aria-label="Excluir transferência">×</button></li>`).join("")}</ul>` : `<p class="empty">Nenhuma transferência neste mês.</p>`}
    </section></div>`;
}

function obligationsView() {
  return `<section class="intro"><h2>Dívidas e obrigações de principal</h2><p>Registre o saldo devido conhecido ou deixe-o desconhecido. Pagamentos parciais reduzem a dívida e a conta usada, sem virar uma segunda despesa. Aluguel e serviços mensais continuam em Despesas fixas.</p></section>
    <div class="two-col top-align"><section class="panel"><h3>Nova dívida</h3>
      <form id="obligation-form" class="form-grid">
        <label>Descrição<input name="name" maxlength="160" placeholder="Ex.: empréstimo" required></label>
        <label>Credor<input name="creditor" maxlength="160" placeholder="Nome ou instituição" required></label>
        <label>Responsável<select name="owner">${peopleOptions()}</select></label>
        <label>Uso<select name="scope"><option value="personal">Pessoal</option><option value="family">Família</option></select></label>
        <label>Saldo devido conhecido (R$)<input name="startingBalance" inputmode="decimal" placeholder="Vazio se desconhecido"></label>
        <label>Vencimento<input name="dueDate" type="date"></label>
        <label class="wide">Origem / referência (opcional)<input name="sourceRef" maxlength="160"></label>
        <button type="submit">Adicionar dívida</button>
      </form>
      <h3>Posição atual</h3>
      ${state.obligations.length ? `<ul class="records">${state.obligations.map((obligation) => {
        const balance = obligationBalance(obligation);
        return `<li><div><strong>${escapeHtml(obligation.name)}</strong><small>${escapeHtml(obligation.creditor)} · ${escapeHtml(personName(obligation.owner))} · ${obligation.scope === "family" ? "Lar" : "Pessoal"} · ${obligationStatus(obligation)}${obligation.dueDate ? ` · vence ${obligation.dueDate}` : ""}</small></div><strong>${balance === null ? "Saldo desconhecido" : money(balance)}</strong><button type="button" class="icon-button" data-delete-obligation="${escapeHtml(obligation.id)}" aria-label="Excluir dívida">×</button></li>`;
      }).join("")}</ul>` : `<p class="empty">Nenhuma dívida cadastrada.</p>`}
    </section><section class="panel"><h3>Pagamento parcial</h3>
      <form id="obligation-payment-form" class="form-grid">
        <label class="wide">Dívida<select name="obligationId"><option value="">Selecione</option>${state.obligations.map((obligation) => `<option value="${escapeHtml(obligation.id)}">${escapeHtml(obligation.name)}</option>`).join("")}</select></label>
        <label>Data<input name="date" type="date" value="${today}" required></label>
        <label>Principal pago (R$)<input name="amount" inputmode="decimal" placeholder="0,00" required></label>
        <label class="wide">Conta usada<select name="accountId"><option value="">Não vinculada</option>${accountOptions()}</select></label>
        <label class="wide">Origem / referência (opcional)<input name="sourceRef" maxlength="160"></label>
        <button type="submit">Registrar pagamento</button>
      </form>
      ${state.obligations.some((obligation) => obligation.payments.length) ? `<h3>Pagamentos</h3><ul class="records">${state.obligations.flatMap((obligation) => obligation.payments.map((payment) => `<li><div><strong>${escapeHtml(obligation.name)}</strong><small>${payment.date} · ${escapeHtml(state.accounts.find((account) => account.id === payment.accountId)?.name || "sem conta")}</small></div><strong>${money(payment.amountCents)}</strong><button type="button" class="icon-button" data-delete-payment="${escapeHtml(obligation.id)}:${escapeHtml(payment.id)}" aria-label="Excluir pagamento">×</button></li>`)).join("")}</ul>` : `<p class="empty">Nenhum pagamento registrado.</p>`}
      <p class="hint">Com saldo inicial desconhecido, os pagamentos ficam registrados, mas o saldo continua desconhecido até uma conciliação.</p>
    </section></div>`;
}

function planningView() {
  return `<section class="panel narrow"><h2>Planejamento do casal</h2><p>Defina os nomes exibidos e a meta de despesas compartilhadas por mês. As despesas pessoais ficam separadas da meta.</p>
    <form id="planning-form" class="form-grid">
      <label>Nome da esposa<input name="wifeName" maxlength="80" value="${escapeHtml(state.names.wife)}" required></label>
      <label>Nome do marido<input name="husbandName" maxlength="80" value="${escapeHtml(state.names.husband)}" required></label>
      <label>Orçamento mensal do lar (R$)<input name="budget" inputmode="decimal" value="${(state.budgetCents / 100).toFixed(2).replace(".", ",")}" required></label>
      <button type="submit">Salvar planejamento</button>
    </form>
    <p class="hint">A meta vale para todos os meses; o histórico de lançamentos permanece por data. Alertas são exibidos ao abrir este aplicativo, sem notificações ou sincronização.</p>
    <h3>Despesas fixas mensais</h3><p>Cadastre aluguel, internet ou outras contas. A previsão aparece todo mês; confirme manualmente quando o gasto acontecer.</p>
    <form id="recurring-form" class="form-grid">
      <label class="wide">Descrição<input name="name" maxlength="160" placeholder="Ex.: aluguel" required></label>
      <label>Valor previsto (R$)<input name="amount" inputmode="decimal" placeholder="0,00" required></label>
      <label>Categoria<input name="category" maxlength="80" placeholder="Ex.: Moradia" required></label>
      <label>Responsável<select name="buyer">${peopleOptions()}</select></label>
      <label>Uso<select name="scope"><option value="family">Lar / família</option><option value="personal">Pessoal</option></select></label>
      <label>Dia do mês<input name="day" type="number" min="1" max="31" value="1" required></label>
      <label>Começa em<input name="startMonth" type="month" value="${month}" required></label>
      <button type="submit">Adicionar despesa fixa</button>
    </form>
    ${state.recurring.length ? `<ul class="summary-list recurring-list">${state.recurring.map((item) => `<li><span>${escapeHtml(item.name)} · ${money(item.amountCents)} · dia ${item.day} · desde ${item.startMonth}</span><button type="button" class="icon-button" data-delete-recurring="${escapeHtml(item.id)}" aria-label="Remover despesa fixa">×</button></li>`).join("")}</ul>` : `<p class="empty">Nenhuma despesa fixa cadastrada.</p>`}
  </section>`;
}

function reviewView() {
  const selected = state.pending.find((item) => item.id === selectedReviewId);
  return `<section class="intro"><h2>Registros pendentes de revisão</h2><p>Dados incompletos ou incertos ficam aqui, fora de saldos, receitas, despesas e faturas, até você confirmar cada registro.</p></section>
    <div class="two-col top-align"><section class="panel"><h3>Adicionar pendência</h3>
      <form id="pending-form" class="form-grid">
        <label class="wide">Descrição<input name="description" maxlength="160" required></label>
        <label>Tipo provável<select name="kind"><option value="">Ainda incerto</option><option value="expense">Despesa</option><option value="income">Receita</option><option value="transfer">Transferência</option><option value="obligation">Dívida</option></select></label>
        <label>Data conhecida<input name="date" type="date"></label>
        <label>Valor conhecido (R$)<input name="amount" inputmode="decimal" placeholder="Vazio se desconhecido"></label>
        <label class="wide">Origem / referência<input name="sourceRef" maxlength="160" placeholder="Ex.: anotação em conversa" required></label>
        <label>Data da fonte<input name="sourceDate" type="date"></label>
        <label>Confiança<select name="confidence"><option value="unknown">Desconhecida</option><option value="probable">Provável</option><option value="verified">Fonte verificada</option></select></label>
        <label class="wide">O que falta conferir?<input name="notes" maxlength="500" placeholder="Ex.: confirmar data e conta"></label>
        <button type="submit">Guardar como pendente</button>
      </form>
    </section><section class="panel"><h3>Fila de revisão · ${state.pending.length}</h3>
      ${state.pending.length ? `<ul class="records">${state.pending.map((item) => `<li><div><strong>${escapeHtml(item.description)}</strong><small>${item.date || "data desconhecida"} · ${item.kind || "tipo incerto"} · origem: ${escapeHtml(item.sourceRef)}${item.sourceDate ? ` (${item.sourceDate})` : ""} · ${item.confidence === "verified" ? "fonte verificada" : item.confidence === "probable" ? "provável" : "incerto"}${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</small></div><strong>${item.amountCents === null ? "Valor desconhecido" : money(item.amountCents)}</strong>${item.kind !== "transfer" && item.kind !== "obligation" ? `<button type="button" class="secondary" data-review-item="${escapeHtml(item.id)}">Revisar</button>` : ""}<button type="button" class="icon-button" data-delete-pending="${escapeHtml(item.id)}" aria-label="Remover pendência">×</button></li>`).join("")}</ul>` : `<p class="empty">Nenhum registro pendente.</p>`}
      <p class="hint">Transferências e dívidas pendentes precisam ser conciliadas nas áreas Contas ou Dívidas. Remova a pendência só depois de registrá-las corretamente.</p>
    </section></div>
    <dialog id="review-dialog" aria-labelledby="review-title">${selected ? `<h2 id="review-title">Confirmar registro revisado</h2><p>Origem: ${escapeHtml(selected.sourceRef)}</p><form id="review-form" class="form-grid"><input type="hidden" name="pendingId" value="${escapeHtml(selected.id)}"><label>Tipo<select name="kind"><option value="expense" ${selected.kind === "expense" ? "selected" : ""}>Despesa</option><option value="income" ${selected.kind === "income" ? "selected" : ""}>Receita</option></select></label><label>Data<input name="date" type="date" value="${selected.date || ""}" required></label><label class="wide">Descrição<input name="description" maxlength="160" value="${escapeHtml(selected.description)}" required></label><label>Valor (R$)<input name="amount" inputmode="decimal" value="${selected.amountCents === null ? "" : (selected.amountCents / 100).toFixed(2).replace(".", ",")}" required></label><label>Categoria<input name="category" maxlength="80" value="${escapeHtml(selected.category)}" required></label><label>Responsável<select name="buyer">${peopleOptions(selected.buyer || "wife")}</select></label><label>Uso<select name="scope"><option value="family" ${selected.scope === "family" ? "selected" : ""}>Lar / família</option><option value="personal" ${selected.scope === "personal" ? "selected" : ""}>Pessoal</option></select></label><label>Pagamento<select name="payment"><option value="cash">À vista</option><option value="card" ${selected.payment === "card" ? "selected" : ""}>Cartão</option></select></label><label>Conta<select name="accountId"><option value="">Sem conta</option>${accountOptions()}</select></label><label>Cartão<select name="cardId"><option value="">Selecione</option>${cardOptions()}</select></label><div class="dialog-actions wide"><button type="button" class="secondary" data-close-review>Cancelar</button><button type="submit">Confirmar lançamento</button></div></form>` : ""}</dialog>`;
}

function dataView() {
  const draft = pendingImport;
  const summary = draft ? backupSummary(draft) : null;
  const preview = draft ? draft.entries.slice(0, 10).map((entry) => `<li><span>${escapeHtml(entry.date)} · ${escapeHtml(entry.description)} · ${escapeHtml(draft.names[entry.buyer])}</span><strong>${money(entry.amountCents)}</strong></li>`).join("") : "";
  const pendingPreview = draft ? draft.pending.slice(0, 10).map((item) => `<li><span>${escapeHtml(item.description)} · transação: ${item.date ? escapeHtml(item.date) : "data incerta"} · fonte: ${item.sourceDate ? escapeHtml(item.sourceDate) : "data incerta"}</span><strong>${item.amountCents === null ? "Valor incerto" : money(item.amountCents)}</strong></li>`).join("") : "";
  return `<section class="panel narrow"><h2>Seus dados</h2><p>Dados ficam somente neste navegador e dispositivo. O casal não vê atualizações em dois celulares automaticamente. Use exportar/importar para transferir manualmente um backup.</p>
    <div class="button-row"><button type="button" data-export>Exportar backup JSON</button><label class="file-label">Importar backup JSON<input id="import-file" type="file" accept="application/json,.json"></label></div>
    <p class="hint">Importar substitui todos os dados locais após revisão e confirmação. Guarde o arquivo de backup em local seguro: ele contém suas informações financeiras.</p>
    ${state.importInfo ? `<p class="hint">Última origem informada: ${escapeHtml(state.importInfo.source)} · ${escapeHtml(state.importInfo.importedAt)} · ${state.importInfo.entryCount} lançamentos. Esta origem foi informada por quem importou; o app não a verifica.</p>` : ""}
  </section>
  <dialog id="import-dialog" aria-labelledby="import-title"><h2 id="import-title">Revisar importação</h2>
    ${summary ? `<p>Arquivo: <strong>${escapeHtml(importFilename)}</strong></p><p>${summary.entries} lançamentos · ${summary.cards} cartões · ${summary.market} itens de mercado · ${summary.recurring} despesas fixas · ${summary.accounts} contas · ${summary.transfers} transferências · ${summary.obligations} dívidas · ${summary.pending} pendências</p><p>Período: ${summary.firstDate || "sem lançamentos"} ${summary.lastDate && summary.lastDate !== summary.firstDate ? `até ${summary.lastDate}` : ""}</p><h3>Primeiros lançamentos</h3>${preview ? `<ul class="summary-list import-preview">${preview}</ul>` : `<p class="empty">Nenhum lançamento confirmado.</p>`}${summary.pending ? `<h3>Primeiras pendências</h3><p class="hint">Pendências ficam fora dos totais até revisão e confirmação. Exibindo até 10 de ${summary.pending}.</p><ul class="summary-list import-preview">${pendingPreview}</ul>` : ""}<label class="import-label">Origem informada por você<input id="import-source" maxlength="160" value="${escapeHtml(importFilename)}" required></label><label class="import-consent"><input id="import-agree" type="checkbox"> Entendo que isto substituirá todos os dados locais atuais.</label><div class="dialog-actions"><button type="button" class="secondary" data-cancel-import>Cancelar</button><button type="button" data-confirm-import>Substituir dados locais</button></div>` : ""}
  </dialog>`;
}

const views: Record<string, () => string> = { overview, entries: entriesView, cards: cardsView, accounts: accountsView, obligations: obligationsView, market: marketView, planning: planningView, review: reviewView, data: dataView };
function render() {
  root!.innerHTML = `<header class="topbar"><div class="topbar-inner"><div><p class="brand-kicker">Planejamento do lar</p><h1>${escapeHtml(import.meta.env.VITE_APP_NAME || "Financeiro360")}</h1></div><p>Registro manual · dados apenas neste dispositivo</p></div></header>
    <div class="layout"><nav class="tabs" aria-label="Áreas do aplicativo">${[
      ["overview", "Visão geral"], ["entries", "Lançamentos"], ["cards", "Cartões e faturas"], ["accounts", "Contas"], ["obligations", "Dívidas"], ["market", "Mercado"], ["planning", "Planejamento"], ["review", "Pendências"], ["data", "Dados"],
    ].map(([key, label]) => `<button type="button" data-tab="${key}" class="${tab === key ? "active" : ""}">${label}</button>`).join("")}</nav>
    <div class="month-bar"><label>Mês de referência <input id="month" type="month" value="${month}"></label></div>
    ${notice ? `<div class="notice" role="status">${escapeHtml(notice)}</div>` : ""}
    ${views[tab]()}</div>`;
}

function requireMoney(raw: string, label: string, allowZero = false): number {
  const parsed = parseMoney(raw);
  if (parsed === null || (!allowZero && parsed === 0)) throw new Error(`Informe ${label} válido em reais (ex.: 12,50).`);
  return parsed;
}

root.addEventListener("click", (event) => {
  const target = event.target as Element;
  const tabButton = target.closest<HTMLButtonElement>("[data-tab]");
  if (tabButton) { tab = tabButton.dataset.tab || "overview"; pendingImport = null; notice = ""; render(); return; }
  if (target.closest("[data-close-dialog]")) { root?.querySelector<HTMLDialogElement>("#buy-dialog")?.close(); return; }
  if (target.closest("[data-cancel-import]")) { pendingImport = null; importFilename = ""; render(); return; }
  if (target.closest("[data-close-review]")) { selectedReviewId = null; render(); return; }
  const reviewItem = target.closest<HTMLButtonElement>("[data-review-item]");
  if (reviewItem) { selectedReviewId = reviewItem.dataset.reviewItem || null; tab = "review"; render(); root?.querySelector<HTMLDialogElement>("#review-dialog")?.showModal(); return; }
  const removePending = target.closest<HTMLButtonElement>("[data-delete-pending]");
  if (removePending) {
    if (!confirm("Remover esta pendência? Confira antes se ela foi registrada no lugar correto.")) return;
    commitChange(() => { state.pending = state.pending.filter((item) => item.id !== removePending.dataset.deletePending); }, "Pendência removida."); return;
  }
  if (target.closest("[data-confirm-import]")) {
    if (!pendingImport) return;
    const agreed = root?.querySelector<HTMLInputElement>("#import-agree")?.checked;
    const source = root?.querySelector<HTMLInputElement>("#import-source")?.value.trim() || "";
    if (!agreed || !source) { notice = "Informe a origem e confirme que os dados locais serão substituídos."; root?.querySelector<HTMLDialogElement>("#import-dialog")?.close(); render(); root?.querySelector<HTMLDialogElement>("#import-dialog")?.showModal(); return; }
    const before = state, wasBlocked = storageBlocked;
    state = { ...pendingImport, importInfo: { source, importedAt: new Date().toISOString(), entryCount: pendingImport.entries.length } };
    storageBlocked = false;
    if (save()) { notice = "Backup importado após revisão."; pendingImport = null; importFilename = ""; }
    else { state = before; storageBlocked = wasBlocked; }
    render(); return;
  }
  const buy = target.closest<HTMLButtonElement>("[data-buy]");
  if (buy) {
    const dialog = root?.querySelector<HTMLDialogElement>("#buy-dialog");
    const hidden = dialog?.querySelector<HTMLInputElement>('input[name="itemId"]');
    if (dialog && hidden) { hidden.value = buy.dataset.buy || ""; dialog.showModal(); }
    return;
  }
  const confirmRecurring = target.closest<HTMLButtonElement>("[data-confirm-recurring]");
  if (confirmRecurring) {
    const item = pendingRecurring(state, month).find((candidate) => candidate.id === confirmRecurring.dataset.confirmRecurring);
    if (!item) { notice = "Esta previsão já foi confirmada ou não pertence ao mês."; render(); return; }
    commitChange(() => {
      state.entries.push({ id: id(), date: recurrenceDate(month, item.day), description: item.name, amountCents: item.amountCents, kind: "expense", category: item.category, buyer: item.buyer, scope: item.scope, payment: "cash", installments: 1, recurringId: item.id, recurringMonth: month });
    }, "Despesa fixa confirmada e lançada."); return;
  }
  const removeRecurring = target.closest<HTMLButtonElement>("[data-delete-recurring]");
  if (removeRecurring) {
    if (!confirm("Remover esta previsão futura? Lançamentos já confirmados permanecem.")) return;
    commitChange(() => { state.recurring = state.recurring.filter((item) => item.id !== removeRecurring.dataset.deleteRecurring); }, "Previsão removida."); return;
  }
  const removeAccount = target.closest<HTMLButtonElement>("[data-delete-account]");
  if (removeAccount) {
    const accountId = removeAccount.dataset.deleteAccount;
    if (state.entries.some((entry) => entry.accountId === accountId) || state.transfers.some((transfer) => transfer.fromAccountId === accountId || transfer.toAccountId === accountId) || state.obligations.some((obligation) => obligation.payments.some((payment) => payment.accountId === accountId)) || state.pending.some((item) => item.accountId === accountId)) { notice = "A conta tem registros vinculados. Revise-os antes de excluir."; render(); return; }
    if (!confirm("Excluir esta conta sem registros vinculados?")) return;
    commitChange(() => { state.accounts = state.accounts.filter((account) => account.id !== accountId); }, "Conta excluída."); return;
  }
  const removeTransfer = target.closest<HTMLButtonElement>("[data-delete-transfer]");
  if (removeTransfer) {
    if (!confirm("Excluir esta transferência?")) return;
    commitChange(() => { state.transfers = state.transfers.filter((transfer) => transfer.id !== removeTransfer.dataset.deleteTransfer); }, "Transferência excluída."); return;
  }
  const removeObligation = target.closest<HTMLButtonElement>("[data-delete-obligation]");
  if (removeObligation) {
    const obligationId = removeObligation.dataset.deleteObligation;
    const obligation = state.obligations.find((item) => item.id === obligationId);
    if (obligation?.payments.length) { notice = "Exclua primeiro os pagamentos desta dívida."; render(); return; }
    if (!confirm("Excluir esta dívida?")) return;
    commitChange(() => { state.obligations = state.obligations.filter((item) => item.id !== obligationId); }, "Dívida excluída."); return;
  }
  const removePayment = target.closest<HTMLButtonElement>("[data-delete-payment]");
  if (removePayment) {
    const [obligationId, paymentId] = (removePayment.dataset.deletePayment || "").split(":");
    if (!confirm("Excluir este pagamento parcial?")) return;
    commitChange(() => { const obligation = state.obligations.find((item) => item.id === obligationId); if (obligation) obligation.payments = obligation.payments.filter((payment) => payment.id !== paymentId); }, "Pagamento excluído."); return;
  }
  const removeEntry = target.closest<HTMLButtonElement>("[data-delete-entry]");
  if (removeEntry) {
    if (!confirm("Excluir este lançamento?")) return;
    const entryId = removeEntry.dataset.deleteEntry;
    commitChange(() => {
      state.entries = state.entries.filter((entry) => entry.id !== entryId);
      for (const item of state.market) if (item.entryId === entryId) { item.entryId = undefined; item.boughtDate = undefined; item.actualCents = undefined; }
    }, "Lançamento excluído."); return;
  }
  const removeCard = target.closest<HTMLButtonElement>("[data-delete-card]");
  if (removeCard) {
    const cardId = removeCard.dataset.deleteCard;
    if (state.entries.some((entry) => entry.cardId === cardId)) { notice = "Exclua primeiro os lançamentos vinculados a este cartão."; render(); return; }
    if (!confirm("Excluir este cartão?")) return;
    commitChange(() => { state.cards = state.cards.filter((card) => card.id !== cardId); }, "Cartão excluído."); return;
  }
  const removeMarket = target.closest<HTMLButtonElement>("[data-delete-market]");
  if (removeMarket) { commitChange(() => { state.market = state.market.filter((item) => item.id !== removeMarket.dataset.deleteMarket); }, "Item removido."); return; }
  if (target.closest("[data-export]")) {
    if (storageBlocked) { notice = "Importe um backup válido antes de exportar; os dados anteriores não foram apagados."; render(); return; }
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `financeiro360-backup-${today}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

root.addEventListener("change", async (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "month" && /^\d{4}-\d{2}$/.test(target.value)) { month = target.value; render(); return; }
  if (target.id === "import-file" && target.files?.[0]) {
    pendingImport = null;
    try {
      const file = target.files[0];
      if (file.size > 10 * 1024 * 1024) throw new Error("O backup deve ter até 10 MB.");
      pendingImport = parseBackup(JSON.parse(await file.text()));
      importFilename = file.name;
      notice = "Revise o conteúdo antes de substituir seus dados.";
    } catch (error) { notice = error instanceof Error ? error.message : "Não foi possível importar o arquivo."; }
    render();
    if (pendingImport) root?.querySelector<HTMLDialogElement>("#import-dialog")?.showModal();
  }
});

root.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const before = structuredClone(state);
  let successMessage = "";
  try {
    if (storageBlocked) throw new Error("Gravação bloqueada: importe um backup válido antes de lançar novos registros.");
    if (form.id === "entry-form") {
      const kind = value(form, "kind") as Entry["kind"];
      const payment = value(form, "payment") as Entry["payment"];
      const cardId = value(form, "cardId");
      const accountId = value(form, "accountId");
      const count = Number(value(form, "installments"));
      const date = value(form, "date");
      if (!validIsoDate(date)) throw new Error("Informe uma data válida.");
      if (payment === "card" && kind === "expense" && !state.cards.some((card) => card.id === cardId)) throw new Error("Selecione um cartão cadastrado.");
      if (kind === "income" && payment === "card") throw new Error("Receitas não podem ser lançadas na fatura do cartão.");
      if (payment === "cash" && accountId && !state.accounts.some((account) => account.id === accountId)) throw new Error("Conta inválida.");
      state.entries.push({ id: id(), date, description: value(form, "description"), amountCents: requireMoney(value(form, "amount"), "um valor"), kind, category: value(form, "category"), buyer: value(form, "buyer") as Person, scope: value(form, "scope") as Entry["scope"], payment, cardId: payment === "card" ? cardId : undefined, accountId: payment === "cash" && accountId ? accountId : undefined, installments: payment === "card" ? count : 1 });
      month = date.slice(0, 7); successMessage = "Lançamento salvo.";
    } else if (form.id === "card-form") {
      const closingDay = Number(value(form, "closingDay")), dueDay = Number(value(form, "dueDay"));
      if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) throw new Error("Dias de fechamento e vencimento devem estar entre 1 e 31.");
      state.cards.push({ id: id(), name: value(form, "name"), owner: value(form, "owner") as Person, limitCents: requireMoney(value(form, "limit"), "um limite", true), closingDay, dueDay });
      successMessage = "Cartão cadastrado.";
    } else if (form.id === "market-form") {
      const quantity = Number(value(form, "quantity"));
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Informe uma quantidade válida.");
      state.market.push({ id: id(), name: value(form, "name"), quantity, estimatedCents: requireMoney(value(form, "estimate"), "um preço estimado", true) });
      successMessage = "Item adicionado à lista.";
    } else if (form.id === "buy-form") {
      const item = state.market.find((candidate) => candidate.id === value(form, "itemId"));
      if (!item || item.boughtDate) throw new Error("Item indisponível.");
      const payment = value(form, "payment") as Entry["payment"], cardId = value(form, "cardId"), accountId = value(form, "accountId"), date = value(form, "date");
      if (!validIsoDate(date)) throw new Error("Informe uma data válida.");
      if (payment === "card" && !state.cards.some((card) => card.id === cardId)) throw new Error("Selecione um cartão cadastrado.");
      if (payment === "cash" && accountId && !state.accounts.some((account) => account.id === accountId)) throw new Error("Conta inválida.");
      const actualCents = requireMoney(value(form, "actual"), "o total real");
      const entryId = id();
      state.entries.push({ id: entryId, date, description: `Mercado: ${item.name}`, amountCents: actualCents, kind: "expense", category: "Mercado", buyer: value(form, "buyer") as Person, scope: "family", payment, cardId: payment === "card" ? cardId : undefined, accountId: payment === "cash" && accountId ? accountId : undefined, installments: 1, marketItemId: item.id });
      item.actualCents = actualCents; item.boughtDate = date; item.entryId = entryId;
      month = date.slice(0, 7); successMessage = "Compra e despesa registradas.";
    } else if (form.id === "pending-form") {
      const dateRaw = value(form, "date"), sourceDateRaw = value(form, "sourceDate"), amountRaw = value(form, "amount");
      if (dateRaw && !validIsoDate(dateRaw)) throw new Error("Data da transação inválida.");
      if (sourceDateRaw && !validIsoDate(sourceDateRaw)) throw new Error("Data da fonte inválida.");
      const amountCents = amountRaw ? parseMoney(amountRaw) : null;
      if (amountRaw && (!amountCents || amountCents <= 0)) throw new Error("Valor da pendência inválido.");
      const kindRaw = value(form, "kind");
      state.pending.push({ id: id(), description: value(form, "description"), date: dateRaw || null, amountCents, kind: kindRaw ? kindRaw as ReviewItem["kind"] : null, category: "", buyer: null, scope: null, payment: null, accountId: null, cardId: null, sourceRef: value(form, "sourceRef"), notes: value(form, "notes"), sourceDate: sourceDateRaw || null, confidence: value(form, "confidence") as ReviewItem["confidence"], status: "pending_review" });
      successMessage = "Registro guardado como pendente, fora dos totais.";
    } else if (form.id === "review-form") {
      const item = state.pending.find((candidate) => candidate.id === value(form, "pendingId"));
      if (!item || item.kind === "transfer" || item.kind === "obligation") throw new Error("Pendência indisponível para este tipo de lançamento.");
      const kind = value(form, "kind") as Entry["kind"], payment = value(form, "payment") as Entry["payment"];
      const date = value(form, "date"), cardId = value(form, "cardId"), accountId = value(form, "accountId");
      if (!validIsoDate(date)) throw new Error("Informe a data confirmada.");
      if (payment === "card" && (kind !== "expense" || !state.cards.some((card) => card.id === cardId))) throw new Error("Selecione um cartão para a despesa.");
      if (payment === "cash" && accountId && !state.accounts.some((account) => account.id === accountId)) throw new Error("Conta inválida.");
      state.entries.push({ id: id(), date, description: value(form, "description"), amountCents: requireMoney(value(form, "amount"), "um valor"), kind, category: value(form, "category"), buyer: value(form, "buyer") as Person, scope: value(form, "scope") as Entry["scope"], payment, cardId: payment === "card" ? cardId : undefined, accountId: payment === "cash" && accountId ? accountId : undefined, installments: 1, sourceRef: item.sourceRef, sourceDate: item.sourceDate || undefined });
      state.pending = state.pending.filter((candidate) => candidate.id !== item.id);
      selectedReviewId = null; month = date.slice(0, 7); successMessage = "Registro revisado e incluído nos totais.";
    } else if (form.id === "account-form") {
      const openingRaw = value(form, "opening"), asOfRaw = value(form, "asOfDate");
      const openingBalanceCents = openingRaw ? parseSignedMoney(openingRaw) : null;
      if (openingRaw && openingBalanceCents === null) throw new Error("Saldo inicial inválido.");
      if (openingBalanceCents !== null && !validIsoDate(asOfRaw)) throw new Error("Informe a data-base do saldo conhecido.");
      const ownerRaw = value(form, "owner");
      state.accounts.push({ id: id(), name: value(form, "name"), kind: value(form, "kind") as Account["kind"], owner: ownerRaw ? ownerRaw as Person : null, openingBalanceCents, asOfDate: openingBalanceCents === null ? null : asOfRaw });
      successMessage = "Conta cadastrada.";
    } else if (form.id === "transfer-form") {
      const fromAccountId = value(form, "fromAccountId"), toAccountId = value(form, "toAccountId"), date = value(form, "date");
      if (!validIsoDate(date) || !state.accounts.some((account) => account.id === fromAccountId) || !state.accounts.some((account) => account.id === toAccountId) || fromAccountId === toAccountId) throw new Error("Selecione data válida e duas contas diferentes.");
      state.transfers.push({ id: id(), date, description: value(form, "description"), fromAccountId, toAccountId, amountCents: requireMoney(value(form, "amount"), "um valor"), sourceRef: value(form, "sourceRef") || undefined });
      month = date.slice(0, 7); successMessage = "Transferência registrada sem criar receita ou despesa.";
    } else if (form.id === "obligation-form") {
      const balanceRaw = value(form, "startingBalance"), dueRaw = value(form, "dueDate");
      const startingBalanceCents = balanceRaw ? parseMoney(balanceRaw) : null;
      if (balanceRaw && startingBalanceCents === null) throw new Error("Saldo da dívida inválido.");
      if (dueRaw && !validIsoDate(dueRaw)) throw new Error("Vencimento inválido.");
      state.obligations.push({ id: id(), name: value(form, "name"), creditor: value(form, "creditor"), owner: value(form, "owner") as Person, scope: value(form, "scope") as Entry["scope"], startingBalanceCents, dueDate: dueRaw || null, sourceRef: value(form, "sourceRef") || undefined, payments: [] });
      successMessage = "Dívida cadastrada.";
    } else if (form.id === "obligation-payment-form") {
      const obligation = state.obligations.find((item) => item.id === value(form, "obligationId"));
      const accountId = value(form, "accountId"), date = value(form, "date"), amountCents = requireMoney(value(form, "amount"), "um valor");
      if (!obligation || !validIsoDate(date) || (accountId && !state.accounts.some((account) => account.id === accountId))) throw new Error("Selecione dívida, data e conta válidas.");
      const balance = obligationBalance(obligation);
      if (balance !== null && amountCents > balance) throw new Error("Pagamento maior que o saldo da dívida.");
      obligation.payments.push({ id: id(), date, amountCents, accountId: accountId || undefined, sourceRef: value(form, "sourceRef") || undefined });
      month = date.slice(0, 7); successMessage = "Pagamento parcial registrado sem duplicar despesa.";
    } else if (form.id === "recurring-form") {
      const day = Number(value(form, "day")), startMonth = value(form, "startMonth");
      if (!Number.isInteger(day) || day < 1 || day > 31 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) throw new Error("Informe mês inicial e dia válidos.");
      state.recurring.push({ id: id(), name: value(form, "name"), amountCents: requireMoney(value(form, "amount"), "um valor"), category: value(form, "category"), buyer: value(form, "buyer") as Person, scope: value(form, "scope") as Entry["scope"], startMonth, day });
      successMessage = "Despesa fixa prevista nos próximos meses.";
    } else if (form.id === "planning-form") {
      state.names = { wife: value(form, "wifeName"), husband: value(form, "husbandName") };
      state.budgetCents = requireMoney(value(form, "budget"), "um orçamento", true);
      successMessage = "Planejamento salvo.";
    } else return;
    if (save()) notice = successMessage;
    else state = before;
    render();
  } catch (error) {
    state = before;
    notice = error instanceof Error ? error.message : "Não foi possível salvar.";
    render();
  }
});

render();
