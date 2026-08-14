/*
 * Service worker do Estante.
 *
 * Objetivo: o app abrir e funcionar sem internet no palco. Só o "casco" do
 * aplicativo é guardado em cache (HTML, CSS, scripts e ícones). As letras
 * salvas continuam no localStorage, que já funciona offline.
 *
 * Consultas às fontes de letra (LRCLIB, Vagalume, Apple) nunca passam pelo
 * cache: são outro domínio e precisam de resposta fresca.
 *
 * IMPORTANTE: ao alterar qualquer arquivo do Estante, atualize APP_VERSION em
 * core.js e a constante abaixo. É o que faz o navegador buscar a versão nova.
 */
"use strict";
const VERSION = "3.6.0";
const CACHE = `estante-${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./core.js",
  "./search-engine.js",
  "./library.js",
  "./acervo.js",
  "./acervo.json",
  "./setlists.js",
  "./song-prefs.js",
  "./autoscroll.js",
  "./player.js",
  "./song-edit.js",
  "./print.js",
  "./ui.js",
  "./search-ui.js",
  "./offline.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      // addAll falha inteiro se um arquivo faltar; guardamos um a um para que
      // uma ausência isolada não impeça o app de ficar offline.
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("estante-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fontes de letra vão direto à rede

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      // Cache primeiro (abre rápido e funciona offline), atualizando por trás
      // para a próxima abertura já pegar a versão nova.
      const network = fetch(req).then(resp => {
        if (resp && resp.ok && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return resp;
      }).catch(() => null);

      if (hit) {
        event.waitUntil(network);
        return hit;
      }
      return network.then(resp => resp || caches.match("./index.html", { ignoreSearch: true }));
    })
  );
});
