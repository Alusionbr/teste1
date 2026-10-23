"use strict";
/*
 * Resiliência das fontes de letra.
 *
 * Carrega core.js e search-engine.js num contexto isolado, com `fetch` simulado,
 * e confere o comportamento que fazia "nenhuma letra abre": uma falha passageira
 * (um 503 da sondagem automática, por exemplo) desligava LRCLIB e Vagalume pelo
 * resto da sessão. Não depende de navegador nem de rede.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");

const resposta=(status,corpo)=>({ok:status>=200&&status<300,status,headers:new Headers(),json:async()=>corpo});
const linhaLrclib={trackName:"Um Pedido",artistName:"Davi Sacer",albumName:"Álbum",duration:200,plainLyrics:"Letra de teste",syncedLyrics:""};

function carregar(responder){
  const chamadas=[];
  const contexto=vm.createContext({
    console,URL,URLSearchParams,AbortController,Headers,
    // A espera entre tentativas (no máximo 3 s) vira imediata; o limite de
    // tempo de cada pedido (8 s ou mais) continua real e é cancelado ao fim.
    setTimeout:(fn,ms,...args)=>ms<=3000?setImmediate(fn,...args):setTimeout(fn,ms,...args),clearTimeout,
    window:{dispatchEvent(){}},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init&&init.detail}},
    document:{getElementById:()=>null},
    fetch:async url=>{chamadas.push(String(url));return responder(String(url),chamadas.length)}
  });
  for(const arquivo of["core.js","search-engine.js"])vm.runInContext(fs.readFileSync(path.join(root,arquivo),"utf8"),contexto,{filename:arquivo});
  return{chamadas,rodar:codigo=>vm.runInContext(codigo,contexto)};
}

test("LRCLIB que falhou é poupado logo depois, mas volta a ser consultado após o prazo",async()=>{
  const{chamadas,rodar}=carregar(()=>resposta(200,[linhaLrclib]));
  rodar('markSource("lrclib",false,503)');
  assert.equal((await rodar('searchLrclib("um pedido")')).length,0);
  assert.equal(chamadas.length,0,"logo após a falha não deve martelar o servidor");
  rodar("sourceStatus.lrclib.at=Date.now()-SOURCE_COOLDOWN_MS-1");
  const linhas=await rodar('searchLrclib("um pedido")');
  assert.equal(linhas.length,1);
  assert.equal(chamadas.length,1,"passado o prazo, a fonte precisa ser consultada de novo");
  assert.equal(rodar("sourceStatus.lrclib.ok"),true);
});

test("Vagalume que falhou também volta a ser consultado após o prazo",async()=>{
  const docs={response:{docs:[{title:"Um Pedido",band:"Davi Sacer",id:"1",url:"/davi/um-pedido.html"}]}};
  const{chamadas,rodar}=carregar(()=>resposta(200,docs));
  rodar('markSource("vagalume",false,503)');
  assert.equal((await rodar("searchVagalumeAdvanced('um pedido')")).length,0);
  assert.equal(chamadas.length,0);
  rodar("sourceStatus.vagalume.at=Date.now()-SOURCE_COOLDOWN_MS-1");
  assert.equal((await rodar("searchVagalumeAdvanced('um pedido')")).length,1);
  assert.equal(chamadas.length,1);
});

test("erro 503 passageiro do LRCLIB é repetido uma vez e a busca funciona",async()=>{
  const{chamadas,rodar}=carregar((url,n)=>n===1?resposta(503):resposta(200,[linhaLrclib]));
  const linhas=await rodar('searchLrclib("um pedido")');
  assert.equal(linhas.length,1);
  assert.equal(chamadas.length,2);
  assert.equal(rodar("sourceStatus.lrclib.ok"),true);
});

test("503 persistente do LRCLIB falha com mensagem clara e marca a fonte como fora do ar",async()=>{
  const{chamadas,rodar}=carregar(()=>resposta(503));
  await assert.rejects(()=>rodar('searchLrclib("um pedido")'),/LRCLIB respondeu 503/);
  // busca livre + uma repetição + a reserva pela busca por título — e para aí.
  assert.equal(chamadas.length,3,"uma repetição e uma reserva, não um laço de insistência");
  assert.match(chamadas[2],/track_name=um%20pedido/);
  assert.equal(rodar('sourceCoolingDown("lrclib")'),true);
});

test("busca livre do LRCLIB em 503 cai para a busca por título, que é estável",async()=>{
  const{chamadas,rodar}=carregar(url=>url.includes("?q=")?resposta(503):resposta(200,[linhaLrclib]));
  const linhas=await rodar('searchLrclib("um pedido")');
  assert.equal(linhas.length,1);
  assert.equal(chamadas.length,3);
  assert.equal(rodar("sourceStatus.lrclib.ok"),true,"a fonte respondeu: não pode ficar marcada como fora do ar");
});

/*
 * Caso real, medido no LRCLIB em 22/10/2026: "Estamos de Pé" existe ali só como
 * gravação ao vivo, com o título escrito de três jeitos. O catálogo (Apple,
 * Deezer) traz "Estamos de Pé" puro, e era esse o resultado que abria vazio.
 */
