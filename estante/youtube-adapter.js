"use strict";
const YouTubeAdapter=(()=>{
  let apiPromise=null;
  function loadApi(timeout=12000){
    if(window.YT&&window.YT.Player)return Promise.resolve(window.YT);
    if(apiPromise)return apiPromise;
    apiPromise=new Promise((resolve,reject)=>{const previous=window.onYouTubeIframeAPIReady,timer=setTimeout(()=>reject(Error("O YouTube demorou demais para carregar.")),timeout);window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);try{if(typeof previous==="function")previous()}finally{resolve(window.YT)}};const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";script.async=true;script.onerror=()=>{clearTimeout(timer);reject(Error("Não foi possível carregar o YouTube."))};document.head.appendChild(script)});return apiPromise
  }
  async function create(container,handlers={}){const YT=await loadApi();return new Promise((resolve,reject)=>{let settled=false;const player=new YT.Player(container,{height:"100%",width:"100%",playerVars:{playsinline:1,rel:0,controls:1},events:{onReady:()=>{settled=true;resolve(player)},onStateChange:event=>handlers.onState&&handlers.onState(event.data,YT.PlayerState),onError:event=>handlers.onError&&handlers.onError(event.data)}});setTimeout(()=>{if(!settled)reject(Error("O player do YouTube não respondeu."))},12000)})}
  return{create};
})();
