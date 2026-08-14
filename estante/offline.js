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

  // Na primeira visita o service worker assume o controle e dispara
  // controllerchange na hora. Recarregar nesse momento só faz a tela piscar e
  // joga fora o que estava aberto. Só é troca de versão quando já existia um
  // controller antes.
  const jaControlado = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !jaControlado) return;
    reloading = true;
    location.reload();
  });

  function announceUpdate(worker) {
    notify('Nova versão do Estante disponível. <button type="button" id="reloadApp">Atualizar</button>', true);
    const btn = document.getElementById("reloadApp");
    if (btn) btn.onclick = () => worker.postMessage("skipWaiting");
  }
})();
