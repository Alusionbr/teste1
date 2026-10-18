"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const D=require("../domain.js");

test("migra repertórios v3 sem perder campos musicais",()=>{
  const v3={version:3,activeId:"show",setlists:[{id:"show",name:"Show",songs:[{title:"Águas de Março",artist:"Tom Jobim",lyrics:"É pau",key:2,capo:1,notes:"final 2x"}]}]};
  const workspace=D.migrate(v3);
  assert.equal(workspace.version,4);assert.equal(workspace.activeId,"show");assert.equal(workspace.setlists[0].songs[0].lyrics,"É pau");assert.equal(workspace.setlists[0].songs[0].key,2);assert.equal(workspace.library.length,1);assert.ok(workspace.setlists[0].songs[0].songId);assert.ok(workspace.setlists[0].songs[0].arrangementId);
});

test("reutiliza uma música e um arranjo idênticos entre repertórios",()=>{
  const workspace=D.migrate({setlists:[{name:"A",songs:[{title:"Café",artist:"Banda",lyrics:"la"}]},{name:"B",songs:[{title:"Cafe",artist:"banda",lyrics:"la"}]}]});
  const [a,b]=workspace.setlists.map(s=>s.songs[0]);
  assert.equal(a.songId,b.songId);assert.equal(a.arrangementId,b.arrangementId);assert.equal(workspace.library.length,1);
});

test("mantém versões diferentes como arranjos separados",()=>{
  const workspace=D.migrate({setlists:[{name:"A",songs:[{title:"Canção",artist:"Banda",lyrics:"versão A"}]},{name:"B",songs:[{title:"Canção",artist:"Banda",lyrics:"versão B"}]}]});
  const [a,b]=workspace.setlists.map(s=>s.songs[0]);
  assert.equal(a.songId,b.songId);assert.notEqual(a.arrangementId,b.arrangementId);assert.equal(workspace.library[0].arrangements.length,2);
});

test("registra revisão e limita o histórico",()=>{
  let song=D.normalizeSong({title:"Música",artist:"Artista",lyrics:"v0"});
  for(let i=1;i<=25;i++)song=D.revise({...song,lyrics:`v${i}`},song,"Teste");
  assert.equal(song.revision,26);assert.equal(song.history.length,20);assert.equal(song.history.at(-1).snapshot.lyrics,"v24");
});

test("calcula prontidão offline e progresso do ensaio",()=>{
  const items=[D.normalizeSong({title:"A",lyrics:"texto",status:"ready"}),D.normalizeSong({title:"B",status:"rehearsing"}),D.normalizeSong({kind:"note",title:"Pausa"})];
  assert.deepEqual(D.readiness(items),{ready:1,total:2,missing:[items[1]],complete:false});
  assert.deepEqual(D.progress(items),{learning:0,rehearsing:1,ready:1});
});

test("pacote compartilhado conserva revisão, status e conteúdo",()=>{
  const setlist=D.normalizeSetlist({name:"Ensaio",songs:[{title:"A",lyrics:"texto",revision:3,status:"ready"}]});
  const full=D.packageSetlist(setlist,true),list=D.packageSetlist(setlist,false);
  assert.equal(full.version,4);assert.equal(full.setlist.songs[0].lyrics,"texto");assert.equal(list.setlist.songs[0].lyrics,undefined);assert.equal(list.setlist.songs[0].revision,3);
});

test("preserva sessão ativa e repertório completo na lixeira",()=>{
  const setlist=D.normalizeSetlist({id:"show",name:"Show",songs:[{title:"A",lyrics:"x"}]});
  const session=D.newSession("show",setlist.songs);
  const workspace=D.migrate({setlists:[setlist],activeId:"show",activeSession:session,trash:[{id:"t",setlistId:"show",index:0,item:{kind:"setlist",...setlist}}]});
  assert.equal(workspace.activeSession.setlistId,"show");
  assert.equal(workspace.trash[0].item.kind,"setlist");
  assert.equal(workspace.trash[0].item.songs[0].title,"A");
});
