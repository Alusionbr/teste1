"use strict";
/*
 * Sala da festa — cliente do Supabase, sem biblioteca (fetch puro em
 * /rest/v1/rpc/). Usado pela tela central (sala-host.js) e pelos celulares
 * (controle.js).
 *
 * As tabelas ficam no schema "karaoke", que a API não expõe; a única porta
 * são as funções public.karaoke_* (ver supabase/001_sala.sql). A chave aqui é
 * a PUBLICÁVEL (feita para ficar no navegador). Nunca colocar a service_role.
 *
 * Sem tempo real por websocket de propósito: consulta a cada 1,5–2 s é
 * simples, aguenta rede ruim e não precisa de biblioteca.
 */
const SALA_SUPABASE_URL="https://iowuejrpzoibyidiuvpt.supabase.co";
const SALA_SUPABASE_KEY="sb_publishable_RJisxh4p6IAXX_nPVtkMeQ__-QcfB8p";
const SALA_ALFABETO="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O e 1/I: fácil de ditar

async function salaRpc(fn,corpo,tempoLimite=10000){
  const r=await fetchSafe(`${SALA_SUPABASE_URL}/rest/v1/rpc/${fn}`,{
    method:"POST",
    headers:{apikey:SALA_SUPABASE_KEY,Authorization:"Bearer "+SALA_SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(corpo)
  },tempoLimite);
  const texto=await r.text();
  let dados=null;try{dados=texto?JSON.parse(texto):null}catch{}
  if(!r.ok){
    const msg=(dados&&(dados.message||dados.hint))||`erro ${r.status}`;
    const e=Error(traduzirErroSala(msg));e.status=r.status;e.bruto=msg;throw e;
  }
  return dados;
}
function traduzirErroSala(msg){
  if(/codigo em uso/.test(msg))return"Esse código de sala já está em uso.";
  if(/sala fechada|sala nao encontrada/.test(msg))return"A sala está fechada. Peça para abrirem de novo na tela da festa.";
  if(/token/.test(msg))return"Esta tela perdeu a chave da sala. Abra uma sala nova.";
  if(/muitos comandos/.test(msg))return"Calma! Muitos comandos seguidos — espere um pouquinho.";
  if(/Could not find the function|PGRST202/.test(msg))return"O servidor da sala ainda não foi preparado (migrações 001_sala.sql e 003_transferencia_tela.sql).";
  return"Falha na sala: "+msg;
}
function novoCodigoSala(){
  const r=crypto.getRandomValues(new Uint8Array(6));
  return [...r].map(b=>SALA_ALFABETO[b%SALA_ALFABETO.length]).join("");
}
function novoTokenSala(){return [...crypto.getRandomValues(new Uint8Array(20))].map(b=>b.toString(16).padStart(2,"0")).join("")}
function linkControle(codigo){
  const base=location.href.split("#")[0].split("?")[0].replace(/[^/]*$/,"");
  return `${base}controle.html?sala=${codigo}`;
}
// Link para outro aparelho assumir a sala como tela principal. O convite (segredo de 5 min,
// uso único) vai depois do #, então não passa pelo servidor do site.
function linkAssumir(codigo,convite){
  const base=location.href.split("#")[0].split("?")[0].replace(/[^/]*$/,"");
  return `${base}index.html#assumir=${codigo}${convite?"."+convite:""}`;
}
// Aceita o link inteiro ou só o código (ABC123 ou ABC123.convite).
function lerLinkAssumir(texto){
  const m=String(texto||"").match(/(?:#assumir=|^)\s*([A-Za-z0-9]{6,12})(?:\.([a-f0-9]{16,40}))?\s*$/);
  return m?{codigo:m[1].toUpperCase(),convite:m[2]||""}:null;
}
// Id anônimo do aparelho (não identifica a pessoa; só separa um celular do outro).
function idDoAparelho(){
  const K_ID="karaoke:aparelho";
  let id="";try{id=localStorage.getItem(K_ID)||""}catch{}
  if(!/^[a-zA-Z0-9-]{4,40}$/.test(id)){id="ap-"+novoTokenSala().slice(0,20);try{localStorage.setItem(K_ID,id)}catch{}}
  return id;
}
