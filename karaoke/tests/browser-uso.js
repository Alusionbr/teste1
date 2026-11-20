"use strict";
/*
 * Teste de navegador por cenários de USO (o browser-smoke.js cobre o caminho
 * feliz; este cobre o que só aparece usando de verdade). Cada cenário nasceu de
 * um bug achado testando o app com YouTube e Spotify reais em 20/11/2026:
 *
 *  - o botão ✕ ficava coberto nas telas "a vez de…", aplausos, fim e erro;
 *  - seta para a direita na barra de progresso trocava de música;
 *  - fim da prévia de 30 s do Spotify virava "fim da música" (ia para os aplausos);
 *  - "Seguir sem playback" recomeçava a letra do zero;
 *  - clipe bloqueado fora do YouTube só era descoberto na hora de tocar.
 *
 * Sem internet de verdade: YouTube e Spotify são páginas falsas servidas nas
 * origens verdadeiras (route do Playwright), então a conferência de origem do app vale.
 *
 * Uso:
 *   python3 -m http.server 8765 -d karaoke     (em outro terminal)
 *   node karaoke/tests/browser-uso.js [pasta-para-arquivos-temporários]
 */
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const assert=require("node:assert/strict");
const {chromium}=require("playwright");

const BASE=process.env.KARAOKE_URL||"http://127.0.0.1:8765/";
const SAIDA=process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),"karaoke-uso-"));
const BLOQUEADO="BLOQUEADO01";   // id de 11 caracteres que o player falso recusa com erro 150

const YOUTUBE_FALSO=`<!doctype html><body>player falso<script>
let bloqueado=location.pathname.includes("${BLOQUEADO}");
const send=o=>parent.postMessage(JSON.stringify(o),"*");
// Player que toca de verdade (relógio de 250 ms, vídeo de 5 min), para testar letra liga/desliga.
let estado=-1,t=0,timer=null;
const info=()=>send({event:"infoDelivery",info:{playerState:estado,currentTime:t,duration:300,playbackRate:1}});
addEventListener("message",e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.event==="listening"){send({event:"initialDelivery",info:{apiInterface:[]}});send({event:"onReady"});if(bloqueado)send({event:"onError",info:150});else info();return}
  if(m.event!=="command")return;
  // O app reaproveita o mesmo iframe com cue/loadVideoById: o vídeo atual muda sem recarregar a página.
  if(m.func==="cueVideoById"||m.func==="loadVideoById"){bloqueado=String(m.args[0]).includes("${BLOQUEADO}");clearInterval(timer);t=0;estado=5;if(bloqueado)send({event:"onError",info:150});else info();return}
  if(bloqueado)return;
  if(m.func==="playVideo"){estado=1;clearInterval(timer);timer=setInterval(()=>{t+=0.25;info()},250);info()}
  if(m.func==="pauseVideo"||m.func==="stopVideo"){estado=2;clearInterval(timer);info()}
  if(m.func==="seekTo"){t=m.args[0];info()}
});</script></body>`;

// Spotify falso: toca 30 s de "prévia" em velocidade 5x e para, como o de verdade sem login.
const SPOTIFY_FALSO=`<!doctype html><body>spotify falso<script>
let pos=0,dur=30000,timer=null;
const send=o=>parent.postMessage(o,"*");
const upd=(p)=>send({type:"playback_update",payload:{isPaused:p,isBuffering:false,position:pos,duration:dur}});
addEventListener("message",e=>{const m=e.data;if(!m)return;
  if(m.command==="play"||m.command==="resume"){clearInterval(timer);timer=setInterval(()=>{pos=Math.min(dur,pos+500);const fim=pos>=dur;upd(fim);if(fim)clearInterval(timer)},100)}
  if(m.command==="pause"){clearInterval(timer);upd(true)}
});
send({type:"ready"});</script></body>`;

const ok=(c,msg)=>{if(!c)throw Error(msg)};
const resultados=[];
let page=null;

async function limpar(){
  try{if(await page.locator("#palco:not([hidden])").count())await page.click("#palcoSair",{timeout:3000})}catch{}
  try{await page.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>d.close()))}catch{}
}
async function cenario(nome,fn,{encadeado=false}={}){
  if(!encadeado)await limpar();
  try{const r=await fn();resultados.push(true);console.log("  ✓",nome,r?"— "+r:"")}
  catch(e){
    resultados.push(false);console.log("  ✗",nome,"—",String(e.message).split("\n")[0]);
    try{console.log("    estado do palco:",JSON.stringify(await page.evaluate(()=>({aberto:P.aberto,fase:P.fase,modo:P.modo,musica:P.musica&&P.musica.title,pb:P.musica&&P.musica.playback&&P.musica.playback.id,fonte:P.fonte&&P.fonte.constructor===Object?(P.fonte===FonteYouTube?"youtube":P.fonte===FonteRelogio?"relogio":"outra"):"",erro:document.querySelector("#palcoErro").hidden?"":document.querySelector("#erroTexto").textContent}))))}catch{}
  }
}
const aba=a=>page.click(`[data-aba="${a}"]`);
async function novaManual(titulo,letra,dur){
  await aba("musicas");await page.click("#btnNovaMusica");
  await page.fill("#buscaLetra",titulo);await page.click("#btnMusicaManual");
  await page.waitForSelector("#dlgMusica[open]");
  if(letra)await page.fill("#mLetra",letra);
  if(dur)await page.fill("#mDuracao",dur);
  await page.click("#mSalvar");
  await page.waitForSelector("#dlgMusica",{state:"hidden"});
}

