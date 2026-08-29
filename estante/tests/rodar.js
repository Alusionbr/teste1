"use strict";
/*
 * Roda todas as suítes do Estante.
 *
 *   node estante/tests/rodar.js            # tudo
 *   node estante/tests/rodar.js karaoke    # só as que casam com "karaoke"
 *
 * Sobe um servidor local (o service worker não roda em file://), executa cada
 * suíte num processo próprio — uma que trave não leva as outras junto — e
 * devolve código de saída diferente de zero se qualquer uma falhar, para servir
 * de portão antes de publicar.
 *
 * A porta é fixa em 8777 de propósito: as suítes trazem o endereço escrito, e
 * mexer nelas para tornar a porta configurável seria reescrever a rede de
 * proteção inteira para ganhar muito pouco. Se a porta já estiver ocupada por
 * um servidor deste mesmo repositório, ele é reaproveitado.
 */
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { ouvir } = require("./servidor.js");

const PORTA = 8777;
const RAIZ = path.resolve(__dirname, "..", "..");
const AQUI = __dirname;

// Ordem: das mais básicas para as mais específicas. Quando o casco quebra, é a
// primeira linha do relatório que diz isso, em vez de vinte falhas confusas.
const SUITES = [
  "smoke.js",
  "final-test.js",
  "offline-test.js",
  "acervo-local-test.js",
  "lyrics-fallback-test.js",
  "search-resilience-test.js",
  "musicbrainz-test.js",
  "setlist-test.js",
  "songprefs-test.js",
  "palco-test.js",
  "mobile-test.js",
  "karaoke-test.js",
  "karaoke-mobile-test.js",
  "share-test.js",
  "v34-test.js",
  "v39-test.js",
  "v312-test.js",
  "v313-test.js",
  "v314-test.js",
  "v315-test.js"
];

const TEMPO_LIMITE = 300000;

function servindoEsteRepo() {
  return new Promise(resolve => {
    const req = http.get({ host: "127.0.0.1", port: PORTA, path: "/estante/index.html" }, res => {
      let corpo = "";
      res.on("data", c => (corpo += c));
      res.on("end", () => resolve(res.statusCode === 200 && corpo.includes("ESTANTE")));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false) });
  });
}

function rodar(arquivo) {
  return new Promise(resolve => {
    const inicio = Date.now();
    const filho = spawn(process.execPath, [path.join(AQUI, arquivo)], { cwd: AQUI });
    let saida = "";
    const relogio = setTimeout(() => { filho.kill("SIGKILL"); saida += "\nESTOUROU O TEMPO LIMITE" }, TEMPO_LIMITE);
    filho.stdout.on("data", d => (saida += d));
    filho.stderr.on("data", d => (saida += d));
    filho.on("close", code => {
      clearTimeout(relogio);
      const linhas = saida.split("\n");
      const falhas = linhas.filter(l => l.startsWith("FALHA")).length;
      const passou = linhas.filter(l => l.startsWith("ok ")).length;
      resolve({ arquivo, code, falhas, passou, saida, ms: Date.now() - inicio });
    });
  });
}

(async () => {
  const filtro = process.argv[2] || "";
  const lista = SUITES.filter(f => f.includes(filtro));
  if (!lista.length) {
    console.error(`Nenhuma suíte casa com "${filtro}". Disponíveis:\n  ` + SUITES.join("\n  "));
    process.exit(2);
  }

  let servidor = await ouvir(RAIZ, PORTA);
  if (!servidor && !(await servindoEsteRepo())) {
    console.error(`A porta ${PORTA} está ocupada por outra coisa. Feche o que está lá e rode de novo.`);
    process.exit(2);
  }
  console.log(servidor ? `servidor em http://localhost:${PORTA}` : `reaproveitando o servidor já aberto em ${PORTA}`);
  console.log(`${lista.length} suíte${lista.length === 1 ? "" : "s"}\n`);

  const resultados = [];
  for (const arquivo of lista) {
    const r = await rodar(arquivo);
    resultados.push(r);
    const ruim = r.code !== 0 || r.falhas > 0;
    console.log(
      `${ruim ? "FALHOU " : "ok     "}${arquivo.padEnd(26)} ` +
      `${String(r.passou).padStart(3)} ok  ${r.falhas} falha${r.falhas === 1 ? "" : "s"}  ${(r.ms / 1000).toFixed(1)}s`
    );
    if (ruim) console.log(r.saida.split("\n").filter(l => l.startsWith("FALHA") || /ERRO|Error|error:/.test(l)).slice(0, 12).map(l => "       │ " + l).join("\n"));
  }

  if (servidor) servidor.close();
  const ruins = resultados.filter(r => r.code !== 0 || r.falhas > 0);
  const totalOk = resultados.reduce((t, r) => t + r.passou, 0);
  const totalFalhas = resultados.reduce((t, r) => t + r.falhas, 0);
  console.log(`\n${totalOk} verificações passaram, ${totalFalhas} falharam, em ${resultados.length} suítes.`);
  if (ruins.length) {
    console.log("Suítes com problema: " + ruins.map(r => r.arquivo).join(", "));
    console.log("Para ver uma inteira: node estante/tests/rodar.js " + ruins[0].arquivo.replace("-test.js", ""));
  }
  process.exit(ruins.length ? 1 : 0);
})();
