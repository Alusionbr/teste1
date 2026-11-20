"use strict";
/*
 * Protocolo dos players embutidos, sem rede nem navegador: carrega
 * fonte-youtube.js e fonte-spotify.js num contexto falso e conversa com eles.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");

// fonte-youtube.js usa o YouTubeBase de verificar-youtube.js (a página carrega os dois, nesta ordem).
const fonteYT=()=>fs.readFileSync(path.join(root,"verificar-youtube.js"),"utf8")+"\n"+fs.readFileSync(path.join(root,"fonte-youtube.js"),"utf8");

function contexto(){
  let ouvinte=null,agora=1000;
  const eventos=[],enviados=[];
  const aoCarregar=[];
  const frame={src:"",contentWindow:{postMessage:(m,o)=>enviados.push({m,o})},setAttribute(){},addEventListener:(t,f)=>{if(t==="load")aoCarregar.push(f)}};
  const ctx={
    window:{addEventListener:(t,f)=>{if(t==="message")ouvinte=f}},
    document:{createElement:()=>frame},
    $:()=>({appendChild(){}}),
    location:{origin:"https://exemplo.github.io"},
    performance:{now:()=>agora},
    setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    emitir:(t,d)=>eventos.push([t,d||{}]),
    URLSearchParams,JSON,Math,Number,String
  };
  vm.createContext(ctx);
  // Simula o iframe terminando de carregar (antes disso, o app não deve enviar nada).
  return{ctx,frame,eventos,enviados,receber:e=>ouvinte(e),avancar:ms=>{agora+=ms},carregou:()=>aoCarregar.forEach(f=>f())};
}

test("YouTube: aceita só mensagem da origem certa vinda do próprio iframe",async()=>{
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"},duration:200});
  assert.match(c.frame.src,/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*enablejsapi=1/);
  const info=x=>JSON.stringify({event:"infoDelivery",info:x});
  c.receber({origin:"https://golpe.com",source:c.frame.contentWindow,data:info({playerState:1,currentTime:50})});
  c.receber({origin:"https://www.youtube-nocookie.com",source:{},data:info({playerState:1,currentTime:50})});
  assert.equal(F.tocando(),false,"mensagem falsa não pode mudar o estado");
  c.receber({origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:info({playerState:1,currentTime:10,duration:180})});
  assert.equal(F.tocando(),true);
  c.avancar(500);
  assert.equal(F.tempo(),10.5,"extrapola entre entregas");
  c.avancar(5000);
  assert.equal(F.tempo(),11,"teto de 1 s: player mudo congela a letra");
});

test("YouTube: anúncio congela o relógio, erro 150 avisa e fim dispara 'fim'",async()=>{
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  const msg=x=>c.receber({origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:JSON.stringify(x)});
  for(let i=0;i<3;i++)msg({event:"infoDelivery",info:{playerState:1,currentTime:3+i,duration:180}});   // 3 mensagens iguais fixam a referência
  msg({event:"infoDelivery",info:{currentTime:2,duration:15}});
  assert.equal(F.emAnuncio,true);
  assert.equal(F.tocando(),false);
  msg({event:"onError",info:150});
  const erro=c.eventos.find(e=>e[0]==="erro");
  assert.ok(erro&&erro[1].bloqueadoEmbutir);
  msg({event:"infoDelivery",info:{playerState:0}});
  assert.ok(c.eventos.some(e=>e[0]==="fim"));
});

// Mensagens do player real: o iframe é reaproveitado entre músicas e anúncios chegam antes do vídeo.
function playerFalso(){
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const msg=x=>c.receber({origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:JSON.stringify(x)});
  const info=(i,ms=250)=>{c.avancar(ms);msg({event:"infoDelivery",info:i})};
  return{c,F:c.ctx.F,msg,info};
}
test("YouTube: música 2 com mensagens atrasadas da música 1 NÃO vira anúncio",async()=>{
  const{c,F,info}=playerFalso();
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  for(let i=0;i<5;i++)info({playerState:1,currentTime:10+i/4,duration:200});
  assert.equal(F.duracao(),200);
  // troca de vídeo no mesmo iframe: chegam mais mensagens do vídeo anterior, depois as do novo
  await F.carregar({playback:{id:"abcdefghijk"}});
  for(let i=0;i<3;i++)info({playerState:1,currentTime:199,duration:200});
  for(let i=0;i<6;i++)info({playerState:1,currentTime:1+i/4,duration:312});
  assert.equal(F.emAnuncio,false,"duração nova do vídeo foi tomada por anúncio");
  assert.equal(F.tocando(),true);
  assert.equal(F.duracao(),312);
  c.avancar(400);
  assert.ok(F.tempo()>2,"o relógio da letra não pode ficar parado");
});
test("YouTube: anúncio antes do vídeo não faz o vídeo virar anúncio; com duração esperada o anúncio congela e libera sozinho",async()=>{
  const a=playerFalso();
  await a.F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  for(let i=0;i<4;i++)a.info({playerState:1,currentTime:i,duration:15});   // anúncio de 15 s primeiro, sem referência
  for(let i=0;i<5;i++)a.info({playerState:1,currentTime:i,duration:240});
  assert.equal(a.F.emAnuncio,false);assert.equal(a.F.duracao(),240);
  const b=playerFalso();
  await b.F.carregar({playback:{id:"dQw4w9WgXcQ",duracao:240}});
  b.info({playerState:1,currentTime:0,duration:15});
  assert.equal(b.F.emAnuncio,true,"com a duração esperada, o anúncio curto é reconhecido logo");
  assert.equal(b.F.tocando(),false);
  b.info({playerState:1,currentTime:0,duration:240});
  assert.equal(b.F.emAnuncio,false,"acabou o anúncio: o relógio volta sozinho");
  assert.equal(b.F.tocando(),true);
});
test("YouTube: entregas atrasadas (TV ocupada) não congelam a letra por mais tempo que o atraso",async()=>{
  const{c,F,info}=playerFalso();
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  for(let i=0;i<4;i++)info({playerState:1,currentTime:i*0.25,duration:200},250);
  for(let i=0;i<4;i++)info({playerState:1,currentTime:1+i*1.5,duration:200},1500);   // mensagens a cada 1,5 s
  const t0=F.tempo();c.avancar(1400);
  assert.ok(F.tempo()-t0>=1.39,"com entregas a cada 1,5 s a letra deve seguir andando entre elas");
  c.avancar(10000);
  assert.ok(F.tempo()-t0<=2.6,"e o teto máximo (2 s) continua valendo para player mudo");
  assert.ok(F.diagnostico().maiorIntervaloMs>=1500&&F.diagnostico().congelamentos>=1);
});
test("YouTube: com a letra do app ligada as legendas do YouTube são descarregadas",async()=>{
  const{c,F,info}=playerFalso();
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  c.carregou();info({playerState:1,currentTime:1,duration:100});
  c.enviados.length=0;
  F.legendas(true);
  assert.equal(c.enviados.length,0,"só o vídeo: as legendas ficam como o vídeo quiser");
  F.legendas(false);
  const cmds=c.enviados.map(e=>JSON.parse(e.m));
  assert.ok(cmds.some(x=>x.func==="unloadModule"&&x.args[0]==="captions"));
  assert.ok(c.enviados.every(e=>e.o==="https://www.youtube-nocookie.com"));
});
test("YouTube: o gravador guarda as mensagens para o Diagnóstico",async()=>{
  const{F,info}=playerFalso();
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  for(let i=0;i<10;i++)info({playerState:1,currentTime:i,duration:100});
  const d=F.diagnostico();
  assert.equal(d.mensagens,10);assert.equal(d.registro.length,10);
  assert.equal(d.registro[9].c,9);assert.equal(d.registro[9].d,100);
});

test("YouTube: pedido de tocar antes de o player carregar é cumprido quando ele responde",async()=>{
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  F.tocar();
  assert.equal(c.enviados.length,0,"antes de o iframe carregar nada pode ser enviado (o navegador recusa o postMessage)");
  c.carregou();
  c.enviados.length=0;
  c.receber({origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:JSON.stringify({event:"onReady"})});
  const cmds=c.enviados.map(e=>JSON.parse(e.m));
  assert.ok(cmds.some(x=>x.func==="playVideo"));
  assert.ok(c.enviados.every(e=>e.o==="https://www.youtube-nocookie.com"),"targetOrigin explícito, nunca *");
});

test("Spotify: ready → ack, playback_update dá tempo, prévia de 30 s é avisada",async()=>{
  const c=contexto();
  vm.runInContext(fs.readFileSync(path.join(root,"fonte-spotify.js"),"utf8")+";this.F=FonteSpotify;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"4cOdK2wGLETKBW3PvgPWqT"},duration:240});
  assert.match(c.frame.src,/^https:\/\/open\.spotify\.com\/embed\/track\/4cOdK2wGLETKBW3PvgPWqT/);
  const de=(origin,data,source=c.frame.contentWindow)=>c.receber({origin,source,data});
  F.pausar();
  assert.equal(c.enviados.length,0,"antes de o iframe carregar nada pode ser enviado");
  c.carregou();
  de("https://open.spotify.com",{type:"ready"});
  assert.equal(JSON.stringify(c.enviados.at(-1)),JSON.stringify({m:{command:"load_complete_ack"},o:"https://open.spotify.com"}));
  de("https://golpe.com",{type:"playback_update",payload:{isPaused:false,position:99000,duration:240000}});
  assert.equal(F.tocando(),false);
  de("https://open.spotify.com",{type:"playback_update",payload:{isPaused:false,isBuffering:false,position:12000,duration:30000}});
  assert.equal(F.tocando(),true);
  assert.equal(F.tempo(),12);
  assert.ok(c.eventos.some(e=>e[0]==="previa"));
  F.buscar(20);
  assert.equal(JSON.stringify(c.enviados.at(-1).m),JSON.stringify({command:"seek",timestamp:20}));
  de("https://open.spotify.com",{type:"playback_update",payload:{isPaused:true,position:29900,duration:30000}});
  assert.ok(c.eventos.some(e=>e[0]==="erro"&&e[1].previa),"o fim da prévia de 30 s vira aviso");
  assert.ok(!c.eventos.some(e=>e[0]==="fim"),"e não é tratado como fim da música");
});

test("Spotify: fim da prévia de 30 s não é fim da música (vira aviso, não aplausos)",async()=>{
  const c=contexto();
  vm.runInContext(fs.readFileSync(path.join(root,"fonte-spotify.js"),"utf8")+";this.F=FonteSpotify;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"4cOdK2wGLETKBW3PvgPWqT"},duration:280});
  c.carregou();
  const de=data=>c.receber({origin:"https://open.spotify.com",source:c.frame.contentWindow,data});
  de({type:"ready"});
  de({type:"playback_update",payload:{isPaused:false,isBuffering:false,position:1000,duration:29713}});
  assert.ok(c.eventos.some(e=>e[0]==="previa"),"avisa que é prévia");
  de({type:"playback_update",payload:{isPaused:true,isBuffering:false,position:29713,duration:29713}});
  const erro=c.eventos.find(e=>e[0]==="erro");
  assert.ok(erro&&erro[1].previa,"termina com aviso de prévia");
  assert.ok(!c.eventos.some(e=>e[0]==="fim"),"não pode seguir para os aplausos");
});

test("Spotify: prévia também é detectada quando a duração da música é desconhecida",async()=>{
  const c=contexto();
  vm.runInContext(fs.readFileSync(path.join(root,"fonte-spotify.js"),"utf8")+";this.F=FonteSpotify;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"4cOdK2wGLETKBW3PvgPWqT"},duration:0});
  c.carregou();
  c.receber({origin:"https://open.spotify.com",source:c.frame.contentWindow,data:{type:"playback_update",payload:{isPaused:false,isBuffering:false,position:500,duration:29713}}});
  assert.ok(c.eventos.some(e=>e[0]==="previa"));
});

/* ---- verificação "este vídeo pode tocar aqui?" (antes de escolher o playback) ---- */
// A conferência entra numa fila (uma por vez): o player só abre depois de um instante.
const proximoTick=()=>new Promise(r=>setImmediate(r));
function contextoVerificar(){
  const timers=[],ouvintes=[];let criados=0;
  const frame={style:{},contentWindow:{postMessage(){}},setAttribute(){},addEventListener(){},remove(){frame.removido=true}};
  const ctx={
    window:{addEventListener:(t,f)=>{if(t==="message")ouvintes.push(f)},removeEventListener:(t,f)=>{const i=ouvintes.indexOf(f);if(i>=0)ouvintes.splice(i,1)}},
    document:{createElement:()=>{criados++;return frame},body:{appendChild(){}}},
    $:()=>({appendChild(){}}),location:{origin:"https://exemplo.github.io"},performance:{now:()=>0},
    setTimeout:(f,ms)=>{timers.push({f,ms,vivo:true});return timers.length},clearTimeout:i=>{if(timers[i-1])timers[i-1].vivo=false},
    setInterval:()=>0,clearInterval(){},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),emitir(){},URLSearchParams,JSON,Math,Number,String
  };
  vm.createContext(ctx);
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",ctx);
  const msg=(o,origin="https://www.youtube-nocookie.com",source=frame.contentWindow)=>ouvintes.slice().forEach(f=>f({origin,source,data:JSON.stringify(o)}));
  const disparar=ms=>{const t=timers.find(x=>x.vivo&&x.ms===ms);if(t){t.vivo=false;t.f()}};
  return{F:ctx.F,frame,msg,disparar,get criados(){return criados}};
}

