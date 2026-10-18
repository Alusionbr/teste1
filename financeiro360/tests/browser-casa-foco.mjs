// Teste de navegador das funções de agenda, foco, parcelamentos, lançamento rápido e mercado no cartão.
// Usa a demonstração (dados fictícios). Rode com o servidor de desenvolvimento ativo: npm run dev.
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  ...(existsSync("/usr/bin/chromium") ? { executablePath: "/usr/bin/chromium" } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = iso(new Date());
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const capture = async (name) => {
    if (!process.env.FIN_TEST_ARTIFACTS) return;
    mkdirSync(process.env.FIN_TEST_ARTIFACTS, { recursive: true });
    await page.screenshot({ path: process.env.FIN_TEST_ARTIFACTS + "/" + name + ".png", fullPage: true });
  };
  const go = async (section) => {
    await page.getByRole("combobox", { name: "Abrir uma seção" }).selectOption(section).catch(async () => {
      const target = page.locator('.sidebar .nav-item[data-page="' + section + '"]');
      if (!(await target.isVisible())) await page.locator(".sidebar-more > summary").click();
      await target.click();
    });
  };
  const noOverflow = async (what) =>
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, what + " fits on mobile");

  await page.goto(process.env.FIN_TEST_URL || "http://localhost:5173");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.getByRole("heading", { name: "Seu mês, sem complicação." }).waitFor();

  // Agora: uma coisa por vez, começando pela conta vencida; "Pular" passa para a próxima.
  const focus = page.locator(".focus-card");
  const first = await focus.locator("h2").innerText();
  assert.match(first, /^Pagar /);
  await focus.getByRole("button", { name: "Pular por agora" }).click();
  assert.notEqual(await page.locator(".focus-card h2").innerText(), first);

  // Lançamento rápido: o texto vira um formulário preenchido, conferido antes de salvar.
  await page.locator("#quick-text").fill("padaria 12,50 ontem");
  await page.getByRole("button", { name: "Conferir", exact: true }).click();
  await page.getByRole("heading", { name: "Conferir antes de salvar" }).waitFor();
  const draft = page.locator("#entry-form");
  assert.equal(await draft.locator('[name="amount"]').inputValue(), "12,50");
  assert.equal(await draft.locator('[name="description"]').inputValue(), "Padaria");
  assert.equal(await draft.locator('[name="date"]').inputValue(), iso(yesterday));
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.getByText("Alteração salva.").waitFor();
  await page.locator("#quick-text").fill("mercado 80 3x");
  await page.getByRole("button", { name: "Conferir", exact: true }).click();
  assert.match(await page.locator(".draft-hint").innerText(), /qual cartão/);
  assert.equal(await draft.locator('[name="payment"]').inputValue(), "card");
  assert.equal(await draft.locator('[name="installments"]').inputValue(), "3");
  await page.getByRole("button", { name: "Cancelar" }).click();

  // Cartões: parcelamentos ativos, carnê, simulador e os próximos 12 meses.
  await go("cards");
  await page.getByRole("button", { name: "Parcelamentos", exact: true }).click();
  const plans = page.locator(".plan-row");
  assert.ok((await plans.count()) >= 2);
  assert.match(await page.locator(".plan-row", { hasText: "Geladeira nova" }).innerText(), /1\/4 paga/);
  await page.getByRole("button", { name: "Cabe no mês? Simular" }).click();
  await page.locator('#simulate-form [name="amount"]').fill("1200,00");
  await page.locator('#simulate-form [name="count"]').fill("3");
  await page.getByRole("button", { name: "Simular", exact: true }).click();
  assert.match(await page.locator("#simulate-result").innerText(), /(Cabe|Aperta|Atenção)[\s\S]*parcela 3\/3/);
  await page.locator("#simulate-form [data-action=close]").click();
  await page.getByRole("button", { name: "Novo carnê ou boleto parcelado" }).click();
  await page.locator('#carne-form [name="description"]').fill("Sofá");
  await page.locator('#carne-form [name="amount"]').fill("900,00");
  await page.locator('#carne-form [name="count"]').fill("3");
  assert.match(await page.locator("#carne-preview").innerText(), /3x de R\$\s*300,00/);
  await page.getByRole("button", { name: "Criar as parcelas" }).click();
  await page.getByText("3 parcelas criadas como contas a pagar.", { exact: false }).waitFor();
  assert.match(await page.locator(".plan-row", { hasText: "Sofá" }).innerText(), /0\/3 paga[\s\S]*R\$\s*900,00/);
  await page.getByRole("button", { name: "Próximos meses", exact: true }).click();
  assert.equal(await page.locator(".future-row").count(), 12);

  // Agenda: pessoal, "ocupado" de outra pessoa e compromisso novo levado ao calendário (.ics).
  await page.locator('.sidebar [data-action="nav"][data-page="agenda"]').click();
  await page.getByRole("heading", { name: "O dia de todo mundo, num lugar só." }).waitFor();
  const dayView = await page.locator(".content").innerText();
  assert.match(dayView, /Ligar para o banco/);
  assert.match(dayView, /Esposa ocupado\(a\)/);
  assert.doesNotMatch(dayView, /Terapia/, "the administrator never sees the title of a personal event");
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  await page.locator('#event-form [name="title"]').fill("Consulta do pet");
  await page.locator('#event-form [name="start_time"]').fill("23:50");
  assert.equal(await page.locator("[data-people]").isVisible(), false, "people only for home events");
  await page.getByRole("button", { name: "Criar compromisso" }).click();
  await page.getByText("Compromisso criado. Só você vê.").waitFor();
  const pet = page.locator(".agenda-item", { hasText: "Consulta do pet" });
  const [download] = await Promise.all([page.waitForEvent("download"), pet.getByRole("button", { name: /calendário do celular/ }).click()]);
  const ics = readFileSync(await download.path(), "utf8");
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, new RegExp(`DTSTART:${todayIso.replace(/-/g, "")}T235000`));
  assert.match(ics, /SUMMARY:Consulta do pet/);
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  assert.equal(await page.locator(".agenda-day").count(), 7);
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  assert.ok((await page.locator(".month-day").count()) >= 28);
  await page.locator(".month-day.is-today").click();
  assert.match(await page.locator(".content").innerText(), /Consulta do pet/);
  // Outra pessoa não vê o que é pessoal, nem o administrador vê o dela.
  await page.getByRole("button", { name: "Ver como esposa" }).click();
  await page.locator('.sidebar [data-action="nav"][data-page="agenda"]').click();
  const memberView = await page.locator(".content").innerText();
  assert.doesNotMatch(memberView, /Ligar para o banco|Consulta do pet/);
  assert.match(memberView, /Terapia/);
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  await page.getByRole("button", { name: "Dia", exact: true }).click();
  await page.getByRole("button", { name: "Próximo" }).click();
  assert.match(await page.locator(".content").innerText(), /Administrador ocupado\(a\)/);
  assert.doesNotMatch(await page.locator(".content").innerText(), /Consulta médica/);
  await page.getByRole("button", { name: "Ver como administrador" }).click();

  // Anotar: captura rápida e depois organizar em um destino.
  await page.locator(".fab").click();
  await page.locator('#note-form [name="text"]').fill("comprar pilha");
  await page.getByRole("button", { name: "Guardar anotação" }).click();
  await page.getByText("Anotado. Organize depois, com calma.").waitFor();
  await go("focus");
  await page.getByRole("heading", { name: "Uma coisa de cada vez." }).waitFor();
  const note = page.locator(".record", { hasText: "comprar pilha" });
  await note.getByRole("button", { name: "Organizar" }).click();
  await page.getByRole("button", { name: /É para comprar/ }).click();
  await page.getByText("Foi para a lista de compras.").waitFor();
  assert.equal(await page.locator(".record", { hasText: "comprar pilha" }).count(), 0);
  await page.locator(".fab").click();
  await page.locator('#note-form [name="text"]').fill("luz 150 vence 10");
  await page.getByRole("button", { name: "Guardar anotação" }).click();
  await page.locator(".record", { hasText: "luz 150 vence 10" }).getByRole("button", { name: "Organizar" }).click();
  await page.getByRole("button", { name: /É um gasto ou conta/ }).click();
  assert.equal(await page.locator('#entry-form [name="kind"]').inputValue(), "payable");
  assert.equal(await page.locator('#entry-form [name="amount"]').inputValue(), "150,00");
  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await page.getByText("Alteração salva.").waitFor();
  await go("focus");
  assert.equal(await page.locator(".record", { hasText: "luz 150 vence 10" }).count(), 0, "organized note leaves the inbox");

  // Temporizador visual e desejos com espera.
  await page.getByRole("button", { name: "5 min", exact: true }).click();
  await page.locator(".timer-ring").waitFor();
  assert.match(await page.locator("#timer-left").innerText(), /^[45]:\d\d$/);
  await page.getByRole("button", { name: "Parar", exact: true }).click();
  const phones = page.locator(".wishes-list .record, .record", { hasText: "Fone sem fio" }).last();
  await phones.getByRole("button", { name: "Desisti" }).click();
  await page.getByText("Você deixou de gastar", { exact: false }).first().waitFor();
  assert.match(await page.locator(".hint-banner", { hasText: "deixou de gastar" }).innerText(), /R\$\s*250,00/);

  // Passos da tarefa: marcar um passo salva na hora.
  await page.locator('.sidebar [data-action="nav"][data-page="pantry"]').click();
  await page.getByRole("button", { name: "Rotina da casa" }).click();
  await page.getByRole("checkbox", { name: "Arrumar a cama" }).check();
  await page.getByRole("checkbox", { name: "Arrumar a cama" }).waitFor();
  assert.equal(await page.getByRole("checkbox", { name: "Arrumar a cama" }).isChecked(), true);

  // Mercado: fechar a compra no cartão parcelado.
  await page.locator('.sidebar [data-action="nav"][data-page="shopping"]').click();
  const pilha = page.locator(".market-item", { hasText: "comprar pilha" });
  await pilha.getByRole("checkbox").check();
  await pilha.locator('input[name^="price-"]').fill("19,90");
  await page.locator('#purchase-form [name="pay"]').selectOption("card");
  assert.equal(await page.locator('#purchase-form [name="account_id"]').isVisible(), false);
  await page.locator('#purchase-form [name="card_id"]').selectOption("demo-card");
  await page.locator('#purchase-form [name="parts"]').fill("2");
  await page.getByRole("button", { name: "Concluir compra dos itens marcados" }).click();
  await page.getByText("Compra concluída no cartão em 2x.", { exact: false }).waitFor();
  await go("cards");
  await page.getByRole("button", { name: "Parcelamentos", exact: true }).click();
  assert.match(await page.locator(".plan-row", { hasText: "Compra de mercado" }).innerText(), /Meu cartão/);

  // Atalho de teclado "a" abre a anotação; Esc fecha.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("a");
  await page.getByRole("heading", { name: "Anotar rápido" }).waitFor();
  await page.keyboard.press("Escape");

  // Modo foco: o Início mostra só o próximo passo e o dia.
  await go("settings");
  await page.locator('#preferences-form [name="focus_mode"]').check();
  await page.getByRole("button", { name: "Salvar aparência" }).click();
  await go("overview");
  await page.getByRole("heading", { name: "Seu dia" }).waitFor();
  assert.equal(await page.locator(".kpi-grid").count(), 0);

  // Celular: nada pode passar da largura da tela.
  await page.setViewportSize({ width: 360, height: 800 });
  await noOverflow("focus home");
  await capture("mobile-inicio-foco");
  await go("settings");
  await page.locator('#preferences-form [name="focus_mode"]').uncheck();
  await page.getByRole("button", { name: "Salvar aparência" }).click();
  await go("overview");
  await noOverflow("home");
  await capture("mobile-inicio");
  await page.locator('.mobile-nav [data-page="agenda"]').click();
  for (const tab of ["Dia", "Semana", "Mês"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await noOverflow("agenda " + tab);
    await capture("mobile-agenda-" + tab.toLowerCase().replace("ê", "e"));
  }
  await go("cards");
  for (const tab of ["Parcelamentos", "Próximos meses"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await noOverflow(tab);
    await capture("mobile-" + (tab === "Parcelamentos" ? "parcelamentos" : "proximos-meses"));
  }
  await go("focus");
  await noOverflow("focus page");
  await capture("mobile-agora");
  assert.deepEqual(errors, []);
  console.log("Agora, lançamento rápido, parcelamentos, carnê, simulador, agenda com privacidade e .ics, anotações, temporizador, desejos, passos, mercado no cartão, atalho de teclado, modo foco e celular passaram.");
} finally {
  await browser.close();
}
