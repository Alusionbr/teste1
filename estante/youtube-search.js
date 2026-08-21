"use strict";
/*
 * Busca de vídeo do YouTube sem sair do app.
 *
 * Antes daqui, achar o vídeo de uma música exigia abrir uma aba do YouTube,
 * procurar, copiar o link e voltar — no meio da festa, com o celular na mão.
 *
 * Três decisões que sustentam o arquivo:
 *
 * 1. É fetch() direto, não JSONP. O googleapis.com devolve
 *    `access-control-allow-origin` com a origem do pedido (conferido com
 *    `curl -D-`), diferente da Apple e da Deezer, que precisam de <script>.
 *
 * 2. A chave é do APARELHO, como a do Vagalume: fica em KEYS.prefs, nunca no
 *    link compartilhado, nunca enviada a outro serviço. É do plano gratuito do
 *    Google — 10.000 unidades por dia, e uma busca custa 100, ou seja ~100
 *    buscas diárias. Por isso o cache de sessão abaixo, e por isso a mensagem
 *    de cota estourada precisa dizer o que fazer em vez de só falhar.
 *
 * 3. Filtra `videoEmbeddable` na origem. Um vídeo que recusa ser embutido abre
 *    preto dentro do karaokê, e a pessoa só descobre com a festa esperando.
 */

const YT_API="https://www.googleapis.com/youtube/v3";
const YT_MAX_RESULTS=8;
// Diferença de duração que ainda conta como "é esta gravação". Vídeo de
// karaokê quase nunca bate no segundo: costuma ter vinheta ou contagem.
const YT_DUR_TOLERANCIA=15;
/*
 * Cache só desta sessão, e só da BUSCA. Repetir a mesma consulta gastaria 100
 * unidades da cota do dia para devolver a mesma lista. Não vai para o
 * localStorage nem para o service worker: a regra de não cachear resposta de
 * API continua valendo, isto é memória viva que morre ao fechar a aba.
 */
const ytBuscaCache=new Map();

// "PT3M45S" -> 225. Transmissão ao vivo vem como "P0D" e cai em 0, que é o
// certo: sem duração conhecida, não dá para dizer que bate com a música.
function parseISODuration(txt){
  const m=/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(txt||""));
  if(!m)return 0;
  return (+m[1]||0)*86400+(+m[2]||0)*3600+(+m[3]||0)*60+(+m[4]||0);
}

/*
 * O YouTube devolve título e canal já com entidades HTML (&quot;, &#39;).
 * Passar isso direto por esc() mostraria "&amp;quot;" na tela. Decodificar num
 * <textarea> solto é seguro: o conteúdo de textarea é RCDATA, marcação lá
 * dentro não vira elemento nem executa nada — e o texto ainda passa por esc()
 * na hora de desenhar.
 */
function ytDecode(s){
  const t=document.createElement("textarea");
  t.innerHTML=String(s||"");
  return t.value;
}

/*
 * A mensagem de erro importa mais aqui do que nas outras fontes: é a única que
 * depende de uma chave que o próprio usuário cadastrou, e "erro 403" não diz a
 * ninguém o que fazer a seguir.
 */
function ytErrorMessage(status,body){
  const err=(body&&body.error)||{};
  const razao=(err.errors&&err.errors[0]&&err.errors[0].reason)||"";
  const detalhe=((err.details||[]).map(d=>d&&d.reason).find(Boolean))||"";
  const codigo=detalhe||razao;
  if(/API_KEY_INVALID|keyInvalid|badRequest/i.test(codigo))
    return "O Google não aceitou essa chave. Confira em Ajustes se ela foi colada inteira.";
  if(/quotaExceeded|dailyLimitExceeded|rateLimitExceeded/i.test(codigo))
    return "Acabaram as buscas gratuitas de hoje. Use Procurar no YouTube e cole o link.";
  if(/ipRefererBlocked|forbidden/i.test(codigo)||status===403)
    return "A chave existe, mas o Google recusou o pedido vindo deste endereço. No Google Cloud, libere este site na restrição da chave.";
  return `A busca do YouTube respondeu ${status}.`;
}

// A consulta padrão é a mesma que o link "Procurar no YouTube" sempre usou.
// O modo "original" existe porque nem sempre se quer a versão sem voz: às
// vezes a festa quer o clipe.
function karaokeQuery(song,modo){
  const base=`${(song&&song.artist)||""} ${(song&&song.title)||""}`.trim();
  return modo==="original"?base:`${base} karaokê`.trim();
}

/*
 * Segunda chamada, de 1 unidade só, para saber a duração de cada resultado.
 * Vale muito barato: é o que denuncia o "1 hour loop" e o que permite apontar
 * qual resultado tem a duração da gravação certa. Falhar aqui não derruba a
 * busca — a lista aparece sem duração.
 */
