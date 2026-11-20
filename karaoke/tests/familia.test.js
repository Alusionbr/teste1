"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {proximoCantor}=require("../familia.js");
const {normalizarDados}=require("../estado.js");
const c=[{id:"vo"},{id:"pai"},{id:"ana"}];

test("rodízio: começa pelo primeiro e segue quem cantou menos",()=>{
  assert.equal(proximoCantor(c,[]),"vo");
  assert.equal(proximoCantor(c,[{cantorA:"vo"}]),"pai");
  assert.equal(proximoCantor(c,[{cantorA:"vo"},{cantorA:"pai"}]),"ana");
  assert.equal(proximoCantor(c,[{cantorA:"vo"},{cantorA:"pai"},{cantorA:"ana"}]),"vo");
});
test("rodízio: dueto conta para os dois",()=>{
  assert.equal(proximoCantor(c,[{cantorA:"vo",cantorB:"pai"}]),"ana");
});
test("rodízio: sem família devolve vazio",()=>{assert.equal(proximoCantor([],[]),"")});

test("normalizar descarta lixo e item que aponta para música inexistente",()=>{
  const d=normalizarDados({cantores:[{id:"c1",nome:"Vó",cor:"#123456"},{id:"<x>",nome:"mal"}],musicas:[{id:"m1",title:"A"}],
    playlists:[{id:"p1",nome:"F",itens:[{id:"i1",musicaId:"m1",cantorA:"c1",cantorB:"c1"},{id:"i2",musicaId:"nada"}]}],prefs:{fundo:"neon",tamanho:999}});
  assert.equal(d.cantores.length,1);
  assert.deepEqual(d.playlists[0].itens,[{id:"i1",musicaId:"m1",cantorA:"c1",cantorB:""}]);
  assert.equal(d.activePlaylistId,"p1");
  assert.equal(d.prefs.fundo,"tela");assert.equal(d.prefs.tamanho,180);
  assert.deepEqual(normalizarDados(null).musicas,[]);
});
