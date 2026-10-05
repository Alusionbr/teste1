import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  ...(existsSync("/usr/bin/chromium")
    ? { executablePath: "/usr/bin/chromium" }
    : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const capture = async (name) => {
    if (!process.env.FIN_TEST_ARTIFACTS) return;
    mkdirSync(process.env.FIN_TEST_ARTIFACTS, { recursive: true });
    await page.screenshot({ path: process.env.FIN_TEST_ARTIFACTS + "/" + name + ".png", fullPage: true });
  };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.FIN_TEST_URL || "http://localhost:5173");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page
    .getByRole("heading", { name: "Sua casa em equilíbrio." })
    .waitFor();
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo lançamento", exact: false })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("25,50");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Compra teste privado");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.getByText("Compra teste privado", { exact: true }).waitFor();
  const navigate = async (section) => {
    const target = page.locator('.sidebar [data-action="nav"][data-page="' + section + '"]');
    if (!(await target.isVisible())) await page.locator('.sidebar-more > summary').click();
    await target.click();
  };
  const openEntry = async () => {
    await navigate("entries");
    await page.getByRole("button", { name: "Novo lançamento", exact: false }).click();
  };
  const form = page.locator("#entry-form");
  // Switching operations retains card choices, while unrelated controls disappear.
  await openEntry();
  await form.locator('[name="payment"]').selectOption("card");
  await form.locator('[name="card_id"]').selectOption({ index: 1 });
  await form.locator('[name="installments"]').fill("3");
  await form.locator('[name="amount"]').fill("100,01");
  await form.locator('[name="date"]').fill("");
  assert.match(await page.locator("#installment-preview").innerText(), /data completa/);
  await form.locator('[name="date"]').fill("2026-12-01");
  await form.locator('[name="first_invoice_month"]').fill("2027-01");
  assert.match(await page.locator("#installment-preview").innerText(), /Primeira fatura: 2027-01/);
  await form.locator('[name="first_invoice_month"]').fill("");
  await form.locator('[name="description"]').fill("Compra total centavos");
  await form.locator('[name="kind"]').selectOption("income");
  assert.equal(await form.locator('[name="payment"]').isVisible(), false);
  assert.equal(await form.locator('[name="due_date"]').isVisible(), false);
  await form.locator('[name="kind"]').selectOption("expense");
  assert.equal(await form.locator('[name="installments"]').inputValue(), "3");
  assert.match(await page.locator("#installment-preview").innerText(), /33,34/);
  assert.match(await page.locator("#installment-preview").innerText(), /33,33/);
  await capture("desktop-parcelas");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.getByText("Compra total centavos", { exact: true }).waitFor();
  await navigate("cards");
  for (const [month, number, amount] of [["2026-12", 1, "33,34"], ["2027-01", 2, "33,34"], ["2027-02", 3, "33,33"]]) {
    await page.getByLabel("Mês de referência").fill(month);
    const cardPanel = page.locator(".panel").filter({ has: page.getByText("Compra total centavos", { exact: false }) });
    await cardPanel.locator("summary").click();
    const line = cardPanel.locator(".detail-line").filter({ hasText: "Compra total centavos" });
    assert.match(await line.innerText(), new RegExp("Parcela " + number + "/3"));
    assert.match(await line.innerText(), new RegExp(amount));
  }
  await page.getByLabel("Mês de referência").fill("2027-03");
  assert.equal(await page.getByText("Compra total centavos", { exact: false }).count(), 0);
  await navigate("settings");
  await page.locator('#preferences-form [name="simple_mode"]').uncheck();
  await page.getByRole("button", { name: "Salvar aparência" }).click();
  await openEntry();
  await form.locator('[name="payment"]').selectOption("card");
  await form.locator('[name="card_id"]').selectOption({ index: 1 });
  await form.locator('[name="installment_basis"]').selectOption("each");
  await form.locator('[name="installments"]').fill("4");
  await form.locator('[name="amount"]').fill("200,00");
  await form.locator('[name="description"]').fill("Compra por parcela");
  await form.locator('[name="date"]').fill("2026-12-01");
  assert.match(await page.locator("#installment-preview").innerText(), /800,00/);
  // A validation error must preserve even disabled card fields and open details.
  await form.locator('[name="kind"]').selectOption("transfer");
  await form.locator('[name="account_id"]').selectOption({ index: 1 });
  await form.locator('[name="target_account_id"]').selectOption({ index: 1 });
  if (!(await form.locator("details").first().evaluate((details) => details.open)))
    await form.locator("summary").first().click();
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.locator("dialog").getByRole("alert").filter({ hasText: "Transferência exige duas contas diferentes." }).waitFor();
  assert.equal(await form.locator('[name="description"]').inputValue(), "Compra por parcela");
  assert.equal(await form.locator("details").first().evaluate((details) => details.open), true);
  await capture("desktop-rascunho-erro");
  await form.locator('[name="kind"]').selectOption("expense");
  assert.equal(await form.locator('[name="payment"]').inputValue(), "card");
  assert.equal(await form.locator('[name="installment_basis"]').inputValue(), "each");
  assert.equal(await form.locator('[name="installments"]').inputValue(), "4");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  const purchase = page.locator(".record").filter({ hasText: "Compra por parcela" });
  await purchase.waitFor();
  assert.match(await purchase.innerText(), /800,00/);
  await purchase.getByRole("button", { name: "Editar", exact: true }).click();
  assert.equal(await form.locator('[name="installment_basis"]').inputValue(), "total");
  assert.equal(await form.locator('[name="amount"]').inputValue(), "800,00");
  if (!(await form.locator("details").first().evaluate((details) => details.open)))
    await form.locator("summary").first().click();
  await form.locator('[name="status"]').selectOption("pending");
  assert.equal(await form.locator('[name="due_date"]').isVisible(), false);
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await purchase.getByRole("button", { name: "Editar", exact: true }).click();
  assert.equal(await form.locator('[name="kind"]').inputValue(), "expense");
  assert.equal(await form.locator('[name="payment"]').inputValue(), "card");
  assert.equal(await form.locator('[name="installments"]').inputValue(), "4");
  assert.equal(await form.locator('[name="amount"]').inputValue(), "800,00");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await openEntry();
  await form.locator('[name="kind"]').selectOption("payable");
  assert.equal(await form.locator('[name="due_date"]').isVisible(), true);
  assert.equal(await form.locator('[name="payment"]').isVisible(), false);
  await form.locator('[name="amount"]').fill("40,00");
  await form.locator('[name="description"]').fill("Conta futura sintética");
  await form.locator('[name="date"]').fill("2026-12-01");
  await form.locator('[name="due_date"]').fill("2026-12-15");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  assert.match(await page.locator(".record").filter({ hasText: "Conta futura sintética" }).innerText(), /A pagar/);
  await openEntry();
  await form.locator('[name="payment"]').selectOption("card");
  await form.locator('[name="kind"]').selectOption("income");
  assert.equal(await form.locator('[name="category"]').inputValue(), "Salário");
  await form.locator('[name="account_id"]').selectOption({ index: 1 });
  await form.locator('[name="amount"]').fill("50,00");
  await form.locator('[name="description"]').fill("Receita sintética");
  await form.locator('[name="date"]').fill("2026-12-01");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  const income = page.locator(".record").filter({ hasText: "Receita sintética" });
  await income.getByRole("button", { name: "Editar", exact: true }).click();
  assert.equal(await form.locator('[name="kind"]').inputValue(), "income");
  assert.notEqual(await form.locator('[name="account_id"]').inputValue(), "");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await navigate("cards");
  await page.getByRole("button", { name: "Registrar pagamento", exact: true }).first().click();
  await form.locator('[name="account_id"]').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.getByText("Alteração salva.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Ver como esposa" }).click();
  await page.getByRole("button", { name: "Dinheiro", exact: true }).click();
  assert.equal(
    await page.getByText("Compra teste privado", { exact: true }).count(),
    0,
  );
  assert.equal(await page.getByText("Compra por parcela", { exact: true }).count(), 0);
  assert.equal(
    await page.getByText("Curso de desenvolvimento", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("Renda do mês", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Ver como administrador" }).click();
  await navigate("accounts");
  const personalAccount = page.locator(".panel").filter({ has: page.getByRole("heading", { name: "Conta pessoal" }) });
  await personalAccount.getByRole("button", { name: "Compartilhar com a família", exact: true }).click();
  await personalAccount.getByRole("button", { name: "Compartilhar saldo com a família" }).waitFor();
  await page.getByRole("button", { name: "Ver como esposa" }).click();
  await navigate("accounts");
  assert.match(await personalAccount.innerText(), /Saldo privado/);
  await page.getByRole("button", { name: "Ver como administrador" }).click();
  await navigate("accounts");
  await personalAccount.getByRole("button", { name: "Compartilhar saldo com a família" }).click();
  await personalAccount.getByRole("button", { name: "Ocultar saldo da família" }).waitFor();
  await page.getByRole("button", { name: "Ver como esposa" }).click();
  await navigate("accounts");
  assert.doesNotMatch(await personalAccount.innerText(), /Saldo privado/);
  await page.getByRole("button", { name: "Ver como administrador" }).click();
  await navigate("shopping");
  await page.getByRole("button", { name: "Sugerir para 14 dias" }).click();
  await page.getByText("Lista sugerida a partir da despensa.").waitFor();
  assert.equal(await page.locator(".shopping-item").count(), 2);
  await page
    .getByRole("button", { name: "Concluir compra e atualizar estoque" })
    .click();
  await page.getByText("Alteração salva.").waitFor();
  assert.equal(await page.locator(".shopping-item").count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("combobox", { name: "Abrir uma seção" })
    .selectOption("cards");
  await page.getByRole("heading", { name: "Cartões sem surpresas." }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await capture("mobile-fatura");
  await page.getByRole("combobox", { name: "Abrir uma seção" }).selectOption("settings");
  const appearance = page.locator("#preferences-form");
  await appearance.locator('[name="theme"]').selectOption("dark");
  await appearance.locator('[name="palette"]').selectOption("ocean");
  await appearance.locator('[name="text_size"]').selectOption("large");
  await appearance.locator('[name="hide_values"]').check();
  await appearance.locator('[name="widget"][value="categories"]').uncheck();
  await appearance.getByRole("button", { name: "Salvar aparência" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(await page.locator("html").getAttribute("data-palette"), "ocean");
  assert.equal(await page.locator("html").getAttribute("data-hide-values"), "true");
  await page.getByRole("button", { name: "Ver como esposa" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "system");
  assert.equal(await page.locator("html").getAttribute("data-hide-values"), "false");
  await page.getByRole("button", { name: "Ver como administrador" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByRole("combobox", { name: "Abrir uma seção" }).selectOption("settings");
  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "system");
  assert.equal(await page.locator("html").getAttribute("data-hide-values"), "false");
  assert.deepEqual(errors, []);
  console.log(
    "Desktop/mobile, total/each installments, monthly invoices, pending-card editing, contextual tasks, error drafts, income account, invoice payment, member privacy and shopping passed.",
  );
} finally {
  await browser.close();
}
