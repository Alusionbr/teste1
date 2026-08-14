"use strict";
/*
 * Velocidade de rolagem calculada pela duração da música.
 *
 * Ajustar a velocidade na mão é o que mais atrapalha no palco: a música começa,
 * a letra desce rápido demais ou devagar demais, e você fica no "+/−" em vez de
 * tocar. A duração já vem do LRCLIB junto com a letra — com ela dá para calcular
 * quantos pixels por segundo fazem a letra terminar junto com a música.
 *
 * A conta é a distância que falta rolar dividida pelo tempo disponível. A
 * distância muda quando muda o tamanho da letra ou a rotação da tela, por isso
 * o ResizeObserver lá embaixo refaz o cálculo sozinho.
 */

// Alguns segundos de folga: quase toda gravação tem introdução antes do
// primeiro verso, e ninguém começa a ler no primeiro estalo.
const LEAD_IN = 4;

function scrollDistance(){const v=$("paperViewport");return Math.max(0,v.scrollHeight-v.clientHeight)}

// Devolve px/s, ou 0 quando não dá para calcular (sem duração, sem letra, ou
// letra tão curta que cabe na tela e não precisa rolar).
function speedForSong(song){
  const dur=Number(song&&song.duration)||0,dist=scrollDistance();
  if(dur<=LEAD_IN+5||dist<=0)return 0;
  return Math.round(Math.max(4,Math.min(140,dist/(dur-LEAD_IN))));
}

function applyAutoSpeed(){
  if(!state.auto)return;
  const px=speedForSong(state.current);
  if(!px)return;
  state.speed=px;updateControls();
}

function setAuto(on){
  state.auto=!!on;
  if(state.auto)applyAutoSpeed();
  updateControls();
  rememberSongPref("auto",state.auto);
}

function toggleAuto(){
  if(state.auto){setAuto(false);return notify("Velocidade no manual.",true)}
  if(!state.current)return notify("Abra uma música antes de ligar o automático.");
  // Sem duração conhecida não há o que calcular: pergunta em vez de falhar calado.
  if(!(Number(state.current.duration)>0))return askDuration();
  setAuto(true);
  if(!speedForSong(state.current))return notify("Esta letra cabe na tela: não precisa rolar.",true);
  notify(`Velocidade automática: ${state.speed} px/s para terminar em ${fmt(state.current.duration)}.`,true);
}

function askDuration(){
  if(!state.current)return;
  $("durationInput").value=state.current.duration?fmt(state.current.duration):"";
  $("durationDialog").showModal();$("durationInput").focus();
}

function saveDuration(text){
  if(!state.current)return;
  const sec=parseClock(text);
  if(!sec)return notify("Não entendi a duração. Escreva no formato 3:45.");
  state.current.duration=sec;
  persistCurrent(["duration"]);
  if(state.tab==="setlist")renderList();
  setAuto(true);
  notify(speedForSong(state.current)
    ? `Duração ${fmt(sec)} salva. Velocidade automática: ${state.speed} px/s.`
    : `Duração ${fmt(sec)} salva. Esta letra cabe na tela: não precisa rolar.`,true);
}

// A altura da letra muda com o tamanho da fonte, a rotação da tela e a troca de
// música. Recalcular sozinho evita que o automático fique errado no meio do show.
if("ResizeObserver"in window)new ResizeObserver(()=>applyAutoSpeed()).observe($("paper"));
