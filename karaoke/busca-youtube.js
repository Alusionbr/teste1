"use strict";
/*
 * Busca de vídeos do YouTube dentro do app, na tela e no celular.
 *
 * O navegador não consegue consultar youtube.com/results (sem CORS), então a
 * busca passa por uma ponte, na ordem:
 *   1. API oficial do YouTube, se a família colou uma chave em Ajustes (a chave
 *      fica só no aparelho). `videoEmbeddable=true` traz só vídeos que tocam
 *      fora do YouTube.
 *   2. Serviços públicos de busca "Piped" (INSTANCIAS_BUSCA), vários ao mesmo
 *      tempo; vale a primeira resposta válida. Instância pública cai de vez em
 *      quando: quem falha fica poupada por 20 s (como as fontes de letra), nunca
 *      para sempre.
 *
 * Resultado do Piped NÃO garante que o vídeo toca embutido: quem escolhe um
 * resultado confere com YouTubeBase.verificar (ver ui.js e controle.js).
 *
 * Trocar ou acrescentar um serviço = editar só INSTANCIAS_BUSCA (precisa
 * devolver JSON com `access-control-allow-origin`; confira com curl -D-).
 */
const INSTANCIAS_BUSCA=[
  "https://api.piped.private.coffee",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.adminforge.de"
];
const BUSCA_TEMPO_MS=6000,BUSCA_MAX_PARALELO=4,BUSCA_MAX_RESULTADOS=12;

// A API oficial devolve o título com entidades HTML ("Don&#39;t"). Volta ao texto
// puro; a tela escapa de novo ao exibir.
function semEntidades(s){return String(s||"").replace(/&(amp|quot|#39|lt|gt);/g,(_,e)=>({amp:"&",quot:'"',"#39":"'",lt:"<",gt:">"}[e]))}

// Sem a palavra karaokê/playback/instrumental a busca traz o clipe oficial, que
// quase sempre é bloqueado fora do YouTube.
function consultaDeKaraoke(q){
  const t=String(q||"").replace(/\s+/g," ").trim();
  return /karaok|playback|instrumental/i.test(t)?t:`${t} karaokê playback`.trim();
}
const miniaturaYouTube=id=>`https://i.ytimg.com/vi/${id}/default.jpg`;

async function buscarVideosYouTube(q,chave){
  const p=new URLSearchParams({part:"snippet",type:"video",videoEmbeddable:"true",maxResults:String(BUSCA_MAX_RESULTADOS),q,key:chave,relevanceLanguage:"pt"});
  const r=await fetchSafe(`https://www.googleapis.com/youtube/v3/search?${p}`,{},10000);
  if(r.status===400||r.status===403){
    let motivo="";try{motivo=(await r.json()).error?.errors?.[0]?.reason||""}catch{}
    throw Error(motivo==="quotaExceeded"?"A cota diária de buscas do YouTube acabou.":"Chave do YouTube recusada. Confira a chave em Ajustes.");
  }
  if(!r.ok)throw Error("A busca do YouTube não respondeu.");
  const d=await r.json();
  return(d.items||[]).filter(x=>x.id&&x.id.videoId).map(x=>({id:x.id.videoId,titulo:semEntidades(x.snippet?.title),canal:semEntidades(x.snippet?.channelTitle),thumb:miniaturaYouTube(x.id.videoId),duracao:0}));
}

/* --------------------------------------------------------------- Piped */
function idDoPiped(url){const m=String(url||"").match(/[?&]v=([\w-]{11})(?:$|&)/);return m?m[1]:""}
// Só vídeos de verdade: sem Shorts, sem transmissão ao vivo, sem repetidos.
function mapearPiped(dados){
  const vistos=new Set(),lista=[];
  for(const x of(dados&&Array.isArray(dados.items)?dados.items:[])){
    if(!x||x.type!=="stream"||x.isShort)continue;
    const id=idDoPiped(x.url);
    const duracao=Number(x.duration)||0;
    if(!id||vistos.has(id)||duracao<=0)continue;
    vistos.add(id);
    lista.push({id,titulo:String(x.title||"").slice(0,160),canal:String(x.uploaderName||"").slice(0,80),thumb:miniaturaYouTube(id),duracao});
    if(lista.length>=BUSCA_MAX_RESULTADOS)break;
  }
  return lista;
}
const nomeDaFonte=base=>"busca:"+String(base).replace(/^https?:\/\//,"");
async function consultarInstancia(base,q){
  const fonte=nomeDaFonte(base);
  try{
    const r=await fetchSafe(`${base}/search?${new URLSearchParams({q,filter:"videos"})}`,{headers:{Accept:"application/json"}},BUSCA_TEMPO_MS);
    if(!r.ok)throw Error("status "+r.status);
    const d=await r.json();
    if(!d||!Array.isArray(d.items))throw Error("resposta inesperada");
    markSource(fonte,true);
    return mapearPiped(d);
  }catch(e){markSource(fonte,false,String(e.message||e));throw e}
}
// A primeira instância que responde direito ganha; as outras são ignoradas.
function buscarNoPiped(q){
  let bases=INSTANCIAS_BUSCA.filter(b=>!sourceCoolingDown(nomeDaFonte(b)));
  if(!bases.length)bases=[...INSTANCIAS_BUSCA];   // todas poupadas: tenta de novo mesmo assim
  bases=bases.slice(0,BUSCA_MAX_PARALELO);
  return new Promise((resolve,reject)=>{
    let falhas=0;
    bases.forEach(b=>consultarInstancia(b,q).then(resolve,()=>{if(++falhas===bases.length)reject(Error("nenhum serviço de busca respondeu"))}));
  });
}

/*
 * Busca principal. Devolve {lista:[{id,titulo,canal,thumb,duracao}], fonte:"oficial"|"publico", aviso}.
 * Com chave, a oficial vem primeiro; se ela recusar (chave ruim, cota), cai para o
 * serviço público e o aviso diz por quê.
 */
async function buscarVideos(q,{chave=""}={}){
  const consulta=consultaDeKaraoke(q);
  let aviso="";
  if(chave){
    try{return{lista:await buscarVideosYouTube(consulta,chave),fonte:"oficial",aviso}}
    catch(e){aviso=e.message}
  }
  try{return{lista:await buscarNoPiped(consulta),fonte:"publico",aviso}}
  catch{throw Error(`${aviso?aviso+" ":""}A busca não respondeu agora. Use “Procurar no YouTube” e cole o link.`)}
}

// Lista de resultados para as telas (tela e celular). Título e canal vêm de terceiro:
// sempre escapados.
function htmlResultadosVideos(lista){
  return lista.map(v=>`<li><button type="button" data-video="${esc(v.id)}" data-titulo="${esc(v.titulo)}"><img src="${esc(v.thumb)}" alt="" width="96" height="72" loading="lazy" referrerpolicy="no-referrer"><span><b>${esc(v.titulo)}</b><small>${esc(v.canal)}${v.duracao?" · "+fmt(v.duracao):""}</small></span></button></li>`).join("");
}
const textoDaFonteBusca=r=>r.fonte==="oficial"?"Resultados do YouTube (só vídeos que tocam aqui).":"Resultados de um serviço público de busca. O app confere se o vídeo toca aqui ao escolher.";

if(typeof module!=="undefined")module.exports={INSTANCIAS_BUSCA,consultaDeKaraoke,mapearPiped,buscarVideos};