(async()=>{
  const browser=await chromium.launch({args:["--autoplay-policy=no-user-gesture-required","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]});
  const ctx=await browser.newContext({viewport:{width:1280,height:720},acceptDownloads:true,permissions:["microphone"]});
  await ctx.route("https://www.youtube-nocookie.com/embed/**",r=>r.fulfill({status:200,contentType:"text/html",body:YOUTUBE_FALSO}));
  await ctx.route("https://open.spotify.com/embed/track/**",r=>r.fulfill({status:200,contentType:"text/html",body:SPOTIFY_FALSO}));
  await ctx.route("https://open.spotify.com/oembed**",r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({title:"Faixa de teste"})}));
  await ctx.route("https://www.youtube.com/oembed**",r=>r.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({title:"Vídeo de teste"})}));
  // Busca de vídeos: a primeira instância responde, as outras caem (como no mundo real).
  const BUSCA_FALSA={items:[
    {url:"/watch?v=BUSCAAAAAA1",type:"stream",title:"Evidências (Playback Karaokê)",uploaderName:"Canal Karaokê",duration:215,isShort:false},
    {url:"/watch?v=BUSCAAAAAA2",type:"stream",title:"Evidências — Instrumental",uploaderName:"Outro Canal",duration:230,isShort:false},
    {url:"/watch?v=BLOQUEADO01",type:"stream",title:"Clipe oficial (bloqueado)",uploaderName:"Gravadora",duration:250,isShort:false}]};
  const CORS={"access-control-allow-origin":"*","access-control-allow-headers":"*"};
  const SO_BLOQUEADO={items:[BUSCA_FALSA.items[2]]};
  ["https://api.piped.private.coffee","https://pipedapi.kavin.rocks","https://pipedapi.leptons.xyz","https://pipedapi.adminforge.de"].forEach((base,i)=>
    ctx.route(base+"/search**",r=>{
      if(i!==0)return r.fulfill({status:200,contentType:"application/json",headers:CORS,body:"{\"erro\":\"fora do ar\"}"});
      const q=(new URL(r.request().url()).searchParams.get("q")||"").toLowerCase();
      // "bloqueada": só o clipe que não toca fora do YouTube; "nada": busca sem resultado
      const corpo=/bloqueada/.test(q)?SO_BLOQUEADO:/\bnada\b/.test(q)?{items:[]}:BUSCA_FALSA;
      r.fulfill({status:200,contentType:"application/json",headers:CORS,body:JSON.stringify(corpo)});
    }));
  // Letra: LRCLIB falso. Música com "nada" no nome não tem letra.
  const LETRA_FALSA={trackName:"Evidências",artistName:"Chitãozinho e Xororó",albumName:"Álbum",duration:215,instrumental:false,syncedLyrics:"[00:01.00]primeira linha\n[00:05.00]segunda linha",plainLyrics:"primeira linha\nsegunda linha"};
  await ctx.route("https://api.lyrics.ovh/**",r=>r.fulfill({status:404,headers:CORS,contentType:"application/json",body:"{}"}));
  await ctx.route("https://lrclib.net/api/**",r=>{
    const u=r.request().url(),semLetra=/nada/i.test(decodeURIComponent(u));
    if(/\/api\/get\?/.test(u))return r.fulfill(semLetra?{status:404,headers:CORS,contentType:"application/json",body:"{}"}:{status:200,headers:CORS,contentType:"application/json",body:JSON.stringify(LETRA_FALSA)});
    r.fulfill({status:200,headers:CORS,contentType:"application/json",body:JSON.stringify(semLetra?[]:[LETRA_FALSA])});
  });
  // Miniaturas dos resultados (ids falsos): sem rede de verdade.
  await ctx.route("https://i.ytimg.com/**",r=>r.fulfill({status:200,contentType:"image/gif",body:Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","base64")}));
  page=await ctx.newPage();
  const erros=[];
  page.on("pageerror",e=>erros.push("página: "+e.message));
  page.on("console",m=>{
    if(m.type()!=="error")return;
    const url=(m.location()&&m.location().url)||"";
    if(/ERR_FAILED/.test(m.text())&&/\/search\?q=/.test(url))return;   // busca fora do ar simulada de propósito
    if(/status of 404/.test(m.text())&&/lrclib\.net\/api\/get|api\.lyrics\.ovh/.test(url))return;   // "sem letra" simulado de propósito
    erros.push("console: "+m.text().slice(0,160)+" "+url);
  });
  page.on("dialog",d=>d.accept(d.type()==="prompt"?(d.defaultValue()||"Teste"):undefined));
  await page.goto(BASE);
  console.log("Cenários de uso:");

  await cenario("primeira abertura: vazio e sem erros",async()=>{
    ok(await page.locator("#filaVazia").isVisible(),"passos de início não aparecem");
    ok(await page.locator("#btnComecar").isDisabled(),"Começar deveria estar desligado");
  });

  await cenario("letra simples sem playback: relógio anda, pausa para, [Refrão] aparece",async()=>{
    await novaManual("Parabéns pra Você","Parabéns pra você\n[Refrão]\nMuitos anos de vida","0:40");
    await page.locator("#bibliotecaLista li").first().locator('[data-acao="ensaiar"]').click();
    await page.waitForSelector("#palco:not([hidden])");
    await page.waitForFunction(()=>!document.querySelector("#letraCorrida").hidden);
    ok(/Refrão/.test(await page.locator("#letraCorrida").innerText()),"o [Refrão] da letra sumiu");
    await page.waitForFunction(()=>P.fonte.tocando()&&P.fonte.tempo()>1);
    await page.click("#palcoTocar");await page.waitForTimeout(500);
    const a=await page.evaluate(()=>P.fonte.tempo());await page.waitForTimeout(600);
    const b=await page.evaluate(()=>P.fonte.tempo());
    ok(Math.abs(b-a)<0.05,"pausa não parou o relógio");
  });

  await cenario("HTML no título e na letra não é executado",async()=>{
    await novaManual('<img src=x onerror="window.__xss=1"> Hack','<script>window.__xss=2</script>\n<b onmouseover="window.__xss=3">negrito</b>',"0:30");
    await aba("musicas");
    const imgs=await page.locator("#bibliotecaLista img").count();
    await page.locator("#bibliotecaLista li").filter({hasText:"Hack"}).locator('[data-acao="ensaiar"]').click();
    await page.waitForSelector("#palco:not([hidden])");await page.waitForTimeout(400);
    const x=await page.evaluate(()=>window.__xss),dentro=await page.locator("#palco img, #letraCorrida b").count();
    ok(!x&&!imgs&&!dentro,"HTML injetado foi interpretado");
  });

  await cenario("família, playlist e rodízio",async()=>{
    await aba("familia");
    for(const [n,e] of [["Ana","👧"],["Beto","👦"]]){await page.fill("#cantorNome",n);await page.click(`#cantorEmojis [data-emoji="${e}"]`);await page.click("#cantorSalvar")}
    await novaManual("Música A","um\ndois","0:04");await novaManual("Música B","tres\nquatro","0:04");await novaManual("Música C","cinco\nseis","0:04");
    for(const nome of ["Música A","Música B","Música C"]){
      await aba("musicas");
      await page.locator("#bibliotecaLista li").filter({hasText:nome}).locator('[data-acao="paraFila"]').click();
      await page.waitForSelector("#dlgAddFila[open]");await page.click("#addConfirmar");await page.waitForSelector("#dlgAddFila",{state:"hidden"});
    }
    await aba("playlist");
    const quem=(await page.locator("#filaLista .quem").allInnerTexts()).map(s=>s.replace(/\s+/g," ").trim());
    ok(quem.length===3&&/Ana/.test(quem[0])&&/Beto/.test(quem[1])&&/Ana/.test(quem[2]),"rodízio inesperado: "+quem.join(" | "));
  });

  await cenario("✕ sai do palco em TODAS as telas de cobertura (vez, aplausos, fim)",async()=>{
    for(const tela of ["vez","nota","fim"]){
      await page.click("#btnComecar");await page.waitForSelector("#palcoVez:not([hidden])");
      if(tela!=="vez")await page.click("#vezComecar");
      if(tela==="nota")await page.waitForSelector("#palcoNota:not([hidden])",{timeout:15000});
      if(tela==="fim"){await page.evaluate(()=>mostrarFim());await page.waitForSelector("#palcoFim:not([hidden])")}
      await page.click("#palcoSair",{timeout:3000}).catch(()=>{throw Error("o ✕ está coberto na tela '"+tela+"'")});
      await page.waitForSelector("#palco",{state:"hidden"});
    }
  });

  await cenario("Enter e Espaço em botão focado acionam uma vez só",async()=>{
    await page.click("#btnComecar");await page.waitForSelector("#palcoVez:not([hidden])");await page.click("#vezComecar");
    await page.waitForSelector("#palcoNota:not([hidden])",{timeout:15000});
    const antes=await page.evaluate(()=>P.indice);
    await page.focus("#notaProxima");await page.keyboard.press("Enter");await page.waitForTimeout(500);
    ok((await page.evaluate(()=>P.indice))===antes+1,"Enter pulou mais de uma música");
    await page.waitForSelector("#palcoVez:not([hidden])");await page.click("#vezComecar");
    await page.waitForFunction(()=>P.fase==="cantando");
    await page.focus("#palcoTocar");
    const t0=await page.evaluate(()=>P.fonte.tocando());
    await page.keyboard.press("Space");await page.waitForTimeout(300);
    ok(t0!==(await page.evaluate(()=>P.fonte.tocando())),"Espaço no botão focado acionou duas vezes");
  },{encadeado:true});

  await cenario("setas na barra de progresso não trocam de música",async()=>{
    await page.waitForFunction(()=>P.fase==="cantando");
    const antes=await page.evaluate(()=>P.indice);
    await page.focus("#palcoProgresso");await page.keyboard.press("ArrowRight");await page.waitForTimeout(300);
    ok((await page.evaluate(()=>P.indice))===antes,"a seta trocou de música");
  },{encadeado:true});

  await cenario("aplausômetro com microfone falso dá nota",async()=>{
    await limpar();
    await page.click("#btnComecar");await page.click("#vezComecar");
    await page.waitForSelector("#palcoNota:not([hidden])",{timeout:15000});
    await page.click("#notaMedir");
    await page.waitForFunction(()=>/pontos/.test(document.querySelector("#notaResultado").textContent),null,{timeout:12000});
  });

  let backup;
  await cenario("backup: exporta, Adicionar não duplica, Substituir restaura, arquivo ruim é recusado",async()=>{
    await limpar();await aba("musicas");
    const antes=await page.locator("#bibliotecaLista li").count();
    await aba("ajustes");
    const [dl]=await Promise.all([page.waitForEvent("download"),page.click("#btnExportar")]);
    backup=path.join(SAIDA,"backup.json");await dl.saveAs(backup);
    ok(!/keyYT|audioDelay/.test(fs.readFileSync(backup,"utf8")),"o backup leva preferências do aparelho");
    await page.setInputFiles("#arquivoImportar",backup);await page.waitForSelector("#dlgImportar[open]");
    await page.click("#importarAdicionar");await page.waitForSelector("#dlgImportar",{state:"hidden"});
    await aba("musicas");ok((await page.locator("#bibliotecaLista li").count())===antes,"Adicionar duplicou músicas");
    await aba("ajustes");await page.setInputFiles("#arquivoImportar",backup);await page.waitForSelector("#dlgImportar[open]");
    await page.click("#importarSubstituir");await page.waitForSelector("#dlgImportar",{state:"hidden"});
    await aba("playlist");ok((await page.locator("#filaLista li").count())===3,"Substituir perdeu a playlist");
    const ruim=path.join(SAIDA,"ruim.json");fs.writeFileSync(ruim,'{"foo":1');
    await aba("ajustes");await page.setInputFiles("#arquivoImportar",ruim);
    await page.waitForSelector("#aviso .aviso");
    ok(/backup/i.test(await page.locator("#aviso").innerText()),"mensagem de arquivo inválido confusa");
    ok(!(await page.locator("#dlgImportar[open]").count()),"abriu o diálogo com arquivo inválido");
  });

  await cenario("link de compartilhar é aceito por outro navegador",async()=>{
    await aba("playlist");await page.click("#btnCompartilhar");
    await page.waitForFunction(()=>/#playlist/.test(document.querySelector("#compLink").value));
    const link=await page.inputValue("#compLink");await page.keyboard.press("Escape");
    const c2=await browser.newContext({viewport:{width:390,height:844}});
    const p2=await c2.newPage();const e2=[];p2.on("pageerror",e=>e2.push(e.message));
    await p2.goto(link);await p2.waitForSelector("#dlgImportar[open]");
    await p2.click("#importarAdicionar");
    await p2.waitForFunction(()=>document.querySelectorAll("#filaLista li").length===3,null,{timeout:6000});
    await c2.close();ok(!e2.length,"erros: "+e2.join(","));
  });

  await cenario("offline: depois da primeira visita o app abre sem internet",async()=>{
    await page.goto(BASE);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForTimeout(1500);
    await page.reload();await page.waitForTimeout(800);
    await ctx.setOffline(true);
    try{await page.reload();await page.waitForSelector("#filaLista li",{timeout:8000})}finally{await ctx.setOffline(false)}
  });

  await cenario("YouTube: clipe bloqueado é recusado ao escolher; vídeo liberado é aceito",async()=>{
    await limpar();await aba("musicas");
    await page.locator("#bibliotecaLista li").filter({hasText:"Música A"}).locator('[data-acao="editar"]').click();
    await page.waitForSelector("#dlgMusica[open]");
    await page.click("#mLinkDetalhes summary");   // o link fica recolhido: a busca é o caminho principal
    await page.fill("#mLinkYT","https://youtu.be/"+BLOQUEADO);await page.click("#mUsarYT");
    await page.waitForFunction(()=>/Escolha outro v/.test(document.querySelector("#aviso").textContent),null,{timeout:12000});
    ok(/Sem playback/.test(await page.locator("#mPlaybackAtual").innerText()),"gravou o vídeo bloqueado");
    await page.fill("#mLinkYT","https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x");await page.click("#mUsarYT");
    await page.waitForFunction(()=>/YouTube/.test(document.querySelector("#mPlaybackAtual").textContent),null,{timeout:12000});
    await page.click("#mSalvar");
  });

  await cenario("YouTube bloqueado na hora de tocar: aviso com ✕, trocar e seguir sem playback",async()=>{
    await limpar();await aba("musicas");
    await page.locator("#bibliotecaLista li").filter({hasText:"Música B"}).locator('[data-acao="editar"]').click();
    await page.waitForSelector("#dlgMusica[open]");
    // grava direto o id bloqueado (como um backup antigo ou um link recebido faria)
    await page.evaluate(b=>{editarMusica(ED.id,{playback:{tipo:"youtube",id:b,titulo:""}});atualizarEditor()},BLOQUEADO);
    await page.click("#mEnsaiar");await page.waitForSelector("#palcoErro:not([hidden])",{timeout:10000});
    ok(/bloqueou/.test(await page.locator("#erroTexto").innerText()),"texto do erro");
    await page.click("#palcoSair",{timeout:3000});
  });

  await cenario("Spotify: prévia de 30 s avisa, não vai para os aplausos e a letra continua de onde parou",async()=>{
    await limpar();await aba("musicas");
    await page.locator("#bibliotecaLista li").filter({hasText:"Música C"}).locator('[data-acao="editar"]').click();
    await page.waitForSelector("#dlgMusica[open]");
    await page.fill("#mDuracao","4:00");
    await page.fill("#mLetra","[00:05.00]primeiro\n[00:40.00]segundo\n[01:00.00]terceiro");
    await page.click('[data-pb="spotify"]');
    await page.fill("#mLinkSP","https://open.spotify.com/intl-pt/track/4cOdK2wGLETKBW3PvgPWqT?si=x");
    await page.click("#mUsarSP");
    await page.waitForFunction(()=>/Spotify/.test(document.querySelector("#mPlaybackAtual").textContent));
    await page.click("#mEnsaiar");await page.waitForSelector("#palco:not([hidden])");
    await page.waitForFunction(()=>!document.querySelector("#palcoErro").hidden,null,{timeout:20000});
    ok(/prévia/.test(await page.locator("#erroTexto").innerText()),"o aviso não fala da prévia");
    ok(await page.locator("#palcoNota").isHidden(),"foi para os aplausos no meio da música");
    await page.click("#erroRelogio");
    await page.waitForFunction(()=>P.fonte===FonteRelogio&&P.fonte.tempo()>=29,null,{timeout:5000}).catch(()=>{throw Error("a letra recomeçou do zero em vez de continuar aos 30 s")});
  });

  // As músicas A/B/C já têm playback falso nos cenários acima; o solo usa músicas só com relógio.
  await cenario("cantar sozinho (uma música): sem cantor, nota, recorde, cantar de novo, selo 🏆",async()=>{
    await novaManual("Solo Um","um\ndois","0:04");await novaManual("Solo Dois","tres\nquatro","0:04");
    await aba("musicas");
    await page.locator("#bibliotecaLista li").filter({hasText:"Solo Um"}).locator('[data-acao="solo"]').click();
    await page.waitForSelector("#palcoVez:not([hidden])");
    const vez=await page.locator("#vezCantor").innerText();
    ok(/Prepare-se/.test(vez)&&!/Ana|Beto/.test(vez),"tela de preparo mostrou cantor: "+vez);
    ok(/Você/.test(await page.locator("#palcoCantor").innerText()),"selo do palco não diz Você");
    await page.click("#vezComecar");
    await page.waitForSelector("#palcoNota:not([hidden])",{timeout:15000});
    ok(await page.locator("#notaDeNovo").isVisible(),"falta o botão Cantar de novo");
    await page.click("#notaMedir");
    await page.waitForFunction(()=>/pontos/.test(document.querySelector("#notaResultado").textContent),null,{timeout:12000});
    ok(/Primeira nota/.test(await page.locator("#notaRecorde").innerText()),"primeira nota não foi reconhecida");
    await page.click("#notaDeNovo");
    await page.waitForFunction(()=>P.fase==="cantando"&&P.indice===0);
    await page.waitForSelector("#palcoNota:not([hidden])",{timeout:15000});
    ok(/recorde/i.test(await page.locator("#notaRecorde").innerText()),"recorde antigo não apareceu ao voltar para a nota");
    await page.click("#notaMedir");
    await page.waitForFunction(()=>/pontos/.test(document.querySelector("#notaResultado").textContent),null,{timeout:12000});
    ok(/recorde/i.test(await page.locator("#notaRecorde").innerText()),"segunda nota sem linha de recorde");
    ok((await page.evaluate(()=>K.dados.placar.length))===2,"as duas notas não foram guardadas");
    await page.click("#notaProxima");
    await page.waitForSelector("#palcoFim:not([hidden])");
    ok(/Fim da música/.test(await page.locator("#palcoFim .vezCantor").innerText()),"fim de música avulsa");
    await page.click("#palcoSair");await page.waitForSelector("#palco",{state:"hidden"});
    ok(await page.locator("#bibliotecaLista li").filter({hasText:"Solo Um"}).locator(".selo.recorde").count()===1,"sem selo 🏆 na biblioteca");
  });

  await cenario("cantar sozinho (playlist): ignora os cantores marcados e segue para a próxima",async()=>{
    await aba("playlist");await page.click("#btnNovaPlaylist");await page.waitForTimeout(200);
    for(const nome of ["Solo Um","Solo Dois"]){
      await aba("musicas");
      await page.locator("#bibliotecaLista li").filter({hasText:nome}).locator('[data-acao="paraFila"]').click();
      await page.waitForSelector("#dlgAddFila[open]");await page.click("#addConfirmar");await page.waitForSelector("#dlgAddFila",{state:"hidden"});
    }
    await aba("playlist");
    ok(/Ana|Beto/.test((await page.locator("#filaLista .quem").allInnerTexts()).join(" ")),"a playlist de teste deveria ter cantores marcados");
    await page.click("#btnSolo");
    await page.waitForSelector("#palcoVez:not([hidden])");
    ok(/Prepare-se/.test(await page.locator("#vezCantor").innerText()),"mostrou a vez de alguém");
    await page.click("#vezComecar");
    await page.waitForSelector("#palcoNota:not([hidden])",{timeout:15000});
    ok(!/Ana|Beto/.test(await page.locator("#notaTitulo").innerText()+await page.locator("#notaProximoInfo").innerText()),"nota citou cantor");
    await page.click("#notaProxima");
    await page.waitForFunction(()=>P.indice===1&&P.solo);
    ok(/Você/.test(await page.locator("#palcoCantor").innerText()),"segunda música sem selo Você");
  });

  await cenario("placar entra no backup e Apagar meu placar zera",async()=>{
    await limpar();
    ok((await page.evaluate(()=>JSON.parse(backupJSON()).placar.length))>=2,"placar fora do backup");
    await aba("ajustes");await page.click("#btnLimparPlacar");
    await page.waitForFunction(()=>K.dados.placar.length===0);
    await aba("musicas");
    ok(await page.locator("#bibliotecaLista .selo.recorde").count()===0,"selo 🏆 continua depois de apagar");
  });

  await cenario("só o link do YouTube entra na playlist; o modo 'só o vídeo' esconde a letra do app",async()=>{
    await aba("musicas");await page.click("#btnNovaMusica");
    await page.fill("#novaLinkYT","https://exemplo.com/video");await page.click("#formNovaLink button[type=submit]");
    await page.waitForFunction(()=>/Não reconheci/.test(document.querySelector("#buscaStatus").textContent));
    await page.fill("#novaLinkYT","https://music.youtube.com/watch?v=dQw4w9WgXcQ");await page.click("#formNovaLink button[type=submit]");
    await page.waitForSelector("#dlgNovaMusica",{state:"hidden",timeout:12000});
    const li=page.locator("#filaLista li").filter({hasText:"Vídeo de teste"});
    ok(await li.count()===1,"a música do link não entrou na playlist com o título do vídeo");
    await aba("ajustes");await page.selectOption("#prefFundo","tela");
    await aba("playlist");
    await li.locator('[data-acao="tocarItem"]').click();
    await page.waitForSelector("#palcoVez:not([hidden])");await page.click("#vezComecar");
    await page.waitForFunction(()=>P.fase==="cantando"&&P.fonte===FonteYouTube);
    const v=await page.evaluate(()=>{const d=id=>getComputedStyle(document.getElementById(id)).display,r=document.getElementById("palcoFundo").getBoundingClientRect();return{letra:d("palcoLetra"),cob:d("palcoCobertura"),alto:r.height,topo:r.top}});
    ok(v.letra==="none"&&v.cob==="none","a letra do app ou a cobertura continuam na frente do vídeo");
    ok(v.alto>=700&&v.topo===0,"o vídeo não ocupa o palco inteiro: "+JSON.stringify(v));
    await page.click("#palcoSair");await aba("ajustes");await page.selectOption("#prefFundo","opaco");
  });

  await cenario("letra do app liga e desliga sem recarregar o vídeo; só o player fica na tela; o YouTube não é clicável",async()=>{
    await aba("ajustes");await page.selectOption("#prefFundo","tela");
    await aba("musicas");
    await page.locator("#bibliotecaLista li").filter({hasText:"Vídeo de teste"}).first().locator('[data-acao="ensaiar"]').click();
    await page.waitForFunction(()=>P.fase==="cantando"&&P.fonte===FonteYouTube&&P.fonte.tocando(),null,{timeout:15000});
    const antes=await page.evaluate(()=>{window.__yt=document.querySelector("#ytBox iframe");return{src:window.__yt.src,t:P.fonte.tempo()}});
    ok(/controls=0/.test(antes.src)&&/disablekb=1/.test(antes.src),"o player ainda mostra os controles do YouTube");
    ok((await page.evaluate(()=>getComputedStyle(window.__yt).pointerEvents))==="none","o player do YouTube é clicável (a TV poderia sair da sala)");
    // só o player: depois de 4 s parado somem as barras
    await page.mouse.move(5,5);await page.waitForTimeout(4600);
    ok((await page.evaluate(()=>getComputedStyle(document.querySelector("#palcoTopo")).opacity))==="0","a barra do topo continua na tela");
    // liga a letra (botão e tecla L): o vídeo não pode ser recarregado nem parar
    await page.keyboard.press("l");
    await page.waitForFunction(()=>prefs().fundo!=="tela");
    ok(await page.evaluate(()=>getComputedStyle(document.querySelector("#palcoLetra")).display!=="none"),"a letra não voltou");
    await page.waitForFunction(()=>document.querySelector("#linhaAtual").textContent.length>0||!document.querySelector("#letraCorrida").hidden,null,{timeout:5000});
    const meio=await page.evaluate(()=>({mesmo:document.querySelector("#ytBox iframe")===window.__yt,src:window.__yt.src,tocando:P.fonte.tocando(),t:P.fonte.tempo()}));
    ok(meio.mesmo&&meio.src===antes.src,"o iframe do vídeo foi recriado ao ligar a letra");
    ok(meio.tocando&&meio.t>=antes.t,"o vídeo parou ou voltou ao ligar a letra");
    await page.click("#palcoLetraBtn");
    await page.waitForFunction(()=>prefs().fundo==="tela");
    const fim=await page.evaluate(()=>({mesmo:document.querySelector("#ytBox iframe")===window.__yt,tocando:P.fonte.tocando()}));
    ok(fim.mesmo&&fim.tocando,"desligar a letra atrapalhou o vídeo");
    await page.click("#palcoSair");await aba("ajustes");await page.selectOption("#prefFundo","opaco");
  });

  await cenario("buscar vídeo no YouTube sem chave: Nova música e editor",async()=>{
    await aba("musicas");await page.click("#btnNovaMusica");
    await page.fill("#novaLinkYT","evidências");await page.click("#novaVerOpcoes");
    await page.waitForSelector("#novaVideos [data-video]",{timeout:10000});
    ok(await page.locator("#novaVideos [data-video]").count()===3,"deveria listar os 3 vídeos");
    ok(/serviço público/.test(await page.locator("#buscaStatus").innerText()),"não diz de onde vieram os resultados");
    await page.click('#novaVideos [data-video="BLOQUEADO01"]');
    await page.waitForFunction(()=>/Escolha outro v/.test(document.querySelector("#buscaStatus").textContent),null,{timeout:12000});
    await page.click('#novaVideos [data-video="BUSCAAAAAA1"]');
    await page.waitForSelector("#dlgNovaMusica",{state:"hidden",timeout:12000});
    ok(await page.evaluate(()=>K.dados.musicas.some(m=>m.playback&&m.playback.id==="BUSCAAAAAA1"&&m.title==="Evidências (Playback Karaokê)")),"a música do resultado não foi criada");
    // editor: música sem playback já abre com os vídeos listados, sem pedir link nem buscar
    await aba("musicas");
    await page.locator("#bibliotecaLista li").filter({hasText:"Solo Dois"}).locator('[data-acao="editar"]').click();
    await page.waitForSelector("#dlgMusica[open]");
    await page.waitForSelector("#mVideos [data-video]",{timeout:10000});
    ok(/playback karaokê/.test(await page.inputValue("#mBuscaYT")),"o campo de busca não veio preenchido");
    ok(!(await page.evaluate(()=>document.querySelector("#mLinkDetalhes").open)),"o campo de link deveria vir recolhido");
    await page.click('#mVideos [data-video="BLOQUEADO01"]');
    await page.waitForFunction(()=>/Escolha outro v/.test(document.querySelector("#aviso").textContent),null,{timeout:12000});
    await page.click('#mVideos [data-video="BUSCAAAAAA2"]');
    await page.waitForFunction(()=>{const m=K.dados.musicas.find(x=>x.title==="Solo Dois");return m&&m.playback&&m.playback.id==="BUSCAAAAAA2"},null,{timeout:12000});
  });

  await cenario("editor: duração parecida vem primeiro; se a busca cair, o link e o atalho externo aparecem",async()=>{
    // duração da letra 3:35 (215 s): o vídeo de 215 s ganha o selo e vai para o topo
    await page.evaluate(()=>{const m=K.dados.musicas.find(x=>x.title==="Solo Um");editarMusica(m.id,{duration:230,playback:null});salvarEstado()});
    await aba("musicas");
    await page.locator("#bibliotecaLista li").filter({hasText:"Solo Um"}).locator('[data-acao="editar"]').click();
    await page.waitForSelector("#mVideos [data-video]",{timeout:10000});
    ok(await page.locator("#mVideos .selo.ok").count()>=1,"nenhum vídeo ganhou o selo de duração parecida");
    ok((await page.locator("#mVideos [data-video]").first().getAttribute("data-video"))==="BUSCAAAAAA2","o vídeo de duração parecida deveria vir primeiro");
    await page.evaluate(()=>document.querySelector("#dlgMusica").close());
    // busca fora do ar: nenhuma instância responde
    const bases=["https://api.piped.private.coffee","https://pipedapi.kavin.rocks","https://pipedapi.leptons.xyz","https://pipedapi.adminforge.de"];
    for(const b of bases)await page.route(b+"/search**",r=>r.abort());
    await page.locator("#bibliotecaLista li").filter({hasText:"Solo Um"}).locator('[data-acao="editar"]').click();
    await page.waitForFunction(()=>/não respondeu agora/.test(document.querySelector("#mVideos").textContent),null,{timeout:15000});
    ok(await page.evaluate(()=>document.querySelector("#mLinkDetalhes").open),"o campo de link deveria abrir quando a busca cai");
    ok(await page.locator("#mProcurarYT").isVisible(),"falta o atalho para o YouTube");
    for(const b of bases)await page.unroute(b+"/search**");
  });

  await cenario("adicionar pelo nome: o app escolhe o vídeo e a letra, entra na playlist, dá para trocar e tirar",async()=>{
    await aba("musicas");await page.click("#btnNovaMusica");
    const antes=await page.evaluate(()=>K.dados.musicas.length);
    await page.fill("#novaLinkYT","evidências");await page.click("#formNovaLink button[type=submit]");
    await page.waitForSelector("#novaResultado .autoItem",{timeout:15000});
    const m=await page.evaluate(()=>{const x=K.dados.musicas[K.dados.musicas.length-1];return{title:x.title,artist:x.artist,pb:x.playback&&x.playback.id,sinc:!!x.synced,naFila:playlistAtiva().itens.some(i=>i.musicaId===x.id)}});
    ok(m.pb==="BUSCAAAAAA1"&&m.title==="Evidências"&&m.artist==="Chitãozinho e Xororó"&&m.sinc&&m.naFila,"escolha automática errada: "+JSON.stringify(m));
    ok(await page.locator("#novaResultado .selo.ok").count()===1,"falta o selo de letra sincronizada");
    // trocar: o clipe bloqueado é recusado, o outro vale
    await page.click('#novaResultado [data-auto="trocar"]');
    await page.waitForSelector('#novaResultado [data-video="BLOQUEADO01"]');
    await page.click('#novaResultado [data-video="BLOQUEADO01"]');
    await page.waitForFunction(()=>/Escolha outro v/.test(document.querySelector("#aviso").textContent),null,{timeout:12000});
    ok(await page.evaluate(()=>K.dados.musicas[K.dados.musicas.length-1].playback.id)==="BUSCAAAAAA1","trocou para um vídeo bloqueado");
    await page.click('#novaResultado [data-video="BUSCAAAAAA2"]');
    await page.waitForFunction(()=>K.dados.musicas[K.dados.musicas.length-1].playback.id==="BUSCAAAAAA2",null,{timeout:12000});
    // tirar: sai da playlist e a música criada agora some junto
    await page.click('#novaResultado [data-auto="tirar"]');
    await page.waitForFunction(n=>K.dados.musicas.length===n,antes);
    await page.waitForFunction(()=>!document.querySelector("#novaResultado .autoItem"),null,{timeout:5000}).catch(()=>{});
    ok(await page.locator("#novaResultado .autoItem").count()===0,"a linha continuou na tela");
    await page.evaluate(()=>document.querySelector("#dlgNovaMusica").close());
  });

  await cenario("adicionar várias de uma vez: uma entra completa, uma sem vídeo, uma não acha; pode tirar",async()=>{
    await aba("musicas");await page.click("#btnNovaMusica");
    await page.click("#novaLote summary");
    const antes=await page.evaluate(()=>({m:K.dados.musicas.length,f:playlistAtiva().itens.length}));
    await page.fill("#loteTexto","1. Evidências - Chitãozinho e Xororó\nBloqueada - Fulano\nNada - Ninguém\nevidências - chitãozinho e xororó");
    await page.click("#loteIr");
    await page.waitForFunction(()=>/Pronto/.test(document.querySelector("#loteStatus").textContent),null,{timeout:60000});
    ok(await page.locator("#loteLista .autoItem[data-musica]").count()===2,"deveriam entrar 2 músicas");
    ok(await page.locator("#loteLista .autoItem.falhou").count()===1,"deveria falhar 1 linha");
    const st=await page.locator("#loteStatus").innerText();
    ok(/2 entraram/.test(st)&&/1 não/.test(st),"resumo errado: "+st);
    const dep=await page.evaluate(()=>({m:K.dados.musicas.length,f:playlistAtiva().itens.length,sem:K.dados.musicas.filter(x=>!x.playback&&x.title==="Bloqueada").length}));
    ok(dep.m===antes.m+2&&dep.f===antes.f+2&&dep.sem===1,"estado errado: "+JSON.stringify(dep));
    ok(await page.locator('#loteLista [data-auto="trocar"]').filter({hasText:"Escolher vídeo"}).count()===1,"a música sem vídeo deveria oferecer Escolher vídeo");
    // tira as duas
    for(let n=await page.locator('#loteLista [data-auto="tirar"]').count();n>0;n--){
      await page.locator('#loteLista [data-auto="tirar"]').first().click();
      await page.waitForFunction(k=>document.querySelectorAll('#loteLista [data-auto="tirar"]').length===k,n-1,{timeout:5000});
    }
    await page.waitForFunction(n=>K.dados.musicas.length===n,antes.m);
    await page.evaluate(()=>document.querySelector("#dlgNovaMusica").close());
  });

  await cenario("trava: durante a música só quem canta mexe; na vez, qualquer um pula; fila é livre",async()=>{
    await page.evaluate(()=>{
      const ana=criarCantor({nome:"Ana",emoji:"🎤"}),beto=criarCantor({nome:"Beto",emoji:"🎸"});
      const m=criarMusica({title:"Música da Trava",lyrics:"linha um\nlinha dois",duration:90});
      const p=criarPlaylist("Trava");adicionarItem(p,m.id,ana.id,"");adicionarItem(p,m.id,beto.id,"");
      prefs().contagem=30;prefs().trava=true;
      abrirPalco({playlistId:p.id,indice:0});
    });
    await page.waitForFunction(()=>P.fase==="vez");
    ok(await page.evaluate(()=>!SalaHost.bloqueadoPara("Beto")),"na vez ninguém deveria estar travado");
    // Beto (não é o dono) começa a música da Ana: é livre na vez
    await page.evaluate(()=>SalaHost.aplicar({tipo:"comecar",nome:"Beto",dados:{}}));
    await page.waitForFunction(()=>P.fase==="cantando");
    const est=await page.evaluate(()=>{const e=SalaHost.montarEstado();return{donos:e.agora.donos,trava:e.trava}});
    ok(est.donos.join()==="Ana"&&est.trava===true,"estado da sala não diz quem canta: "+JSON.stringify(est));
    ok(await page.evaluate(()=>SalaHost.bloqueadoPara("Beto")&&!SalaHost.bloqueadoPara("Ana")&&!SalaHost.bloqueadoPara("  ana ")),"a trava não separou dono e visitante");
    // Beto tenta pular e pausar: nada muda
    await page.evaluate(()=>{["proxima","alternar","anterior"].forEach(t=>SalaHost.aplicar({tipo:t,nome:"Beto",dados:{}}))});
    ok(await page.evaluate(()=>P.fase==="cantando"&&P.indice===0),"o visitante conseguiu mexer na música");
    // Beto mexe na fila: livre (pôr a seguir e tirar)
    await page.evaluate(()=>{const p=acharPlaylist(P.playlistId),it=p.itens[1];SalaHost.aplicar({tipo:"subir_item",nome:"Beto",dados:{itemId:it.id}})});
    // Beto manda "tocar agora": interrompe, por isso também é travado
    await page.evaluate(()=>{const it=acharPlaylist(P.playlistId).itens[1];SalaHost.aplicar({tipo:"tocar_item",nome:"Beto",dados:{itemId:it.id}})});
    ok(await page.evaluate(()=>P.indice===0),"o visitante trocou a música tocando");
    // Ana (dona) pula
    await page.evaluate(()=>SalaHost.aplicar({tipo:"proxima",nome:"Ana",dados:{}}));
    await page.waitForFunction(()=>P.fase!=="cantando"||P.indice===1,null,{timeout:8000});
    // trava desligada em Ajustes: qualquer um
    await page.evaluate(()=>{prefs().trava=false});
    ok(await page.evaluate(()=>!SalaHost.bloqueadoPara("Beto")),"com a trava desligada ninguém deveria ser travado");
    await page.evaluate(()=>{prefs().trava=true;prefs().contagem=5;fecharPalco()});
  });

  await cenario("letra por música: vídeo é o padrão, alternar grava na música, reabrir mantém e o iframe não recarrega",async()=>{
    await page.evaluate(()=>{
      const m=criarMusica({title:"Letra Por Música",lyrics:"a\nb",synced:"[00:01.00]a\n[00:05.00]b",duration:100,playback:{tipo:"youtube",id:"BUSCAAAAAA1",titulo:"v"}});
      const p=criarPlaylist("Letra");adicionarItem(p,m.id,"","");
      prefs().fundo="tela";prefs().contagem=0;window.__pl=p.id;
      abrirPalco({playlistId:p.id,indice:0});
    });
    await page.waitForFunction(()=>P.fase==="cantando"&&P.fonte===FonteYouTube);
    ok(await page.evaluate(()=>document.getElementById("palco").dataset.fundo)==="tela","o padrão deveria ser só o vídeo");
    await page.evaluate(()=>{window.__f=document.querySelector("#ytBox iframe")});
    await page.evaluate(()=>alternarLetra());
    ok(await page.evaluate(()=>document.getElementById("palco").dataset.fundo!=="tela"&&P.musica.letraDe==="app"&&acharMusica(P.musica.id).letraDe==="app"),"alternar não guardou a letra do app na música");
    ok(await page.evaluate(()=>document.querySelector("#ytBox iframe")===window.__f),"o iframe do vídeo foi recriado");
    ok(await page.evaluate(()=>prefs().fundo)==="tela","a preferência do aparelho não pode mudar por causa de uma música");
    await page.evaluate(()=>fecharPalco());
    await page.evaluate(()=>abrirPalco({playlistId:window.__pl,indice:0}));
    await page.waitForFunction(()=>P.fase==="cantando"&&P.fonte===FonteYouTube);
    ok(await page.evaluate(()=>document.getElementById("palco").dataset.fundo!=="tela"),"reabrir a música perdeu a escolha");
    await page.evaluate(()=>alternarLetra());
    ok(await page.evaluate(()=>document.getElementById("palco").dataset.fundo==="tela"&&P.musica.letraDe==="video"),"voltar ao vídeo não guardou");
    await page.evaluate(()=>{prefs().contagem=5;fecharPalco()});
  });

  await cenario("pedido do celular com música nova: a tela procura a letra sem travar a fila",async()=>{
    await page.evaluate(()=>{
      window.__v=SalaHost.aplicar({tipo:"pedir_nova",nome:"Celular",dados:{title:"Cogulândia",artist:"Matuê",playback:{tipo:"youtube",id:"BUSCAAAAAA1",titulo:"v"}}});
    });
    ok(await page.evaluate(()=>window.__v===true&&K.dados.musicas.length>0),"o pedido não entrou na fila");
    await page.waitForFunction(()=>{const m=K.dados.musicas.find(x=>x.title==="Cogulândia");return m&&temSincronia(m)},null,{timeout:10000});
    ok(await page.evaluate(()=>K.dados.musicas.filter(x=>x.title==="Cogulândia").length)===1,"criou a música duas vezes");
  });

  await cenario("celular em pé: título e botão numa linha, seletor de playlist com largura toda",async()=>{
    await limpar();
    const c2=await browser.newContext({viewport:{width:390,height:844}});
    const p2=await c2.newPage();await p2.goto(BASE);
    const l=await p2.evaluate(()=>({
      marca:document.querySelector(".marca").getBoundingClientRect().height,
      botao:document.querySelector("#btnSala").getBoundingClientRect().height,
      sel:document.querySelector("#playlistSel").getBoundingClientRect().width,
      larg:document.documentElement.clientWidth,
      rolagemH:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
    await c2.close();
    ok(l.marca<50&&l.botao<50,"título ou botão quebrando em duas linhas");
    ok(l.sel>l.larg*0.8,"seletor de playlist apertado ("+Math.round(l.sel)+"px)");
    ok(!l.rolagemH,"a página rola na horizontal");
  });

  ok(erros.length===0,"erros de console/página: "+erros.slice(0,3).join(" | "));
  await browser.close();
  const falhas=resultados.filter(r=>!r).length;
  console.log(falhas?`\nFALHOU: ${falhas} de ${resultados.length} cenários.`:`\nOK — ${resultados.length} cenários de uso passaram.`);
  process.exit(falhas?1:0);
})().catch(e=>{console.error("FALHOU:",e.message||e);process.exit(1)});
