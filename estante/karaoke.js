"use strict";
/*
 * Modo karaokê: vídeo do YouTube tocando com a letra por cima.
 *
 * Por que um <iframe> não quebra a regra "nada de biblioteca externa":
 * o iframe é um documento separado, com o JavaScript dele rodando no contexto
 * dele. Nenhum script de terceiro entra nesta página, o service worker não vê
 * nada disso (sw.js devolve tudo que é de outra origem para a rede sem tocar) e
 * o casco do app continua cacheado e abrindo sem internet. O que NÃO pode é
 * carregar o `iframe_api` do Google: aí sim seria script externo dentro do app,
 * e o offline morreria junto. Por isso falamos o protocolo na mão — está
 * documentado logo abaixo, conferido no código do próprio Google.
 *
 * Regras que sustentam o resto do arquivo:
 *
 * 1. UM iframe para a sessão inteira, reaproveitado por `loadVideoById`.
 *    Não é economia de memória (embora 30 players numa noite pesem): no iOS o
 *    gesto do usuário NÃO atravessa um iframe de outra origem, então tocar um
 *    vídeo por programa só funciona no elemento de mídia que já recebeu um
 *    toque de verdade uma vez. Um iframe por música obrigaria a tocar na tela a
 *    cada troca, e encadear música ficaria impossível.
 *
 * 2. O tempo é extrapolado entre as entregas. O `infoDelivery` chega a cada
 *    ~250 ms, não a cada quadro; usar o valor cru faria a letra andar aos
 *    saltos. O próprio getCurrentTime do Google extrapola do mesmo jeito, com o
 *    mesmo teto de 1 s — que aqui também serve de freio: se as mensagens
 *    pararem, a letra congela em vez de disparar sozinha.
 *
 * 3. Anúncio não é a música. Durante um anúncio o player informa o tempo e a
 *    duração DO ANÚNCIO. Sem detectar isso, a letra corre durante o comercial e
 *    entra atrasada na música — toda vez, não de vez em quando.
 */

const YT_ORIGIN="https://www.youtube-nocookie.com";
const YT_ORIGINS=[YT_ORIGIN,"https://www.youtube.com"];
const YT_ID=1;                    // id do nosso player no protocolo do widget
const EXTRAPOLA_MAX=1;            // segundos: mesmo teto que o Google usa
const SEM_NOTICIA_MS=2500;        // silêncio maior que isso = perdemos o player
const DUR_TOLERANCIA=2;           // diferença de duração que denuncia anúncio

// Estados do player do YouTube.
const YT_ENCERRADO=0,YT_TOCANDO=1,YT_PAUSADO=2,YT_CARREGANDO=3;

let ytFrame=null,ytPronto=false,ytHandshake=null;
let ancoraTempo=0,ancoraEm=0,ytEstado=-1,ytTaxa=1;
let duracaoReal=0,emAnuncio=false,ultimoAviso=0;
let autoplayComprovado=false,manualAte=0;

/* ---------------------------------------------------------------- protocolo */
/*
 * O envelope conferido no www-widgetapi.js do próprio Google:
 *   sendMessage(a){ a.id=this.id; a.channel="widget";
 *                   contentWindow.postMessage(JSON.stringify(a), <origem do src>) }
 * handshake: {event:"listening"}   comando: {event:"command",func,args}
 * recebido:  {event:"infoDelivery"|"initialDelivery", info:{...}}
 */
function ytSend(msg){
  if(!ytFrame||!ytFrame.contentWindow)return false;
  try{ytFrame.contentWindow.postMessage(JSON.stringify({...msg,id:YT_ID,channel:"widget"}),YT_ORIGIN);return true}
  catch{return false}
}
function ytCommand(func,args){return ytSend({event:"command",func,args:args||[]})}

// O "listening" só é atendido depois que o player carregou, e não há evento que
// avise essa hora — por isso repetimos até alguém responder.
function ytStartHandshake(){
  if(ytHandshake)return;
  let tentativas=0;
  const bater=()=>{
    if(ytPronto||tentativas++>40){clearInterval(ytHandshake);ytHandshake=null;return}
    ytSend({event:"listening"});
  };
  bater();
  ytHandshake=setInterval(bater,250);
}

function ytOnMessage(e){
  // Qualquer aba, extensão ou frame pode postar aqui: confira origem E remetente.
  if(!YT_ORIGINS.includes(e.origin))return;
  if(ytFrame&&e.source!==ytFrame.contentWindow)return;
  if(typeof e.data!=="string")return;
  let msg;try{msg=JSON.parse(e.data)}catch{return}
  if(!msg||!msg.info&&msg.event!=="onReady")return;
  ytPronto=true;
  aplicarInfo(msg.info||{});
}

