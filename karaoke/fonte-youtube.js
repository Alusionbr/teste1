"use strict";
/*
 * YouTube e YouTube Music como playback.
 *
 * Nenhum script do Google entra nesta página: o player é um <iframe> criado só
 * depois de um gesto do usuário, e o protocolo postMessage é falado à mão (o
 * mesmo que o www-widgetapi.js do Google usa, conferido no código dele):
 *   envio:   JSON {event:"listening"|"command", func, args, id:1, channel:"widget"}
 *   recebido JSON {event:"infoDelivery"|"initialDelivery"|"onReady"|"onError", info}
 *
 * MODO SÓ SOM: o player continua vivo (sem player não sai som, e iframe
 * escondido com display:none costuma ser pausado pelo navegador), mas fica
 * ATRÁS da camada da letra. Na tela aparece só a letra.
 *
 * UM iframe para a festa inteira, reaproveitado com loadVideoById: no iPhone o
 * toque do usuário não atravessa iframe de outra origem, então só um player que
 * já recebeu um toque de verdade aceita tocar por comando. Por isso, na
 * primeira música, se o play não pegar, o palco mostra o player por cima com
 * "Toque no vídeo para liberar o som"; depois disso ele volta para trás da letra.
 *
 * Relógio: infoDelivery chega a cada ~250 ms; entre as entregas o tempo é
 * extrapolado com teto de 1 s (o mesmo do getCurrentTime do Google). Se as
 * mensagens pararem, a letra congela em vez de disparar sozinha.
 *
 * Anúncio: durante o comercial o player informa a duração DO ANÚNCIO. Duração
 * muito diferente da do vídeo = anúncio, e o relógio da letra congela.
 */
