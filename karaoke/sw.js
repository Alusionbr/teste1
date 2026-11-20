/*
 * Service worker do Karaokê em Casa.
 *
 * Guarda só o "casco" do app (HTML, CSS, scripts, ícones) para abrir sem
 * internet. Letras, músicas do aparelho e playlists ficam no IndexedDB.
 * Nada de outra origem passa pelo cache: YouTube, Spotify, LRCLIB e a sala
 * (Supabase) vão sempre direto à rede.
 *
 * IMPORTANTE: alterou qualquer arquivo, suba APP_VERSION (core.js), VERSION
 * (abaixo) e os ?v= / data-version de index.html e controle.html.
 */
"use strict";
const VERSION = "1.0.16";
const CACHE = `karaoke-${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  "./controle.html",
  "./styles.css",
  "./core.js",
  "./storage.js",
  "./lrc.js",
  "./links.js",
  "./placar.js",
  "./estado.js",
  "./familia.js",
  "./biblioteca.js",
  "./playlists.js",
  "./letras.js",
  "./busca-youtube.js",
  "./fontes.js",
  "./verificar-youtube.js",
  "./auto-adicionar.js",
  "./fonte-youtube.js",
  "./fonte-spotify.js",
  "./aplausometro.js",
  "./palco.js",
  "./sincronia.js",
  "./qr.js",
  "./sala.js",
  "./sala-host.js",
  "./telas.js",
  "./ui.js",
  "./controle.js",
  "./offline.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  // Transacional: a versão só fica pronta com o casco inteiro no cache.
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL.map(a => /\.(?:js|css)$/.test(a) ? `${a}?v=${VERSION}` : a)))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("karaoke-") && k !== CACHE).map(k => caches.delete(k))))
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
  if (url.origin !== self.location.origin) return; // fontes externas: sempre rede

  // Página: rede primeiro (pega a versão nova); sem rede, a cópia guardada.
  if (req.mode === "navigate") {
    const pagina = /controle\.html$/.test(url.pathname) ? "./controle.html" : "./index.html";
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const resp = await fetch(req);
        if (resp && resp.ok) { await cache.put(pagina, resp.clone()); return resp; }
        return (await cache.match(pagina)) || resp;
      } catch {
        return cache.match(pagina);
      }
    })());
    return;
  }

  event.respondWith((async () => {
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
