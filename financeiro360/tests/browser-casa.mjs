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
    .getByRole("heading", { name: "Seu mês, sem complicação." })
    .waitFor();
  const navigate = async (section) => {
    const target = page.locator('.sidebar .nav-item[data-page="' + section + '"]');
    if (!(await target.isVisible())) await page.locator(".sidebar-more > summary").click();
    await target.click();
  };
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
  await page.getByText("Compra concluída.", { exact: true }).waitFor();
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
  // Catálogo: produtos reais vêm das bases abertas (aqui simuladas), sem digitar marca nem tamanho.
  const until = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const apiHits = { search: 0, product: 0 };
  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: "application/json; charset=utf-8", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
  await page.route(/open(food|beauty|products)facts\.org\//, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/v2/product/")) {
      apiHits.product++;
      const code = url.pathname.split("/").pop();
      if (code === "7896006711155") return json(route, { status: 1, product: { code, product_name: "Arroz Camil Tipo 1 5 kg", brands: "CAMIL", quantity: "5kg" } });
      return json(route, { status: 1, product: { code, product_name: "Detergente Ypê Clear", brands: "Ype", quantity: "500ml" } });
    }
    apiHits.search++;
    const term = (url.searchParams.get("search_terms") || "").toLowerCase();
    if (term.includes("feij")) return route.fulfill({ status: 503, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<!DOCTYPE html><title>Page temporarily unavailable</title>" });
    if (url.hostname.includes("openproductsfacts") && term.includes("detergente"))
      return json(route, { products: [{ code: "7891022100372", product_name: "Detergente Ypê Clear", brands: "Ype", quantity: "500 ml" }] });
    if (term.includes("arroz"))
      return json(route, { products: [
        { code: "7896006716464", product_name: "Biscoito de arroz", brands: "Camil" },
        { code: "7896006711155", product_name: "Arroz Tipo 1 Camil 5kg", brands: "CAMIL", quantity: "5kg", categories_tags: ["en:rices"] },
        { code: "7893500020110", product_name: "Arroz Tio João 1 Kg", brands: "TIO JOAO", quantity: "1kg" },
      ] });
    return json(route, { products: [] });
  });
  await navigate("shopping");
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.getByText("Em oferta agora").waitFor();
  assert.equal(await page.locator(".catalog-row:visible").count(), 0, "categories start collapsed");
  await page.locator(".catalog-group > summary", { hasText: "Limpeza" }).click();
  assert.ok((await page.locator(".catalog-row:visible").count()) > 5);
  await page.locator(".catalog-group > summary", { hasText: "Limpeza" }).click();
  assert.equal(await page.locator(".catalog-row:visible").count(), 0);
  assert.match(await page.locator(".credit").innerText(), /Open Food Facts[\s\S]*ODbL[\s\S]*preços do Brasil/);
  // Atalho genérico → busca o produto real. Nada de marca ou tamanho escrito à mão no app.
  await page.locator('[name="catalog_search"]').fill("arroz");
  assert.equal(await page.locator(".catalog-row").count(), 1);
  assert.match(await page.locator(".catalog-row").innerText(), /Toque para escolher a marca e o tamanho/);
  await page.getByRole("button", { name: "Escolher produto para Arroz" }).click();
  await page.getByRole("button", { name: "Escolher Arroz Tipo 1 Camil 5kg" }).waitFor();
  const names = await page.locator(".find-row strong").allInnerTexts();
  assert.deepEqual(names, ["Arroz Tipo 1 Camil 5kg", "Arroz Tio João 1 Kg", "Biscoito de arroz"], "names starting with the search come first");
  assert.match(await page.locator(".find-row").first().innerText(), /Camil · 5 kg/);
  await page.getByRole("button", { name: "Escolher Arroz Tipo 1 Camil 5kg" }).click();
  await page.locator('#catalog-add-form [name="quantity"]').fill("2");
  await page.locator('#catalog-add-form [name="price"]').fill("24,90");
  assert.equal(await page.locator('#catalog-add-form [name="save_item"]').isChecked(), true);
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("Arroz Tipo 1 Camil 5kg entrou na lista. Guardado no seu catálogo.").waitFor();
  assert.equal(apiHits.search, 1);
  // A mesma busca vem do cache do aparelho e não gasta o limite do serviço; item repetido soma.
  await page.getByRole("button", { name: "Escolher produto para Arroz" }).click();
  await page.getByText("Resultado guardado neste aparelho").waitFor();
  assert.equal(apiHits.search, 1, "cached search does not call the service again");
  assert.match(await page.locator(".find-row").first().innerText(), /já no seu catálogo/);
  await page.getByRole("button", { name: "Escolher Arroz Tipo 1 Camil 5kg" }).click();
  assert.equal(await page.locator('#catalog-add-form [name="save_item"]').count(), 0, "already saved");
  await page.locator('#catalog-add-form [name="quantity"]').fill("2");
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("Arroz Tipo 1 Camil 5kg: quantidade somada na lista.").waitFor();
  // O item guardado aparece no catálogo da casa, achável pela marca, e se adiciona sem internet.
  await page.locator('[name="catalog_search"]').fill("camil");
  assert.match(await page.locator(".catalog-row").first().innerText(), /Arroz Tipo 1 Camil 5kg[\s\S]*Da base aberta/);
  // Oferta de encarte guardada vai para a lista com o preço dela.
  await page.locator('[name="catalog_search"]').fill("");
  await page.locator(".offer-card").getByRole("button", { name: "Pôr na lista" }).click();
  assert.equal(await page.locator('#catalog-add-form [name="price"]').inputValue(), "24,90");
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("Arroz Camil 5 kg entrou na lista.").waitFor();
  await page.getByRole("button", { name: /^Minha lista \(\d+\)$/ }).click();
  const camil = page.locator(".market-item", { hasText: "Arroz Tipo 1 Camil 5kg" });
  assert.equal(await camil.count(), 1, "same item is not repeated");
  assert.equal(await camil.locator('input[name^="qty-"]').inputValue(), "4");
  assert.equal(await camil.locator('input[name^="price-"]').inputValue(), "24,90");
  // Produto de limpeza vem do banco irmão; busca por texto livre também funciona.
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.locator('[name="catalog_search"]').fill("detergente ype");
  await page.locator(".online-search").getByRole("button").click();
  await page.getByRole("button", { name: "Escolher Detergente Ypê Clear" }).click();
  await page.getByRole("button", { name: "Adicionar à lista", exact: true }).click();
  await page.getByText("Detergente Ypê Clear 500 ml entrou na lista. Guardado no seu catálogo.").waitFor();
  // Atualização pela API: um produto mudou na base, o outro não.
  await page.locator('[name="catalog_search"]').fill("");
  await page.getByRole("button", { name: "Atualizar dados dos produtos salvos (2)" }).click();
  await page.getByText("1 produto(s) atualizado(s), 1 sem mudança.").waitFor({ timeout: 30000 });
  assert.equal(apiHits.product, 2);
  await page.locator('[name="catalog_search"]').fill("camil");
  assert.match(await page.locator(".catalog-row").first().innerText(), /Arroz Camil Tipo 1 5 kg/);
  // Serviço instável: mensagem clara e saída para criar o item à mão.
  await page.locator('[name="catalog_search"]').fill("feijao");
  await page.getByRole("button", { name: "Escolher produto para Feijão carioca" }).click();
  await page.getByText("O serviço de produtos está instável agora").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Criar “Feijão carioca” manualmente" }).click();
  assert.equal(await page.locator('#catalog-new-form [name="name"]').inputValue(), "Feijão carioca");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.locator('[name="catalog_search"]').fill("");
  // Criar item que não existe no catálogo e já pôr na lista.
  await page.getByRole("button", { name: "Catálogo", exact: true }).click();
  await page.locator('[name="catalog_search"]').fill("pano de prato xyz");
  await page.getByRole("button", { name: "Criar item manualmente" }).click();
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
  assert.deepEqual(errors, []);
  console.log("Despensa por local, rotina da casa, modo mercado, catálogo de bases abertas, atualização e encartes passaram.");
} finally {
  await browser.close();
}