test("verificar: clipe bloqueado manda 'pronto' e erro 150 no mesmo instante e é recusado",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("2vjPBrBU-TM");
  await proximoTick();
  c.msg({event:"initialDelivery",info:{apiInterface:[]}});
  c.msg({event:"onReady"});
  c.msg({event:"onError",info:150});
  const v=await r;
  assert.equal(v.ok,false);assert.equal(v.bloqueado,true);assert.equal(v.codigo,150);
  assert.match(v.msg,/fora do YouTube/);
  assert.equal(c.frame.removido,true,"o player de teste é removido");
});

test("verificar: vídeo liberado só é aceito depois da margem esperando um erro",async()=>{
  const c=contextoVerificar();
  let resolvido=false;
  const r=c.F.verificar("dQw4w9WgXcQ").then(v=>{resolvido=true;return v});
  await proximoTick();
  c.msg({event:"initialDelivery",info:{apiInterface:[]}});
  c.msg({event:"onReady"});
  await Promise.resolve();
  assert.equal(resolvido,false,"'pronto' sozinho não basta");
  c.disparar(1500);
  const v=await r;
  assert.deepEqual({...v},{ok:true});
  assert.equal(c.frame.removido,true);
});

test("verificar: sem resposta a tempo (ex.: sem internet) não impede a escolha, mas avisa",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("dQw4w9WgXcQ");
  await proximoTick();
  c.disparar(5000);
  const v=await r;
  assert.equal(v.ok,true);assert.equal(v.incerto,true);
});