const estamosDePe=[
  {trackName:"Estamos de Pé - Ao Vivo",artistName:"Marcus Salles",albumName:"Estamos de Pé (Ao Vivo)",duration:397,plainLyrics:"Letra de teste ao vivo",syncedLyrics:"[00:10.00] Letra de teste ao vivo"},
  {trackName:"Estamos de Pé (Ao Vivo) - Marcus Salles",artistName:"Pr Marcus Salles",albumName:"Pr Marcus Salles",duration:397,plainLyrics:"Outra cópia",syncedLyrics:""},
  {trackName:"Estamos de Pé (Ao Vivo)",artistName:"PIBB Music",albumName:"Estamos de Pé (Ao Vivo)",duration:439,plainLyrics:"Letra da PIBB",syncedLyrics:"[00:05.00] Letra da PIBB"},
  {trackName:"Estamos de Pé (Ao Vivo) (feat. Lucas Magno)",artistName:"PIBB Music",albumName:"Estamos de Pé (Ao Vivo)",duration:440,plainLyrics:"Letra da PIBB feat",syncedLyrics:""}
];

test("reconhece a mesma música em outra versão, mas nunca de outro artista",()=>{
  const{rodar}=carregar(()=>resposta(200,[]));
  const mesma=(r,s)=>rodar(`sameSongOtherVersion(${JSON.stringify(r)},${JSON.stringify(s)})`);
  const catalogo={title:"Estamos de Pé",artist:"Marcus Salles"};
  assert.equal(mesma(estamosDePe[0],catalogo),true,"“- Ao Vivo” é a mesma música");
  assert.equal(mesma(estamosDePe[1],catalogo),true,"“Pr” e o nome repetido no título não mudam a música");
  assert.equal(mesma(estamosDePe[2],catalogo),false,"PIBB Music é outro artista");
  assert.equal(mesma(estamosDePe[3],{title:"Estamos de Pé",artist:"PIBB Music"}),true,"participação no título não muda a música");
  assert.equal(mesma(estamosDePe[0],{title:"Estamos De Pé",artist:"Eli Soares"}),false,"mesmo título, outro cantor: outra música");
  assert.equal(mesma({trackName:"Medley - Parte 2",artistName:"Banda X"},{title:"Medley - Parte 1",artist:"Banda X"}),false,"parte diferente não é a mesma música");
  assert.equal(rodar('sameArtist("Davi","Davi Sacer")'),false,"nome curto sozinho não casa com qualquer um");
});

test("abrir “Estamos de Pé” do catálogo usa a letra ao vivo do LRCLIB, sem sincronia de outra duração",async()=>{
  const{chamadas,rodar}=carregar(url=>url.includes("/api/get")?resposta(404):resposta(200,estamosDePe));
  rodar("fetchFromAcervo=async()=>null;fetchLiriqoSong=async()=>{throw Error('LiriQo não deveria ser consultado')};fetchLyricsOvh=async()=>null");
  const musica=await rodar('fetchLrclibSong({title:"Estamos de Pé",artist:"Marcus Salles",album:"Acoustic Session",duration:194})');
  assert.equal(musica.lyrics,"Letra de teste ao vivo");
  assert.equal(musica.synced,"","sincronia de uma gravação de 397 s não serve para a de 194 s");
  assert.equal(musica.duration,194,"a duração da versão escolhida continua valendo para a rolagem");
  assert.equal(musica.source,"LRCLIB");
  assert.match(musica.lyricNote,/outra versão/);
  assert.equal(chamadas.filter(u=>u.includes("lrclib")).length,2,"get + busca; nenhuma consulta a mais");
});

test("com a mesma duração, a versão ao vivo traz também a letra sincronizada",async()=>{
  const{rodar}=carregar(url=>url.includes("/api/get")?resposta(404):resposta(200,estamosDePe));
  rodar("fetchFromAcervo=async()=>null;fetchLiriqoSong=async()=>null;fetchLyricsOvh=async()=>null");
  const musica=await rodar('fetchLrclibSong({title:"Estamos de Pé",artist:"Marcus Salles",album:"Ao vivo no catálogo",duration:396})');
  assert.match(musica.synced,/Letra de teste ao vivo/);
});

test("“Estamos De Pé” de outro cantor não pega a letra do Marcus Salles",async()=>{
  const{rodar}=carregar(url=>url.includes("/api/get")?resposta(404):resposta(200,estamosDePe));
  rodar("fetchFromAcervo=async()=>null;fetchLiriqoSong=async()=>null;fetchLyricsOvh=async()=>null");
  await assert.rejects(()=>rodar('fetchLrclibSong({title:"Estamos De Pé",artist:"Eli Soares",album:"Inteligência Natural",duration:251})'));
});

