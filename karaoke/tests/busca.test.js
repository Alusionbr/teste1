"use strict";
/*
 * Busca de vídeos do YouTube (busca-youtube.js) sem rede: fetchSafe falso,
 * resposta real do Piped em tests/piped-amostra.json.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const amostra=JSON.parse(fs.readFileSync(path.join(__dirname,"piped-amostra.json"),"utf8"));

function modulo(respostas){
  const chamadas=[],saude={};
  const ctx={
    URLSearchParams,JSON,Promise,Error,Set,Number,String,Math,
    fetchSafe:async url=>{
      chamadas.push(url);
      const r=respostas(url);
      if(r instanceof Error)throw r;
      return{ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.corpo};
    },
    markSource:(n,ok)=>{saude[n]={ok,at:Date.now()}},
    sourceCoolingDown:n=>!!saude[n]&&saude[n].ok===false
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,"busca-youtube.js"),"utf8")+";this.B={INSTANCIAS_BUSCA,consultaDeKaraoke,mapearPiped,buscarVideos};",ctx);
  return{B:ctx.B,chamadas,saude};
}
const B0=modulo(()=>({status:200,corpo:{}})).B;

test("mapeia só vídeos: tira Short, ao vivo, id inválido e playlist",()=>{
  const l=B0.mapearPiped(amostra);
  assert.ok(l.length>=3);
  assert.ok(l.every(v=>/^[\w-]{11}$/.test(v.id)&&v.duracao>0));
  assert.ok(!l.some(v=>["SHORTSSHORT","AOVIVOAOVIV","curto"].includes(v.id)));
  assert.equal(l[0].thumb,`https://i.ytimg.com/vi/${l[0].id}/default.jpg`,"miniatura do próprio YouTube, não do proxy da instância");
  assert.ok(l[0].titulo&&l[0].canal);
});
test("remove repetidos e limita a 12",()=>{
  const it=i=>({url:`/watch?v=${String(i).padStart(11,"a")}`,type:"stream",title:"v"+i,duration:100});
  const itens=[...Array.from({length:20},(_,i)=>it(i)),it(0)];
  assert.equal(B0.mapearPiped({items:itens}).length,12);
  assert.equal(B0.mapearPiped({items:[it(1),it(1)]}).length,1);
  assert.equal(B0.mapearPiped(null).length,0);
});
test("consulta ganha 'karaokê playback' só quando falta",()=>{
  assert.equal(B0.consultaDeKaraoke("evidências"),"evidências karaokê playback");
  assert.equal(B0.consultaDeKaraoke("evidências   karaoke"),"evidências karaoke");
  assert.equal(B0.consultaDeKaraoke("x instrumental"),"x instrumental");
});
test("primeira instância dá 502, a segunda responde: usa a segunda e poupa a primeira",async()=>{
  const m=modulo(url=>url.startsWith(B0.INSTANCIAS_BUSCA[0])?{status:502}:url.startsWith(B0.INSTANCIAS_BUSCA[1])?{status:200,corpo:amostra}:new Error("sem rede"));
  const r=await m.B.buscarVideos("evidências");
  assert.equal(r.fonte,"publico");assert.ok(r.lista.length>=3);
  assert.ok(m.chamadas.every(u=>/\/search\?/.test(u)&&/filter=videos/.test(u)&&/karaok/.test(decodeURIComponent(u))));
  // segunda busca: as que falharam ficam poupadas, só a boa é consultada
  m.chamadas.length=0;
  await m.B.buscarVideos("outra");
  assert.equal(m.chamadas.length,1);assert.ok(m.chamadas[0].startsWith(B0.INSTANCIAS_BUSCA[1]));
});
test("todas falham: erro claro; todas poupadas: tenta de novo mesmo assim",async()=>{
  const m=modulo(()=>new Error("sem rede"));
  await assert.rejects(m.B.buscarVideos("x"),/não respondeu agora/);
  m.chamadas.length=0;
  await assert.rejects(m.B.buscarVideos("x"),/não respondeu agora/);
  assert.ok(m.chamadas.length>=1,"depois de tudo poupado ainda tenta");
});
test("resposta sem 'items' conta como falha",async()=>{
  const m=modulo(()=>({status:200,corpo:{erro:"x"}}));
  await assert.rejects(m.B.buscarVideos("x"),/não respondeu agora/);
});
test("com chave: usa a API oficial (só embutíveis) e não toca no Piped",async()=>{
  const m=modulo(url=>url.startsWith("https://www.googleapis.com/")?{status:200,corpo:{items:[{id:{videoId:"dQw4w9WgXcQ"},snippet:{title:"Don&#39;t stop",channelTitle:"Canal &amp; Cia"}}]}}:new Error("não devia"));
  const r=await m.B.buscarVideos("x",{chave:"AIzaX"});
  assert.equal(r.fonte,"oficial");assert.equal(r.lista[0].titulo,"Don't stop");assert.equal(r.lista[0].canal,"Canal & Cia");
  assert.ok(/videoEmbeddable=true/.test(m.chamadas[0])&&m.chamadas.length===1);
});
test("chave recusada ou cota acabada: cai para o Piped e avisa",async()=>{
  for(const motivo of ["keyInvalid","quotaExceeded"]){
    const m=modulo(url=>url.startsWith("https://www.googleapis.com/")?{status:403,corpo:{error:{errors:[{reason:motivo}]}}}:url.startsWith(B0.INSTANCIAS_BUSCA[0])?{status:200,corpo:amostra}:new Error("x"));
    const r=await m.B.buscarVideos("x",{chave:"AIzaX"});
    assert.equal(r.fonte,"publico");assert.ok(r.aviso.length>5&&r.lista.length>=3);
  }
});
