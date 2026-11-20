"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const L=require("../lrc.js");

test("lê LRC comum, ordena e calcula o fim de cada linha",()=>{
  const {sincronizada,linhas}=L.lerLetra("[ar:Alguém]\n[00:05.00]Segunda\n[00:01.50]Primeira\n[00:09.00]");
  assert.equal(sincronizada,true);
  assert.deepEqual(linhas.map(l=>[l.t,l.texto,l.fim]),[[1.5,"Primeira",5],[5,"Segunda",9],[9,"",15]]);
});

test("aceita várias marcas de tempo na mesma linha (refrão repetido)",()=>{
  const {linhas}=L.lerLetra("[00:10.00][00:30.00]Refrão\n[00:20.00]Verso");
  assert.deepEqual(linhas.map(l=>l.texto),["Refrão","Verso","Refrão"]);
});

test("LRC enhanced: tempo por palavra",()=>{
  const {linhas}=L.lerLetra("[00:01.00]<00:01.00>Olá <00:01.50>mundo\n[00:04.00]fim");
  assert.deepEqual(linhas[0].palavras,[{t:1,texto:"Olá "},{t:1.5,texto:"mundo"}]);
  assert.equal(linhas[0].texto,"Olá mundo");
  const p=L.preenchimento(linhas[0],1.25);
  assert.equal(p[0],0.5);assert.equal(p[1],0);
  assert.deepEqual(L.preenchimento(linhas[0],0.5),[0,0]);
});

test("dueto: A/B/T e M/F/D, marca vale até a próxima",()=>{
  const {linhas}=L.lerLetra("[00:01.00]A: um\n[00:02.00]dois\n[00:03.00]F: três\n[00:04.00]D: quatro");
  assert.deepEqual(linhas.map(l=>[l.parte,l.texto]),[["A","um"],["A","dois"],["B","três"],["T","quatro"]]);
});

test("ida e volta: paraTexto(lerLetra(x)) preserva tempo, parte e palavras",()=>{
  const fonte="[00:01.00]A: <00:01.00>Olá <00:01.50>mundo\n[00:02.25]outra\n[00:03.00]B: tchau";
  const a=L.lerLetra(fonte).linhas,b=L.lerLetra(L.paraTexto(a)).linhas;
  assert.deepEqual(b,a);
  assert.equal(L.paraTexto(a).split("\n")[1],"[00:02.25]outra");
});

test("texto simples vira linhas sem tempo, sem linhas vazias",()=>{
  const {sincronizada,linhas}=L.lerLetra("Primeira\n\nA: Segunda\n");
  assert.equal(sincronizada,false);
  assert.deepEqual(linhas.map(l=>[l.t,l.texto,l.parte]),[[null,"Primeira",""],[null,"Segunda","A"]]);
  assert.deepEqual(L.versosDaLetra("[00:01.00]x\n[00:02.00]\n[00:03.00]y").map(l=>l.texto),["x","y"]);
});

test("indiceNoTempo acha a última linha já começada",()=>{
  const {linhas}=L.lerLetra("[00:01.00]a\n[00:02.00]b\n[00:03.00]c");
  assert.equal(L.indiceNoTempo(linhas,0.5),-1);
  assert.equal(L.indiceNoTempo(linhas,2),1);
  assert.equal(L.indiceNoTempo(linhas,99),2);
});

test("preenchimento sem tempo por palavra termina antes da próxima linha",()=>{
  const {linhas}=L.lerLetra("[00:00.00]uma linha curta\n[00:10.00]próxima");
  const l=linhas[0];
  assert.deepEqual(L.preenchimento(l,0),[0,0,0]);
  const fim=L.preenchimento(l,2.5);
  assert.ok(fim.every(x=>x===1),"linha curta já cheia em 2,5 s");
  const meio=L.preenchimento(l,0.6);
  assert.ok(meio[0]>0&&meio[2]<1);
});

test("fmtLRC arredonda centésimos",()=>{
  assert.equal(L.fmtLRC(61.234),"01:01.23");
  assert.equal(L.fmtLRC(0),"00:00.00");
});

test("diferencaDuracao só avisa quando o playback destoa da letra",()=>{
  assert.equal(L.diferencaDuracao(200,203),0);        // fade/silêncio no fim é normal
  assert.equal(L.diferencaDuracao(200,222),22);       // playback mais longo
  assert.equal(L.diferencaDuracao(200,185),-15);      // playback mais curto
  assert.equal(L.diferencaDuracao(0,222),0);          // letra sem duração: nada a comparar
  assert.equal(L.diferencaDuracao(200,0),0);          // player ainda sem duração
  assert.equal(L.diferencaDuracao(200,210,15),0);     // limite configurável
});
