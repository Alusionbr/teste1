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
const bloqueado=location.pathname.includes("${BLOQUEADO}");
const send=o=>parent.postMessage(JSON.stringify(o),"*");
addEventListener("message",e=>{let m;try{m=JSON.parse(e.data)}catch{return}
  if(m.event==="listening"){send({event:"initialDelivery",info:{apiInterface:[]}});send({event:"onReady"});if(bloqueado)send({event:"onError",info:150});}
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
  catch(e){resultados.push(false);console.log("  ✗",nome,"—",String(e.message).split("\n")[0])}
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
  page=await ctx.newPage();
  const erros=[];
  page.on("pageerror",e=>erros.push("página: "+e.message));
  page.on("console",m=>{if(m.type()==="error")erros.push("console: "+m.text().slice(0,160))});
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
