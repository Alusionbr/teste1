"use strict";
/*
 * Núcleo do Karaokê em Casa: versão, utilidades e acesso à rede.
 *
 * APP_VERSION anda junto com VERSION (sw.js) e com o data-version e os ?v= do
 * index.html e do controle.html. Alterou qualquer arquivo, suba os três — o
 * teste de contrato (tests/contracts.test.js) falha se divergirem.
 */
const APP_VERSION="1.0.13";
const LRCLIB_HEADERS={Accept:"application/json","Lrclib-Client":`KaraokeEmCasa/${APP_VERSION} (https://alusionbr.github.io/teste1/karaoke/)`};

const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
// Compara textos ignorando acento, maiúscula e pontuação.
function fold(s){return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/&/g," e ").replace(/[^a-z0-9]+/g," ").trim()}
function fmt(sec){if(!Number.isFinite(sec)||sec<0)sec=0;const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,"0")}`}
// Lê "3:45" ou "225" e devolve segundos (0 quando não entende).
function parseClock(text){const t=String(text||"").trim();if(!t)return 0;const m=t.match(/^(\d+)\s*[:.']\s*(\d{1,2})$/);if(m)return +m[1]*60+Math.min(59,+m[2]);return /^\d+$/.test(t)?+t:0}
function uid(prefixo){const r=crypto.getRandomValues(new Uint32Array(2));return `${prefixo}-${Date.now().toString(36)}-${r[0].toString(36)}${r[1].toString(36)}`.slice(0,40)}

/*
 * Aviso na tela. `acao` = {label, run} vira um botão dentro do aviso.
 * Avisos de sucesso somem sozinhos; erros ficam até o próximo aviso.
 */
let avisoTimer=null;
function notify(msg,ok=false,acao=null){
  const host=$("aviso");if(!host)return;
  host.textContent="";clearTimeout(avisoTimer);
  if(!msg)return;
  const box=document.createElement("div");
  box.className="aviso"+(ok?" ok":"");
  box.setAttribute("role",ok?"status":"alert");
  box.textContent=msg;
  if(acao&&acao.label&&acao.run){const b=document.createElement("button");b.type="button";b.textContent=acao.label;b.onclick=()=>{host.textContent="";acao.run()};box.append(" ",b)}
  const fechar=document.createElement("button");fechar.type="button";fechar.className="fecharAviso";fechar.textContent="×";fechar.setAttribute("aria-label","Fechar aviso");fechar.onclick=()=>{host.textContent=""};
  box.append(fechar);
  host.appendChild(box);
  if(ok&&!acao)avisoTimer=setTimeout(()=>{host.textContent=""},4000);
}

/* -------------------------------------------------------------------- rede */
async function fetchSafe(url,options={},timeout=12000){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
  try{return await fetch(url,{...options,signal:ctrl.signal})}
  catch(e){if(e.name==="AbortError")throw Error("A fonte demorou demais para responder. Tente novamente.");throw e}
  finally{clearTimeout(timer)}
}
// Repete uma vez em erro passageiro (502/503/504). Nunca em 429: aí o
// servidor está pedindo para esperar, e insistir só piora.
async function fetchRetrying(url,options={},timeout=12000){
  const first=await fetchSafe(url,options,timeout);
  if(![502,503,504].includes(first.status))return first;
  const wait=Math.min(3000,(Number(first.headers.get("Retry-After"))||1)*1000);
  await new Promise(res=>setTimeout(res,wait));
  return fetchSafe(url,options,timeout);
}
/*
 * Saúde das fontes nesta sessão. Fonte que falhou é poupada por 20 s e depois
 * volta a ser consultada — nunca para sempre: um único 503 passageiro não pode
 * desligar a busca de letra pela festa inteira.
 */
const sourceStatus={};
const SOURCE_COOLDOWN_MS=20000;
function markSource(name,ok,detail){sourceStatus[name]={ok,at:Date.now(),detail}}
function sourceCoolingDown(name){const s=sourceStatus[name];return!!s&&!s.ok&&(Date.now()-s.at)<SOURCE_COOLDOWN_MS}
function forgetSourceFailures(){Object.values(sourceStatus).forEach(s=>{if(s&&s.ok===false)s.at=0})}

/*
 * Gravar o estado inteiro custa caro. Ajuste fino (adiantar letra, atraso da
 * caixa) agenda a gravação; o que não pode se perder (adicionar, remover,
 * salvar sincronia) grava na hora. flushSaves() fecha a conta ao sair.
 */
const pendingSaves=new Map();
function saveSoon(key,build,ms=700){const p=pendingSaves.get(key);if(p)clearTimeout(p.timer);pendingSaves.set(key,{build,timer:setTimeout(()=>{pendingSaves.delete(key);build()},ms)})}
function flushSaves(){const jobs=[...pendingSaves.values()];pendingSaves.clear();jobs.forEach(p=>{clearTimeout(p.timer);p.build()})}

/* ------------------------------------------------- tela acesa durante a festa */
let wakeLock=null,pedindoWake=false;
async function keepAwake(){
  if(wakeLock||pedindoWake||!("wakeLock" in navigator))return;
  pedindoWake=true;
  try{wakeLock=await navigator.wakeLock.request("screen");wakeLock.addEventListener("release",()=>{wakeLock=null})}
  catch{}finally{pedindoWake=false}
}
function releaseAwake(){if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}
