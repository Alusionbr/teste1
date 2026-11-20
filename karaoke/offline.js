"use strict";
/*
 * Registra o service worker e avisa quando há versão nova.
 * Não roda em file:// — service worker só funciona em http/https.
 */
(function () {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, { scope: "./", updateViaCache: "none" });
      if (reg.waiting) avisar(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nova = reg.installing;
        if (!nova) return;
        nova.addEventListener("statechange", () => {
          if (nova.state === "installed" && navigator.serviceWorker.controller) avisar(nova);
        });
      });
      if (navigator.onLine) reg.update().catch(() => {});
    } catch (e) {
      // Sem service worker o app funciona; só perde o modo offline.
    }
  });
  // Primeira visita também dispara controllerchange: só recarrega se já havia versão antes.
  const jaControlado = !!navigator.serviceWorker.controller;
  let recarregando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recarregando || !jaControlado) return;
    recarregando = true;
    location.reload();
  });
  function avisar(worker) {
    notify("Nova versão do Karaokê em Casa disponível.", true, { label: "Atualizar", run: () => worker.postMessage("skipWaiting") });
  }
})();
