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
    diferencaDuracao:require("../lrc.js").diferencaDuracao,
    markSource:(n,ok)=>{saude[n]={ok,at:Date.now()}},
    sourceCoolingDown:n=>!!saude[n]&&saude[n].ok===false
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,"busca-youtube.js"),"utf8")+";this.B={INSTANCIAS_BUSCA,MAX_LOTE,consultaDeKaraoke,mapearPiped,buscarVideos,pontuarVideo,ordenarCandidatos,resolverPlayback,lerListaDeMusicas};",ctx);
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

/* ------------------------------------------------- escolha automática */
const v=(id,titulo,duracao,canal="Canal")=>({id,titulo,canal,duracao,thumb:""});
const ctx={titulo:"Evidências",artista:"Chitãozinho e Xororó",duracaoEsperada:240};

test("karaokê da música certa, com a duração certa, ganha do clipe e do ao vivo",()=>{
  const lista=[
    v("aaaaaaaaaaa","Chitãozinho e Xororó - Evidências (Clipe Oficial)",245),
    v("bbbbbbbbbbb","Evidências - Chitãozinho e Xororó (Ao Vivo)",250),
    v("ccccccccccc","Evidências - Chitãozinho e Xororó - Karaokê Playback",243,"Karaokê Brasil"),
    v("ddddddddddd","As melhores 30 músicas karaokê sertanejo - medley",1800)
  ];
  const o=B0.ordenarCandidatos(lista,ctx);
  assert.equal(o[0].id,"ccccccccccc");
  assert.equal(o[o.length-1].id,"ddddddddddd");
  assert.ok(o[0].pontos>o[1].pontos);
  assert.equal(lista[0].pontos,undefined,"não altera a lista original");
});
test("empate mantém a ordem da busca",()=>{
  const o=B0.ordenarCandidatos([v("aaaaaaaaaaa","x karaokê",200),v("bbbbbbbbbbb","y karaokê",200)],{});
  assert.equal(o.map(x=>x.id).join(),"aaaaaaaaaaa,bbbbbbbbbbb");
});
test("vídeo que não tem nada do pedido perde para o parecido, mesmo com 'karaokê' no título",()=>{
  const a=B0.pontuarVideo(v("aaaaaaaaaaa","Outra Coisa Karaokê",240),ctx);
  const b=B0.pontuarVideo(v("bbbbbbbbbbb","Evidências Chitãozinho e Xororó Karaokê",240),ctx);
  assert.ok(b>a+5);
});

const musicas=t=>B0.lerListaDeMusicas(t);
test("lista colada: separa título e artista, tira numeração, vazias e repetidas",()=>{
  const r=musicas("1. Evidências - Chitãozinho e Xororó\n\n2) Cogulândia — Matuê\n- Tá Escrito\nevidências - chitãozinho e xororó\n x \r\n");
  assert.equal(r.itens.length,3);
  assert.equal(JSON.stringify(r.itens.map(i=>[i.titulo,i.artista])),JSON.stringify([["Evidências","Chitãozinho e Xororó"],["Cogulândia","Matuê"],["Tá Escrito",""]]));
  assert.equal(r.ignoradas,0);
});
test("lista colada: no máximo 30 por vez, o resto é contado",()=>{
  const r=musicas(Array.from({length:35},(_,i)=>"Música "+i).join("\n"));
  assert.equal(r.itens.length,B0.MAX_LOTE);assert.equal(r.ignoradas,5);
  assert.equal(musicas("").itens.length,0);
});

const resposta=lista=>({status:200,corpo:{items:lista.map(x=>({type:"stream",url:"/watch?v="+x.id,title:x.titulo,uploaderName:x.canal||"C",duration:x.duracao}))}});
test("resolverPlayback: o melhor é bloqueado, cai para o segundo e guarda as alternativas",async()=>{
  const lista=[v("aaaaaaaaaaa","Evidências - Chitãozinho e Xororó (Clipe Oficial)",245),v("bbbbbbbbbbb","Evidências Chitãozinho e Xororó Karaokê",242),v("ccccccccccc","Evidências Chitãozinho e Xororó Playback",260)];
  const m=modulo(()=>resposta(lista));
  const vistos=[];
  const r=await m.B.resolverPlayback("Evidências Chitãozinho e Xororó",{...ctx,verificar:async id=>{vistos.push(id);return id==="bbbbbbbbbbb"?{ok:false,msg:"bloqueado"}:{ok:true}}});
  assert.equal(vistos[0],"bbbbbbbbbbb");
  assert.equal(r.video.id,vistos[1]);assert.notEqual(r.video.id,"bbbbbbbbbbb");
  assert.ok(!r.alternativas.some(x=>x.id===r.video.id)&&r.alternativas.length===2);
  assert.equal(r.fonte,"publico");
});
test("resolverPlayback: nenhum toca → erro com a lista inteira para a tela mostrar",async()=>{
  const m=modulo(()=>resposta([v("aaaaaaaaaaa","a karaokê",200),v("bbbbbbbbbbb","b karaokê",200)]));
  await assert.rejects(m.B.resolverPlayback("a",{verificar:async()=>({ok:false})}),e=>/não tocam/.test(e.message)&&e.alternativas.length===2);
});
test("resolverPlayback: busca vazia → erro claro; chave oficial não confere de novo",async()=>{
  await assert.rejects(modulo(()=>resposta([])).B.resolverPlayback("a",{verificar:async()=>({ok:true})}),/Nenhum vídeo/);
  const m=modulo(url=>url.startsWith("https://www.googleapis.com/")?{status:200,corpo:{items:[{id:{videoId:"dQw4w9WgXcQ"},snippet:{title:"Karaokê x",channelTitle:"c"}}]}}:new Error("não devia"));
  let conferiu=0;
  const r=await m.B.resolverPlayback("x",{chave:"AIzaX",verificar:async()=>{conferiu++;return{ok:true}}});
  assert.equal(r.video.id,"dQw4w9WgXcQ");assert.equal(conferiu,0);
});
test("pontuação baixa vira dúvida; certa não",async()=>{
  const m=modulo(()=>resposta([v("aaaaaaaaaaa","Receita de bolo",30)]));
  const r=await m.B.resolverPlayback("Evidências",{verificar:async()=>({ok:true})});
  assert.equal(r.video.duvida,true);
  const m2=modulo(()=>resposta([v("aaaaaaaaaaa","Evidências Karaokê",240)]));
  assert.equal((await m2.B.resolverPlayback("Evidências",{verificar:async()=>({ok:true})})).video.duvida,false);
});
