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

function contexto(){
  let ouvinte=null,agora=1000;
  const eventos=[],enviados=[];
  const frame={src:"",contentWindow:{postMessage:(m,o)=>enviados.push({m,o})},setAttribute(){},addEventListener(){}};
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
  return{ctx,frame,eventos,enviados,receber:e=>ouvinte(e),avancar:ms=>{agora+=ms}};
}

test("YouTube: aceita só mensagem da origem certa vinda do próprio iframe",async()=>{
  const c=contexto();
  vm.runInContext(fs.readFileSync(path.join(root,"fonte-youtube.js"),"utf8")+";this.F=FonteYouTube;",c.ctx);
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
  vm.runInContext(fs.readFileSync(path.join(root,"fonte-youtube.js"),"utf8")+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  const msg=x=>c.receber({origin:"https://www.youtube-nocookie.com",source:c.frame.contentWindow,data:JSON.stringify(x)});
  msg({event:"infoDelivery",info:{playerState:1,currentTime:3,duration:180}});
  msg({event:"infoDelivery",info:{currentTime:2,duration:15}});
  assert.equal(F.emAnuncio,true);
  assert.equal(F.tocando(),false);
  msg({event:"onError",info:150});
  const erro=c.eventos.find(e=>e[0]==="erro");
  assert.ok(erro&&erro[1].bloqueadoEmbutir);
  msg({event:"infoDelivery",info:{playerState:0}});
  assert.ok(c.eventos.some(e=>e[0]==="fim"));
});

test("YouTube: pedido de tocar antes de o player carregar é cumprido quando ele responde",async()=>{
  const c=contexto();
  vm.runInContext(fs.readFileSync(path.join(root,"fonte-youtube.js"),"utf8")+";this.F=FonteYouTube;",c.ctx);
  const F=c.ctx.F;
  await F.carregar({playback:{id:"dQw4w9WgXcQ"}});
  F.tocar();
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
  assert.ok(c.eventos.some(e=>e[0]==="fim"));
});
