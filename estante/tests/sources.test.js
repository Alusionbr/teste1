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
  assert.equal(chamadas.length,2,"uma tentativa extra, não um laço de insistência");
  assert.equal(rodar('sourceCoolingDown("lrclib")'),true);
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
