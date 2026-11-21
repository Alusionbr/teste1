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
  let ouvinte=null,agora=1000,seq=0;
  const timers=new Map();
  const eventos=[],enviados=[];
  const aoCarregar=[];
  const frame={src:"",contentWindow:{postMessage:(m,o)=>enviados.push({m,o})},setAttribute(){},addEventListener:(t,f)=>{if(t==="load")aoCarregar.push(f)}};
  const ctx={
    window:{addEventListener:(t,f)=>{if(t==="message")ouvinte=f}},
    document:{createElement:()=>frame},
    $:()=>({appendChild(){}}),
    location:{origin:"https://exemplo.github.io"},
    performance:{now:()=>agora},
    setTimeout:(fn,ms)=>{timers.set(++seq,{fn,em:agora+ms});return seq},
    clearTimeout:id=>timers.delete(id),setInterval:()=>0,clearInterval(){},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    emitir:(t,d)=>eventos.push([t,d||{}]),
    URLSearchParams,JSON,Math,Number,String
  };
  vm.createContext(ctx);
  // Simula o iframe terminando de carregar (antes disso, o app não deve enviar nada).
  return{ctx,frame,eventos,enviados,receber:e=>ouvinte(e),avancar:ms=>{
    const fim=agora+ms;
    while(true){
      const [id,t]=[...timers].sort((a,b)=>a[1].em-b[1].em)[0]||[];
      if(!t||t.em>fim)break;
      agora=t.em;timers.delete(id);t.fn();
    }
    agora=fim;
  },carregou:()=>aoCarregar.forEach(f=>f())};
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

test("YouTube: outra mídia identificada congela o relógio, erro 150 avisa e fim dispara 'fim'",async()=>{
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  const msg=x=>c.receber({origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:JSON.stringify(x)});
  msg({event:"infoDelivery",info:{playerState:1,currentTime:3,duration:180}});
  msg({event:"infoDelivery",info:{currentTime:2,duration:15,videoData:{video_id:"OUTRAVIDEO1"}}});
  assert.equal(F.emAnuncio,true);
  assert.equal(F.tocando(),false);
  assert.equal(F.tempo(),3,"o relógio continua no tempo da música");
  msg({event:"infoDelivery",info:{currentTime:4,duration:181,videoData:{video_id:"dQw4w9WgXcQ"}}});
  assert.ok(F.tocando(),"o vídeo escolhido volta a contar mesmo com duração diferente");
  msg({event:"onError",info:150});
  const erro=c.eventos.find(e=>e[0]==="erro");
  assert.ok(erro&&erro[1].bloqueadoEmbutir);
  msg({event:"infoDelivery",info:{playerState:0}});
  assert.ok(c.eventos.some(e=>e[0]==="fim"));
});

