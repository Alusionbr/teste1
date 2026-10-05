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
  // Início mostra o que a casa precisa hoje.
  await page.getByRole("button", { name: "Início", exact: true }).first().click();
  await page.getByText("tarefa(s) da casa para hoje", { exact: false }).waitFor();
  await page.getByText("produto(s) vencendo", { exact: false }).waitFor();
  // Modo mercado: só o que foi marcado é comprado; o resto fica na lista.
  await navigate("shopping");
  await page.getByRole("button", { name: "✦ Sugerir lista" }).click();
  await page.getByText("Lista sugerida para 14 dias a partir da despensa.").waitFor();
  assert.equal(await page.locator(".market-item").count(), 2);
  assert.equal(await page.locator('.market-item input[name="items"]:checked').count(), 0, "nothing starts in the cart");
  const rice = page.locator(".market-item", { hasText: "Arroz" });
  assert.match(await rice.innerText(), /Por quê: abaixo do mínimo/);
  await rice.getByRole("checkbox").check();
  await rice.locator('input[name^="price-"]').fill("7,00");
  assert.equal(await page.locator('#purchase-form [name="total"]').inputValue(), "6,30");
  // Re-render (changing the horizon) must not lose what is in the cart.
  await page.locator('[name="suggest_days"]').selectOption("30");
  assert.equal(await rice.getByRole("checkbox").isChecked(), true);
  assert.equal(await rice.locator('input[name^="price-"]').inputValue(), "7,00");
  await page.locator('#purchase-form [name="total"]').fill("6,00");
  assert.match(await page.locator("#cart-diff").innerText(), /difere da soma/);
  await page.getByRole("button", { name: "Concluir compra dos itens marcados" }).click();
  await page.getByText("Alteração salva.").waitFor();
  assert.equal(await page.locator(".market-item").count(), 1);
  assert.equal(await page.locator(".market-item", { hasText: "Leite" }).count(), 1);
  // Despensa: quantidade reposta, último preço lembrado, uso e perda registrados.
  await navigate("pantry");
  const riceCard = page.locator(".pantry-card", { hasText: "Arroz" });
  assert.match(await riceCard.innerText(), /2,1\s*kg/);
  assert.match(await riceCard.innerText(), /último preço R\$\s*7,00/);
  await page.getByRole("button", { name: "Registrar uso de Café" }).click();
  await page.locator('#move-form [name="quantity"]').fill("1");
  await page.getByRole("button", { name: "Registrar uso", exact: true }).click();
  await page.getByText("Alteração salva.").waitFor();
  assert.match(await page.locator(".pantry-card", { hasText: "Café" }).innerText(), /\b2\s*pacote/);
  await page.locator(".pantry-card", { hasText: "Leite" }).getByRole("button", { name: "Perdi / venceu" }).click();
  await page.getByRole("button", { name: "Registrar perda", exact: true }).click();
  await page.getByText("Alteração salva.").waitFor();
  assert.match(await page.locator(".house-stats").innerText(), /R\$\s*11,98/);
  await page.getByRole("button", { name: "🧊 Geladeira 1" }).click();
  assert.equal(await page.locator(".pantry-card").count(), 1);
  await page.getByRole("button", { name: "Tudo 4" }).click();
  // Rotina: concluir uma tarefa semanal gera a próxima, sem duplicar.
  await page.getByRole("button", { name: "Rotina da casa", exact: true }).click();
  const late = page.locator(".task-block.late");
  await late.getByRole("button", { name: "Marcar Limpar o banheiro como feita" }).click();
  await page.getByText("Tarefa concluída. Obrigado!").waitFor();
  assert.equal(await page.locator(".task-block.late").count(), 0);
  assert.equal(await page.locator(".task-block", { hasText: "Próximos 7 dias" }).getByText("Limpar o banheiro").count(), 1);
  await page.getByText("Feitas recentemente (1)").waitFor();
  await page.getByRole("button", { name: "Nova tarefa", exact: true }).click();
  await page.locator("#task-form .chip", { hasText: "Regar as plantas" }).click();
  assert.equal(await page.locator('#task-form [name="title"]').inputValue(), "Regar as plantas");
  assert.equal(await page.locator('#task-form [name="repeat"]').inputValue(), "weekly");
  await page.getByRole("button", { name: "Criar tarefa", exact: true }).click();
  await page.getByText("Alteração salva.").waitFor();
  assert.equal(await page.locator(".task-block", { hasText: "Hoje" }).getByText("Regar as plantas").count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["Despensa", "Rotina da casa"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, tab + " fits on mobile");
    await capture("mobile-casa-" + (tab === "Despensa" ? "despensa" : "rotina"));
  }
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "market fits on mobile");
  await capture("mobile-mercado");
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Catálogo: item comum sem digitar, soma na lista, item próprio e encarte colado.
  const until = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  await navigate("shopping");
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.getByText("Em oferta agora").waitFor();
  assert.equal(await page.locator(".catalog-row:visible").count(), 0, "categories start collapsed");
  await page.locator(".catalog-group > summary", { hasText: "Limpeza" }).click();
  assert.ok((await page.locator(".catalog-row:visible").count()) > 5);
  await page.locator(".catalog-group > summary", { hasText: "Limpeza" }).click();
  assert.equal(await page.locator(".catalog-row:visible").count(), 0);
  await page.locator('[name="catalog_search"]').fill("arroz");
  assert.equal(await page.locator(".catalog-row").count(), 1);
  await page.getByRole("button", { name: "Adicionar Arroz à lista" }).click();
  await page.locator('#catalog-add-form [name="brand"]').selectOption("Camil");
  await page.locator('#catalog-add-form [name="size"]').selectOption("5 kg");
  await page.locator('#catalog-add-form [name="quantity"]').fill("2");
  await page.locator('#catalog-add-form [name="price"]').fill("24,90");
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("Arroz Camil 5 kg entrou na lista.").waitFor();
  await page.getByRole("button", { name: "Adicionar Arroz à lista" }).click();
  await page.locator('#catalog-add-form [name="brand"]').selectOption("Camil");
  await page.locator('#catalog-add-form [name="size"]').selectOption("5 kg");
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("Arroz Camil 5 kg: quantidade somada na lista.").waitFor();
  // Oferta guardada vai para a lista com o preço do encarte.
  await page.locator(".offer-card").getByRole("button", { name: "Pôr na lista" }).click();
  assert.equal(await page.locator('#catalog-add-form [name="price"]').inputValue(), "24,90");
  await page.locator('#catalog-add-form [name="brand"]').selectOption("Camil");
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("quantidade somada na lista.").waitFor();
  await page.getByRole("button", { name: /^Minha lista \(\d+\)$/ }).click();
  const camil = page.locator(".market-item", { hasText: "Arroz Camil 5 kg" });
  assert.equal(await camil.count(), 1, "same item is not repeated");
  assert.equal(await camil.locator('input[name^="qty-"]').inputValue(), "4");
  assert.equal(await camil.locator('input[name^="price-"]').inputValue(), "24,90");
  // Criar item que não existe no catálogo e já pôr na lista.
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.locator('[name="catalog_search"]').fill("pano de prato xyz");
  await page.getByRole("button", { name: "Criar este item" }).click();
  assert.equal(await page.locator('#catalog-new-form [name="name"]').inputValue(), "pano de prato xyz");
  await page.locator('#catalog-new-form [name="name"]').fill("Pano de prato");
  await page.locator('#catalog-new-form [name="category"]').selectOption("casa");
  await page.locator('#catalog-new-form [name="add_to_list"]').check();
  await page.getByRole("button", { name: "Salvar item" }).click();
  await page.getByText("Item salvo no catálogo.").waitFor();
  await page.locator('[name="catalog_search"]').fill("pano");
  assert.match(await page.locator(".catalog-row").first().innerText(), /Pano de prato[\s\S]*Meu item/);
  // Encarte colado: o app separa produto e preço; a pessoa confere antes de salvar.
  await page.getByRole("button", { name: "Encartes", exact: true }).click();
  await page.getByRole("button", { name: "Colar texto do encarte" }).first().click();
  await page.locator('#flyer-form [name="store"]').selectOption("Sam's Club");
  await page.locator('#flyer-form [name="until"]').fill(until);
  await page.locator('#flyer-form [name="text"]').fill("OFERTAS DA SEMANA\nDetergente Ypê 500 ml - R$ 2,19\nPapel higiênico 30 rolos de R$ 39,90 por R$ 34,90\nCafé Pilão 500 g R$ 18,90\nvalidade 12/10");
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await page.getByText("3 oferta(s)").waitFor();
  await page.getByText("2 linha(s) sem preço ignorada(s)").waitFor();
  await page.getByRole("checkbox", { name: "Salvar Café Pilão 500 g" }).uncheck();
  await page.getByRole("button", { name: "Salvar ofertas marcadas" }).click();
  await page.getByText("2 oferta(s) de Sam's Club salva(s).").waitFor();
  const sams = page.locator(".task-block", { hasText: "Sam's Club" });
  assert.match(await sams.innerText(), /Papel higiênico 30 rolos[\s\S]*R\$\s*34,90/);
  assert.equal(await sams.getByText("Café Pilão").count(), 0);
  await sams.getByRole("button", { name: "Pôr na lista" }).first().click();
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("entrou na lista.").waitFor();
  // Filtro por mercado mostra a oferta do Sam's e esconde a do Atacadão.
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.locator('[name="catalog_search"]').fill("");
  assert.equal(await page.locator(".catalog-row:visible").count(), 0, "search-opened categories are not remembered");
  await page.getByRole("button", { name: "Sam's Club", exact: true }).click();
  assert.equal(await page.locator(".offer-card", { hasText: "Atacadão" }).count(), 0);
  assert.equal(await page.locator(".offer-card", { hasText: "Papel higiênico" }).count(), 1);
  await page.getByRole("button", { name: "Todos os mercados" }).click();
  assert.equal(await page.locator(".offer-card", { hasText: "Atacadão" }).count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["Catálogo", "Encartes"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, tab + " fits on mobile");
    await capture("mobile-" + tab.toLowerCase().replace("á", "a"));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
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
    "Desktop/mobile, total/each installments, monthly invoices, pending-card editing, contextual tasks, error drafts, income account, invoice payment, member privacy, partial market purchase, pantry movements, household routine, market catalog and flyers passed.",
  );
} finally {
  await browser.close();
}