function aplicarInfo(info){
  if(typeof info.playerState==="number"){
    const antes=ytEstado;ytEstado=info.playerState;
    if(ytEstado===YT_TOCANDO)autoplayComprovado=true;
    if(antes!==ytEstado)aoMudarEstado(ytEstado);
  }
  if(typeof info.playbackRate==="number")ytTaxa=info.playbackRate||1;
  if(typeof info.currentTime==="number"){
    ancoraTempo=info.currentTime;
    ancoraEm=performance.now();
  }
  if(typeof info.duration==="number"&&info.duration>0)avaliarAnuncio(info.duration);
}

/*
 * Anúncio: o player passa a relatar o tempo e a duração do comercial. Como a
 * duração verdadeira da música é conhecida (o próprio vídeo informa quando
 * termina de carregar), uma duração muito diferente denuncia que o que está
 * tocando não é a música. Nesse caso o relógio da letra congela.
 */
function avaliarAnuncio(dur){
  if(!duracaoReal||ytEstado===YT_ENCERRADO){duracaoReal=duracaoReal||dur;return}
  const agora=Math.abs(dur-duracaoReal)>DUR_TOLERANCIA;
  if(agora===emAnuncio)return;
  emAnuncio=agora;
  if(emAnuncio)notify("Anúncio tocando: a letra espera a música começar.");
  else notify("");
}

function aoMudarEstado(estado){
  state.videoPlaying=(estado===YT_TOCANDO);
  if(state.videoPlaying)keepAwake();else releaseAwake();
  if(state.karaoke)startTick();
  updateControls();
  // rel=0 não tira mais a tela final do YouTube: ela vira uma grade de
  // sugestões por cima do vídeo. Encerrar na hora deixa o palco limpo.
  if(estado===YT_ENCERRADO){ytCommand("stopVideo");aoTerminarMusica()}
}

/*
 * Fim da música. Só encadeia sozinho se o navegador já provou que deixa tocar
 * por programa; senão o toque teria de vir do usuário e a festa ficaria olhando
 * uma tela muda sem entender.
 */
function aoTerminarMusica(){
  if(!state.karaoke)return;
  const temProxima=state.currentIndex>=0&&state.currentIndex<state.setlist.length-1;
  if(!temProxima)return notify("Fim do repertório.",true);
  if(!autoplayComprovado)return notify("Música encerrada. Toque em › para a próxima.",true);
  jumpSong(1);
}

/* ------------------------------------------------------------------ relógio */
/*
 * Posição da música agora, em segundos, extrapolando desde a última entrega.
 * Sem o teto de EXTRAPOLA_MAX, um iframe travado faria a letra disparar até o
 * fim; com ele, ela para e o aviso aparece.
 */
function karaokeTime(){
  if(emAnuncio)return ancoraTempo;
  if(ytEstado!==YT_TOCANDO)return ancoraTempo;
  const decorrido=(performance.now()-ancoraEm)/1000*ytTaxa;
  return ancoraTempo+Math.max(0,Math.min(decorrido,EXTRAPOLA_MAX));
}
// O tempo que a LETRA deve mostrar: desconta a introdução do vídeo (por música)
// e o atraso da caixa Bluetooth (do aparelho). Dedução dos sinais no README.
function karaokeLyricTime(){
  const off=Number(state.current&&state.current.videoOffset)||0;
  return karaokeTime()-off-(Number(state.audioDelay)||0)/1000;
}
// Vigia: mensagens pararam de chegar enquanto o player dizia estar tocando.
function karaokeWatchdog(){
  if(!state.karaoke||ytEstado!==YT_TOCANDO)return;
  if(performance.now()-ancoraEm<SEM_NOTICIA_MS)return;
  if(performance.now()-ultimoAviso<10000)return;
  ultimoAviso=performance.now();
  notify("Perdi o compasso do vídeo. Se a letra parar, toque em Karaokê para reconectar.");
}

/* ------------------------------------------------------------------- iframe */
function ensureFrame(){
  if(ytFrame)return ytFrame;
  const box=$("karaokeFrame");
  const f=document.createElement("iframe");
  f.id="ytFrame";
  f.title="Vídeo do karaokê";
  // autoplay precisa ser DELEGADO ao frame de outra origem, senão o Chrome
  // recusa playVideo() mesmo com gesto do usuário. Sem allowfullscreen de
  // propósito: o botão de tela cheia do YouTube levaria só o vídeo, e a letra
  // sumiria — exatamente o contrário do que o projetor precisa.
  f.setAttribute("allow","autoplay; encrypted-media; picture-in-picture");
  f.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
  box.appendChild(f);
  ytFrame=f;
  f.addEventListener("load",ytStartHandshake);
  return f;
}
function frameSrc(id){
  const p=new URLSearchParams({enablejsapi:"1",playsinline:"1",rel:"0",modestbranding:"1"});
  // Sob file:// o origin vira a string "null"; melhor omitir do que mandar isso.
  if(location.origin&&location.origin!=="null")p.set("origin",location.origin);
  return `${YT_ORIGIN}/embed/${encodeURIComponent(id)}?${p}`;
}
function karaokeLoad(id){
  const f=ensureFrame();
  zerarAncora();
  if(ytPronto&&f.src){ytCommand("loadVideoById",[id]);return}
  f.src=frameSrc(id);
}
function zerarAncora(){ancoraTempo=0;ancoraEm=performance.now();ytEstado=-1;duracaoReal=0;emAnuncio=false;manualAte=0}

