"use strict";
/*
 * Teste de ponta a ponta no Chromium (Playwright), sem internet de verdade:
 * LRCLIB, o player do YouTube e a sala do Supabase são simulados por
 * context.route(). O player falso do YouTube é servido na origem verdadeira
 * (www.youtube-nocookie.com), então a conferência de origem do app vale.
 *
 * Uso:
 *   python3 -m http.server 8765 -d karaoke     (em outro terminal)
 *   node karaoke/tests/browser-smoke.js [pasta-para-screenshots]
 */
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const assert=require("node:assert/strict");
const {chromium}=require("playwright");

const BASE=process.env.KARAOKE_URL||"http://127.0.0.1:8765/";
const SAIDA=process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),"karaoke-"));

const LRC="[00:00.50]Primeira linha da canção\n[00:02.50]A: Segunda linha cantada\n[00:04.00]B: Terceira linha do dueto\n[00:05.20]";
const LRCLIB=[{trackName:"Canção de Teste",artistName:"Família Silva",albumName:"Ao Vivo",duration:8,instrumental:false,plainLyrics:"Primeira linha da canção\nSegunda linha cantada\nTerceira linha do dueto",syncedLyrics:LRC}];

// WAV de 6 s em silêncio, gerado aqui (sem arquivo de áudio no repositório).
function wav(segundos){
  const taxa=8000,n=taxa*segundos,buf=Buffer.alloc(44+n*2);
  buf.write("RIFF",0);buf.writeUInt32LE(36+n*2,4);buf.write("WAVE",8);buf.write("fmt ",12);
  buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(taxa,24);
  buf.writeUInt32LE(taxa*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write("data",36);buf.writeUInt32LE(n*2,40);
  return buf;
}

const PLAYER_FALSO=`<!doctype html><body style="margin:0;background:#300;color:#fff;font:20px sans-serif">player falso<script>
let estado=-1,t=0,timer=null,dur=7;
const send=o=>parent.postMessage(JSON.stringify(o),"*");
const info=()=>send({event:"infoDelivery",info:{playerState:estado,currentTime:t,duration:dur,playbackRate:1}});
addEventListener("message",e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.event==="listening"){send({event:"onReady"});info();return}
  if(m.event!=="command")return;
  if(m.func==="playVideo"){estado=1;clearInterval(timer);timer=setInterval(()=>{t=Math.min(dur,t+0.25);if(t>=dur){estado=0;clearInterval(timer)}info()},250);info()}
  if(m.func==="pauseVideo"||m.func==="stopVideo"){if(estado!==0)estado=2;clearInterval(timer);info()}
  if(m.func==="seekTo"){t=m.args[0];info()}
  if(m.func==="cueVideoById"||m.func==="loadVideoById"){clearInterval(timer);t=0;estado=5;info()}
});</script></body>`;

// Sala do Supabase em memória: mesmas regras das funções de 001_sala.sql.
function salaFalsa(){
  const salas=new Map();let seq=0;
  return(fn,b)=>{
    const s=salas.get(b.p_codigo);
    switch(fn){
      case "karaoke_sala_abrir":
        if(s&&s.token!==b.p_token)return[400,{message:"codigo em uso"}];
        if(!s)salas.set(b.p_codigo,{token:b.p_token,estado:{},versao:0,comandos:[],aparelhos:new Map()});
        return[200,{ok:true}];
      case "karaoke_host_sync":
        if(!s)return[400,{message:"sala nao encontrada"}];
        if(s.token!==b.p_token)return[400,{message:"token incorreto"}];
        if(b.p_estado){s.estado=b.p_estado;s.versao++}
        return[200,{comandos:s.comandos.filter(c=>c.id>(b.p_depois||0)).slice(0,50),aparelhos:s.aparelhos.size}];
      case "karaoke_sala_ver":
        if(!s)return[200,{existe:false}];
        s.aparelhos.set(b.p_device,b.p_nome);
        return[200,{existe:true,versao:s.versao,tela_viva:true,estado:s.versao>b.p_versao?s.estado:null}];
      case "karaoke_comando":
        if(!s)return[400,{message:"sala fechada"}];
        s.comandos.push({id:++seq,device:b.p_device,nome:b.p_nome,tipo:b.p_tipo,dados:b.p_dados||{}});
        return[200,{ok:true}];
      case "karaoke_sala_fechar":salas.delete(b.p_codigo);return[200,null];
    }
    return[404,{message:"Could not find the function"}];
  };
}

(async()=>{
  const wavPath=path.join(SAIDA,"playback.wav");fs.writeFileSync(wavPath,wav(6));
  const browser=await chromium.launch({args:["--autoplay-policy=no-user-gesture-required"]});
  const [LARG,ALT]=(process.env.KARAOKE_VIEWPORT||"1280x720").split("x").map(Number);
  const context=await browser.newContext({viewport:{width:LARG,height:ALT}});
  const sala=salaFalsa();
  await context.route("https://lrclib.net/**",r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(r.request().url().includes("/api/get")?{...LRCLIB[0]}:LRCLIB)}));
  // Busca de vídeos: a primeira instância responde, as outras caem (como no mundo real).
  const BUSCA_FALSA={items:[
    {url:"/watch?v=BUSCAAAAAA1",type:"stream",title:"Evidências (Playback Karaokê)",uploaderName:"Canal Karaokê",duration:215,isShort:false},
    {url:"/watch?v=BUSCAAAAAA2",type:"stream",title:"Evidências — Instrumental",uploaderName:"Outro Canal",duration:230,isShort:false},
    {url:"/watch?v=BLOQUEADO01",type:"stream",title:"Clipe oficial (bloqueado)",uploaderName:"Gravadora",duration:250,isShort:false}]};
  ["https://api.piped.private.coffee","https://pipedapi.kavin.rocks","https://pipedapi.leptons.xyz","https://pipedapi.adminforge.de"].forEach((base,i)=>
    context.route(base+"/search**",r=>i===0?r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(BUSCA_FALSA)}):r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:"{\"erro\":\"fora do ar\"}"})));
  await context.route("https://i.ytimg.com/**",r=>r.fulfill({status:200,contentType:"image/gif",body:Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","base64")}));
  await context.route("https://www.youtube.com/oembed**",r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({title:"Canção de Teste (playback)"})}));
  await context.route("https://www.youtube-nocookie.com/embed/**",r=>r.fulfill({status:200,contentType:"text/html",body:PLAYER_FALSO}));
  await context.route("https://iowuejrpzoibyidiuvpt.supabase.co/rest/v1/rpc/*",async r=>{
    const fn=r.request().url().split("/").pop();
    if(process.env.KARAOKE_SALA_REAL)return r.continue();
    if(r.request().method()==="OPTIONS")return r.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"POST"}});
    // KARAOKE_SALA_REAL=1: deixa passar para o Supabase de verdade (a sala de teste é fechada no fim).
    if(process.env.KARAOKE_SALA_REAL)return r.continue();
    // KARAOKE_SALA_URL: em vez da sala em memória, usa um servidor que fala com um
    // Postgres de verdade rodando 001_sala.sql (ver supabase/teste_sala.sql).
    if(process.env.KARAOKE_SALA_URL){
      const resp=await fetch(`${process.env.KARAOKE_SALA_URL}/rest/v1/rpc/${fn}`,{method:"POST",headers:{"content-type":"application/json"},body:r.request().postData()||"{}"});
      return r.fulfill({status:resp.status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:await resp.text()});
    }
    const[status,body]=sala(fn,JSON.parse(r.request().postData()||"{}"));
    return r.fulfill({status,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(body)});
  });
  const erros=[];
  const page=await context.newPage();
  page.on("pageerror",e=>erros.push("página: "+e.message));
  page.on("dialog",d=>d.accept(d.type()==="prompt"?"Festa de teste":undefined));
  await page.goto(BASE);

  // 1. Família
  await page.click('[data-aba="familia"]');
  for(const [nome,emoji] of [["Vovó","👵"],["Pedro","👦"]]){
    await page.fill("#cantorNome",nome);
    await page.click(`#cantorEmojis [data-emoji="${emoji}"]`);
    await page.click("#cantorSalvar");
  }
  await page.waitForFunction(()=>document.querySelectorAll("#familiaLista li").length===2);

  // 2. Música com arquivo do aparelho
  await page.click('[data-aba="musicas"]');
  await page.click("#btnNovaMusica");
  await page.fill("#buscaLetra","canção de teste");
  await page.click('#formBuscaLetra button[type="submit"]');
  await page.click('[data-resultado="0"]');
  await page.waitForSelector("#dlgMusica[open]");
  await page.click('[data-pb="arquivo"]');
  await page.setInputFiles("#mArquivo",wavPath);
  await page.waitForFunction(()=>document.querySelector("#mPlaybackAtual").textContent.includes("Arquivo"));
  await page.click("#mParaFila");
  await page.waitForSelector("#dlgAddFila[open]");
  assert.match(await page.locator('#addCantores [aria-pressed="true"]').innerText(),/Vovó/,"rodízio começa pela Vovó");
  await page.click("#addDueto");
  await page.click("#addConfirmar");

  // 3. Segunda música com YouTube (mesma letra, outro playback)
  await page.click('[data-aba="musicas"]');
  await page.click("#btnNovaMusica");
  await page.fill("#buscaLetra","canção de teste");
  await page.click('#formBuscaLetra button[type="submit"]');
  await page.click('[data-resultado="0"]');
  await page.waitForSelector("#dlgMusica[open]");
  await page.click("#mLinkDetalhes summary");
  await page.fill("#mLinkYT","https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD");
  await page.click("#mUsarYT");
  await page.waitForFunction(()=>document.querySelector("#mPlaybackAtual").textContent.includes("YouTube"));
  await page.click("#mParaFila");
  await page.waitForSelector("#dlgAddFila[open]");
  assert.match(await page.locator('#addCantores [aria-pressed="true"]').innerText(),/Pedro/,"rodízio: agora é o Pedro");
  await page.click("#addConfirmar");
  await page.waitForFunction(()=>document.querySelectorAll("#filaLista li").length===2);
  await page.screenshot({path:path.join(SAIDA,"playlist.png")});

  // 4. Sala + celular
  await page.click("#btnSala");
  await page.click("#salaAbrir");
  await page.waitForFunction(()=>/^[A-Z0-9]{6}$/.test(document.querySelector("#salaCodigo").textContent));
  const codigo=await page.locator("#salaCodigo").innerText();
  await page.screenshot({path:path.join(SAIDA,"sala.png")});
  await page.keyboard.press("Escape");
  const cel=await context.newPage();
  await cel.setViewportSize({width:390,height:800});
  cel.on("pageerror",e=>erros.push("celular: "+e.message));
  await cel.goto(BASE+"controle.html?sala="+codigo);
  await cel.fill("#ctNome","Tia Carla");
  await cel.click('#ctFormQuem button[type="submit"]');
  await page.waitForFunction(()=>[...document.querySelectorAll("#familiaLista b")].some(b=>b.textContent==="Tia Carla"),null,{timeout:8000});
  await cel.waitForFunction(()=>document.querySelectorAll("#ctFila li[data-item]").length===2,null,{timeout:8000});

  // 5. Palco: arquivo local
  await page.click('[data-aba="playlist"]');
  await page.click("#btnComecar");
  await page.waitForSelector("#palcoVez:not([hidden])");
  assert.match(await page.locator("#vezCantor").innerText(),/Vovó & .*Pedro/);
  await cel.waitForFunction(()=>document.querySelector("#ctFase").textContent.includes("Preparando"),null,{timeout:8000});
  await cel.click("#ctComecar"); // o celular manda começar
  await page.waitForFunction(()=>document.querySelector("#linhaAtual").textContent.includes("Primeira linha"),null,{timeout:8000});
  await page.waitForFunction(()=>document.querySelector("#linhaAtual").textContent.includes("Segunda linha"),null,{timeout:8000});
  assert.match(await page.locator("#linhaParte").innerText(),/Vovó/,"parte A é da Vovó");
  // a linha "enche" palavra por palavra
  await page.waitForFunction(()=>[...document.querySelectorAll("#linhaAtual .w")].some(s=>parseFloat(s.style.getPropertyValue("--p"))>0),null,{timeout:3000});
  await page.waitForFunction(()=>document.querySelector("#linhaParte").textContent.includes("Pedro"),null,{timeout:8000});
  await page.waitForTimeout(450); // deixa a animação de entrada da linha terminar
  await page.screenshot({path:path.join(SAIDA,"palco-dueto.png")});
  await page.waitForSelector("#palcoNota:not([hidden])",{timeout:10000});
  assert.match(await page.locator("#notaTitulo").innerText(),/Aplausos para/);
  await page.screenshot({path:path.join(SAIDA,"palco-nota.png")});

  // 6. Celular pula para a próxima (YouTube falso, modo só som)
  // O padrão é "só o vídeo" (sem letra do app); aqui o teste confere a letra por cima do player.
  await page.evaluate(()=>{prefs().fundo="opaco";aplicarPrefsPalco()});
  await cel.waitForFunction(()=>!document.querySelector("#ctComecar").hidden,null,{timeout:8000});
  await cel.click("#ctComecar");
  await page.waitForSelector("#palcoVez:not([hidden])",{timeout:8000});
  await page.click("#vezComecar");
  await page.waitForFunction(()=>document.querySelector("#palcoSinal").textContent.includes("sincronizado"),null,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector("#linhaAtual").textContent.includes("Segunda linha"),null,{timeout:8000});
  const camadas=await page.evaluate(()=>({fundo:getComputedStyle(document.querySelector("#palcoFundo")).zIndex,cobertura:getComputedStyle(document.querySelector("#palcoCobertura")).zIndex,fundoCob:getComputedStyle(document.querySelector("#palcoCobertura")).backgroundImage}));
  assert.ok(Number(camadas.fundo)<Number(camadas.cobertura),"player do YouTube fica atrás da letra");
  assert.ok(await page.locator("#ytBox iframe").count()===1,"um iframe só");
  await page.screenshot({path:path.join(SAIDA,"palco-youtube-so-som.png")});

  // 7. Celular pausa; letra congela
  await cel.click("#ctTocar");
  await page.waitForFunction(()=>document.querySelector("#palcoTocar").textContent==="▶",null,{timeout:8000});
  await cel.screenshot({path:path.join(SAIDA,"celular.png")});

  // 8. Celular pede música da lista para a Tia Carla
  await cel.click('[data-ct-aba="pedir"]');
  await cel.click("[data-pedir]");
  await cel.waitForSelector("#ctMusicaPainel[open]");
  await cel.click("#ctPnFila");
  await page.waitForFunction(()=>document.querySelector("#palcoTitulo").textContent.includes("/3"),null,{timeout:8000});

  // 8b. Celular: pôr/trocar playback e tocar (painel da música)
  cel.on("dialog",d=>d.accept());
  await page.evaluate(()=>{const m=criarMusica({title:"Sem Som",artist:"Teste",lyrics:"uma\nduas",duration:6});salvarEstado();window.__semSom=m.id});
  const semSom=await page.evaluate(()=>window.__semSom);
  const abrirNoCelular=async nome=>{
    await cel.fill("#ctBusca",nome);
    await cel.waitForFunction(n=>[...document.querySelectorAll("#ctMusicas b")].some(b=>b.textContent===n),nome,{timeout:8000});
    await cel.locator("#ctMusicas li").filter({hasText:nome}).first().locator("button").click();
    await cel.waitForSelector("#ctMusicaPainel[open]");
  };
  await abrirNoCelular("Sem Som");
  assert.match(await cel.locator("#ctPnPlayback").innerText(),/Sem playback/);
  await cel.fill("#ctPnLink","isso não é link");await cel.click("#ctPnUsar");
  await cel.waitForFunction(()=>/Não reconheci/.test(document.querySelector("#ctPnStatus").textContent),null,{timeout:5000});
  await cel.fill("#ctPnLink","https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x");await cel.click("#ctPnUsar");
  await page.waitForFunction(id=>{const m=acharMusica(id);return m&&m.playback&&m.playback.tipo==="youtube"&&m.playback.id==="dQw4w9WgXcQ"},semSom,{timeout:10000});
  await cel.waitForSelector("#ctMusicaPainel",{state:"hidden"});
  assert.equal(await page.evaluate(id=>acharMusica(id)&&P.itens.some(i=>i.musicaId===id),semSom),false,"só trocar o playback não pode pôr na fila");

  // Só o link do YouTube: o celular pede e a tela cria a música com o título do vídeo
  await cel.click('[data-ct-aba="nova"]');
  await cel.fill("#ctLinkRapido","https://youtu.be/dQw4w9WgXcQ");await cel.click('#ctFormLink button[type="submit"]');
  await page.waitForFunction(()=>K.dados.musicas.some(m=>m.title==="Canção de Teste (playback)"&&m.playback&&m.playback.id==="dQw4w9WgXcQ"),null,{timeout:12000});
  await cel.click('[data-ct-aba="pedir"]');

  // Celular liga/desliga a letra do app (mesma sala, mesmo player)
  const fundoAntes=await page.evaluate(()=>prefs().fundo);
  await cel.click("#ctLetra");
  await page.waitForFunction(a=>prefs().fundo!==a,fundoAntes,{timeout:8000});
  await cel.waitForFunction(a=>document.querySelector("#ctLetra").textContent.includes(a==="tela"?"Só o vídeo":"Ligar"),fundoAntes,{timeout:8000});
  await cel.click("#ctLetra");
  await page.waitForFunction(a=>prefs().fundo===a,fundoAntes,{timeout:8000});

  // Busca de vídeos no celular: resultado tocado vira pedido para a tela
  await cel.click('[data-ct-aba="nova"]');
  await cel.fill("#ctLinkRapido","evidências");await cel.click('#ctFormLink button[type="submit"]');
  await cel.waitForSelector('#ctLinkResultados [data-video="BUSCAAAAAA1"]',{timeout:10000});
  await cel.click('#ctLinkResultados [data-video="BUSCAAAAAA1"]');
  await page.waitForFunction(()=>K.dados.musicas.some(m=>m.title==="Evidências (Playback Karaokê)"&&m.playback&&m.playback.id==="BUSCAAAAAA1"),null,{timeout:12000});
  await cel.click('[data-ct-aba="pedir"]');

  // Celular: escolhe a letra e os playbacks já aparecem; tocar num confere e pede para a fila
  const itensAntes=await page.evaluate(()=>playlistAtiva().itens.length);
  await cel.click('[data-ct-aba="nova"]');
  await cel.fill("#ctBuscaNova","canção de teste");await cel.click('#ctFormNova button[type="submit"]');
  await cel.click('[data-res="0"]');
  await cel.waitForSelector('#ctNovaVideos [data-video="BUSCAAAAAA1"]',{timeout:10000});
  await cel.click('#ctNovaVideos [data-video="BUSCAAAAAA1"]');
  await cel.waitForFunction(()=>/Playback escolhido/.test(document.querySelector("#ctNovaPb").textContent),null,{timeout:12000});
  await cel.click("#ctNovaEnviar");
  await page.waitForFunction(n=>playlistAtiva().itens.length>n,itensAntes,{timeout:12000});
  await cel.click('[data-ct-aba="pedir"]');

  // Arquivo guardado na tela não é trocado pelo celular (nem forçando o comando)
  const arquivoId=await page.evaluate(()=>K.dados.musicas.find(m=>m.playback&&m.playback.tipo==="arquivo").id);
  await abrirNoCelular("Canção de Teste");
  assert.match(await cel.locator("#ctPnPlayback").innerText(),/arquivo guardado na tela|Playback atual/);
  await cel.click("#ctPnFechar");
  await cel.evaluate(id=>comando("pedir",{musicaId:id,modo:"playback",playback:{tipo:"youtube",id:"dQw4w9WgXcQ"}}),arquivoId);
  await page.waitForTimeout(3500);
  assert.equal(await page.evaluate(id=>acharMusica(id).playback.tipo,arquivoId),"arquivo","celular trocou o arquivo da tela");

  // Tocar a seguir e Tocar agora
  await abrirNoCelular("Sem Som");
  await cel.click("#ctPnSeguir");
  await page.waitForFunction(id=>P.itens[P.indice+1]&&P.itens[P.indice+1].musicaId===id,semSom,{timeout:8000});
  await abrirNoCelular("Sem Som");
  await cel.click("#ctPnAgora");
  await page.waitForFunction(id=>P.aberto&&P.musica&&P.musica.id===id,semSom,{timeout:8000});

  // Playback que falha: o celular vê o aviso e troca; a tela recarrega sozinha
  await page.evaluate(()=>mostrarErro("O vídeo falhou no teste."));
  await cel.waitForSelector("#ctErroPlayback:not([hidden])",{timeout:8000});
  await cel.click("#ctErroTrocar");
  await cel.waitForSelector("#ctMusicaPainel[open]");
  assert.ok(await cel.locator("#ctPnPedido").isHidden(),"ao trocar o playback da música atual não deve oferecer pedir de novo");
  await cel.fill("#ctPnLink","https://youtu.be/9bZkp7q19f0");await cel.click("#ctPnUsar");
  await page.waitForFunction(()=>P.musica.playback.id==="9bZkp7q19f0"&&document.querySelector("#palcoErro").hidden,null,{timeout:10000});
  await cel.screenshot({path:path.join(SAIDA,"celular-painel.png")});

  // 9. Gravar sincronia tocando (música do arquivo local)
  await page.click("#palcoSair");
  await page.waitForSelector("#palco",{state:"hidden"});
  await page.click('[data-aba="musicas"]');
  await page.locator("#bibliotecaLista li").filter({hasText:"Arquivo"}).first().locator('[data-acao="editar"]').click();
  await page.waitForSelector("#dlgMusica[open]");
  await page.click("#mGravar");
  await page.waitForSelector("#gravarPainel:not([hidden])");
  await page.click("#gravarMarcar"); // primeiro toque: começa o playback
  await page.waitForFunction(()=>P.fonte.tocando());
  for(let i=0;i<3;i++){await page.waitForTimeout(700);await page.keyboard.press(" ")}
  await page.waitForFunction(()=>!document.querySelector("#gravarSalvar").disabled);
  await page.click("#gravarSalvar");
  await page.waitForFunction(()=>P.modo==="ensaio"&&/\[00:0\d\.\d\d\]/.test(P.musica.synced));
  const gravada=await page.evaluate(()=>lerLetra(P.musica.synced).linhas.map(l=>[l.texto,l.parte]));
  assert.deepEqual(gravada.map(x=>x[0]),["Primeira linha da canção","Segunda linha cantada","Terceira linha do dueto"]);
  assert.deepEqual(gravada.map(x=>x[1]),["","A","B"],"dueto preservado na sincronia gravada");
  await page.screenshot({path:path.join(SAIDA,"ensaio-depois-de-gravar.png")});
  await page.click("#palcoSair");

  // 10. Sem erros de página e versão em mobile
  const mob=await context.newPage();
  await mob.setViewportSize({width:390,height:844});
  await mob.goto(BASE);
  await mob.screenshot({path:path.join(SAIDA,"celular-tela-principal.png")});
  // Fecha a sala (testa o botão e não deixa sala de teste para trás no banco).
  await page.click("#btnSala");
  // Espera a resposta do servidor: a tela atualiza antes, e fechar o navegador antes disso deixaria a sala no banco.
  const fechou=process.env.KARAOKE_SALA_REAL?page.waitForResponse(r=>r.url().includes("karaoke_sala_fechar"),{timeout:8000}):null;
  await page.click("#salaFechar");
  if(fechou)await fechou;
  await page.waitForFunction(()=>document.querySelector("#salaFechada")&&!document.querySelector("#salaFechada").hidden,null,{timeout:8000});
  assert.deepEqual(erros,[]);
  await browser.close();
  console.log("OK — teste de navegador passou. Screenshots em",SAIDA);
})().catch(async e=>{console.error("FALHOU:",e);process.exit(1)});