test("verificar: ignora mensagem de outra origem ou de outra janela",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("dQw4w9WgXcQ");
  await proximoTick();
  c.msg({event:"onError",info:150},"https://golpe.com");
  c.msg({event:"onError",info:150},"https://www.youtube-nocookie.com",{});
  c.disparar(5000);
  const v=await r;
  assert.equal(v.ok,true,"erro falso não pode reprovar o vídeo");
});

test("verificar: uma conferência por vez, e o resultado firme fica em cache",async()=>{
  const c=contextoVerificar();
  const a=c.F.verificar("aaaaaaaaaaa"),b=c.F.verificar("bbbbbbbbbbb");
  await proximoTick();
  assert.equal(c.criados,1,"a segunda conferência espera a primeira");
  c.msg({event:"onError",info:150});
  assert.equal((await a).ok,false);
  await proximoTick();
  assert.equal(c.criados,2);
  c.msg({event:"onReady"});c.disparar(1500);
  assert.equal((await b).ok,true);
  const antes=c.criados;
  assert.equal((await c.F.verificar("aaaaaaaaaaa")).ok,false,"cache");
  assert.equal(c.criados,antes,"vídeo já conferido não abre outro player");
});
test("verificar: resposta incerta (sem internet) não vai para o cache",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("ccccccccccc");
  await proximoTick();
  c.disparar(5000);
  assert.equal((await r).incerto,true);
  const antes=c.criados;
  const r2=c.F.verificar("ccccccccccc");
  await proximoTick();
  assert.equal(c.criados,antes+1,"incerto confere de novo na próxima vez");
  c.disparar(5000);await r2;
});

