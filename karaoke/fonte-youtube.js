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
 * Anúncio: durante o comercial o player informa a duração DO ANÚNCIO. Anúncio =
 * duração CURTA (até 60 s) e menor que a do vídeo; o relógio da letra congela e
 * volta sozinho quando a duração normal reaparece. A referência é a duração
 * esperada do vídeo (playback.duracao, guardada na escolha); sem ela, vale a duração
 * que se repete por 3 mensagens seguidas. Nunca a primeira mensagem: o iframe é
 * reaproveitado entre músicas (chegam mensagens atrasadas do vídeo anterior) e um
 * anúncio antes do vídeo também vem primeiro.
 */
const FonteYouTube=(()=>{
  // Origens, mensagens de erro, endereço do player e a conferência de vídeo moram em
  // verificar-youtube.js, que o celular (controle.html) também usa.
  const{ORIGEM,ORIGENS,ERROS,endereco}=YouTubeBase;
  const TETO_MIN=1,TETO_MAX=2,SEM_NOTICIA_MS=3000,TOLERANCIA_DURACAO=2,ANUNCIO_MAX_S=60,ESTAVEL=3,REGISTRO_MAX=600;
  const ENCERRADO=0,TOCANDO=1,PAUSADO=2,CARREGANDO=3;

  let frame=null,vivo=false,pronto=false,handshake=null,videoAtual="";
  let ancora=0,ancoraEm=0,estado=-1,taxa=1,duracaoVideo=0,emAnuncio=false;
  let autoplayComprovado=false,vigia=null,ultimaNoticia=0,tocarQuandoPronto=false;
  let duracaoEsperada=0,candidata=0,repeticoes=0,intervalos=[],teto=TETO_MIN;
  // Gravador para o Diagnóstico: o que o player mandou e o que o app concluiu.
  const registro=[];let inicioRegistro=0,maiorIntervalo=0,anunciosVistos=0,congelamentos=0;

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
    const agora=performance.now();
    if(ultimaNoticia){
      const gap=agora-ultimaNoticia;
      if(gap<30000&&estado===TOCANDO){
        if(gap>teto*1000)congelamentos++;   // a letra teria parado antes desta mensagem
        intervalos.push(gap);if(intervalos.length>8)intervalos.shift();
        // Teto de extrapolação acompanha o atraso real das entregas (1 a 2 s): TV ocupada
        // atrasa as mensagens, e um teto fixo congelava a letra e depois a fazia pular.
        teto=clamp(Math.max(...intervalos)/1000*1.5,TETO_MIN,TETO_MAX);
        if(gap>maiorIntervalo)maiorIntervalo=gap;
      }
    }
    pronto=true;ultimaNoticia=agora;
    aplicar(msg.info||{});
    gravar(msg.info||{});
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
  function gravar(info){
    if(!inicioRegistro)inicioRegistro=performance.now();
    if(registro.length>=REGISTRO_MAX)registro.shift();
    registro.push({t:Math.round(performance.now()-inicioRegistro),v:videoAtual,e:estado,c:typeof info.currentTime==="number"?Math.round(info.currentTime*100)/100:null,d:typeof info.duration==="number"?Math.round(info.duration*10)/10:null,a:emAnuncio});
  }
  function avaliarAnuncio(dur){
    // Duração que se repete: vira a referência quando não há duração esperada.
    if(Math.abs(dur-candidata)<=TOLERANCIA_DURACAO)repeticoes++;else{candidata=dur;repeticoes=1}
    const referencia=duracaoEsperada||duracaoVideo;
    // Anúncio = curto, menor que a referência e diferente dela. Sem referência, nunca é anúncio.
    // Se a "duração curta" dura mais que qualquer anúncio (~60 s de mensagens), era o próprio vídeo.
    const curto=dur<=ANUNCIO_MAX_S&&referencia>0&&dur<referencia-TOLERANCIA_DURACAO&&repeticoes<=ANUNCIO_MAX_S*4+8;
    // A duração estável que não é anúncio vira a referência (vídeo certo, mesmo que a esperada estivesse errada).
    if(!curto&&repeticoes>=ESTAVEL)duracaoVideo=dur;
    if(curto!==emAnuncio){emAnuncio=curto;if(curto)anunciosVistos++;emitir("anuncio",{ativo:emAnuncio})}
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
  function zerar(){ancora=0;ancoraEm=performance.now();estado=-1;duracaoVideo=0;emAnuncio=false;candidata=0;repeticoes=0;intervalos=[];teto=TETO_MIN}

  // Se o play não pegou em 1,6 s, quase sempre é política de autoplay.
  function vigiarPlay(){
    clearTimeout(vigia);
    vigia=setTimeout(()=>{if(estado!==TOCANDO&&estado!==CARREGANDO&&videoAtual)emitir("bloqueado",{tipo:"youtube"})},1600);
  }

  window.addEventListener("message",aoReceber);

  return{
    tipo:"youtube",
    verificar:YouTubeBase.verificar,
    async carregar(musica){
      const id=musica.playback.id;
      const f=criarFrame();
      zerar();videoAtual=id;tocarQuandoPronto=false;
      duracaoEsperada=Number(musica.playback.duracao)||0;
      if(pronto&&f.src){comando("cueVideoById",[id]);return}
      vivo=false;pronto=false;f.src=endereco(id);
    },
    // Legendas do YouTube (CC): com a letra do app ligada elas duplicam a letra e brigam com as
    // barras do palco, então são descarregadas. Com "só o vídeo" ficam como o vídeo quiser.
    legendas(ligadas){if(!ligadas){comando("unloadModule",["captions"]);comando("unloadModule",["cc"])}},
    // Recarrega o iframe do zero (vídeo travado). Quem chama manda tocar e voltar ao ponto.
    reiniciar(musica){
      if(!frame||!videoAtual)return;
      const id=videoAtual;
      zerar();videoAtual=id;tocarQuandoPronto=false;
      if(musica&&musica.playback)duracaoEsperada=Number(musica.playback.duracao)||0;
      vivo=false;pronto=false;frame.src=endereco(id);
    },
    tocar(){if(!pronto)tocarQuandoPronto=true;comando("playVideo");vigiarPlay()},
    pausar(){clearTimeout(vigia);tocarQuandoPronto=false;comando("pauseVideo")},
    alternar(){estado===TOCANDO?this.pausar():this.tocar()},
    buscar(seg){const alvo=Math.max(0,seg);ancora=alvo;ancoraEm=performance.now();comando("seekTo",[alvo,true])},
    parar(){clearTimeout(vigia);tocarQuandoPronto=false;comando("pauseVideo")},
    tempo(){
      if(emAnuncio||estado!==TOCANDO)return ancora;
      return ancora+clamp((performance.now()-ancoraEm)/1000*taxa,0,teto);
    },
    duracao:()=>emAnuncio?0:(duracaoVideo||duracaoEsperada),
    tocando:()=>estado===TOCANDO&&!emAnuncio,
    sinal:()=>estado!==TOCANDO||performance.now()-ultimaNoticia<SEM_NOTICIA_MS,
    volume(v){comando("setVolume",[clamp(Math.round(v),0,100)])},
    get autoplayComprovado(){return autoplayComprovado},
    get emAnuncio(){return emAnuncio},
    // usado pelos testes: estado interno sem expor o iframe
    _depurar:()=>({pronto,estado,ancora,duracaoVideo,emAnuncio,teto}),
    // Para o Diagnóstico (Ajustes): resumo e as últimas mensagens do player.
    diagnostico:()=>({mensagens:registro.length,maiorIntervaloMs:Math.round(maiorIntervalo),anuncios:anunciosVistos,congelamentos,teto:Math.round(teto*10)/10,esperada:duracaoEsperada,duracaoVideo,emAnuncio,estado,registro:registro.slice(-120)})
  };
})();
