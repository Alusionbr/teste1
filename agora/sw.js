/*
 * Service worker do Agora.
 *
 * O app precisa abrir sem internet: a lista de tarefas mora no aparelho e não
 * faz sentido depender de rede para ver o que fazer agora. Só o casco (HTML,
 * CSS, scripts e ícones) entra no cache — não há chamada externa nenhuma.
 *
 * IMPORTANTE: ao alterar qualquer arquivo do Agora, atualize APP_VERSION em
 * src/core.js, a constante VERSION abaixo e o ?v= das tags do index.html.
 * Sem isso o navegador continua servindo a versão antiga.
 */
"use strict";
const VERSION = "1.0.0";
const CACHE = `agora-${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./src/core.js",
  "./src/model.js",
  "./src/engine.js",
  "./src/focus.js",
  "./src/routines.js",
  "./src/views.js",
  "./src/views-gestao.js",
  "./src/backup.js",
  "./src/app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      // Um arquivo ausente não pode impedir o resto de ficar disponível
      // offline: guarda um a um em vez de addAll.
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k.startsWith("agora-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // nada de outra origem passa por aqui

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(guardado => {
      // Cache primeiro (abre instantâneo), rede em segundo plano para a
      // próxima abertura já vir atualizada.
      const daRede = fetch(req).then(resposta => {
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then(cache => cache.put(req, copia));
        }
        return resposta;
      }).catch(() => guardado);
      return guardado || daRede;
    })
  );
});
