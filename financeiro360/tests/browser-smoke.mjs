import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.FIN_TEST_URL || "http://localhost:5173");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page
    .getByRole("heading", { name: "Sua casa em equilíbrio." })
    .waitFor();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo lançamento", exact: false })
    .click();
  await page.getByLabel("Valor (R$)", { exact: true }).fill("25,50");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Compra teste privado");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.getByText("Compra teste privado", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Ver como esposa" }).click();
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  assert.equal(
    await page.getByText("Compra teste privado", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("Curso de desenvolvimento", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("Renda do mês", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Ver como administrador" }).click();
  await page
    .getByRole("button", { name: "Lista de compras", exact: true })
    .click();
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
  assert.deepEqual(errors, []);
  console.log(
    "Desktop/mobile, quick entry, member privacy, shopping completion and mobile navigation passed.",
  );
} finally {
  await browser.close();
}
