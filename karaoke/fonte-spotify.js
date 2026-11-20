"use strict";
/*
 * Spotify como playback.
 *
 * Sem o script do Spotify na página: o protocolo foi conferido no próprio
 * iframe_api do Spotify (embed-cdn.spotifycdn.com, lido em 20/11/2026) e é
 * falado à mão. Mensagens são OBJETOS (não JSON em texto):
 *   recebido: {type:"ready"} | {type:"playback_update", payload:{isPaused,
 *             isBuffering, position, duration}} (ms) | {type:"error", payload}
 *   envio:    {command:"load_complete_ack"} depois do "ready";
 *             {command:"play"|"pause"|"resume"|"toggle"} e
 *             {command:"seek", timestamp:<segundos>}
 *
 * Limites do Spotify (não são nossos, e a tela avisa):
 * - sem login no Spotify NESTE navegador, toca só a prévia de 30 s;
 * - o primeiro play precisa ser um toque no ▶ do próprio player; por isso o
 *   player do Spotify fica visível num canto do palco;
 * - cada faixa nova recarrega o player (é assim no script oficial também).
 */
const FonteSpotify=(()=>{
  const ORIGEM="https://open.spotify.com";
  const TETO_EXTRAPOLA=1,SEM_NOTICIA_MS=3000;
  let frame=null,pronto=false,faixa="",musicaDuracao=0;
  let ancora=0,ancoraEm=0,pausado=true,duracaoMs=0,jaTocou=false,acabou=false,avisouPrevia=false,vigia=null,ultimaNoticia=0,tocarQuandoPronto=false;

  function enviar(msg){
    if(!frame||!frame.contentWindow)return false;
    try{frame.contentWindow.postMessage(msg,ORIGEM);return true}catch{return false}
  }
  function aoReceber(e){
    if(e.origin!==ORIGEM)return;
    if(!frame||e.source!==frame.contentWindow)return;
    const msg=e.data;
    if(!msg||typeof msg!=="object")return;
    if(msg.type==="ready"){
      pronto=true;enviar({command:"load_complete_ack"});
      if(tocarQuandoPronto){tocarQuandoPronto=false;enviar({command:"play"})}
      return;
    }
    if(msg.type==="error"){emitir("erro",{msg:"O Spotify não conseguiu tocar esta faixa."});return}
    if(msg.type!=="playback_update"||!msg.payload)return;
    aplicar(msg.payload);
  }
  function aplicar(p){
    ultimaNoticia=performance.now();
    const pos=Number(p.position)||0,dur=Number(p.duration)||0;
    const estavaPausado=pausado;
    pausado=!!p.isPaused||!!p.isBuffering;
    if(!p.isPaused)jaTocou=true;
    if(dur)duracaoMs=dur;
    // Fim: parou no finalzinho, ou voltou ao zero depois de ter chegado perto do fim.
    const pertoDoFim=duracaoMs&&ancora*1000>=duracaoMs-1500;
    if(jaTocou&&!acabou&&p.isPaused&&(pos>=duracaoMs-600||(pos===0&&pertoDoFim))){acabou=true;ancora=duracaoMs/1000;emitir("estado");emitir("fim");return}
    ancora=pos/1000;ancoraEm=performance.now();
    if(!p.isPaused&&dur&&dur<=31000&&musicaDuracao>45&&!avisouPrevia){avisouPrevia=true;emitir("previa")}
    if(estavaPausado!==pausado)emitir("estado");
  }
  function criarFrame(){
    if(frame)return frame;
    const f=document.createElement("iframe");
    f.title="Player do Spotify";
    f.setAttribute("allow","autoplay; clipboard-write; encrypted-media; picture-in-picture");
    f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
    $("spBox").appendChild(f);
    frame=f;
    return f;
  }
  function vigiarPlay(){
    clearTimeout(vigia);
    vigia=setTimeout(()=>{if(pausado&&faixa)emitir("bloqueado",{tipo:"spotify"})},1800);
  }
  window.addEventListener("message",aoReceber);

  return{
    tipo:"spotify",
    async carregar(musica){
      const f=criarFrame();
      faixa=musica.playback.id;musicaDuracao=musica.duration||0;
      pronto=false;ancora=0;ancoraEm=performance.now();pausado=true;duracaoMs=0;jaTocou=false;acabou=false;avisouPrevia=false;tocarQuandoPronto=false;
      f.src=`${ORIGEM}/embed/track/${encodeURIComponent(faixa)}?utm_source=generator&theme=0`;
    },
    tocar(){
      if(!pronto){tocarQuandoPronto=true;vigiarPlay();return}
      if(acabou){acabou=false;enviar({command:"play"})}
      else enviar({command:jaTocou?"resume":"play"});
      vigiarPlay();
    },
    pausar(){clearTimeout(vigia);tocarQuandoPronto=false;enviar({command:"pause"})},
    alternar(){pausado?this.tocar():this.pausar()},
    buscar(seg){ancora=Math.max(0,seg);ancoraEm=performance.now();enviar({command:"seek",timestamp:Math.max(0,seg)})},
    parar(){clearTimeout(vigia);tocarQuandoPronto=false;enviar({command:"pause"})},
    tempo(){
      if(pausado)return ancora;
      return ancora+clamp((performance.now()-ancoraEm)/1000,0,TETO_EXTRAPOLA);
    },
    duracao:()=>duracaoMs/1000,
    tocando:()=>!pausado,
    sinal:()=>pausado||performance.now()-ultimaNoticia<SEM_NOTICIA_MS,
    volume(){},
    _depurar:()=>({pronto,pausado,ancora,duracaoMs,acabou})
  };
})();