test("YouTube: duração inicial curta não impede a música de tocar",async()=>{
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  const msg=(event,info)=>c.receber({
    origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:JSON.stringify({event,info})
  });
  msg("infoDelivery",{duration:15,currentTime:0});
  F.tocar();
  msg("onStateChange",1);
  msg("infoDelivery",{duration:240,currentTime:1});
  assert.equal(F.emAnuncio,false);
  assert.equal(F.duracao(),240);
  assert.ok(F.tocando());
  c.avancar(12000);
  assert.ok(c.eventos.some(([tipo,d])=>tipo==="erro"&&d.tentarNovamente));
  msg("infoDelivery",{duration:240,currentTime:2});
  assert.ok(c.eventos.some(([tipo])=>tipo==="retomou"));
  assert.ok(!c.enviados.some(({m})=>JSON.parse(m).func==="pauseVideo"));
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

test("YouTube: carregamento mudo tem prazo, e nova tentativa conserva o vídeo e espera o player",async()=>{
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  const msg=x=>c.receber({origin:new URL(c.frame.src).origin,source:c.frame.contentWindow,data:JSON.stringify(x)});
  F.tocar();
  c.avancar(2000);
  assert.equal(c.eventos.some(([tipo])=>tipo==="bloqueado"),false,"player mudo ainda não pode pedir um toque");
  c.avancar(4000);
  assert.match(c.frame.src,/^https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ.*controls=1/);
  c.avancar(6000);
  assert.ok(c.eventos.some(([tipo,d])=>tipo==="erro"&&d.tentarNovamente));
  F.recarregar();
  assert.match(c.frame.src,/^https:\/\/www\.youtube-nocookie\.com.*dQw4w9WgXcQ.*&start=0$/);
  c.carregou();
  msg({event:"onReady"});
  assert.ok(c.enviados.some(({m,o})=>JSON.parse(m).func==="playVideo"&&o==="https://www.youtube-nocookie.com"));
  assert.ok(c.eventos.some(([tipo,d])=>tipo==="bloqueado"&&d.controles));
  msg({event:"infoDelivery",info:{playerState:1,currentTime:22}});
  c.avancar(9000);
  msg({event:"infoDelivery",info:{playerState:1,currentTime:25}});
  c.avancar(4000);
  assert.equal(c.eventos.filter(([tipo])=>tipo==="erro").length,1,"o avanço do vídeo renova o prazo");
  c.avancar(8000);
  assert.equal(c.eventos.filter(([tipo])=>tipo==="erro").length,2,"o vídeo congelado também vence o prazo");
  F.recarregar();
  assert.match(c.frame.src,/dQw4w9WgXcQ.*&start=25$/);
  F.pausar();c.avancar(15000);
  assert.equal(c.eventos.filter(([tipo])=>tipo==="erro").length,2,"uma pausa cancela a espera");
});


// ---- 1.0.17: o relógio nunca pode ficar preso por causa de "outra mídia" ----
function playerComId(){
  const c=contexto();
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",c.ctx);
  const msg=x=>c.receber({origin:new URL(c.frame.src).origin,source:c.frame.contentWindow,data:JSON.stringify(x)});
  const info=(i,ms=250)=>{c.avancar(ms);msg({event:"infoDelivery",info:i})};
  return{c,F:c.ctx.F,msg,info};
}
test("YouTube: mensagem atrasada do vídeo anterior não prende o relógio da música nova",async()=>{
  const{c,F,info}=playerComId();
  await F.carregar({playback:{id:"AAAAAAAAAAA"}});
  F.tocar();
  for(let i=0;i<4;i++)info({playerState:1,currentTime:i,duration:200,videoData:{video_id:"AAAAAAAAAAA"}});
  // troca de vídeo no mesmo iframe: uma mensagem do vídeo anterior chega depois do cue
  await F.carregar({playback:{id:"BBBBBBBBBBB"}});
  F.tocar();
  info({playerState:1,currentTime:199,duration:200,videoData:{video_id:"AAAAAAAAAAA"}});
  // o resto vem SEM videoData (é o normal): precisa ser aceito, senão o app nunca vê o play
  for(let i=0;i<6;i++)info({playerState:1,currentTime:1+i/4,duration:312});
  assert.equal(F.emAnuncio,false,"uma mensagem atrasada não pode deixar 'outra mídia' ligada");
  assert.equal(F.tocando(),true);
  assert.equal(F.duracao(),312);
  c.avancar(400);
  assert.ok(F.tempo()>2,"o relógio da letra precisa andar");
});
test("YouTube: mensagem isolada de outra mídia é ignorada só naquela vez",async()=>{
  const{c,F,info}=playerComId();
  await F.carregar({playback:{id:"AAAAAAAAAAA"}});
  F.tocar();
  info({playerState:1,currentTime:10,duration:200,videoData:{video_id:"AAAAAAAAAAA"}});
  info({currentTime:3,duration:15,videoData:{video_id:"ANUNCIOAAAA"}});
  assert.equal(F.tempo(),10,"enquanto chega outra mídia o relógio fica no ponto da música");
  info({currentTime:11,duration:200});   // sem videoData: já é a música de novo
  assert.equal(F.emAnuncio,false);assert.equal(F.tocando(),true);
  c.avancar(500);assert.ok(F.tempo()>11);
});
test("YouTube: o aviso 'demorou' sai assim que o vídeo dá sinal de vida, mesmo depois de outra mídia",async()=>{
  const{c,F,info}=playerComId();
  await F.carregar({playback:{id:"AAAAAAAAAAA"}});
  F.tocar();
  info({currentTime:0,duration:15,videoData:{video_id:"ANUNCIOAAAA"}});
  c.avancar(13000);
  assert.ok(c.eventos.some(([t])=>t==="erro"),"sem sinal da música o aviso aparece");
  info({playerState:1,currentTime:5,duration:240});   // sem videoData
  assert.ok(c.eventos.some(([t])=>t==="retomou"),"com a música andando o aviso tem de sumir");
  assert.equal(F.tocando(),true);
});
test("YouTube: controles nativos só no modo de recuperação",async()=>{
  const{c,F}=playerComId();
  await F.carregar({playback:{id:"AAAAAAAAAAA"}});
  assert.match(c.frame.src,/controls=0/);assert.match(c.frame.src,/disablekb=1/);
  F.comControles();
  assert.match(c.frame.src,/controls=1/);
  await F.carregar({playback:{id:"BBBBBBBBBBB"}});
  assert.match(c.frame.src,/BBBBBBBBBBB/);
});
test("YouTube: buscar() antes de o player estar pronto vale quando ele começa a tocar",async()=>{
  const{c,F,msg}=playerComId();
  await F.carregar({playback:{id:"AAAAAAAAAAA"}});
  F.buscar(42);   // transferência de tela: a posição chega antes do player
  c.carregou();c.enviados.length=0;
  msg({event:"onReady"});
  assert.ok(c.enviados.some(({m})=>{const x=JSON.parse(m);return x.func==="seekTo"&&x.args[0]===42}),"o seek pendente precisa ir quando o player fica pronto");
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
function contextoVerificar(){
  const timers=[],ouvintes=[];
  const frame={style:{},contentWindow:{postMessage(){}},setAttribute(){},addEventListener(){},remove(){frame.removido=true}};
  const ctx={
    window:{addEventListener:(t,f)=>{if(t==="message")ouvintes.push(f)},removeEventListener:(t,f)=>{const i=ouvintes.indexOf(f);if(i>=0)ouvintes.splice(i,1)}},
    document:{createElement:()=>frame,body:{appendChild(){}}},
    $:()=>({appendChild(){}}),location:{origin:"https://exemplo.github.io"},performance:{now:()=>0},
    setTimeout:(f,ms)=>{timers.push({f,ms,vivo:true});return timers.length},clearTimeout:i=>{if(timers[i-1])timers[i-1].vivo=false},
    setInterval:()=>0,clearInterval(){},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),emitir(){},URLSearchParams,JSON,Math,Number,String
  };
  vm.createContext(ctx);
  vm.runInContext(fonteYT()+";this.F=FonteYouTube;",ctx);
  const msg=(o,origin="https://www.youtube-nocookie.com",source=frame.contentWindow)=>ouvintes.slice().forEach(f=>f({origin,source,data:JSON.stringify(o)}));
  const disparar=ms=>{const t=timers.find(x=>x.vivo&&x.ms===ms);if(t){t.vivo=false;t.f()}};
  return{F:ctx.F,frame,msg,disparar};
}

test("verificar: clipe bloqueado manda 'pronto' e erro 150 no mesmo instante e é recusado",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("2vjPBrBU-TM");
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
  c.disparar(8000);
  const v=await r;
  assert.equal(v.ok,true);assert.equal(v.incerto,true);
});

test("verificar: ignora mensagem de outra origem ou de outra janela",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("dQw4w9WgXcQ");
  c.msg({event:"onError",info:150},"https://golpe.com");
  c.msg({event:"onError",info:150},"https://www.youtube-nocookie.com",{});
  c.disparar(8000);
  const v=await r;
  assert.equal(v.ok,true,"erro falso não pode reprovar o vídeo");
});

test("verificar: vídeo removido (100) também é recusado, sem dizer 'bloqueado'",async()=>{
  const c=contextoVerificar();
  const r=c.F.verificar("xxxxxxxxxxx");
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
