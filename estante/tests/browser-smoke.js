"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),Module=require("node:module");
const bundled=process.env.CODEX_NODE_MODULES||path.join(os.homedir(),".cache","codex-runtimes","codex-primary-runtime","dependencies","node","node_modules");
if(fs.existsSync(bundled)){process.env.NODE_PATH=[process.env.NODE_PATH,bundled].filter(Boolean).join(path.delimiter);Module._initPaths()}
const {chromium}=require("playwright");
const browserCandidates=[
  process.env.ESTANTE_BROWSER,
  process.platform==="win32"&&path.join(process.env.ProgramFiles||"C:/Program Files","Google","Chrome","Application","chrome.exe"),
  process.platform==="win32"&&path.join(process.env["ProgramFiles(x86)"]||"C:/Program Files (x86)","Microsoft","Edge","Application","msedge.exe"),
  "/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);
const installedBrowser=browserCandidates.find(fs.existsSync);
let browser;

(async()=>{
  browser=await chromium.launch({headless:true,...(installedBrowser?{executablePath:installedBrowser}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(()=>{
    localStorage.setItem("estante:v3:setlists",JSON.stringify({version:3,activeId:"legacy",setlists:[{id:"legacy",name:"Legado",songs:[{title:"Canção antiga",artist:"Banda",lyrics:"[Refrão]\nC G\nTexto",notes:"entrada suave"}]}]}));
  });
  const page=await context.newPage(),errors=[],failedRequests=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("requestfailed",request=>failedRequests.push(request.url()));
  page.on("console",message=>{if(message.type()==="error")errors.push(message.text())});
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"networkidle"});
  await page.waitForFunction(()=>typeof state!=="undefined"&&state.workspace&&state.setlists.length);
  assert.equal(await page.evaluate(()=>state.workspace.version),4);
  assert.equal(await page.evaluate(()=>state.setlist[0].title),"Canção antiga");
  const modes=await page.evaluate(()=>{
    markSource("vagalume",false,503);markSource("lrclib",false,503);
    state.source="excerpt";markSource("vagalume",false,503);
    const hidden=[...document.querySelectorAll(".chip[data-source]")].filter(b=>b.hidden).map(b=>b.dataset.source);
    const mode=state.source;
    markSource("vagalume",true);markSource("lrclib",true);
    const restored=[...document.querySelectorAll(".chip[data-source]")].filter(b=>!b.hidden).map(b=>b.dataset.source);
    return{hidden,mode,restored};
  });
  assert.deepEqual(modes,{hidden:["vagalume","lrclib","excerpt"],mode:"smart",restored:["smart","vagalume","lrclib","excerpt"]});
  const searchRegression=await page.evaluate(()=>{
    const ranked=mergeSongs([
      {title:"Fuego",artist:"Jubilo",source:"MusicBrainz"},
      {title:"Ouve-se o Júbilo",artist:"Silvério Peres",source:"Deezer"},
      {title:"Ouve-se o Júbilo / Leão da Tribo de Judá",artist:"Bispo Rodovalho",source:"Deezer"}
    ],"ouvisse o jubilo");
    state.results=ranked;state.tab="results";renderList();
    const solo=ranked.findIndex(x=>x.title==="Ouve-se o Júbilo");
    const unrelated=ranked.findIndex(x=>x.title==="Fuego");
    const medleyTag=[...document.querySelectorAll(".listRow")].some(row=>row.textContent.includes("Leão da Tribo de Judá")&&row.textContent.includes("medley"));
    markSource("vagalume",false,503);
    renderMissingLyrics({title:"Ouve-se o Júbilo",artist:"Silvério Peres",source:"Deezer",sources:["Deezer"]},"Sem letra");
    return{solo,unrelated,medleyTag,explanation:document.querySelector("#paper").textContent,actions:[...document.querySelectorAll(".missingActions button")].map(x=>x.textContent)};
  });
  const lyricPriority=await page.evaluate(()=>{
    const titleOnly=mergeSongs([
      {title:"Um Pedido",artist:"Davi Sacer",source:"Apple"},
      {title:"Um Pedido",artist:"Hungria",lyrics:"letra disponível",source:"LRCLIB"}
    ],"Um Pedido");
    const artistSpecific=mergeSongs([
      {title:"Um Pedido",artist:"Davi Sacer",source:"Apple"},
      {title:"Um Pedido",artist:"Hungria",lyrics:"letra disponível",source:"LRCLIB"}
    ],"Um Pedido Davi Sacer");
    return{firstWithLyrics:!!titleOnly[0].lyrics,exactArtistFirst:artistSpecific[0].artist};
  });
  assert.deepEqual(lyricPriority,{firstWithLyrics:true,exactArtistFirst:"Davi Sacer"});
  assert.ok(searchRegression.solo<searchRegression.unrelated);
  assert.equal(searchRegression.medleyTag,true);
  const combinedRank=await page.evaluate(()=>mergeSongs([
    {title:"Ele é o Leão da Tribo de Judá",artist:"Samuel Souza",source:"Deezer"},
    {title:"Ouve-se o Júbilo / Leão da Tribo de Judá",artist:"Bispo Rodovalho",source:"Deezer"}
  ],"ouvisse o jubilo ele é o leão da tribo de Judá")[0].title);
  assert.match(combinedRank,/Ouve-se o Júbilo \/ Leão/);
  assert.match(searchRegression.explanation,/O Vagalume está indisponível/);
  assert.deepEqual(searchRegression.actions,["Buscar outras versões","Colar minha letra"]);
  const unavailableSources=await page.evaluate(()=>{
    markSource("lrclib",false,503);markSource("vagalume",false,503);
    renderMissingLyrics({title:"Leão da Tribo",artist:"Masterix",source:"Apple",sources:["Apple"]},"Sem letra");
    return{message:document.querySelector("#paper").textContent,actions:[...document.querySelectorAll(".missingActions button")].map(button=>button.textContent)};
  });
  assert.match(unavailableSources.message,/LRCLIB indisponível \(503\)/);
  assert.match(unavailableSources.message,/Vagalume está indisponível/);
  assert.deepEqual(unavailableSources.actions,["Buscar outras versões","Colar minha letra"]);
  const brasilFallback=await page.evaluate(async()=>{
    const originals={fetchRetrying,searchLrclib,searchItunes,searchDeezer,searchMusicBrainz};
    state.source="vagalume";
    fetchRetrying=async()=>({ok:false,status:503});
    searchLrclib=async()=>[];
    searchItunes=async()=>[{title:"Ouve-se o Júbilo",artist:"Marcos Góes",source:"Apple",sources:["Apple"]}];
    searchDeezer=async()=>[];
    searchMusicBrainz=async()=>[];
    try{const rows=await searchMusic("Ouve-se o Júbilo");return{count:rows.length,mode:state.source,fallback:state.searchMeta.fallbackFrom}}
    finally{Object.assign(window,originals)}
  });
  assert.deepEqual(brasilFallback,{count:1,mode:"smart",fallback:"vagalume"});
  const sincroFallback=await page.evaluate(async()=>{
    const originals={fetchSafe,searchItunes,searchDeezer,searchMusicBrainz};
    state.source="lrclib";
    fetchSafe=async()=>({ok:false,status:503,headers:new Headers()});
    searchItunes=async()=>[{title:"Um Pedido",artist:"Davi Sacer",source:"Apple",sources:["Apple"]}];
    searchDeezer=async()=>[];searchMusicBrainz=async()=>[];
    try{const rows=await searchMusic("Um Pedido");return{count:rows.length,mode:state.source,fallback:state.searchMeta.fallbackFrom}}finally{Object.assign(window,originals)}
  });
  assert.deepEqual(sincroFallback,{count:1,mode:"smart",fallback:"lrclib"});
  const lyricsFallback=await page.evaluate(async()=>{
    const original=fetchSafe;
    fetchSafe=async url=>{
      const params=new URL(url).searchParams;
      const title=params.get("title"),artist=params.get("artist");
      const known=title==="Ouve-se o Júbilo"&&artist==="Marcos Góes"||title==="Ele É o Leão da Tribo de Judá"&&artist==="Corinhos Evangélicos";
      return{ok:true,json:async()=>({metadata:known?{title,artist}:{title:"Música errada",artist:"Outro cantor"},primary:{plain:`Letra de teste para ${title} com bastante texto para ensaio.`}})};
    };
    try{
      const song={title:"Ouve-se o Júbilo / Leão da Tribo de Judá",artist:"Bispo Rodovalho"};
      await fetchLiriqoSong(song);
      const mismatch=await fetchLiriqoExact("Outra Música","Outro Artista");
      const saved=EstanteDomain.normalizeSong(song);
      return{source:song.source,note:song.lyricNote,text:song.lyrics,mismatch,savedNote:saved.lyricNote,savedSources:saved.lyricSources};
    }finally{fetchSafe=original;liriqoCache.clear()}
  });
  assert.equal(lyricsFallback.source,"LiriQo");
  assert.match(lyricsFallback.note,/Versão de ensaio/);
  assert.match(lyricsFallback.text,/Ouve-se o Júbilo/);
  assert.match(lyricsFallback.text,/Ele É o Leão da Tribo de Judá/);
  assert.equal(lyricsFallback.mismatch,null);
  assert.equal(lyricsFallback.savedNote,lyricsFallback.note);
  assert.equal(lyricsFallback.savedSources.length,2);
  const alternateTrack=await page.evaluate(async()=>{
    const original=fetchSafe;let calls=0;
    fetchSafe=async()=>({ok:true,json:async()=>{calls++;return calls===1?{metadata:{title:"Teste reserva",artist:"Banda"},primary:null,tracks:[]}:{metadata:{title:"Teste reserva",artist:"Banda"},primary:{title:"Teste reserva",artist:"Outro artista",plain:"Texto errado de outra banda que nunca deve ser aceito aqui"},tracks:[{title:"Teste reserva",artist:"Banda",timed:[{text:"Texto fictício de uma resposta alternativa e correspondente ao artista."}]}]}}});
    try{const text=await fetchLiriqoExact("Teste reserva","Banda");await fetchLiriqoExact("Teste reserva","Banda");return{text,calls}}finally{fetchSafe=original;liriqoCache.clear()}
  });
  assert.match(alternateTrack.text,/Texto fictício/);assert.equal(alternateTrack.calls,2);
  const correctRecording=await page.evaluate(async()=>{
    const original=fetchSafe;
    fetchSafe=async()=>({ok:true,json:async()=>[
      {trackName:"Um Pedido",artistName:"Outro cantor",plainLyrics:"Letra incorreta"},
      {trackName:"Outro pedido",artistName:"Davi Sacer",plainLyrics:"Outro título"},
      {trackName:"Um Pedido",artistName:"Davi Sacer",plainLyrics:"Gravação correspondente"}
    ]});
    try{const song=await fetchLrclibSong({title:"Um Pedido",artist:"Davi Sacer"});return song.lyrics}finally{fetchSafe=original}
  });
  assert.equal(correctRecording,"Gravação correspondente");
  await page.evaluate(()=>{
    window.exactLyricOriginals={searchMusic,searchAcervo,fetchLiriqoExact};
    searchMusic=async()=>[{title:"Um Pedido",artist:"Hungria",source:"LRCLIB",sources:["LRCLIB"],lyrics:"Letra do teste.",synced:""},{title:"Um Pedido",artist:"Davi Sacer",source:"Apple",sources:["Apple"],lyrics:"",synced:""}];
    searchAcervo=async()=>[];
    fetchLiriqoExact=(title,artist)=>new Promise(resolve=>{
      window.exactLyricQuery={title,artist};
      window.finishExactLyrics=()=>resolve("Texto fictício de teste para a gravação confirmada.");
    });
    state.source="smart";
  });
  await page.locator("#searchInput").fill("Um Pedido Davi Sacer");
  await page.locator("#searchForm button").click();
  await page.waitForFunction(()=>typeof window.finishExactLyrics==="function");
  assert.deepEqual(await page.evaluate(()=>window.exactLyricQuery),{title:"Um Pedido",artist:"Davi Sacer"});
  assert.match(await page.locator("#list").textContent(),/buscar letra ao abrir/);
  await page.evaluate(()=>window.finishExactLyrics());
  await page.waitForFunction(()=>state.results[0]?.artist==="Davi Sacer"&&state.results[0]?.source==="LiriQo"&&document.querySelector("#list")?.textContent.includes("com letra"));
  assert.equal(await page.evaluate(()=>!!state.results[0].lyrics),true);
  await page.evaluate(()=>{Object.assign(window,window.exactLyricOriginals);delete window.exactLyricOriginals;delete window.exactLyricQuery;delete window.finishExactLyrics});
  await page.evaluate(()=>liriqoCache.clear());
  if(process.env.ESTANTE_LIVE_LYRICS==="1"){
    await page.evaluate(async()=>openSong({title:"Um Pedido",artist:"Davi Sacer",source:"Apple",sources:["Apple"]}));
    assert.equal(await page.evaluate(()=>!!state.current.lyrics&&state.current.source==="LiriQo"),true);
    assert.equal(await page.locator(".missingActions").count(),0);
    const live=await page.evaluate(async()=>{
      const song={title:"Ouve-se o Júbilo / Leão da Tribo de Judá",artist:"Bispo Rodovalho"};
      await fetchLiriqoSong(song);
      return{source:song.source,note:song.lyricNote,hasFirst:/ouve-se o júbilo/i.test(song.lyrics||""),hasSecond:/ele é o leão da tribo de judá/i.test(song.lyrics||"")};
    });
    assert.equal(live.source,"LiriQo");
    assert.match(live.note,/Versão de ensaio/);
    assert.equal(live.hasFirst,true);
    assert.equal(live.hasSecond,true);
    await page.evaluate(async()=>openSong({title:"Ouve-se o Júbilo / Leão da Tribo de Judá",artist:"Bispo Rodovalho",source:"Deezer",sources:["Deezer"]}));
    assert.match(await page.locator("#paper").textContent(),/Ele É o Leão da Tribo de Judá/);
    assert.match(await page.locator("#credits").textContent(),/Versão de ensaio montada de duas gravações/);
  }
  assert.deepEqual(await page.locator(".tab").allTextContents().then(x=>x.map(v=>v.trim())),["Início","Biblioteca 1","Repertórios 1","Ensaio"]);

  await page.click('[data-tab="setlist"]');
  assert.equal(await page.locator("#setlistBar").isVisible(),true);
  assert.equal(await page.locator("#libraryTools").isVisible(),false);
  assert.equal(await page.locator("#rehearsalTools").isVisible(),false);
  await page.click("#setlistNew");
  await page.fill("#setlistName","Ensaio de quinta");
  await page.locator("#setlistForm button.accent").click();
  assert.equal(await page.evaluate(()=>state.setlist.length),0);

  await page.click('[data-tab="library"]');
  await page.check(".libraryPick");
  await page.click("#libraryAddSelected");
  assert.equal(await page.evaluate(()=>state.setlist.length),1);

  await page.click('[data-tab="rehearsal"]');
  await page.click("#rehearsalStart");
  await page.selectOption(".statusSelect","ready");
  await page.click("#rehearsalFinish");
  await page.fill("#rehearsalNotes","Fechamos o final.");
  await page.locator("#rehearsalForm button.accent").click();
  assert.equal(await page.evaluate(()=>state.sessions.length),1);
  assert.equal(await page.evaluate(()=>state.setlist[0].status),"ready");
  await page.click("#rehearsalHistoryBtn");
  assert.match(await page.locator("#rehearsalHistoryList").textContent(),/Fechamos o final/);
  await page.click("#rehearsalHistoryCloseBtn");

  await page.click("#setlistNote");
  await page.fill("#setlistNoteTitle","Troca de violão");
  await page.fill("#setlistNoteDuration","1:30");
  await page.fill("#setlistNoteText","Afinar em D.");
  await page.locator("#setlistNoteForm button.accent").click();
  assert.equal(await page.evaluate(()=>state.setlist.length),2);
  await page.locator(".noteRow .remove").click();
  assert.equal(await page.evaluate(()=>state.setlist.length),1);
  await page.locator("#notice button").click();
  assert.equal(await page.evaluate(()=>state.setlist.length),2);

  await page.click('[data-tab="setlist"]');
  await page.locator(".songItem").first().click();
  await page.click("#editBtn");
  await page.fill("#editArrangement","Acústico");
  await page.fill("#editText","[Refrão]\nD A\nTexto revisado");
  await page.selectOption("#editScope","arrangement");
  await page.locator("#editForm button.accent").click();
  assert.equal(await page.evaluate(()=>state.current.arrangementName),"Acústico");
  assert.equal(await page.evaluate(()=>state.current.revision),2);
  await page.click("#editBtn");
  await page.click("#revisionHistoryBtn");
  assert.match(await page.locator("#revisionList").textContent(),/Revisão 1/);
  await page.locator("#revisionList button").first().click();
  assert.equal(await page.evaluate(()=>state.current.revision),3);
  assert.match(await page.evaluate(()=>state.current.lyrics||state.current.synced),/Texto/);
  await page.click("#editBtn");
  await page.fill("#editArrangement","Acústico");
  await page.fill("#editText","[Refrão]\nD A\nTexto revisado");
  await page.locator("#editForm button.accent").click();
  assert.equal(await page.evaluate(()=>state.current.revision),4);

  await page.waitForFunction(()=>document.querySelector("#saveState").dataset.state==="saved");
  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>typeof state!=="undefined"&&state.workspace&&state.setlists.length===2);
  assert.equal(await page.evaluate(()=>state.setlists.find(x=>x.name==="Ensaio de quinta").songs.find(x=>x.kind==="song").arrangementName),"Acústico");
  assert.equal(await page.evaluate(()=>state.sessions.length),1);
  const shared=await page.evaluate(async()=>{const url=await makeShareUrl(true),data=await unpackShare(new URL(url).hash);return{version:data.v,revision:data.songs.find(x=>x.kind==="song").revision,hasLyrics:!!data.songs.find(x=>x.kind==="song").lyrics}});
  assert.deepEqual(shared,{version:4,revision:4,hasLyrics:true});
  const race=await page.evaluate(async()=>{
    const original=fetchLrclibSong;
    fetchLrclibSong=song=>new Promise(resolve=>setTimeout(()=>{song.lyrics=`Letra ${song.title}`;resolve(song)},song.title==="Lenta"?80:10));
    try{const first=openSong({title:"Lenta",artist:"Teste"});await new Promise(resolve=>setTimeout(resolve,5));const second=openSong({title:"Rápida",artist:"Teste"});await Promise.all([first,second]);return{title:state.current.title,text:document.querySelector("#paper").textContent}}finally{fetchLrclibSong=original}
  });
  assert.equal(race.title,"Rápida");assert.match(race.text,/Letra Rápida/);assert.doesNotMatch(race.text,/Letra Lenta/);
  const recovered=await page.evaluate(()=>{const legacy=state.setlists.find(x=>x.name==="Legado"),id=legacy.id;deleteSetlist(id);const entry=state.trash.at(-1),kept=entry.item.songs[0].title;restoreTrash(entry.id);return{kept,restored:state.setlists.some(x=>x.id===id&&x.songs.length===1)}});
  assert.deepEqual(recovered,{kept:"Canção antiga",restored:true});
  const second=await context.newPage();
  await second.goto("http://127.0.0.1:8765/",{waitUntil:"networkidle"});
  await second.waitForFunction(()=>typeof state!=="undefined"&&state.workspace);
  await second.evaluate(()=>createSetlist("Criado em outra aba"));
  await page.waitForFunction(()=>document.querySelector("#notice").textContent.includes("outra aba"));
  assert.equal(await page.evaluate(()=>saveSetlists()),false);
  assert.equal(await page.locator("#saveState").textContent(),"Recarregue para salvar");
  await second.close();
  assert.equal(await page.locator("#menuBtn").evaluate(el=>getComputedStyle(el).display),"none");
  await page.setViewportSize({width:390,height:844});
  await page.click("#menuBtn");
  await page.waitForFunction(()=>document.querySelector("#sidebar").getBoundingClientRect().x>=-1);
  const mobile=await page.evaluate(()=>{const sidebar=document.querySelector("#sidebar").getBoundingClientRect(),header=document.querySelector(".songHeader").getBoundingClientRect();return{sidebarX:Math.round(sidebar.x),sidebarWidth:Math.round(sidebar.width),headerRight:Math.round(header.right),viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}});
  assert.equal(Math.abs(mobile.sidebarX),0);assert.ok(mobile.sidebarWidth<=mobile.viewport);assert.ok(mobile.headerRight<=mobile.viewport);assert.equal(mobile.scrollWidth,mobile.viewport);
  await page.click("#sidebarCloseBtn");
  await page.waitForFunction(()=>document.querySelector("#sidebar").getBoundingClientRect().right<=1);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof state!=="undefined"&&state.workspace&&document.querySelector("#network").textContent==="offline");
  assert.equal(await page.evaluate(()=>state.setlists.some(x=>x.name==="Criado em outra aba")),true);
  await context.setOffline(false);
  assert.ok(failedRequests.every(url=>url.includes("api.vagalume.com.br")),failedRequests.join("\n"));
  const unexpected=errors.filter(message=>!message.includes("api.vagalume.com.br")&&message!=="Failed to load resource: net::ERR_FAILED");
  assert.equal(unexpected.length,0,unexpected.join("\n"));

  const compact=await page.evaluate(()=>({version:state.workspace.version,setlists:state.setlists.length,library:state.library.length,sessions:state.sessions.length,trash:state.trash.length,save:document.querySelector("#saveState").textContent}));
  console.log(JSON.stringify(compact));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
