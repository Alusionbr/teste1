"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const A=require("../aplausometro.js");
test("aplausômetro: silêncio dá nota baixa, barulho dá nota alta, entre 0 e 100",()=>{
  assert.equal(A.notaDosAplausos([]),0);
  assert.ok(A.notaDosAplausos(Array(50).fill(0.002))<10);
  assert.ok(A.notaDosAplausos(Array(50).fill(0.5))>90);
  assert.equal(A.notaDosAplausos([1,1,1]),100);
  const meio=A.notaDosAplausos([...Array(70).fill(0.001),...Array(30).fill(0.1)]);
  assert.ok(meio>60,"um aplauso forte no meio vale, mesmo com silêncio antes");
});
test("estrelas e frases cobrem a faixa toda",()=>{
  assert.equal(A.estrelas(0),1);assert.equal(A.estrelas(100),5);
  for(const n of [0,40,60,80,95])assert.ok(A.frase(n).length>3);
});
