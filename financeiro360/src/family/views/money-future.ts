// Telas de parcelamentos e dos próximos meses (aba de Cartões) e o bloco "Já comprometido" do Início.
import { addMonths, invoiceMonth } from "../../logic.ts";
import { parseMoney, type Card } from "../model.ts";
import { activeInstallments, averageIncome, commitments, freedUp, monthLabel, simulatePurchase, type ActivePlan } from "../plans.ts";
import { brl, button, esc, field, formActions, input, moneyInput, opt } from "../ui.ts";
import type { ViewCtx } from "./context.ts";

function planRow(p: ActivePlan, ctx: ViewCtx) {
  const progress = Math.round((p.paidCount / p.count) * 100);
  const open = p.kind === "carne" ? p.entries.find((e) => e.status === "pending") : null;
  const payable = open && ctx.own(open) && ctx.api.allowed("payments");
  return `<article class="record plan-row"><span class="record-icon">${p.kind === "card" ? "💳" : "🧾"}</span><div class="record-info"><strong>${esc(p.description)}</strong><small>${p.kind === "card" ? esc(p.card!.name) : "Carnê / boleto"} · ${p.paidCount}/${p.count} paga(s) · termina em ${monthLabel(p.lastMonth)}</small><div class="bar" role="img" aria-label="${progress}% pago"><b style="width:${progress}%"></b></div></div><div class="record-value"><strong>${brl(p.remainingCents)}</strong><small>faltam ${p.remainingCount}x de ${brl(p.nextCents)}</small></div>${payable ? `<div class="record-actions">${button("paid", "Paguei a parcela", "secondary", `data-id="${open!.id}"`)}</div>` : ""}</article>`;
}

export function plansView(ctx: ViewCtx) {
  const d = ctx.api.data!;
  const plans = activeInstallments(d, ctx.month);
  const remaining = plans.reduce((s, p) => s + p.remainingCents, 0);
  const monthly = plans.reduce((s, p) => s + p.nextCents, 0);
  const freed = freedUp(plans, ctx.month);
  const actions = `<div class="button-row">${ctx.api.allowed("entries") ? button("simulate", "Cabe no mês? Simular") + button("add-carne", "Novo carnê ou boleto parcelado", "secondary") : ""}</div>`;
  return `${actions}<div class="house-stats"><div><span>Parcelamentos ativos</span><strong>${plans.length}</strong><small>a partir de ${monthLabel(ctx.month)}</small></div><div><span>Ainda falta pagar</span><strong>${brl(remaining)}</strong><small>somando todas as parcelas restantes</small></div><div><span>Parcelas por mês agora</span><strong>${brl(monthly)}</strong><small>valor da próxima parcela de cada um</small></div></div>${
    freed.length
      ? `<div class="hint-banner">✦<div><strong>Alívio chegando</strong><p>${freed.map((f) => `${esc(f.plan.description)} termina: a partir de ${monthLabel(f.from)} sobram ${brl(f.cents)} por mês`).join("; ")}.</p></div></div>`
      : ""
  }<section class="panel section-gap"><div class="panel-title"><h3>O que ainda está sendo pago</h3><span class="badge">${plans.length}</span></div>${
    plans.length ? `<div class="records">${plans.map((p) => planRow(p, ctx)).join("")}</div>` : ctx.empty("Nenhum parcelamento em andamento", ctx.api.allowed("entries") ? "add-carne" : undefined)
  }<p class="fine">Compras no cartão seguem o fechamento atual de cada cartão. Carnês e boletos aparecem como contas a pagar, uma por mês.</p></section>`;
}

export function futureView(ctx: ViewCtx) {
  const d = ctx.api.data!;
  const rows = commitments(d, ctx.month, 12);
  const income = averageIncome(d, ctx.month);
  const peak = Math.max(1, income?.cents || 0, ...rows.map((r) => r.total));
  const bar = (cents: number, cls: string) => (cents ? `<b class="${cls}" style="width:${(cents / peak) * 100}%"></b>` : "");
  return `<section class="panel"><div class="panel-title"><div><span class="eyebrow">O FUTURO QUE JÁ ESTÁ GASTO</span><h3>Próximos 12 meses</h3></div>${income ? `<span class="badge">Renda média: ${brl(income.cents)}</span>` : ""}</div><div class="legend"><span><i class="seg-card"></i>Cartões</span><span><i class="seg-bills"></i>Contas e carnês</span><span><i class="seg-fixed"></i>Fixas ainda não geradas</span>${income ? '<span><i class="seg-income"></i>Renda média</span>' : ""}</div><div class="future-list">${rows
    .map(
      (r) =>
        `<div class="future-row"><span>${monthLabel(r.month)}</span><div class="stack" role="img" aria-label="${monthLabel(r.month)}: cartões ${(r.card / 100).toFixed(2)}, contas ${(r.bills / 100).toFixed(2)}, fixas ${(r.fixed / 100).toFixed(2)}">${bar(r.card, "seg-card")}${bar(r.bills, "seg-bills")}${bar(r.fixed, "seg-fixed")}${income ? `<i class="income-mark" style="left:${(income.cents / peak) * 100}%"></i>` : ""}</div><strong>${brl(r.total)}</strong></div>`,
    )
    .join("")}</div><p class="fine">${income ? `A linha mostra a média das receitas registradas nos últimos ${income.months} mês(es). ` : "Registre suas receitas para comparar com a renda. "}Cartões contam pela fatura do mês (competência). Valores que você ainda não registrou não aparecem aqui.</p></section>`;
}

