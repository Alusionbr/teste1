"use strict";
/*
 * Placar pessoal do "Cantar sozinho".
 *
 * Sem DOM: recebe e devolve dados, por isso roda no Node (tests/placar.test.js).
 * O placar fica em K.dados.placar = [{musicaId, nota, em}] e vai no backup.
 * Guarda no máximo MAX_PLACAR registros: os mais antigos saem primeiro, mas o
 * melhor resultado de cada música nunca é descartado.
 */
const MAX_PLACAR=300;

function normalizarPlacar(lista,idsDeMusicas){
  const ok=idsDeMusicas instanceof Set?id=>idsDeMusicas.has(id):()=>true;
  const out=[];
  for(const r of Array.isArray(lista)?lista:[]){
    if(!r||typeof r.musicaId!=="string"||!ok(r.musicaId))continue;
    const nota=Number(r.nota),em=Number(r.em);
    if(!Number.isFinite(nota)||nota<0||nota>100)continue;
    out.push({musicaId:r.musicaId,nota:Math.round(nota),em:Number.isFinite(em)&&em>0?em:0});
  }
  return aparar(out);
}

// Mantém os MAX_PLACAR registros mais novos, mais o melhor de cada música.
function aparar(lista){
  if(lista.length<=MAX_PLACAR)return lista;
  const melhores=new Map();
  lista.forEach((r,i)=>{const m=melhores.get(r.musicaId);if(m==null||r.nota>=lista[m].nota)melhores.set(r.musicaId,i)});
  const guardar=new Set(melhores.values());
  let sobra=lista.length-MAX_PLACAR;
  return lista.filter((r,i)=>{
    if(sobra>0&&!guardar.has(i)){sobra--;return false}
    return true;
  });
}

// Maior nota da música, ou null se ela nunca foi cantada com nota.
function melhorNota(dados,musicaId){
  let melhor=null;
  for(const r of dados.placar||[])if(r.musicaId===musicaId&&(melhor===null||r.nota>melhor))melhor=r.nota;
  return melhor;
}

// Grava a nota e diz se bateu o recorde. A primeira nota de uma música conta
// como recorde; igualar o recorde antigo não.
function registrarNota(dados,musicaId,nota,quando=Date.now()){
  const n=Math.max(0,Math.min(100,Math.round(Number(nota)||0)));
  const antes=melhorNota(dados,musicaId);
  if(!Array.isArray(dados.placar))dados.placar=[];
  dados.placar.push({musicaId,nota:n,em:quando});
  dados.placar=aparar(dados.placar);
  return{recorde:antes===null||n>antes,melhor:Math.max(antes===null?0:antes,n),anterior:antes};
}

function limparPlacar(dados){dados.placar=[]}

if(typeof module!=="undefined")module.exports={MAX_PLACAR,normalizarPlacar,melhorNota,registrarNota,limparPlacar};
