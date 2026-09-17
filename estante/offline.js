"use strict";
(function(){
  if(!("serviceWorker"in navigator)||location.protocol==="file:")return;
  let activationRequested=false,pendingWorker=null,peerOnStage=false;
  const channel=typeof BroadcastChannel==="function"?new BroadcastChannel("estante-update"):null;
  if(channel)channel.onmessage=event=>{if(event.data==="is-anyone-on-stage"&&state.stage)channel.postMessage("stage-active");if(event.data==="stage-active")peerOnStage=true};
  window.addEventListener("load",async()=>{try{const reg=await navigator.serviceWorker.register(`./sw.js?v=${APP_VERSION}`,{scope:"./"});if(reg.waiting)announceUpdate(reg.waiting);reg.addEventListener("updatefound",()=>{const worker=reg.installing;if(worker)worker.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)announceUpdate(worker)})});if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch{}});
  navigator.serviceWorker.addEventListener("controllerchange",async()=>{if(!activationRequested||state.stage)return;await waitForPendingWrites();location.reload()});
  function announceUpdate(worker){pendingWorker=worker;if(state.stage){notify("Uma atualização está pronta. Ela ficará aguardando até você sair do palco.");return}renderNoticeRaw('Nova versão disponível. <button type="button" id="reloadApp">Atualizar</button>',true);const button=$("reloadApp");if(button)button.onclick=activate}
  async function activate(){if(!pendingWorker||state.stage)return;peerOnStage=false;if(channel){channel.postMessage("is-anyone-on-stage");await new Promise(resolve=>setTimeout(resolve,350))}if(peerOnStage)return notify("Outra aba está no palco. Feche a apresentação nela antes de atualizar.");await waitForPendingWrites();activationRequested=true;pendingWorker.postMessage("activate-update")}
  window.addEventListener("estante:stage-exit",()=>{if(pendingWorker)announceUpdate(pendingWorker)});
})();
