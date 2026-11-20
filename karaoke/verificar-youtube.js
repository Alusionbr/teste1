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
    const p=new URLSearchParams({enablejsapi:"1",playsinline:"1",rel:"0",modestbranding:"1",controls:"1",iv_load_policy:"3"});
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
  function verificar(id,limiteMs=8000){
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

  return{ORIGEM,ORIGENS,ERROS,GRACA_ERRO_MS,endereco,verificar};
})();
