"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const os=require("node:os");
const {chromium}=require(path.join(os.homedir(),".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
const root=path.resolve(__dirname,"..");
const version=fs.readFileSync(path.join(root,"core.js"),"utf8").match(/APP_VERSION="([^"]+)"/)[1];
const old=new Map();
for(const file of fs.readdirSync(root).filter(x=>/\.(js|css|html|json|webmanifest|svg|png)$/.test(x))){
  const data=fs.readFileSync(path.join(root,file));
  old.set(file,file.endsWith(".png")?data:Buffer.from(data.toString().replaceAll(version,"0.0.0")));
}
// Simula um worker legado cujo cache ainda não tem a reserva de letras.
old.set("search-engine.js",Buffer.from(old.get("search-engine.js").toString().replace("try{const achou=await fetchLiriqoSong(song);if(achou)return achou}catch{}","")));
const shell=JSON.parse(fs.readFileSync(path.join(root,"sw.js"),"utf8").match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
old.set("sw.js",Buffer.from(`const CACHE="estante-0.0.0",SHELL=${JSON.stringify(shell)};
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("message",e=>{if(e.data==="skipWaiting")self.skipWaiting()});
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET"||new URL(e.request.url).origin!==self.location.origin)return;
 if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).then(async r=>{await(await caches.open(CACHE)).put("./index.html",r.clone());return r}).catch(()=>caches.match("./index.html",{ignoreSearch:true})));return}
 e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
  const network=fetch(e.request).then(async r=>{await(await caches.open(CACHE)).put(e.request,r.clone());return r});
  if(hit){e.waitUntil(network.catch(()=>{}));return hit}return network;
 }));
});`));
let current=false,browser;
const types={".js":"application/javascript",".html":"text/html",".css":"text/css",".json":"application/json",".webmanifest":"application/manifest+json",".svg":"image/svg+xml",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost"),file=decodeURIComponent(url.pathname).replace(/^\//,"")||"index.html";
  if(file.includes("..")){res.writeHead(403).end();return}
  const target=path.join(root,file);
  const data=current?(fs.existsSync(target)&&fs.readFileSync(target)):old.get(file);
  if(!data){res.writeHead(404).end();return}
  res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});res.end(data);
});
(async()=>{
  await new Promise(resolve=>server.listen(8766,"127.0.0.1",resolve));
  browser=await chromium.launch({headless:true,...(process.env.ESTANTE_BROWSER?{executablePath:process.env.ESTANTE_BROWSER}:process.platform==="win32"?{executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await context.addInitScript(()=>{if(!localStorage.getItem("estante:v3:setlists"))localStorage.setItem("estante:v3:setlists",JSON.stringify({version:3,activeId:"saved",setlists:[{id:"saved",name:"Meu ensaio",songs:[{title:"Canção salva",artist:"Banda",lyrics:"Texto guardado para ensaio"}]}]}))});
  await context.route("https://lrclib.net/**",route=>route.fulfill({contentType:"application/json",body:"[]"}));
  await context.route("https://api.lyrics.ovh/**",route=>route.fulfill({status:404,contentType:"application/json",body:"{}"}));
  await context.route("https://api.liriqo-alfarrizi.my.id/**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({metadata:{title:"Um Pedido",artist:"Davi Sacer"},primary:{plain:"Texto fictício de teste para verificar a recuperação da letra sem depender da rede."}})}));
  await page.goto("http://127.0.0.1:8766/",{waitUntil:"networkidle"});
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:"networkidle"});
  await page.evaluate(()=>openSong({title:"Um Pedido",artist:"Davi Sacer",source:"Apple"}));
  assert.equal(await page.evaluate(()=>!!state.current.lyrics),false,"cache legado deve reproduzir a falha");
  current=true;
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(expected=>typeof APP_VERSION!=="undefined"&&APP_VERSION===expected&&navigator.serviceWorker.controller?.scriptURL.includes("v="+expected)&&typeof openSong==="function",version,{timeout:30000});
  await page.waitForLoadState("networkidle");
  await page.evaluate(()=>openSong({title:"Um Pedido",artist:"Davi Sacer",source:"Apple"}));
  assert.equal(await page.evaluate(()=>state.current.source),"LiriQo");
  assert.equal(await page.evaluate(()=>state.library.some(x=>x.title==="Canção salva")),true);
  assert.equal(await page.locator(".missingActions").count(),0);
  // Nem caches alheios nem uma versão antiga do mesmo arquivo podem vazar.
  await page.evaluate(async()=>{const cache=await caches.open("estante-stray");await cache.put("./core.js?v=0.0.0",new Response("STALE"));});
  assert.notEqual(await page.evaluate(async()=>await (await fetch("./core.js?v=0.0.0")).text()),"STALE");
  await context.setOffline(true);await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof state!=="undefined"&&state.workspace);
  assert.equal(await page.evaluate(()=>APP_VERSION),version);
  assert.equal(await page.evaluate(()=>state.library.some(x=>x.title==="Canção salva")),true);
  const mismatched=await page.evaluate(async()=>{try{await fetch("./core.js?v=0.0.0");return true}catch{return false}});
  assert.equal(mismatched,false,"offline não deve substituir uma versão por outra");
  assert.deepEqual(errors,[]);
  console.log("PASS: atualização de cache legado, letras recuperadas, repertório preservado e abertura offline no mobile");
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close()});
