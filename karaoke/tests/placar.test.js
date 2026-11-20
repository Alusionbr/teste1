"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {MAX_PLACAR,normalizarPlacar,melhorNota,registrarNota,limparPlacar}=require("../placar.js");
const {normalizarDados}=require("../estado.js");

test("primeira nota de uma música é recorde",()=>{
  const d={placar:[]};
  const r=registrarNota(d,"m1",80,1);
  assert.equal(r.recorde,true);assert.equal(r.melhor,80);assert.equal(r.anterior,null);
  assert.equal(melhorNota(d,"m1"),80);
});
test("nota maior bate o recorde; menor e igual não",()=>{
  const d={placar:[]};
  registrarNota(d,"m1",80,1);
  assert.equal(registrarNota(d,"m1",70,2).recorde,false);
  assert.equal(registrarNota(d,"m1",80,3).recorde,false);
  const r=registrarNota(d,"m1",91,4);
  assert.equal(r.recorde,true);assert.equal(r.anterior,80);
  assert.equal(melhorNota(d,"m1"),91);
  assert.equal(melhorNota(d,"outra"),null);
});
test("nota fora de 0–100 é cortada; dados sem placar ganham a lista",()=>{
  const d={};
  registrarNota(d,"m1",250,1);registrarNota(d,"m1",-4,2);
  assert.deepEqual(d.placar.map(r=>r.nota),[100,0]);
});
test("limite de registros: sai o mais antigo, o melhor de cada música fica",()=>{
  const d={placar:[]};
  registrarNota(d,"m1",99,0);
  for(let i=1;i<=MAX_PLACAR+20;i++)registrarNota(d,"m2",i%50,i);
  assert.equal(d.placar.length,MAX_PLACAR);
  assert.equal(melhorNota(d,"m1"),99);
  assert.equal(d.placar[d.placar.length-1].em,MAX_PLACAR+20);
});
test("normalizar descarta lixo e música que não existe mais",()=>{
  const l=normalizarPlacar([{musicaId:"m1",nota:50.6,em:5},{musicaId:"x",nota:10},{musicaId:"m1",nota:"abc"},{musicaId:"m1",nota:101},null,{nota:5}],new Set(["m1"]));
  assert.deepEqual(l,[{musicaId:"m1",nota:51,em:5}]);
  assert.deepEqual(normalizarPlacar("lixo",new Set()),[]);
});
test("backup antigo sem placar continua válido; com placar mantém só músicas existentes",()=>{
  assert.deepEqual(normalizarDados({musicas:[{id:"m1",title:"A"}]}).placar,[]);
  const d=normalizarDados({musicas:[{id:"m1",title:"A"}],placar:[{musicaId:"m1",nota:70,em:1},{musicaId:"m2",nota:90,em:2}]});
  assert.equal(d.placar.length,1);assert.equal(d.placar[0].musicaId,"m1");
});
test("limparPlacar zera",()=>{const d={placar:[{musicaId:"m1",nota:1,em:1}]};limparPlacar(d);assert.deepEqual(d.placar,[])});