/* ------------------------------------------------------------- modo ligado */
function songVideoId(song){return (song&&song.videoId)||""}
function karaokeCanPlay(){return !!songVideoId(state.current)}

function enterKaraoke(){
  if(!karaokeCanPlay())return notify("Esta música ainda não tem vídeo. Abra Karaokê → Escolher vídeo.");
  if(!navigator.onLine)return notify("O karaokê precisa de internet. O repertório e a rolagem continuam funcionando.");
  stopAll();
  state.karaoke=true;
  document.body.classList.add("karaokeMode");
  karaokeLoad(songVideoId(state.current));
  keepAwake();startTick();updateControls();
  // O #paper muda de cor, não de caixa — mas a folha e o viewport mudam de
  // tamanho aparente, e o observador de autoscroll só olha o #paper.
  applyAutoSpeed();
  notify("Karaokê ligado. Toque no vídeo para começar.",true);
}
function exitKaraoke(){
  if(!state.karaoke)return;
  state.karaoke=false;state.videoPlaying=false;
  ytCommand("stopVideo");
  document.body.classList.remove("karaokeMode");
  stopTickIfIdle();releaseAwake();updateControls();applyAutoSpeed();
}
function toggleKaraoke(){state.karaoke?exitKaraoke():enterKaraoke()}

// Pausa o vídeo sem derrubar o modo: chamado por stopAll(), que roda a cada
// troca de música. Derrubar o modo aqui apagaria o karaokê a cada música.
function karaokeStop(){
  if(!state.karaoke)return;
  state.videoPlaying=false;
  ytCommand("pauseVideo");
}
function karaokePlayPause(){
  if(!state.karaoke)return;
  // Sem await antes daqui: qualquer espera descarta o gesto do usuário e o
  // navegador recusa o play.
  if(ytEstado===YT_TOCANDO)ytCommand("pauseVideo");
  else{ytCommand("playVideo");vigiarPrimeiroPlay()}
}
function karaokeSeek(seg){
  if(!state.karaoke)return;
  const off=Number(state.current&&state.current.videoOffset)||0;
  const alvo=Math.max(0,seg+off);
  ancoraTempo=alvo;ancoraEm=performance.now();
  ytCommand("seekTo",[alvo,true]);
}
/*
 * Se o play não pegou, quase sempre é política de autoplay — e no iOS o gesto
 * do usuário não atravessa iframe de outra origem. A saída é deixar o toque
 * chegar ao player do YouTube.
 */
function vigiarPrimeiroPlay(){
  setTimeout(()=>{
    if(!state.karaoke)return;
    if(ytEstado===YT_TOCANDO||ytEstado===YT_CARREGANDO)return;
    document.body.classList.add("karaokeToqueNoVideo");
    notify("O navegador pediu um toque no próprio vídeo para liberar o som.");
  },1400);
}

/* ------------------------------------------- trocar o vídeo quando a música muda */
function karaokeOnSongChange(){
  if(!state.karaoke)return;
  const id=songVideoId(state.current);
  if(!id){
    ytCommand("stopVideo");
    notify("Esta música não tem vídeo. Escolha um em Karaokê ou saia do modo.");
    return;
  }
  karaokeLoad(id);
  if(autoplayComprovado)ytCommand("playVideo");
}

/* -------------------------------------------------------- achar o vídeo */
// Aceita link completo, encurtado, de /embed, do YouTube Music, ou o id puro.
function parseVideoId(texto){
  const t=String(texto||"").trim();
  if(!t)return "";
  if(/^[\w-]{11}$/.test(t))return t;
  let u;try{u=new URL(t.startsWith("http")?t:"https://"+t)}catch{return ""}
  if(!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(u.hostname))return "";
  if(u.hostname.endsWith("youtu.be"))return (u.pathname.split("/")[1]||"").slice(0,11);
  const v=u.searchParams.get("v");
  if(v)return v.slice(0,11);
  const m=u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{11})/);
  return m?m[2]:"";
}
// Confirma o título pelo oEmbed (CORS aberto, sem chave). Só para o usuário ver
// que colou o vídeo certo — o texto vem de terceiro e é escapado na exibição.
async function fetchVideoTitle(id){
  const url=`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v="+id)}&format=json`;
  const r=await fetchSafe(url,{headers:{Accept:"application/json"}},8000);
  if(!r.ok)throw Error(r.status===401||r.status===404?"Vídeo não encontrado, particular ou removido.":"Não consegui confirmar esse vídeo.");
  const d=await r.json();
  return{title:String(d.title||""),author:String(d.author_name||"")};
}
function youtubeSearchUrl(song){
  const q=`${song&&song.artist||""} ${song&&song.title||""} karaokê`.trim();
  return "https://www.youtube.com/results?search_query="+encodeURIComponent(q);
}

window.addEventListener("message",ytOnMessage);
