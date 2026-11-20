"use strict";
/*
 * Família: quem canta. Cada cantor tem nome, emoji e cor — a cor pinta a
 * letra dele no palco (e a parte dele no dueto).
 */
const CORES_CANTOR=["#ff3d9a","#2de2e6","#ffd23f","#8b5cf6","#22c55e","#ff8a3d","#3b82f6","#f43f5e","#14b8a6","#eab308"];
const EMOJIS_CANTOR=["🎤","👵","👴","👩","👨","👧","👦","👶","🧒","🧑","🐶","🐱","🦄","🐸","🦁","🐼","🌟","🔥","🎸","🥁","🎹","🎷","👑","🌈"];

function criarCantor({nome,emoji,cor}){
  const usadas=new Set(K.dados.cantores.map(c=>c.cor));
  const c={id:uid("c"),nome:String(nome||"").trim().slice(0,24)||"Cantor",emoji:emoji||"🎤",
    cor:cor||CORES_CANTOR.find(x=>!usadas.has(x))||CORES_CANTOR[K.dados.cantores.length%CORES_CANTOR.length]};
  K.dados.cantores.push(c);
  return c;
}
function editarCantor(id,campos){
  const c=acharCantor(id);if(!c)return null;
  if(campos.nome!=null)c.nome=String(campos.nome).trim().slice(0,24)||c.nome;
  if(campos.emoji)c.emoji=campos.emoji;
  if(campos.cor)c.cor=campos.cor;
  return c;
}
// Remover cantor não apaga música nem item da playlist: o item fica "sem cantor".
function removerCantor(id){
  K.dados.cantores=K.dados.cantores.filter(c=>c.id!==id);
  K.dados.playlists.forEach(p=>p.itens.forEach(i=>{if(i.cantorA===id)i.cantorA=i.cantorB||"",i.cantorB="";if(i.cantorB===id)i.cantorB=""}));
}

/*
 * Rodízio: quem cantou menos nesta playlist vai primeiro. Empate → o próximo
 * na ordem da família depois de quem cantou por último. Função pura
 * (tests/familia.test.js).
 */
function proximoCantor(cantores,itens){
  if(!cantores.length)return"";
  const conta=new Map(cantores.map(c=>[c.id,0]));
  itens.forEach(i=>{[i.cantorA,i.cantorB].forEach(id=>{if(conta.has(id))conta.set(id,conta.get(id)+1)})});
  const menor=Math.min(...conta.values());
  const ultimo=[...itens].reverse().find(i=>conta.has(i.cantorA));
  const base=ultimo?cantores.findIndex(c=>c.id===ultimo.cantorA):-1;
  for(let k=1;k<=cantores.length;k++){
    const c=cantores[(base+k+cantores.length)%cantores.length];
    if(conta.get(c.id)===menor)return c.id;
  }
  return cantores[0].id;
}

function nomeCantor(id){const c=acharCantor(id);return c?`${c.emoji} ${c.nome}`:"Sem cantor"}

if(typeof module!=="undefined")module.exports={proximoCantor};
