import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";

const browser = await chromium.launch({
  ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
const capture = async (page, name) => {
  if (!process.env.FIN_TEST_ARTIFACTS) return;
  mkdirSync(process.env.FIN_TEST_ARTIFACTS, { recursive: true });
  await page.screenshot({ path: `${process.env.FIN_TEST_ARTIFACTS}/${name}.png`, fullPage: true });
};
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.FIN_TEST_URL || "http://localhost:5173");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.getByRole("heading", { name: "Seu mês, sem complicação." }).waitFor();
  assert.match(await page.locator(".overview-hero").innerText(), /GASTOS LANÇADOS NO MÊS/);
  assert.match(await page.locator(".cash-summary").innerText(), /Entrou nas contas/);
  assert.match(await page.locator(".cash-summary").innerText(), /Saiu das contas/);
  assert.ok(await page.locator(".flow-chart-scroll").evaluate((chart) => chart.scrollLeft > 0), "the current month should be visible on a phone");
  await capture(page, "home-mobile");

  await page.locator('.mobile-nav [data-page="analysis"]').click();
  await page.getByRole("heading", { name: "Entenda o ritmo da casa." }).waitFor();
  assert.equal(await page.locator(".flow-column").count(), 12);
  await page.getByRole("button", { name: "Ano a ano" }).click();
  assert.equal(await page.locator(".flow-column").count(), 5);
  await page.locator(".analysis-category summary").first().click();
  assert.ok(await page.locator(".analysis-category .detail-line").count());
  await capture(page, "analysis-mobile");

  await page.locator('.mobile-nav [data-page="entries"]').click();
  await page.getByRole("button", { name: "Gastos", exact: true }).click();
  assert.ok(await page.locator(".money-record").count());
  await page.getByRole("button", { name: "Receitas", exact: true }).click();
  assert.equal(await page.locator(".money-record").count(), 1);
  await page.getByRole("button", { name: "Tudo", exact: true }).click();
  await page.locator(".entry-extra-filters summary").click();
  await page.locator('[name="entry_category"]').selectOption("Moradia");
  assert.ok(await page.locator(".money-record").count() > 0);
  await page.locator('[name="entry_category"]').selectOption("all");
  await capture(page, "entries-mobile");

  await page.getByRole("button", { name: "Categorias", exact: true }).click();
  await page.getByRole("button", { name: "Criar opção" }).click();
  await page.locator('#category-preset-form [name="category"]').fill("Saúde");
  await page.locator('#category-preset-form [name="subcategory"]').fill("Vacinação infantil");
  await page.getByRole("button", { name: "Criar opção", exact: true }).last().click();
  await page.getByText("Vacinação infantil", { exact: true }).waitFor();

  await page.locator('.mobile-nav [data-page="overview"]').click();
  await page.locator(".quick-create").getByRole("button", { name: "Gasto" }).click();
  const form = page.locator("#quick-expense-form");
  await form.locator('[name="amount"]').fill("75,50");
  await form.locator('[name="description"]').fill("Vacina teste UX");
  await form.locator('[name="category"]').selectOption("Saúde");
  // A opção criada pela família entra depois das sugestões prontas e pode ficar fora dos 7 atalhos: digitar vale igual.
  await form.locator('[name="subcategory"]').fill("Vacinação infantil");
  assert.equal(await form.locator('[name="subcategory"]').inputValue(), "Vacinação infantil");
  await page.getByRole("button", { name: "Salvar gasto" }).click();
  await page.locator('.mobile-nav [data-page="entries"]').click();
  const record = page.locator(".money-record").filter({ hasText: "Vacina teste UX" });
  await record.waitFor();
  assert.match(await record.innerText(), /Saúde \/ Vacinação infantil/);
  await record.locator(".record-menu summary").click();
  await record.getByRole("button", { name: "Editar lançamento" }).click();
  await page.locator("#entry-form").locator('[name="amount"]').fill("90,00");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  assert.match(await record.innerText(), /90,00/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, "no horizontal page overflow on a phone");
  assert.deepEqual(errors, []);
  console.log("Browser UX smoke passed: mobile overview, charts, filters, categories and edit flow.");
} finally {
  await browser.close();
}