async function ytFillDurations(rows){
  if(!rows.length)return;
  const p=new URLSearchParams({part:"contentDetails",id:rows.map(x=>x.videoId).join(","),key:state.keyYT});
  try{
    const r=await fetchSafe(`${YT_API}/videos?${p}`,{headers:{Accept:"application/json"}},8000);
    if(!r.ok)return;
    const d=await r.json();
    const dur=new Map(((d&&d.items)||[]).map(x=>[x.id,parseISODuration(x.contentDetails&&x.contentDetails.duration)]));
    rows.forEach(x=>{x.duration=dur.get(x.videoId)||0});
  }catch{}
}

async function searchYoutube(query){
  const q=String(query||"").trim();
  if(!q)throw Error("Escreva o nome da música ou do artista para buscar.");
  if(!state.keyYT)throw Error("Cadastre a chave gratuita do YouTube em Ajustes para buscar sem sair do app.");
  if(!navigator.onLine)throw Error("A busca de vídeo precisa de internet. O repertório salvo continua funcionando.");
  const chave=q.toLowerCase();
  if(ytBuscaCache.has(chave))return ytBuscaCache.get(chave);
  const p=new URLSearchParams({
    part:"snippet",type:"video",q,
    maxResults:String(YT_MAX_RESULTS),
    videoEmbeddable:"true",videoSyndicated:"true",
    regionCode:"BR",relevanceLanguage:"pt",
    key:state.keyYT
  });
  const r=await fetchSafe(`${YT_API}/search?${p}`,{headers:{Accept:"application/json"}},10000);
  let d=null;try{d=await r.json()}catch{}
  if(!r.ok){markSource("youtube",false,r.status);throw Error(ytErrorMessage(r.status,d))}
  markSource("youtube",true);
  const rows=((d&&d.items)||[]).filter(x=>x&&x.id&&x.id.videoId).map(x=>({
    videoId:x.id.videoId,
    title:ytDecode((x.snippet&&x.snippet.title)||""),
    channel:ytDecode((x.snippet&&x.snippet.channelTitle)||""),
    duration:0
  }));
  await ytFillDurations(rows);
  ytBuscaCache.set(chave,rows);
  return rows;
}

function renderYoutubeResults(rows){
  const box=$("karaokeResults");
  if(!box)return;
  box.hidden=false;
  if(!rows.length){
    box.innerHTML='<p class="ytEmpty">Nenhum vídeo que aceite ser embutido apareceu para essa busca. Tente outras palavras ou use Procurar no YouTube.</p>';
    return;
  }
  const alvo=Number(state.current&&state.current.duration)||0;
  box.innerHTML=rows.map(x=>{
    const bate=alvo&&x.duration&&Math.abs(x.duration-alvo)<=YT_DUR_TOLERANCIA;
    const detalhe=[x.channel,x.duration?fmt(x.duration):""].filter(Boolean).map(esc).join(" · ");
    return `<button type="button" class="ytResult" data-video-id="${esc(x.videoId)}" data-video-duration="${x.duration}" data-video-title="${esc(x.title)}">`+
      `<strong>${esc(x.title)}</strong>`+
      `<small>${detalhe}${bate?' · <span class="ytMatch">duração bate</span>':""}</small>`+
      `</button>`;
  }).join("");
}

/* ------------------------------------------------------------ fluxo da tela */
/*
 * O fluxo mora aqui, e não em ui.js, pela mesma razão que a busca de letra
 * mora em search-ui.js: em ui.js ficam só as ligações de evento.
 */
let ytModo="karaoke";
function setYoutubeMode(modo){
  ytModo=modo==="original"?"original":"karaoke";
  refreshYoutubeSearchUI();
}
// Chamado sempre que o diálogo do karaokê abre ou a música muda: a consulta
// sugerida é a da música aberta, e a lista antiga não pode sobrar de uma
// música para a outra.
function refreshYoutubeSearchUI(){
  const box=$("karaokeResults");
  // O estado do chip é redesenhado aqui, não só no clique: a classe .chip é
  // compartilhada com os grupos de fonte de busca e de forma de controle, e
  // quem redesenha um grupo não deve depender de ninguém ter preservado o
  // "active" do outro.
  document.querySelectorAll("[data-yt-mode]").forEach(b=>b.classList.toggle("active",b.dataset.ytMode===ytModo));
  $("karaokeSearchInput").value=karaokeQuery(state.current,ytModo);
  $("karaokeSearchLink").href=youtubeSearchUrl(state.current,ytModo);
  $("karaokeNoKey").hidden=!!state.keyYT;
  box.hidden=true;box.innerHTML="";
}
async function runYoutubeSearch(){
  const btn=$("karaokeSearchBtn"),box=$("karaokeResults");
  const rotulo=btn.textContent;
  btn.disabled=true;btn.textContent="Buscando…";
  box.hidden=false;box.innerHTML='<p class="ytEmpty">Procurando no YouTube…</p>';
  try{renderYoutubeResults(await searchYoutube($("karaokeSearchInput").value))}
  catch(e){box.innerHTML=`<p class="ytEmpty">${esc(e.message||"Não consegui buscar agora.")}</p>`}
  finally{btn.disabled=false;btn.textContent=rotulo}
}
