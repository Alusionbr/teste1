"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

test("versão do app é única no HTML, núcleo e service worker",()=>{
  const core=read("core.js"),sw=read("sw.js"),html=read("index.html");
  const version=core.match(/APP_VERSION="([^"]+)"/)?.[1];
  assert.ok(version);assert.equal(html.match(/data-version="([^"]+)"/)?.[1],version);assert.match(sw,new RegExp(`VERSION\\s*=\\s*"${version.replaceAll(".","\\.")}"`));
  const refs=[...html.matchAll(/[?&]v=([0-9.]+)/g)].map(x=>x[1]);
  assert.ok(refs.length>10);assert.deepEqual([...new Set(refs)],[version]);
});

test("service worker inclui todo script e folha carregados pelo HTML",async()=>{
  const html=read("index.html"),sw=read("sw.js");
  const assets=[...html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(x=>x[1]).filter(x=>/\.(?:js|css|webmanifest)$/.test(x));
  for(const asset of assets)assert.match(sw,new RegExp(`"\\./${asset.replaceAll(".","\\.")}"`),`${asset} ausente do cache offline`);
  const listeners={},cached=[];let installation;
  require("node:vm").runInNewContext(sw,{self:{addEventListener:(name,fn)=>listeners[name]=fn},caches:{open:async()=>({addAll:async urls=>cached.push(...urls)})}});
  listeners.install({waitUntil:promise=>installation=promise});await installation;
  for(const ref of [...html.matchAll(/(?:src|href)="(\.\/[^" ]+)"/g)].map(x=>x[1]).filter(x=>/\.(js|css|webmanifest)(?:\?|$)/.test(x)))assert.ok(cached.includes(ref),ref+" não disponível offline");
});

test("todos os ids usados por JavaScript existem no HTML",()=>{
  const html=read("index.html"),scripts=fs.readdirSync(root).filter(x=>x.endsWith(".js")&&x!=="sw.js").map(read).join("\n");
  const ids=new Set([...scripts.matchAll(/\$\("([^"]+)"\)/g)].map(x=>x[1]));
  const missing=[...ids].filter(id=>!new RegExp(`id=["']${id}["']`).test(html));
  assert.deepEqual(missing,[]);
});