test("a versão com letra sobe para o topo da lista, acima do catálogo sem letra",()=>{
  const{rodar}=carregar(()=>resposta(200,[]));
  const lista=rodar(`mergeSongs([
    {title:"Estamos de Pé",artist:"Felipe Casttro",source:"Apple",duration:271},
    {title:"Estamos De Pé",artist:"Eli Soares",source:"Apple",duration:251},
    {title:"Estamos de Pé",artist:"Marcus Salles",source:"Apple",album:"Acoustic Session",duration:194},
    {title:"Estamos de Pé - Ao Vivo",artist:"Marcus Salles",source:"LRCLIB",album:"Estamos de Pé (Ao Vivo)",duration:397,lyrics:"x",synced:"[00:01.00] x"}
  ],"estamos de pé").map(m=>m.title+" | "+m.artist)`);
  assert.equal(lista[0],"Estamos de Pé - Ao Vivo | Marcus Salles");
});

test("429 (espere) não é repetido na hora",async()=>{
  const{chamadas,rodar}=carregar(()=>resposta(429));
  assert.equal((await rodar('searchLrclib("um pedido")')).length,0);
  assert.equal(chamadas.length,1);
});

test("abrir uma música consulta o /api/get do LRCLIB com repetição em 503",async()=>{
  const{chamadas,rodar}=carregar((url,n)=>n===1?resposta(503):resposta(200,linhaLrclib));
  const musica=await rodar('fetchLrclibSong({title:"Um Pedido",artist:"Davi Sacer",album:"Álbum",duration:200})');
  assert.match(chamadas[0],/\/api\/get\?/);
  assert.equal(chamadas.length,2);
  assert.equal(musica.lyrics,"Letra de teste");
  assert.equal(musica.source,"LRCLIB");
});

test("não aceita letra de outra gravação só porque a fonte voltou",async()=>{
  const outra={...linhaLrclib,artistName:"Outro cantor",plainLyrics:"Letra errada"};
  const{rodar}=carregar(url=>url.includes("/api/get")?resposta(200,outra):resposta(200,[outra]));
  await assert.rejects(()=>rodar('fetchLrclibSong({title:"Um Pedido",artist:"Davi Sacer",album:"Álbum",duration:200})'));
});

test("\"Tentar de novo\" esquece a falha recente sem mentir sobre o estado da fonte",()=>{
  const{rodar}=carregar(()=>resposta(200,[]));
  rodar('markSource("lrclib",false,503);markSource("vagalume",false,503);markSource("liriqo",true)');
  assert.equal(rodar('sourceCoolingDown("lrclib")&&sourceCoolingDown("vagalume")'),true);
  rodar("forgetSourceFailures()");
  assert.equal(rodar('sourceCoolingDown("lrclib")||sourceCoolingDown("vagalume")'),false,"a próxima tentativa deve consultar as duas");
  assert.equal(rodar("sourceStatus.lrclib.ok===false&&sourceStatus.vagalume.ok===false"),true,"o estado só muda quando uma resposta real chegar");
  assert.equal(rodar("sourceStatus.liriqo.ok"),true,"fonte saudável não é mexida");
});

test("tela sem letra oferece versões de outros artistas com o mesmo título, sem aplicar sozinha",async()=>{
  const{chamadas,rodar}=carregar(()=>resposta(200,estamosDePe));
  const opcoes=await rodar('findSameTitleOtherArtists({title:"Estamos de Pé (Ao Vivo)",artist:"AtituD"})');
  const quem=opcoes.map(x=>x.artistName);
  assert.equal(quem.length,2,"Marcus Salles e PIBB Music — sem repetir o mesmo artista");
  assert.ok(quem.includes("Marcus Salles")&&quem.includes("PIBB Music"));
  assert.match(chamadas[0],/track_name=Estamos\+de\+P%C3%A9$/,"procura pelo título sem a marca “Ao Vivo”");
  const propria=await rodar('findSameTitleOtherArtists({title:"Estamos de Pé",artist:"Marcus Salles"})');
  assert.ok(propria.every(x=>!/Marcus Salles/.test(x.artistName)),"o próprio artista não aparece como “outro artista”");
});

test("letra escolhida de outro artista nunca leva a sincronia e diz de onde veio",()=>{
  const{rodar}=carregar(()=>resposta(200,[]));
  const musica=rodar(`applyOtherVersion({title:"Estamos de Pé (Ao Vivo)",artist:"AtituD",duration:227},${JSON.stringify(estamosDePe[0])},true)`);
  assert.equal(musica.synced,"");
  assert.equal(musica.lyrics,"Letra de teste ao vivo");
  assert.equal(musica.duration,227);
  assert.match(musica.lyricNote,/escolhida por você/);
  assert.match(musica.lyricNote,/Marcus Salles/);
});
