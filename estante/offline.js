"use strict";
/*
 * Registro do service worker e aviso de nova versão.
 * Não roda em file:// — o navegador só aceita service worker em http/https.
 */
(function () {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`, { scope: "./" });

      // Já existe uma versão nova esperando de uma visita anterior.
      if (reg.waiting) announceUpdate(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const fresh = reg.installing;
        if (!fresh) return;
        fresh.addEventListener("statechange", () => {
          // "installed" com controller ativo = atualização, não primeira visita.
          if (fresh.state === "installed" && navigator.serviceWorker.controller) announceUpdate(fresh);
        });
      });
    } catch (e) {
      // Sem service worker o app continua funcionando; só perde o offline.
    }
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  function announceUpdate(worker) {
    notify('Nova versão do Estante disponível. <button type="button" id="reloadApp">Atualizar</button>', true);
    const btn = document.getElementById("reloadApp");
    if (btn) btn.onclick = () => worker.postMessage("skipWaiting");
  }
})();
