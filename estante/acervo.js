"use strict";
/*
 * Acervo do site: letras que moram no próprio repositório.
 *
 * Existe para o que as fontes públicas não têm — música autoral, regional,
 * tradicional, hino, versão de igreja, arranjo da banda. LRCLIB, Vagalume,
 * Deezer e Apple só conhecem o que foi lançado comercialmente; boa parte do que
 * se toca num bar ou numa missa não está em nenhum deles.
 *
 * Vantagens sobre as fontes de rede: entra no cache do service worker, então
 * funciona offline e responde na hora, sem depender de ninguém estar no ar.
 *
 * O arquivo `acervo.json` começa vazio de propósito — ver `acervo.md` para o
 * que convém colocar nele.
 */

let acervoCache=null,acervoPedido=null;

// Carrega uma vez por sessão. Falha silenciosa: o acervo é um extra, nunca pode
// derrubar a busca. Sem arquivo, ou com arquivo quebrado, vira lista vazia.
function loadAcervo(){
  if(acervoCache)return Promise.resolve(acervoCache);
  if(!acervoPedido)acervoPedido=fetchSafe(`./acervo.json?v=${APP_VERSION}`,{headers:{Accept:"application/json"}},8000)
    .then(r=>r.ok?r.json():null)
    .then(d=>{
      const brutas=Array.isArray(d)?d:(d&&Array.isArray(d.songs)?d.songs:[]);
      acervoCache=brutas.filter(x=>x&&x.title).map(x=>({...normalizeSong(x),source:x.source||"Acervo",sources:["Acervo"],acervo:true}));
      return acervoCache;
    })
    .catch(()=>{acervoCache=[];return acervoCache});
  return acervoPedido;
}

// Mesma regra da busca no repertório: acha por título, artista e pelo texto da
// letra — inclusive por um trecho, que nenhuma fonte de rede sabe fazer sem o
// Vagalume.
async function searchAcervo(q){
  const alvo=searchFold(q);if(!alvo)return[];
  const todas=await loadAcervo();
  return todas.filter(song=>{
    const cabeca=searchFold(`${song.title} ${song.artist}`);
    const corpo=searchFold(`${song.lyrics||""} ${song.synced||""}`);
    return cabeca.includes(alvo)||corpo.includes(alvo);
  }).map(song=>({...song,matchedLyrics:!searchFold(`${song.title} ${song.artist}`).includes(alvo)}));
}

// Reserva ao abrir uma música: faixa achada só no catálogo (Apple, Deezer) pode
// ter a letra aqui.
async function fetchFromAcervo(song){
  if(!song||!song.title)return null;
  const todas=await loadAcervo();
  const achada=todas.find(x=>sameSong(x,song));
  if(!achada||!(achada.lyrics||achada.synced))return null;
  song.lyrics=achada.lyrics||"";song.synced=achada.synced||"";
  song.duration=song.duration||achada.duration||0;
  song.source=achada.source||"Acervo";
  return song;
}
