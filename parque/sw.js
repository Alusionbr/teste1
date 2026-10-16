/*
 * Service worker do Mapa do Parque.
 *
 * Wi-Fi e 4G no parque são fracos: o app inteiro (incluindo o desenho do
 * mapa em park-data.js) fica em cache e abre sem internet. Só o grupo
 * (Supabase) vai para a rede, e nunca é cacheado.
 *
 * IMPORTANTE: alterou qualquer arquivo do app, suba VERSION aqui,
 * APP_VERSION em store.js e o ?v= do index.html.
 */
"use strict";
const VERSION = "1.0.0";
const CACHE = `parque-${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  `./styles.css?v=${VERSION}`,
  `./park-data.js?v=${VERSION}`,
  `./geo.js?v=${VERSION}`,
  `./store.js?v=${VERSION}`,
  `./route.js?v=${VERSION}`,
  `./map.js?v=${VERSION}`,
  `./gps.js?v=${VERSION}`,
  `./group.js?v=${VERSION}`,
  `./ui.js?v=${VERSION}`,
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("parque-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Página: rede primeiro (pega versão nova), cache se estiver sem sinal.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
