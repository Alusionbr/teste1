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
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push(message.text())});
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"networkidle"});
  await page.waitForFunction(()=>typeof state!=="undefined"&&state.workspace&&state.setlists.length);
  assert.equal(await page.evaluate(()=>state.workspace.version),4);
  assert.equal(await page.evaluate(()=>state.setlist[0].title),"Canção antiga");
  assert.deepEqual(await page.locator(".tab").allTextContents().then(x=>x.map(v=>v.trim())),["Início","Biblioteca 1","Repertórios 1","Ensaio"]);

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
  assert.equal(mobile.sidebarX,0);assert.ok(mobile.sidebarWidth<=mobile.viewport);assert.ok(mobile.headerRight<=mobile.viewport);assert.equal(mobile.scrollWidth,mobile.viewport);
  await page.click("#sidebarCloseBtn");
  await page.waitForFunction(()=>document.querySelector("#sidebar").getBoundingClientRect().right<=1);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof state!=="undefined"&&state.workspace&&document.querySelector("#network").textContent==="offline");
  assert.equal(await page.evaluate(()=>state.setlists.some(x=>x.name==="Criado em outra aba")),true);
  await context.setOffline(false);
  assert.equal(errors.length,0,errors.join("\n"));

  const compact=await page.evaluate(()=>({version:state.workspace.version,setlists:state.setlists.length,library:state.library.length,sessions:state.sessions.length,trash:state.trash.length,save:document.querySelector("#saveState").textContent}));
  console.log(JSON.stringify(compact));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