// Bloco do Início: os próximos 3 meses em uma linha cada.
export function committedPanel(ctx: ViewCtx) {
  const rows = commitments(ctx.api.data!, ctx.month, 3);
  if (!rows.some((r) => r.total)) return "";
  return `<section class="panel committed-panel"><div class="panel-title"><div><span class="eyebrow">JÁ COMPROMETIDO</span><h3>Próximos 3 meses</h3></div>${button("nav", "Ver parcelamentos", "text-button", 'data-page="cards" data-cards="plans"')}</div><div class="committed-grid">${rows
    .map((r) => `<div><span>${monthLabel(r.month)}</span><strong>${brl(r.total)}</strong><small>${brl(r.card)} em cartões</small></div>`)
    .join("")}</div></section>`;
}

export function carneForm(ctx: ViewCtx) {
  return `<form id="carne-form" class="form-grid"><p class="fine wide">Para crediário de loja, boleto parcelado ou financiamento. Cada parcela vira uma conta a pagar no mês dela.</p>${field("description", "O que foi comprado", input("description", "text", "", 'maxlength="140" required placeholder="Ex.: geladeira"'), true)}${field("basis", "Qual valor você tem?", `<select name="basis">${opt("total", "O total") + opt("each", "O valor de cada parcela")}</select>`)}${field("amount", "Valor (R$)", moneyInput("amount"))}${field("count", "Número de parcelas", input("count", "number", 10, 'min="2" max="48" required'))}${field("first_due", "Vencimento da 1ª parcela", input("first_due", "date", ctx.today, "required"))}${field("category", "Categoria", input("category", "text", "Casa", 'maxlength="80" required'))}${field("area", "Área", `<select name="area">${opt("household", "Lar") + opt("personal", "Pessoal") + opt("business", "Empresa")}</select>`)}<p class="fine wide" id="carne-preview" aria-live="polite"></p>${formActions("Criar as parcelas", ctx.busy)}</form>`;
}

export function simulateForm(ctx: ViewCtx, cards: Card[], result: string) {
  return `<form id="simulate-form" class="form-grid"><p class="fine wide">Antes de parcelar, veja como ficam os próximos meses. Nada é salvo.</p>${field("amount", "Valor total (R$)", moneyInput("amount"))}${field("count", "Parcelas", input("count", "number", 3, 'min="1" max="48" required'))}${field("card_id", "Cartão", `<select name="card_id" required>${cards.map((c) => opt(c.id, c.name)).join("")}</select>`)}${field("date", "Data da compra", input("date", "date", ctx.today, "required"))}<div class="form-actions wide"><button class="secondary" type="button" data-action="close">Fechar</button><button class="primary" type="submit">Simular</button></div></form><div id="simulate-result" aria-live="polite">${result}</div>`;
}

export function simulationResult(ctx: ViewCtx, form: { amount: string; count: string; card_id: string; date: string }) {
  const d = ctx.api.data!;
  const total = parseMoney(form.amount);
  const count = Number(form.count);
  const card = d.cards.find((c) => c.id === form.card_id);
  if (!total || !Number.isInteger(count) || count < 1 || count > 48 || !card) return '<p class="notice">Informe valor, parcelas (1 a 48) e cartão.</p>';
  const sim = simulatePurchase(d, { total, count, card, date: form.date }, ctx.month);
  const verdict =
    sim.peakShare === null
      ? "Sem receitas registradas nos últimos 3 meses, não dá para comparar com a renda. Os valores abaixo mostram só o que já está comprometido."
      : sim.peakShare > 1
        ? `Atenção: em algum mês os compromissos passariam da renda média (${Math.round(sim.peakShare * 100)}%).`
        : sim.peakShare > 0.7
          ? `Aperta: no pior mês os compromissos ocupariam ${Math.round(sim.peakShare * 100)}% da renda média.`
          : `Cabe: no pior mês os compromissos ocupariam ${Math.round(sim.peakShare * 100)}% da renda média.`;
  const first = invoiceMonth(form.date, card.closing_day);
  return `<div class="simulation"><p class="${sim.peakShare !== null && sim.peakShare > 0.7 ? "notice" : "fine"}"><strong>${verdict}</strong></p><ol>${sim.rows
    .map((r, i) => `<li><span>${monthLabel(r.month)} · parcela ${i + 1}/${count}</span><span>${brl(r.existing)} + ${brl(r.added)} = <strong>${brl(r.total)}</strong></span></li>`)
    .join("")}</ol><p class="fine">Primeira fatura: ${monthLabel(first)}; última: ${monthLabel(addMonths(first, count - 1))}. Considera só o que está registrado no app.</p></div>`;
}