test("verificar: vídeo removido (100) também é recusado, sem dizer 'bloqueado'",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("xxxxxxxxxxx");
  await proximoTick();
  c.msg({event:"onError",info:100});
  const v=await r;
  assert.equal(v.ok,false);assert.equal(v.bloqueado,false);assert.match(v.msg,/removido/i);
});

test("Spotify: 'ready' que chega ANTES do evento load não perde o pedido de tocar",async()=>{
  const c=contexto();
  vm.runInContext(fs.readFileSync(path.join(root,"fonte-spotify.js"),"utf8")+";this.F=FonteSpotify;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"4cOdK2wGLETKBW3PvgPWqT"},duration:200});
  F.tocar();                                   // pedido antes de o player existir de fato
  c.receber({origin:"https://open.spotify.com",source:c.frame.contentWindow,data:{type:"ready"}});   // sem c.carregou()
  const cmds=c.enviados.map(e=>e.m.command);
  assert.ok(cmds.includes("load_complete_ack"),"confirma o ready");
  assert.ok(cmds.includes("play"),"cumpre o pedido de tocar guardado");
});

test("YouTube: mensagem do player antes do evento load também libera o envio",async()=>{
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  F.tocar();
  c.receber({origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:JSON.stringify({event:"onReady"})});
  assert.ok(c.enviados.some(e=>JSON.parse(e.m).func==="playVideo"),"tocar guardado é cumprido");
});
