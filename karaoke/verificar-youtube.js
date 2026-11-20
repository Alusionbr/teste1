"use strict";
/*
 * Peças do YouTube que a tela do palco (fonte-youtube.js) e o celular
 * (controle.html) usam: origens aceitas, textos de erro, endereço do player e a
 * conferência "este vídeo toca fora do YouTube?". Sem dependência do palco:
 * só document, window, location e setTimeout.
 *
 * Nenhum script do Google é carregado: o player é um <iframe> falado por
 * postMessage à mão (ver o cabeçalho de fonte-youtube.js).
 */
const YouTubeBase=(()=>{
  const ORIGEM="https://www.youtube-nocookie.com";
  const ORIGENS=[ORIGEM,"https://www.youtube.com"];
  const GRACA_ERRO_MS=1500;
  const ERROS={2:"Link de vídeo inválido.",5:"Este vídeo não toca neste navegador.",100:"Vídeo removido ou particular.",
    101:"Este vídeo não pode tocar fora do YouTube (o dono bloqueou).",150:"Este vídeo não pode tocar fora do YouTube (o dono bloqueou)."};

  function endereco(id){
    const p=new URLSearchParams({enablejsapi:"1",playsinline:"1",rel:"0",modestbranding:"1",controls:"0",disablekb:"1",fs:"0",iv_load_policy:"3"});
    if(location.origin&&location.origin!=="null")p.set("origin",location.origin);
    return `${ORIGEM}/embed/${encodeURIComponent(id)}?${p}`;
  }
  /*
   * Confere se o vídeo pode tocar fora do YouTube, ANTES de a família escolhê-lo.
   * O oEmbed não serve para isso: responde 200 mesmo para clipes bloqueados (medido
   * em 20/11/2026 com a Sia e o Despacito, que o player recusa com erro 150).
   * Abre um player minúsculo e invisível só pelo tempo da conferência e o remove.
   * Resolve {ok:true}, {ok:true,incerto:true} (sem resposta a tempo, ex.: sem
   * internet — não impede a escolha) ou {ok:false,codigo,msg,bloqueado}.
   */
  function conferir(id,limiteMs){
    return new Promise(resolve=>{
      const f=document.createElement("iframe");
      f.title="Verificação do vídeo";
      f.setAttribute("aria-hidden","true");
      f.tabIndex=-1;
      f.style.cssText="position:fixed;left:-20px;top:-20px;width:2px;height:2px;border:0;opacity:0;pointer-events:none";
      f.setAttribute("allow","encrypted-media");
      f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
      let fim=false,batida=null,prazo=null,graca=null;
      const sair=r=>{
        if(fim)return;fim=true;
        clearInterval(batida);clearTimeout(prazo);clearTimeout(graca);
        window.removeEventListener("message",ouvir);
        f.remove();resolve(r);
      };
      function ouvir(e){
        if(!ORIGENS.includes(e.origin)||e.source!==f.contentWindow||typeof e.data!=="string")return;
        let m;try{m=JSON.parse(e.data)}catch{return}
        if(!m||typeof m!=="object")return;
        if(m.event==="onError"){const c=Number(m.info);sair({ok:false,codigo:c,bloqueado:c===101||c===150,msg:ERROS[c]||"O YouTube não conseguiu tocar este vídeo."});return}
        // Para vídeo bloqueado o player manda "pronto" e, NO MESMO INSTANTE, onError 150
        // (medido com a Sia: initialDelivery, onReady e onError no mesmo milissegundo).
        // Por isso "pronto" não basta: espera um instante pelo erro antes de aceitar.
        if((m.event==="onReady"||m.info)&&!graca)graca=setTimeout(()=>sair({ok:true}),GRACA_ERRO_MS);
      }
      window.addEventListener("message",ouvir);
      f.addEventListener("load",()=>{
        const bater=()=>{try{f.contentWindow.postMessage(JSON.stringify({event:"listening",id:2,channel:"widget"}),ORIGEM)}catch{}};
        bater();batida=setInterval(bater,250);
      });
      prazo=setTimeout(()=>sair({ok:true,incerto:true}),limiteMs);
      f.src=endereco(id);
      document.body.appendChild(f);
    });
  }

  /*
   * Conferência para uso: UMA por vez, com cache e sem competir com a música.
   * Cada conferência abre um segundo player do YouTube escondido; várias ao mesmo tempo, ou
   * uma durante a música na TV, engasgam o vídeo que está tocando e atrasam as mensagens
   * que movem a letra. Por isso:
   *  - fila: uma conferência de cada vez;
   *  - cache de 15 min por vídeo (só resposta firme: sem "incerto");
   *  - `ocupado()` (a tela do palco define): enquanto a música toca nesta tela, espera até
   *    ESPERA_MAX_MS; se não liberar, devolve {ok:true,incerto:true,adiado:true} sem abrir nada.
   */
  const CACHE_MS=15*60*1000,ESPERA_MAX_MS=15000,PRAZO_PADRAO_MS=5000;
  const cache=new Map();let fila=Promise.resolve(),ocupadoFn=()=>false;
  const esperar=ms=>new Promise(r=>setTimeout(r,ms));
  async function aguardarLivre(maxMs=Infinity){
    const fim=Date.now()+maxMs;
    while(ocupadoFn()){if(Date.now()>=fim)return false;await esperar(500)}
    return true;
  }
  function verificar(id,limiteMs=PRAZO_PADRAO_MS){
    const guardado=cache.get(id);
    if(guardado&&Date.now()-guardado.em<CACHE_MS)return Promise.resolve(guardado.r);
    const rodar=async()=>{
      const certo=cache.get(id);
      if(certo&&Date.now()-certo.em<CACHE_MS)return certo.r;
      if(!await aguardarLivre(ESPERA_MAX_MS))return{ok:true,incerto:true,adiado:true};
      const r=await conferir(id,limiteMs);
      if(!r.incerto)cache.set(id,{r,em:Date.now()});
      return r;
    };
    const p=fila.then(rodar,rodar);
    fila=p.catch(()=>{});
    return p;
  }

  return{ORIGEM,ORIGENS,ERROS,GRACA_ERRO_MS,endereco,verificar,aguardarLivre,
    definirOcupado(fn){ocupadoFn=typeof fn==="function"?fn:()=>false},
    _limparCache(){cache.clear()}};
})();
