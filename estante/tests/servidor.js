"use strict";
/*
 * Servidor estático mínimo para os testes, com a biblioteca padrão do Node.
 *
 * O service worker não roda em `file://`, então testar o Estante exige HTTP.
 * Um servidor de 40 linhas evita acrescentar dependência a um projeto cujo
 * princípio é não ter nenhuma.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8"
};

function criarServidor(raiz) {
  return http.createServer((req, res) => {
    let caminho = decodeURIComponent(req.url.split("?")[0]);
    if (caminho.endsWith("/")) caminho += "index.html";
    // Sem isto, "../../etc/passwd" sairia da raiz servida.
    const alvo = path.join(raiz, path.normalize(caminho).replace(/^(\.\.[/\\])+/, ""));
    if (!alvo.startsWith(raiz)) { res.writeHead(403).end(); return }
    fs.readFile(alvo, (err, buf) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain" }).end("404"); return }
      res.writeHead(200, {
        "content-type": TIPOS[path.extname(alvo)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(buf);
    });
  });
}

// Devolve o servidor já ouvindo, ou null quando a porta já está ocupada por
// alguém que serve o mesmo repositório (útil para rodar uma suíte à mão com o
// servidor já de pé).
function ouvir(raiz, porta) {
  return new Promise((resolve, reject) => {
    const s = criarServidor(raiz);
    s.once("error", e => (e.code === "EADDRINUSE" ? resolve(null) : reject(e)));
    s.listen(porta, "127.0.0.1", () => resolve(s));
  });
}

module.exports = { criarServidor, ouvir };
