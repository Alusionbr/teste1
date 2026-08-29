"use strict";
/*
 * Onde está o Playwright.
 *
 * Cada suíte carregava um caminho absoluto da máquina em que foi escrita
 * (`/opt/node22/lib/.../playwright`), o que só funcionava naquela caixa. Aqui a
 * busca é em ordem: instalado no projeto, depois global. É o único ponto do
 * conjunto de testes que sabe disso.
 *
 * Não é dependência do app: o Estante não carrega biblioteca nenhuma. Isto vive
 * só dentro de tests/ e nunca é servido ao navegador.
 */
const CAMINHOS = [
  "playwright",
  "playwright-core",
  "/opt/node22/lib/node_modules/playwright",
  "/usr/lib/node_modules/playwright"
];

let mod = null, ultimoErro = null;
for (const caminho of CAMINHOS) {
  try { mod = require(caminho); break } catch (e) { ultimoErro = e }
}
if (!mod) {
  throw new Error(
    "Playwright não encontrado. Instale com `npm i -D playwright` (ou use a\n" +
    "instalação global) e um Chromium: `npx playwright install chromium`.\n" +
    "Último erro: " + (ultimoErro && ultimoErro.message)
  );
}
module.exports = mod;
