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
async function playbacksCompartilhados(q){
  if(typeof salaRpc!=="function")return [];
  try{
    const itens=await salaRpc("karaoke_catalogo_buscar",{p_consulta:q.replace(/\s+playback karaokê$/i,"").trim()},2200);
    return (itens||[]).map(v=>({...v,thumb:miniaturaYouTube(v.id),canal:"Salvo pela comunidade",compartilhado:true}));
  }catch{return []}
}
async function buscarVideos(q,{chave=""}={}){
  const [salvos,externos]=await Promise.all([playbacksCompartilhados(q),buscarVideosExternos(q,chave).catch(erro=>({erro}))]);
  if(!salvos.length){if(externos.erro)throw externos.erro;return externos}
  const ids=new Set(salvos.map(v=>v.id));
  return {lista:[...salvos,...(externos.lista||[]).filter(v=>!ids.has(v.id))],fonte:"catalogo",aviso:externos.aviso||""};
}
async function buscarVideosExternos(q,chave){
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
// duracaoEsperada (s, da letra): os vídeos de duração parecida (diferencaDuracao, lrc.js) vêm
// primeiro e ganham o selo "duração parecida"; os outros mostram a duração para comparar.
function htmlResultadosVideos(lista,{duracaoEsperada=0}={}){
  const parecido=v=>duracaoEsperada>0&&v.duracao>0&&!diferencaDuracao(duracaoEsperada,v.duracao);
  const ordem=duracaoEsperada>0?[...lista.filter(parecido),...lista.filter(v=>!parecido(v))]:lista;
  return ordem.map(v=>`<li><button type="button" data-video="${esc(v.id)}" data-titulo="${esc(v.titulo)}"><img src="${esc(v.thumb)}" alt="" width="96" height="72" loading="lazy" referrerpolicy="no-referrer"><span><b>${esc(v.titulo)}</b><small>${esc(v.canal)}${v.duracao?" · "+fmt(v.duracao):""}${parecido(v)?` <span class="selo ok">✓ duração parecida</span>`:""}</small></span></button></li>`).join("");
}
const textoDaFonteBusca=r=>r.fonte==="catalogo"?"Playbacks da comunidade aparecem primeiro.":r.fonte==="oficial"?"Resultados do YouTube (só vídeos que tocam aqui).":"Resultados de um serviço público de busca. O app confere se o vídeo toca aqui ao escolher.";

/* ------------------------------------------------- escolha automática */
/*
 * "Adicionar só pelo nome": o app escolhe sozinho o melhor vídeo de karaokê e a
 * família só troca quando ele errar. A pontuação é puramente heurística (título,
 * duração, palavras de karaokê) e vive aqui, sem tela, para ser testada no Node.
 * Dúvida nunca é escondida: video.duvida avisa a tela para pedir conferência.
 */
const normalizarTexto=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const PALAVRAS_DE_KARAOKE=/karaok|playback|instrumental|sem voz|backing/;
const PALAVRAS_RUINS=/\bao vivo\b|\blive\b|\bcover\b|reaction|\breact\b|remix|slowed|sped up|reverb|\b8d\b|nightcore|tutorial|aula|como tocar|videoaula|cifra/;
const PALAVRAS_DE_COLETANEA=/medley|sequencia|as melhores|\btop ?\d+|\d+ musicas|\d+ sucessos|mix de/;
const PALAVRAS_SOLTAS=new Set(["de","da","do","das","dos","the","feat","ft","com","e","a","o","em","no","na","um","uma","para","pra","por","and"]);
const DUVIDA_ABAIXO_DE=4;

// Palavras que a busca espera ver no vídeo: o que a família digitou, sem as palavras de karaokê.
function palavrasDaMusica(...textos){
  const ok=new Set();
  for(const w of normalizarTexto(textos.join(" ")).split(/[^a-z0-9]+/))
    if(w.length>=3&&!PALAVRAS_SOLTAS.has(w)&&!PALAVRAS_DE_KARAOKE.test(w))ok.add(w);
  return[...ok];
}

function pontuarVideo(v,{titulo="",artista="",duracaoEsperada=0}={}){
  const t=normalizarTexto(v.titulo),canal=normalizarTexto(v.canal);
  let s=0;
  if(PALAVRAS_DE_KARAOKE.test(t))s+=6;
  if(PALAVRAS_DE_KARAOKE.test(canal))s+=2;
  const esperadas=palavrasDaMusica(titulo,artista);
  if(esperadas.length){
    const achadas=esperadas.filter(w=>t.includes(w)).length/esperadas.length;
    s+=8*achadas;
    if(achadas<0.5)s-=4;   // quase nada do que foi pedido está no título
  }
  if(duracaoEsperada>0&&v.duracao>0){
    if(!diferencaDuracao(duracaoEsperada,v.duracao))s+=3;
    else if(Math.abs(v.duracao-duracaoEsperada)>60)s-=4;
    else s-=1;
  }
  if(PALAVRAS_RUINS.test(t))s-=5;
  if(PALAVRAS_DE_COLETANEA.test(t))s-=4;
  if(v.duracao>0&&v.duracao<60)s-=5;
  if(v.duracao>600)s-=3;   // mais de 10 min costuma ser coletânea
  return Math.round(s*10)/10;
}
// Cópia da lista, do melhor para o pior; empate mantém a ordem de relevância da busca.
function ordenarCandidatos(lista,ctx){
  return lista.map((v,i)=>({v:{...v,pontos:pontuarVideo(v,ctx)},i})).sort((a,b)=>b.v.pontos-a.v.pontos||a.i-b.i).map(x=>x.v);
}

/*
 * Busca, escolhe e confere que o vídeo toca fora do YouTube.
 * Devolve {video, alternativas, fonte, aviso}. Sem vídeo que toque, o erro leva
 * `alternativas` para a tela oferecer a lista inteira.
 * Com a chave oficial o resultado já é embutível, então não confere de novo (poupa 1,5 s).
 */
async function resolverPlayback(consulta,{chave="",titulo="",artista="",duracaoEsperada=0,tentativas=3,verificar=id=>YouTubeBase.verificar(id)}={}){
  let salvos=[];
  try{
    salvos=await playbacksCompartilhados(consulta);
    for(const v of salvos){
      const teste=await verificar(v.id);
      if(teste.ok)return{video:{...v,compartilhado:true,incerto:!!teste.incerto},alternativas:salvos.filter(outro=>outro.id!==v.id),fonte:"catalogo",aviso:"Playback salvo pela comunidade."};
    }
  }catch{}
  const r=await buscarVideosExternos(consulta,chave);
  const ordem=ordenarCandidatos(r.lista,{titulo:titulo||consulta,artista,duracaoEsperada});
  if(!ordem.length){const e=Error("Nenhum vídeo encontrado. Tente outras palavras.");e.alternativas=[];throw e}
  for(const v of ordem.slice(0,tentativas)){
    let toca=r.fonte==="oficial",incerto=false;
    if(!toca){const c=await verificar(v.id);toca=!!c.ok;incerto=!!c.incerto}
    if(toca)return{video:{...v,incerto,duvida:v.pontos<DUVIDA_ABAIXO_DE},alternativas:ordem.filter(x=>x.id!==v.id),fonte:r.fonte,aviso:r.aviso};
  }
  const e=Error("Os melhores vídeos achados não tocam fora do YouTube. Veja a lista e escolha outro.");
  e.alternativas=ordem;throw e;
}

// Texto colado → músicas a buscar. Uma por linha: "Música - Artista" ou só o nome.
// Aceita numeração ("1.", "2)") e marcadores; ignora linha vazia e repetida.
const MAX_LOTE=30;
function lerListaDeMusicas(texto){
  const vistos=new Set(),itens=[];let ignoradas=0;
  for(const bruta of String(texto||"").split(/\r?\n/)){
    const linha=bruta.replace(/^\s*(?:\d{1,3}\s*[.)\-–]\s+|[-•*]\s+)/,"").replace(/\s+/g," ").trim();
    if(linha.length<2)continue;
    const chave=normalizarTexto(linha);
    if(vistos.has(chave))continue;
    vistos.add(chave);
    if(itens.length>=MAX_LOTE){ignoradas++;continue}
    const [titulo,...resto]=linha.split(/\s+[-–—]\s+/);
    itens.push({texto:linha,titulo:titulo.trim(),artista:resto.join(" - ").trim()});
  }
  return{itens,ignoradas};
}

if(typeof module!=="undefined")module.exports={INSTANCIAS_BUSCA,MAX_LOTE,consultaDeKaraoke,mapearPiped,buscarVideos,pontuarVideo,ordenarCandidatos,resolverPlayback,lerListaDeMusicas};
