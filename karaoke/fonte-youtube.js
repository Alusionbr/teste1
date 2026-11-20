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
 * A duração pode mudar quando a mídia fica pronta. Só separamos o relógio
 * quando o player identifica explicitamente outra mídia.
 */
const FonteYouTube=(()=>{
  // Origens, mensagens de erro, endereço do player e a conferência de vídeo moram em
  // verificar-youtube.js, que o celular (controle.html) também usa.
  const{ORIGEM,ORIGEM_PADRAO,ERROS,endereco}=YouTubeBase;
  const TETO_EXTRAPOLA=1,SEM_NOTICIA_MS=2500,LIMITE_PLAY_MS=12000,TENTATIVA_MS=6000;
  const ENCERRADO=0,TOCANDO=1,PAUSADO=2;

  let frame=null,vivo=false,pronto=false,handshake=null,videoAtual="";
  let ancora=0,ancoraEm=0,estado=-1,taxa=1,duracaoVideo=0,emAnuncio=false;
  let autoplayComprovado=false,vigia=null,ultimaNoticia=0,tocarQuandoPronto=false;
  let prazoPlay=null,esperandoPlay=false,origem=ORIGEM,alternativaUsada=false,tempoExcedido=false;

  function enviar(msg){
    // Antes de o iframe carregar, a janela ainda é a nossa: o navegador recusa o envio.
    if(!frame||!vivo||!frame.contentWindow)return false;
    try{frame.contentWindow.postMessage(JSON.stringify({...msg,id:1,channel:"widget"}),origem);return true}catch{return false}
  }
  const comando=(func,args)=>enviar({event:"command",func,args:args||[]});

  // O "listening" só é atendido depois que o player carregou; repete até responder.
  function apertarMao(){
    clearInterval(handshake);
    if(pronto)return;
    let n=0;
    const bater=()=>{if(pronto||n++>40){clearInterval(handshake);handshake=null;return}enviar({event:"listening"})};
    bater();handshake=setInterval(bater,250);
  }

  function aoReceber(e){
    // Qualquer aba, extensão ou frame pode postar aqui: confira origem E remetente.
    if(e.origin!==origem)return;
    if(!frame||e.source!==frame.contentWindow)return;
    if(typeof e.data!=="string")return;
    let msg;try{msg=JSON.parse(e.data)}catch{return}
    if(!msg||typeof msg!=="object")return;
    vivo=true; // mensagem válida do player = iframe vivo, mesmo antes do evento "load"
    if(msg.event==="onError"){
      const cod=Number(msg.info);
      if((cod===5||cod===153)&&esperandoPlay&&!alternativaUsada){carregarAlternativa();return}
      cancelarVigia();
      emitir("erro",{msg:ERROS[cod]||"O YouTube não conseguiu tocar este vídeo.",codigo:cod,bloqueadoEmbutir:cod===101||cod===150,tentarNovamente:cod===5||cod===153});
      return;
    }
    const info=msg.event==="onStateChange"&&typeof msg.info==="number"
      ?{playerState:msg.info}:msg.info;
    if(msg.event!=="onReady"&&(!info||typeof info!=="object"))return;
    const acabouDeFicarPronto=!pronto;
    pronto=true;ultimaNoticia=performance.now();
    aplicar(info||{});
    if(acabouDeFicarPronto&&alternativaUsada&&esperandoPlay&&estado!==TOCANDO)emitir("bloqueado",{tipo:"youtube",controles:true});
    // Pedido de tocar feito antes de o player carregar: cumpre agora.
    if(acabouDeFicarPronto&&tocarQuandoPronto){
      tocarQuandoPronto=false;comando("playVideo");vigiarGesto();
    }
  }

  function aplicar(info){
    const id=info.videoData?.video_id;
    if(id&&id!==videoAtual){
      if(!emAnuncio){
        emAnuncio=true;
        emitir("anuncio",{ativo:true});
      }
      return;
    }
    // Sem identificação nova, espera pelo próximo evento do vídeo selecionado.
    if(emAnuncio&&!id)return;
    const voltou=emAnuncio;
    emAnuncio=false;
    if(typeof info.duration==="number"&&info.duration>0)duracaoVideo=info.duration;
    if(typeof info.playbackRate==="number")taxa=info.playbackRate||1;
    const progresso=typeof info.currentTime==="number"&&info.currentTime!==ancora;
    if(typeof info.currentTime==="number"){ancora=info.currentTime;ancoraEm=performance.now()}
    if(typeof info.playerState==="number"&&info.playerState!==estado){
      const anterior=estado;
      estado=info.playerState;
      if(estado===TOCANDO){autoplayComprovado=true;clearTimeout(vigia)}
      if(estado===PAUSADO&&anterior===TOCANDO)cancelarVigia();
      emitir("estado");
      if(estado===ENCERRADO){cancelarVigia();comando("stopVideo");emitir("fim")}
    }
    if(voltou)emitir("anuncio",{ativo:false});
    if(progresso&&estado===TOCANDO){
      if(tempoExcedido){
        tempoExcedido=false;
        esperandoPlay=true;
        emitir("retomou");
      }
      if(esperandoPlay)vigiarProgresso();
    }
  }

  function criarFrame(url){
    if(frame)return frame;
    const f=document.createElement("iframe");
    f.title="Player do playback";
    // autoplay precisa ser DELEGADO ao frame, senão o Chrome recusa playVideo().
    f.setAttribute("allow","autoplay; encrypted-media; picture-in-picture");
    f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
    f.addEventListener("load",()=>{vivo=true;apertarMao()});
    frame=f;
    f.src=url;
    $("ytBox").appendChild(f);
    return f;
  }
  function zerar(){ancora=0;ancoraEm=performance.now();estado=-1;duracaoVideo=0;emAnuncio=false;tempoExcedido=false;taxa=1}

  // Se o play não pegou em 1,6 s, quase sempre é política de autoplay.
  function vigiarGesto(){
    clearTimeout(vigia);
    vigia=setTimeout(()=>{if(pronto&&estado!==TOCANDO&&esperandoPlay)emitir("bloqueado",{tipo:"youtube",controles:true})},1600);
  }
  function vigiarProgresso(limite=LIMITE_PLAY_MS){
    clearTimeout(prazoPlay);
    prazoPlay=setTimeout(()=>{
      cancelarVigia();
      tempoExcedido=true;
      emitir("erro",{msg:"O YouTube demorou para responder. Tente novamente ou abra o vídeo no YouTube.",tentarNovamente:true});
    },limite);
  }
  function navegar(inicio=null){
    clearInterval(handshake);
    vivo=false;pronto=false;
    const url=endereco(videoAtual,{origem,inicio,controles:true});
    if(frame)frame.src=url;else criarFrame(url);
  }
  function carregarAlternativa(limite=LIMITE_PLAY_MS){
    const inicio=Math.floor(Math.max(0,ancora));
    cancelarVigia();zerar();ancora=inicio;
    alternativaUsada=true;
    origem=origem===ORIGEM?ORIGEM_PADRAO:ORIGEM;
    navegar(inicio);
    tocar(limite);
  }
  function tocar(limite=LIMITE_PLAY_MS){
    esperandoPlay=true;
    if(pronto){comando("playVideo");vigiarGesto()}else tocarQuandoPronto=true;
    vigiarProgresso(limite);
    if(alternativaUsada)return;
    clearTimeout(prazoPlay);
    prazoPlay=setTimeout(()=>{
      if(!pronto){carregarAlternativa(LIMITE_PLAY_MS-TENTATIVA_MS);return}
      vigiarProgresso(LIMITE_PLAY_MS-TENTATIVA_MS);
    },TENTATIVA_MS);
  }
  function cancelarVigia(){
    clearTimeout(vigia);clearTimeout(prazoPlay);
    esperandoPlay=false;tocarQuandoPronto=false;
  }

  window.addEventListener("message",aoReceber);

  return{
    tipo:"youtube",
    verificar:YouTubeBase.verificar,
    async carregar(musica){
      const id=musica.playback.id;
      cancelarVigia();zerar();videoAtual=id;
      alternativaUsada=false;
      if(pronto&&frame){comando("cueVideoById",[id]);return}
      navegar();
    },
    recarregar(){if(frame&&videoAtual)carregarAlternativa()},
    tocar,
    pausar(){cancelarVigia();tempoExcedido=false;comando("pauseVideo")},
    alternar(){estado===TOCANDO?this.pausar():this.tocar()},
    buscar(seg){const alvo=Math.max(0,seg);ancora=alvo;ancoraEm=performance.now();comando("seekTo",[alvo,true])},
    parar(){this.pausar()},
    tempo(){
      if(emAnuncio||estado!==TOCANDO)return ancora;
      return ancora+clamp((performance.now()-ancoraEm)/1000*taxa,0,TETO_EXTRAPOLA);
    },
    duracao:()=>emAnuncio?0:duracaoVideo,
    tocando:()=>estado===TOCANDO&&!emAnuncio,
    sinal:()=>estado!==TOCANDO||performance.now()-ultimaNoticia<SEM_NOTICIA_MS,
    volume(v){comando("setVolume",[clamp(Math.round(v),0,100)])},
    get pronto(){return pronto},
    get carregando(){return esperandoPlay&&estado!==TOCANDO},
    get autoplayComprovado(){return autoplayComprovado},
    get emAnuncio(){return emAnuncio},
    // usado pelos testes: estado interno sem expor o iframe
    _depurar:()=>({pronto,estado,ancora,duracaoVideo,emAnuncio})
  };
})();
