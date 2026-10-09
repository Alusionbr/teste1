/*
 * Service worker do Estante.
 *
 * Objetivo: o app abrir e funcionar sem internet no palco. Só o "casco" do
 * aplicativo é guardado em cache (HTML, CSS, scripts e ícones). As letras
 * salvas continuam no IndexedDB, com uma cópia de recuperação local.
 *
 * Consultas às fontes de letra (LRCLIB, Vagalume, Apple) nunca passam pelo
 * cache: são outro domínio e precisam de resposta fresca.
 *
 * IMPORTANTE: ao alterar qualquer arquivo do Estante, atualize APP_VERSION em
 * core.js e a constante abaixo. É o que faz o navegador buscar a versão nova.
 */
"use strict";
const VERSION = "4.0.7";
const CACHE = `estante-${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./domain.js",
  "./storage.js",
  "./core.js",
  "./search-engine.js",
  "./library.js",
  "./acervo.js",
  "./acervo.json",
  "./setlists.js",
  "./song-prefs.js",
  "./autoscroll.js",
  "./player.js",
  "./karaoke.js",
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
    // A instalação é transacional: uma versão só fica pronta quando todo o
    // casco essencial está no cache. Se um arquivo faltar, a versão anterior
    // segue ativa e o usuário não fica com um app parcialmente offline.
    caches.open(CACHE).then(cache => cache.addAll(SHELL.map(asset => /\.(?:js|css|json)$/.test(asset) ? `${asset}?v=${VERSION}` : asset)))
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

  // Página sempre tenta a rede primeiro para receber a versão atual. Quando
  // offline, cai para o shell salvo. Scripts e imagens continuam cache-first.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) {
          await (await caches.open(CACHE)).put("./index.html", resp.clone());
          return resp;
        }
        return await (await caches.open(CACHE)).match("./index.html") || resp;
      } catch {
        return (await caches.open(CACHE)).match("./index.html");
      }
    })());
    return;
  }

  event.respondWith((async () => {
    // Cada worker lê apenas o seu cache e a versão exata pedida pelo HTML.
    // Ignorar ?v= misturava scripts antigos e novos após uma publicação.
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const resp = await fetch(req);
      if (resp.ok && resp.type === "basic" && (!url.searchParams.has("v") || url.searchParams.get("v") === VERSION)) {
        await cache.put(req, resp.clone());
      }
      return resp;
    } catch {
      return Response.error();
    }
  })());
});
