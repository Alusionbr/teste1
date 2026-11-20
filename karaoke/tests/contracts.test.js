"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const PAGINAS=["index.html","controle.html"];
const scriptsDa=html=>[...html.matchAll(/<script src="\.\/([^"?]+)\?v=/g)].map(x=>x[1]);

test("versão única: núcleo, service worker e as duas páginas",()=>{
  const version=read("core.js").match(/APP_VERSION="([^"]+)"/)?.[1];
  assert.ok(version);
  assert.match(read("sw.js"),new RegExp(`VERSION = "${version.replaceAll(".","\\.")}"`));
  for(const p of PAGINAS){
    const html=read(p);
    assert.equal(html.match(/data-version="([^"]+)"/)?.[1],version,p);
    const refs=[...html.matchAll(/[?&]v=([0-9.]+)/g)].map(x=>x[1]);
    assert.ok(refs.length>3,p);
    assert.deepEqual([...new Set(refs)],[version],p);
  }
});

test("service worker guarda todo arquivo usado pelas páginas",()=>{
  const sw=read("sw.js");
  for(const p of PAGINAS){
    const html=read(p);
    const usados=[...html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map(x=>x[1]);
    for(const a of usados)assert.match(sw,new RegExp(`"\\./${a.replaceAll(".","\\.")}"`),`${a} (de ${p}) fora do cache offline`);
    assert.match(sw,new RegExp(`"\\./${p.replace(".","\\.")}"`));
  }
  // Todo arquivo listado existe.
  const shell=[...sw.matchAll(/"\.\/([^"]*)"/g)].map(x=>x[1]).filter(Boolean);
  for(const a of shell)assert.ok(fs.existsSync(path.join(root,a)),`${a} listado no SHELL mas não existe`);
});

test("nenhum script, estilo ou fonte de outra origem nas páginas",()=>{
  for(const p of PAGINAS){
    const html=read(p);
    assert.doesNotMatch(html,/<script[^>]+src="(https?:)?\/\//i,p);
    assert.doesNotMatch(html,/<link[^>]+href="(https?:)?\/\//i,p);
    assert.doesNotMatch(html,/<iframe/i,`${p}: iframe só é criado por JavaScript depois de um gesto`);
  }
  for(const f of fs.readdirSync(root).filter(x=>x.endsWith(".js")))
    assert.doesNotMatch(read(f),/["'`][^"'`\n]*(iframe_api|iframe-api\/v1|spotifycdn)/,`${f} não pode carregar script do YouTube/Spotify`);
});

test("todo id usado pelos scripts existe na página que os carrega",()=>{
  for(const p of PAGINAS){
    const html=read(p);
    const ids=new Set(scriptsDa(html).flatMap(s=>[...read(s).matchAll(/\$\("([^"]+)"\)/g)].map(x=>x[1])));
    const faltam=[...ids].filter(id=>!new RegExp(`id=["']${id}["']`).test(html));
    assert.deepEqual(faltam,[],p);
  }
});

test("chave do Supabase é a publicável, nunca a service_role",()=>{
  const sala=read("sala.js");
  assert.match(sala,/sb_publishable_/);
  for(const f of fs.readdirSync(root).filter(x=>/\.(js|html)$/.test(x)))assert.doesNotMatch(read(f),/sb_secret_|["'`]eyJ[\w-]{10,}\.[\w-]{10,}/,f);
});
