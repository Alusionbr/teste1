"use strict";
// Treino é local à sessão. Só BPM e compasso pertencem à música salva.
const practice={bpm:80,beats:4,sections:[],selected:-1,memorizing:false,audio:null,running:false,starting:false,generation:0,timer:null,nextBeat:0,beat:0,nodes:new Set(),visualTimers:new Set(),taps:[]};

function practiceSections(lines){
  const marked=lines.map((line,i)=>line.type==="section"?i:-1).filter(i=>i>=0);
  const starts=marked.length?marked:lines.map((line,i)=>line.type!=="blank"&&(i===0||lines[i-1].type==="blank")?i:-1).filter(i=>i>=0);
  if(marked.length&&marked[0]>0&&lines.slice(0,marked[0]).some(l=>l.type!=="blank"))starts.unshift(0);
  return starts.map((start,i)=>({start,end:starts[i+1]??lines.length,label:lines[start].type==="section"?lines[start].text:`Trecho ${i+1}`}));
}
function resetPractice(){
  stopMetronome();practice.selected=-1;practice.memorizing=false;practice.taps=[];
  practice.sections=practiceSections(state.lines);
  const select=$("practiceSection");select.textContent="";
  const all=document.createElement("option");all.value="-1";all.textContent="Música inteira";select.appendChild(all);
  practice.sections.forEach((section,i)=>{const option=document.createElement("option");option.value=i;option.textContent=section.label;select.appendChild(option)});
  $("practiceBpm").value=practice.bpm=normalizeBpm(state.current?.bpm)||80;
  $("practiceBeats").value=practice.beats=normalizeBeats(state.current?.beats);
  const hasLyrics=state.lines.some(l=>l.type!=="blank");
  select.disabled=!hasLyrics;$("practiceRestart").disabled=!hasLyrics;$("practiceMemory").disabled=!hasLyrics;
  $("practiceSaveHint").textContent=state.current?"BPM e compasso acompanham a música ao salvar no repertório.":"Abra uma música para guardar seu BPM. O metrônomo já pode ser usado.";
  $("practiceHint").textContent=hasLyrics?"Escolha um trecho, cante e oculte os versos para testar sua memória. Cifras e seções continuam visíveis.":"Abra uma música para praticar por trechos. O metrônomo está disponível em Ritmo.";
  applyPracticeFocus();
}
function applyPracticeFocus(){
  const section=practice.sections[practice.selected];
  Array.from($("paper").children).forEach((node,i)=>{
    const inside=!section||(i>=section.start&&i<section.end);
    node.classList.toggle("practiceOutside",!!section&&!inside);
    const hide=practice.memorizing&&inside&&state.lines[i]?.type==="lyric";
    node.classList.toggle("practiceHidden",hide);
    if(hide)node.setAttribute("aria-hidden","true");else node.removeAttribute("aria-hidden");
  });
  $("practiceMemory").textContent=practice.memorizing?"Mostrar versos":"Ocultar versos";
  $("practiceMemory").setAttribute("aria-pressed",String(practice.memorizing));
}
function restartPracticeSection(){
  if(!state.lines.length)return;
  const i=practice.sections[practice.selected]?.start||0;
  if(state.lrc[i]){
    // Retorna ao tempo escolhido, mas respeita a pausa atual.
    if(state.karaoke){karaokeSeek(state.lrc[i].t);lastActive=-1;highlight(i)}
    else{syncOffset=state.lrc[i].t;syncStart=performance.now()-syncOffset*1000;lastActive=-1;highlight(i)}
  }else{
    scrollToLine(i);
    if(state.karaoke)manualAte=performance.now()+4000;
  }
  $("practiceHint").textContent=state.karaoke&&!state.lrc.length?"A letra voltou ao trecho. Sem letra temporizada, o áudio continua no ponto atual.":"Trecho reposicionado. Cante novamente ou use Rolar / Sincro para acompanhar.";
}
function selectPracticeSection(value){
  const i=Number(value);practice.selected=Number.isInteger(i)&&i>=0&&i<practice.sections.length?i:-1;
  applyPracticeFocus();restartPracticeSection();
}
function togglePracticePanel(){
  const panel=$("practicePanel");panel.hidden=!panel.hidden;
  $("practiceBtn").setAttribute("aria-expanded",String(!panel.hidden));
  if(panel.hidden){stopMetronome();practice.memorizing=false;practice.selected=-1;$("practiceSection").value="-1";applyPracticeFocus()}
}
function setPracticeBpm(value,fromTap=false){
  const n=Number(value);
  if(!Number.isFinite(n)||n<40||n>240){$("practiceBpm").value=practice.bpm;$("practiceHint").textContent="Escolha um andamento entre 40 e 240 BPM.";return}
  const bpm=Math.round(n);$("practiceBpm").value=practice.bpm=bpm;
  if(!fromTap)practice.taps=[];
  rememberSongPref("bpm",bpm);
  if(practice.running||practice.starting){stopMetronome();startMetronome()}
}
function tapPracticeTempo(){
  const now=performance.now(),last=practice.taps.at(-1);
  if(last!==undefined&&now-last>2000)practice.taps=[];
  practice.taps.push(now);practice.taps=practice.taps.slice(-5);
  if(practice.taps.length<2){$("practiceHint").textContent="Continue tocando no botão no ritmo da música.";return}
  const bpm=Math.round(60000*(practice.taps.length-1)/(now-practice.taps[0]));
  if(bpm>=40&&bpm<=240){setPracticeBpm(bpm,true);$("practiceHint").textContent=`Andamento estimado: ${bpm} BPM. Toque mais vezes para ajustar.`}
  else $("practiceHint").textContent="Toque num ritmo entre 40 e 240 BPM.";
}
function updateMetronomeButton(){
  const on=practice.running||practice.starting;
  $("metronomeBtn").textContent=on?"Parar metrônomo":"Ligar metrônomo";
  $("metronomeBtn").setAttribute("aria-pressed",String(on));
}
function stopMetronome(){
  practice.generation++;practice.running=false;practice.starting=false;
  clearTimeout(practice.timer);practice.timer=null;
  practice.visualTimers.forEach(clearTimeout);practice.visualTimers.clear();
  practice.nodes.forEach(node=>{try{node.stop()}catch{}});practice.nodes.clear();
  $("practicePulse").textContent="—";updateMetronomeButton();
}
async function startMetronome(){
  if(practice.running||practice.starting)return;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){$("practiceHint").textContent="Este navegador não oferece áudio para o metrônomo.";return}
  const generation=++practice.generation;practice.starting=true;updateMetronomeButton();
  try{
    if(!practice.audio||practice.audio.state==="closed")practice.audio=new Audio();
    // O contexto só nasce dentro do clique do usuário (inclusive no iPhone).
    await practice.audio.resume();
    if(generation!==practice.generation)return;
    if(practice.audio.state!=="running")throw Error("audio-paused");
    practice.starting=false;practice.running=true;practice.beat=0;practice.nextBeat=practice.audio.currentTime+.04;
    updateMetronomeButton();schedulePracticeBeat();
  }catch{
    if(generation!==practice.generation)return;
    stopMetronome();$("practiceHint").textContent="Não consegui iniciar o som. Toque em Ligar metrônomo para tentar novamente.";
  }
}
function schedulePracticeBeat(){
  if(!practice.running)return;
  const audio=practice.audio,bpm=practice.bpm,beats=practice.beats;
  // Agenda pelo relógio do áudio. Um atraso do JS não cria uma rajada de cliques.
  if(practice.nextBeat<audio.currentTime)practice.nextBeat=audio.currentTime+.02;
  try{
    while(practice.nextBeat<audio.currentTime+.1){
      const when=practice.nextBeat,beat=practice.beat,osc=audio.createOscillator(),gain=audio.createGain();
      osc.frequency.value=beat===0?1000:700;
      gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(.12,when+.003);gain.gain.exponentialRampToValueAtTime(.001,when+.045);
      osc.connect(gain);gain.connect(audio.destination);practice.nodes.add(osc);
      osc.onended=()=>{practice.nodes.delete(osc);osc.disconnect();gain.disconnect()};
      osc.start(when);osc.stop(when+.05);
      const timer=setTimeout(()=>{practice.visualTimers.delete(timer);if(practice.running)$("practicePulse").textContent=String(beat+1)},Math.max(0,(when-audio.currentTime)*1000));
      practice.visualTimers.add(timer);practice.beat=(beat+1)%beats;practice.nextBeat+=60/bpm;
    }
    practice.timer=setTimeout(schedulePracticeBeat,25);
  }catch{stopMetronome();$("practiceHint").textContent="O áudio foi interrompido. Toque em Ligar metrônomo para retomar."}
}