const FonteYouTube=(()=>{
  const ORIGEM="https://www.youtube-nocookie.com";
  const ORIGENS=[ORIGEM,"https://www.youtube.com"];
  const TETO_EXTRAPOLA=1,SEM_NOTICIA_MS=2500,TOLERANCIA_DURACAO=2,GRACA_ERRO_MS=1500;
  const ENCERRADO=0,TOCANDO=1,PAUSADO=2,CARREGANDO=3;
  const ERROS={2:"Link de vídeo inválido.",5:"Este vídeo não toca neste navegador.",100:"Vídeo removido ou particular.",
    101:"Este vídeo não pode tocar fora do YouTube (o dono bloqueou).",150:"Este vídeo não pode tocar fora do YouTube (o dono bloqueou)."};

  let frame=null,vivo=false,pronto=false,handshake=null,videoAtual="";
  let ancora=0,ancoraEm=0,estado=-1,taxa=1,duracaoVideo=0,emAnuncio=false;
  let autoplayComprovado=false,vigia=null,ultimaNoticia=0,tocarQuandoPronto=false;

  function enviar(msg){
    // Antes de o iframe carregar, a janela ainda é a nossa: o navegador recusa o envio.
    if(!frame||!vivo||!frame.contentWindow)return false;
    try{frame.contentWindow.postMessage(JSON.stringify({...msg,id:1,channel:"widget"}),ORIGEM);return true}catch{return false}
  }
  const comando=(func,args)=>enviar({event:"command",func,args:args||[]});

  // O "listening" só é atendido depois que o player carregou; repete até responder.
  function apertarMao(){
    clearInterval(handshake);
    let n=0;
    const bater=()=>{if(pronto||n++>40){clearInterval(handshake);handshake=null;return}enviar({event:"listening"})};
    bater();handshake=setInterval(bater,250);
  }

  function aoReceber(e){
    // Qualquer aba, extensão ou frame pode postar aqui: confira origem E remetente.
    if(!ORIGENS.includes(e.origin))return;
    if(!frame||e.source!==frame.contentWindow)return;
    if(typeof e.data!=="string")return;
    let msg;try{msg=JSON.parse(e.data)}catch{return}
    if(!msg||typeof msg!=="object")return;
    vivo=true; // mensagem válida do player = iframe vivo, mesmo antes do evento "load"
    if(msg.event==="onError"){
      const cod=Number(msg.info);
      emitir("erro",{msg:ERROS[cod]||"O YouTube não conseguiu tocar este vídeo.",codigo:cod,bloqueadoEmbutir:cod===101||cod===150});
      return;
    }
    if(!msg.info&&msg.event!=="onReady")return;
    const acabouDeFicarPronto=!pronto;
    pronto=true;ultimaNoticia=performance.now();
    aplicar(msg.info||{});
    // Pedido de tocar feito antes de o player carregar: cumpre agora.
    if(acabouDeFicarPronto&&tocarQuandoPronto){tocarQuandoPronto=false;comando("playVideo")}
  }

  function aplicar(info){
    if(typeof info.playerState==="number"&&info.playerState!==estado){
      estado=info.playerState;
      if(estado===TOCANDO)autoplayComprovado=true;
      emitir("estado");
      // rel=0 não tira mais a grade de sugestões do fim: encerrar na hora deixa o palco limpo.
      if(estado===ENCERRADO){comando("stopVideo");emitir("fim")}
    }
    if(typeof info.playbackRate==="number")taxa=info.playbackRate||1;
    if(typeof info.currentTime==="number"){ancora=info.currentTime;ancoraEm=performance.now()}
    if(typeof info.duration==="number"&&info.duration>0)avaliarAnuncio(info.duration);
  }
  function avaliarAnuncio(dur){
    if(!duracaoVideo){duracaoVideo=dur;return}
    const agora=Math.abs(dur-duracaoVideo)>TOLERANCIA_DURACAO;
    if(agora!==emAnuncio){emAnuncio=agora;emitir("anuncio",{ativo:emAnuncio})}
  }

  function criarFrame(){
    if(frame)return frame;
    const f=document.createElement("iframe");
    f.title="Player do playback";
    // autoplay precisa ser DELEGADO ao frame, senão o Chrome recusa playVideo().
    f.setAttribute("allow","autoplay; encrypted-media; picture-in-picture");
    f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
    $("ytBox").appendChild(f);
    f.addEventListener("load",()=>{vivo=true;apertarMao()});
    frame=f;
    return f;
  }
  function endereco(id){
    const p=new URLSearchParams({enablejsapi:"1",playsinline:"1",rel:"0",modestbranding:"1",controls:"1",iv_load_policy:"3"});
    if(location.origin&&location.origin!=="null")p.set("origin",location.origin);
    return `${ORIGEM}/embed/${encodeURIComponent(id)}?${p}`;
  }
  function zerar(){ancora=0;ancoraEm=performance.now();estado=-1;duracaoVideo=0;emAnuncio=false}

  // Se o play não pegou em 1,6 s, quase sempre é política de autoplay.
  function vigiarPlay(){
    clearTimeout(vigia);
    vigia=setTimeout(()=>{if(estado!==TOCANDO&&estado!==CARREGANDO&&videoAtual)emitir("bloqueado",{tipo:"youtube"})},1600);
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

  window.addEventListener("message",aoReceber);

  return{
    tipo:"youtube",
    verificar,
    async carregar(musica){
      const id=musica.playback.id;
      const f=criarFrame();
      zerar();videoAtual=id;tocarQuandoPronto=false;
      if(pronto&&f.src){comando("cueVideoById",[id]);return}
      vivo=false;pronto=false;f.src=endereco(id);
    },
    tocar(){if(!pronto)tocarQuandoPronto=true;comando("playVideo");vigiarPlay()},
    pausar(){clearTimeout(vigia);tocarQuandoPronto=false;comando("pauseVideo")},
    alternar(){estado===TOCANDO?this.pausar():this.tocar()},
    buscar(seg){const alvo=Math.max(0,seg);ancora=alvo;ancoraEm=performance.now();comando("seekTo",[alvo,true])},
    parar(){clearTimeout(vigia);tocarQuandoPronto=false;comando("pauseVideo")},
    tempo(){
      if(emAnuncio||estado!==TOCANDO)return ancora;
      return ancora+clamp((performance.now()-ancoraEm)/1000*taxa,0,TETO_EXTRAPOLA);
    },
    duracao:()=>emAnuncio?0:duracaoVideo,
    tocando:()=>estado===TOCANDO&&!emAnuncio,
    sinal:()=>estado!==TOCANDO||performance.now()-ultimaNoticia<SEM_NOTICIA_MS,
    volume(v){comando("setVolume",[clamp(Math.round(v),0,100)])},
    get autoplayComprovado(){return autoplayComprovado},
    get emAnuncio(){return emAnuncio},
    // usado pelos testes: estado interno sem expor o iframe
    _depurar:()=>({pronto,estado,ancora,duracaoVideo,emAnuncio})
  };
})();
