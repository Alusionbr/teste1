"use strict";
(() => {
  // Neo Blocks: jogo local, sem dependências e sem serviços externos.
  const W=10,H=20,CELL=30;
  const shapes={
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]]
  };
  const colors={I:"#23ddf8",O:"#ffd238",T:"#b368ff",S:"#39f278",Z:"#ff5572",J:"#4694ff",L:"#ffa544",G:"#596d93"};
  const modes={
    classic:{label:"Clássico",description:"O desafio original. A cada 10 linhas, a velocidade aumenta.",title:"RESISTÊNCIA INFINITA",mission:"Limpe linhas sem alcançar o topo."},
    time:{label:"Contra o Tempo",description:"Você tem 2 minutos. Faça a maior pontuação possível.",title:"120 SEGUNDOS",mission:"Pontue o máximo antes que o cronômetro zere."},
    turbo:{label:"Turbo",description:"O jogo acelera a cada 20 segundos. Controle o caos.",title:"ACELERAÇÃO TOTAL",mission:"Sobreviva às mudanças de velocidade."},
    survival:{label:"Sobrevivência",description:"Uma nova linha de obstáculos aparece a cada 25 segundos.",title:"LINHAS INIMIGAS",mission:"Elimine blocos antes que os obstáculos encham o campo."},
    puzzle:{label:"Puzzle",description:"Resolva o tabuleiro: limpe 4 linhas usando no máximo 8 peças.",title:"OPERAÇÃO 4 LINHAS",mission:"Dica: comece com a peça I na vertical, alinhada à abertura."},
    lab:{label:"Laboratório",description:"Carregue energia limpando linhas; use X ou o botão para apagar a linha inferior.",title:"PODER EXPERIMENTAL",mission:"Cada linha eliminada recarrega 25% de energia."},
    gravity:{label:"Gravidade Caótica",description:"A velocidade de queda alterna entre lenta, média e rápida a cada 15 segundos.",title:"PULSO GRAVITACIONAL",mission:"Adapte seu ritmo à gravidade variável."},
    zen:{label:"Zen",description:"Jogue sem cronômetro ou derrota. O campo reinicia quando fica cheio.",title:"FLUXO LIVRE",mission:"Experimente combinações sem pressão."}
  };
  const el=id=>document.getElementById(id);
  const canvas=el("game"),ctx=canvas.getContext("2d");
  const nextCanvas=el("next"),nextCtx=nextCanvas.getContext("2d");
  const holdCanvas=el("hold"),holdCtx=holdCanvas.getContext("2d");
  const overlay=el("overlay");
  let mode="classic",board=[],piece=null,queue=[],bag=[],held=null,holdAllowed=true;
  let phase="menu",score=0,lines=0,level=1,combo=-1,placed=0,elapsed=0,gravityTick=0,garbageAt=25,energy=0;
  let lastFrame=0,lastHud=0,eventUntil=0,particles=[],soundOn=true,musicOn=false,audio=null,musicTimer=null,musicStep=0,repeatStart=null,repeatInterval=null;
  let best=0;
  function blank(){return Array.from({length:H},()=>Array(W).fill(null));}
  function clone(m){return m.map(row=>row.slice());}
  function shuffle(){const b=Object.keys(shapes);for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
  function ensureQueue(){while(queue.length<5){if(!bag.length)bag=shuffle();queue.push(bag.pop());}}
  function savedBest(){try{return Number(localStorage.getItem("neo_blocks_best_"+mode))||0;}catch{return 0;}}
  function saveBest(){if(score>best){best=score;try{localStorage.setItem("neo_blocks_best_"+mode,String(score));}catch{}}}
  function audioReady(){
    try{
      if(!audio){
        const AudioEngine=window.AudioContext||window.webkitAudioContext;
        if(!AudioEngine)return null;
        audio=new AudioEngine();
      }
      if(audio.state==="suspended"&&typeof audio.resume==="function"){
        const attempt=audio.resume();
        if(attempt&&typeof attempt.catch==="function")attempt.catch(()=>{});
      }
      return audio;
    }catch{return null;}
  }
  // Síntese em tempo real: efeitos e melodia próprios, sem arquivos externos.
  function tone(freq,duration=.08,wave="sine",volume=.03,delay=0,slide=.76){
    const a=audioReady();if(!a)return;
    try{
      const t=a.currentTime+delay;
      const o=a.createOscillator(),gain=a.createGain();
      o.type=wave;
      o.frequency.setValueAtTime(freq,t);
      o.frequency.exponentialRampToValueAtTime(Math.max(35,freq*slide),t+duration);
      gain.gain.setValueAtTime(.0001,t);
      gain.gain.exponentialRampToValueAtTime(Math.max(.00011,volume),t+Math.min(.012,duration*.2));
      gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      o.connect(gain);gain.connect(a.destination);
      o.start(t);o.stop(t+duration+.015);
    }catch{}
  }
  function beep(freq=440,duration=.08,wave="sine",volume=.035,delay=0,slide=.76){
    if(soundOn)tone(freq,duration,wave,volume,delay,slide);
  }
  const melody=[659.25,0,783.99,0,880,783.99,659.25,0,587.33,0,659.25,783.99,523.25,0,493.88,0];
  const bass=[110,110,130.81,130.81,146.83,146.83,123.47,123.47];
  function musicBeat(){
    if(!musicOn||phase!=="playing")return;
    const step=musicStep++%16;
    if(melody[step])tone(melody[step],.16,"triangle",.015,0,.96);
    if(step%2===0)tone(bass[(step/2)%bass.length],.21,"sine",.018,0,.90);
    if(step%4===2)tone(980,.027,"triangle",.003,0,.60);
  }
  function updateMusic(){
    if(musicTimer!==null){clearInterval(musicTimer);musicTimer=null;}
    if(musicOn&&phase==="playing"&&audioReady()){
      musicStep=0;
      musicBeat();
      musicTimer=setInterval(musicBeat,192);
    }
  }
  function updateAudioButtons(){
    el("soundState").textContent=soundOn?"ON":"OFF";
    el("musicState").textContent=musicOn?"ON":"OFF";
    el("soundBtn").setAttribute("aria-pressed",String(soundOn));
    el("musicBtn").setAttribute("aria-pressed",String(musicOn));
    el("soundBtn").setAttribute("aria-label",soundOn?"Desativar efeitos sonoros":"Ativar efeitos sonoros");
    el("musicBtn").setAttribute("aria-label",musicOn?"Desativar música":"Ativar música");
  }
  function loadAudioPrefs(){
    try{
      soundOn=localStorage.getItem("neo_blocks_sfx")!=="off";
      musicOn=localStorage.getItem("neo_blocks_music")==="on";
    }catch{}
    updateAudioButtons();
  }
  function saveAudioPrefs(){
    try{
      localStorage.setItem("neo_blocks_sfx",soundOn?"on":"off");
      localStorage.setItem("neo_blocks_music",musicOn?"on":"off");
    }catch{}
  }
  function inform(message){el("eventText").textContent=message;eventUntil=performance.now()+1900;}
  function displayOverlay(tag,title,desc,button){el("overlayTag").textContent=tag;el("overlayTitle").textContent=title;el("overlayText").textContent=desc;el("playBtn").textContent=button;overlay.classList.remove("hidden");}
  function speedInterval(){
    if(mode==="turbo")return Math.max(74,800*Math.pow(.80,Math.floor(elapsed/20)));
    if(mode==="gravity")return [950,460,180][Math.floor(elapsed/15)%3];
    if(mode==="zen")return 850;
    return Math.max(100,850*Math.pow(.83,level-1));
  }
  function reset(selectedMode){
    mode=selectedMode;board=blank();piece=null;queue=[];bag=[];held=null;holdAllowed=true;
    phase="menu";updateMusic();score=0;lines=0;level=1;combo=-1;placed=0;elapsed=0;gravityTick=0;garbageAt=25;energy=0;particles=[];best=savedBest();ensureQueue();
    if(mode==="puzzle"){
      for(let y=H-4;y<H;y++)for(let x=0;x<W;x++)if(x!==4)board[y][x]="G";
      queue[0]="I";
    }
    document.querySelectorAll(".mode").forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
    el("modeDescription").textContent=modes[mode].description;
    el("missionTitle").textContent=modes[mode].title;
    el("missionText").textContent=modes[mode].mission;
    displayOverlay("NEO BLOCKS // "+modes[mode].label.toUpperCase(),"PRONTO PARA JOGAR?","Comece a partida. Funciona com teclado ou botões de toque.","▶ COMEÇAR PARTIDA");
    el("pauseBtn").textContent="Ⅱ PAUSAR";
    el("powerButton").hidden=mode!=="lab";
    el("powerHint").textContent=mode==="lab"?"Limpe linhas para carregar e ative o poder com X.":"Limpe linhas e crie combos para pontuar.";
    inform("ESCOLHA SUA ESTRATÉGIA");
    updateHUD();draw();
  }
  function spawn(type){
    ensureQueue();const t=type||queue.shift();ensureQueue();
    const m=clone(shapes[t]);piece={type:t,m,x:Math.floor((W-m[0].length)/2),y:-1};
    if(collision(m,piece.x,piece.y)){
      if(mode==="zen"){board=blank();inform("CAMPO RENOVADO · CONTINUE");}
      else{finish(false,"O CAMPO FICOU CHEIO");return false;}
    }
    drawPreviews();return true;
  }
  function collision(mat,x,y){
    for(let j=0;j<mat.length;j++)for(let i=0;i<mat[j].length;i++)if(mat[j][i]){
      const bx=x+i,by=y+j;
      if(bx<0||bx>=W||by>=H||(by>=0&&board[by][bx]))return true;
    }
    return false;
  }
  function move(dx,dy){
    if(phase!=="playing"||!piece)return false;
    if(!collision(piece.m,piece.x+dx,piece.y+dy)){piece.x+=dx;piece.y+=dy;return true;}
    return false;
  }
  function rotateMat(m){
    const h=m.length,w=m[0].length;return Array.from({length:w},(_,x)=>Array.from({length:h},(_,y)=>m[h-1-y][x]));
  }
  function rotate(){
    if(phase!=="playing"||!piece)return;
    if(piece.type==="O")return;
    const m=rotateMat(piece.m);
    for(const dy of [0,-1,-2])for(const dx of [0,-1,1,-2,2]){
      if(!collision(m,piece.x+dx,piece.y+dy)){piece.m=m;piece.x+=dx;piece.y+=dy;beep(520,.045);return;}
    }
  }
  function hold(){
    if(phase!=="playing"||!piece||!holdAllowed)return;
    const t=piece.type;
    if(held){const swap=held;held=t;spawn(swap);}
    else{held=t;spawn();}
    holdAllowed=false;drawPreviews();beep(390,.09);
  }
  function softDrop(){if(move(0,1)){score++;beep(185,.027,"triangle",.011);return;}lock();}
  function hardDrop(){
    if(phase!=="playing"||!piece)return;
    let n=0;while(move(0,1))n++;
    score+=n*2;beep(190,.105,"triangle",.06);lock();
  }
  function clearRows(){
    const full=[];
    for(let y=0;y<H;y++)if(board[y].every(Boolean))full.push(y);
    if(!full.length){combo=-1;return;}
    for(const y of full)burstRow(y);
    board=board.filter(r=>r.some(v=>!v));while(board.length<H)board.unshift(Array(W).fill(null));
    const n=full.length;
    combo++;score+=([0,100,300,500,800][n]||800)*level+combo*50*level;
    lines+=n;const previousLevel=level;level=1+Math.floor(lines/10);
    if(mode==="lab")energy=Math.min(100,energy+n*25);
    inform(n===4?"TETRIS! +"+(800*level):n>=2?"COMBO DE "+n+" LINHAS!":"LINHA ELIMINADA!");
    el("flash").classList.add("on");setTimeout(()=>el("flash").classList.remove("on"),45);
    beep(n===4?850:600,.18,"triangle",.06);beep(n===4?1270:880,.16,"triangle",.033,.09,1.04);if(level>previousLevel){beep(1046,.26,"sine",.055,.15,1.25);}
    if(mode==="puzzle"&&lines>=4){finish(true,"AS QUATRO LINHAS FORAM ELIMINADAS!");}
  }
  function lock(){
    if(phase!=="playing"||!piece)return;
    let topped=false;
    for(let j=0;j<piece.m.length;j++)for(let i=0;i<piece.m[j].length;i++)if(piece.m[j][i]){
      const x=piece.x+i,y=piece.y+j;
      if(y<0)topped=true;else if(y<H&&x>=0&&x<W)board[y][x]=piece.type;
    }
    placed++;holdAllowed=true;piece=null;beep(145,.065,"triangle",.027);
    if(topped){
      if(mode==="zen"){board=blank();inform("CAMPO RENOVADO · CONTINUE");}
      else{finish(false,"O CAMPO FICOU CHEIO");return;}
    }
    clearRows();
    if(phase!=="playing")return;
    if(mode==="puzzle"&&placed>=8){finish(false,"AS OITO PEÇAS FORAM UTILIZADAS");return;}
    saveBest();spawn();updateHUD();
  }
  function burstRow(y){for(let i=0;i<24;i++)particles.push({x:Math.random()*W*CELL,y:(y+Math.random())*CELL,vx:(Math.random()-.5)*190,vy:(Math.random()-.5)*170,life:.4+Math.random()*.42,c:colors[Object.keys(shapes)[Math.floor(Math.random()*7)]]});if(particles.length>100)particles=particles.slice(-100);}
  function garbage(){
    if(board[0].some(Boolean)){finish(false,"OBSTÁCULOS ALCANÇARAM O TOPO");return;}
    const hole=Math.floor(Math.random()*W);
    board.shift();board.push(Array.from({length:W},(_,x)=>x===hole?null:"G"));
    if(piece&&collision(piece.m,piece.x,piece.y)){finish(false,"VOCÊ FOI ATINGIDO PELOS OBSTÁCULOS");return;}
    inform("⚠ OBSTÁCULO ADICIONADO");beep(180,.20,"sawtooth");
  }
  function activatePower(){
    if(mode!=="lab"||phase!=="playing"||energy<100)return;
    energy=0;const idx=board.findLastIndex?board.findLastIndex(row=>row.some(Boolean)):(()=>{for(let i=H-1;i>=0;i--)if(board[i].some(Boolean))return i;return -1;})();
    if(idx<0){energy=100;inform("AGUARDE ATÉ EXISTIREM BLOCOS");return;}
    burstRow(idx);board.splice(idx,1);board.unshift(Array(W).fill(null));score+=200*level;inform("⚡ RAIO DE LIMPEZA ATIVADO");beep(1100,.25,"sawtooth");saveBest();updateHUD();
  }
  function finish(won,reason){
    if(phase!=="playing")return;
    phase="over";updateMusic();saveBest();
    const tag=won?"MISSÃO CUMPRIDA":"FIM DE PARTIDA";
    displayOverlay(tag,won?"VITÓRIA!":"FIM DE JOGO",reason+" · Pontuação: "+score.toLocaleString("pt-BR"),"↻ JOGAR NOVAMENTE");
    el("status").textContent=won?"VITÓRIA":"FINALIZADO";beep(won?880:160,.35,"triangle",.05);
    updateHUD();
  }
  function start(){
    if(phase==="paused"){audioReady();phase="playing";overlay.classList.add("hidden");el("status").textContent="JOGANDO";el("pauseBtn").textContent="Ⅱ PAUSAR";lastFrame=performance.now();updateMusic();beep(630,.10);return;}
    audioReady();reset(mode);phase="playing";overlay.classList.add("hidden");spawn();lastFrame=performance.now();updateMusic();updateHUD();beep(660,.10);beep(990,.12,"triangle",.028,.09,1.10);
  }
  function pause(){
    if(phase==="playing"){phase="paused";updateMusic();displayOverlay("PARTIDA PAUSADA","PAUSA","Seu progresso está preservado.","▶ CONTINUAR");el("pauseBtn").textContent="▶ CONTINUAR";}
    else if(phase==="paused")start();
    updateHUD();
  }
  function tick(dt){
    elapsed+=dt;
    if(mode==="time"&&elapsed>=120){elapsed=120;finish(true,"TEMPO ESGOTADO");return;}
    if(mode==="survival"&&elapsed>=garbageAt){garbageAt+=25;garbage();if(phase!=="playing")return;}
    gravityTick+=dt*1000;
    if(gravityTick>=speedInterval()){gravityTick=0;if(!move(0,1))lock();}
  }
  function pad(n){return String(Math.floor(n)).padStart(2,"0");}
  function updateHUD(){
    el("score").textContent=String(score).padStart(6,"0");
    el("lines").textContent=lines;
    el("level").textContent=mode==="turbo"?1+Math.floor(elapsed/20):mode==="gravity"?Math.floor(elapsed/15)%3+1:level;
    el("combo").textContent=combo>0?"×"+(combo+1):"—";
    el("timer").textContent=mode==="time"?pad(Math.max(0,Math.ceil(120-elapsed))/60)+":"+pad(Math.max(0,Math.ceil(120-elapsed))%60):pad(elapsed/60)+":"+pad(elapsed%60);
    el("best").textContent=Math.max(best,score).toLocaleString("pt-BR");
    const progress=mode==="time"?100*(1-elapsed/120):mode==="puzzle"?Math.min(100,lines*25):mode==="survival"?100*(1-(garbageAt-elapsed)/25):mode==="turbo"?((elapsed%20)/20)*100:mode==="gravity"?((elapsed%15)/15)*100:(lines%10)*10;
    el("missionMeter").firstElementChild.style.width=Math.max(0,Math.min(100,progress))+"%";
    el("speedLabel").textContent=mode==="gravity"?["GRAVIDADE LEVE","GRAVIDADE NORMAL","GRAVIDADE EXTREMA"][Math.floor(elapsed/15)%3]:"GRAVIDADE "+String(mode==="turbo"?1+Math.floor(elapsed/20):level).padStart(2,"0");
    el("status").textContent=phase==="playing"?"JOGANDO":phase==="paused"?"PAUSADO":phase==="over"?"FINALIZADO":"PRONTO";
    el("powerLabel").textContent=mode==="lab"?"PODER DISPONÍVEL":"ENERGIA DO JOGO";
    el("powerText").textContent=mode==="lab"?energy+"%":"NEON";
    el("powerMeter").style.width=(mode==="lab"?energy:Math.min(100,(lines%4)*25))+"%";
    el("powerButton").disabled=phase!=="playing"||energy<100;
    if(mode==="puzzle")el("missionText").textContent=lines+"/4 linhas · "+placed+"/8 peças usadas. Alinhe a peça I na abertura.";
  }
  function cell(context,x,y,size,type,opacity=1){
    if(type==null)return;
    const color=colors[type]||type;
    context.save();context.globalAlpha=opacity;const px=x*size,py=y*size;
    context.shadowColor=color;context.shadowBlur=opacity<.5?2:9;context.fillStyle=color;context.fillRect(px+1.3,py+1.3,size-2.6,size-2.6);
    context.shadowBlur=0;const g=context.createLinearGradient(px,py,px+size,py+size);g.addColorStop(0,"#ffffff95");g.addColorStop(.32,"#ffffff13");g.addColorStop(.74,"#00000030");g.addColorStop(1,"#00000078");
    context.fillStyle=g;context.fillRect(px+3,py+3,size-6,size-6);
    context.strokeStyle="#ffffff95";context.lineWidth=1;context.beginPath();context.moveTo(px+3,py+size-4);context.lineTo(px+3,py+3);context.lineTo(px+size-4,py+3);context.stroke();
    context.strokeStyle="#00000088";context.beginPath();context.moveTo(px+size-3,py+4);context.lineTo(px+size-3,py+size-3);context.lineTo(px+4,py+size-3);context.stroke();
    context.restore();
  }
  function drawPiece(context,p,alpha=1){
    if(!p)return;
    for(let j=0;j<p.m.length;j++)for(let i=0;i<p.m[j].length;i++)if(p.m[j][i]&&p.y+j>=0)cell(context,p.x+i,p.y+j,CELL,p.type,alpha);
  }
  function draw(){
    ctx.clearRect(0,0,300,600);
    ctx.fillStyle="#071027";ctx.fillRect(0,0,300,600);
    const back=ctx.createLinearGradient(0,0,300,600);back.addColorStop(0,"#0b2642");back.addColorStop(.5,"#090e29");back.addColorStop(1,"#171136");ctx.fillStyle=back;ctx.fillRect(0,0,300,600);
    ctx.strokeStyle="#32628a45";ctx.lineWidth=1;ctx.beginPath();
    for(let x=0;x<=W;x++){ctx.moveTo(x*CELL+.5,0);ctx.lineTo(x*CELL+.5,600);}
    for(let y=0;y<=H;y++){ctx.moveTo(0,y*CELL+.5);ctx.lineTo(300,y*CELL+.5);}ctx.stroke();
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(board[y][x])cell(ctx,x,y,CELL,board[y][x]);
    if(piece){
      let gy=piece.y;while(!collision(piece.m,piece.x,gy+1))gy++;
      if(gy!==piece.y)drawPiece(ctx,{...piece,y:gy},.19);
      drawPiece(ctx,piece);
    }
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*1.3);ctx.fillStyle=p.c;ctx.shadowColor=p.c;ctx.shadowBlur=7;ctx.fillRect(p.x,p.y,3.8,3.8);}ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  function paintPreview(context,can,type,top,size){
    if(!type)return;
    const m=shapes[type];let minx=Infinity,maxx=-1,miny=Infinity,maxy=-1;
    for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x]){minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);}
    const left=(can.width-(maxx-minx+1)*size)/2,offsetY=top+((75-(maxy-miny+1)*size)/2);
    context.save();context.translate(left-minx*size,offsetY-miny*size);
    for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(m[y][x]){
      const px=x*size,py=y*size;context.shadowColor=colors[type];context.shadowBlur=11;context.fillStyle=colors[type];context.fillRect(px+2,py+2,size-4,size-4);context.shadowBlur=0;context.fillStyle="#ffffff65";context.fillRect(px+4,py+3,size-8,2);context.strokeStyle="#ecfaffaa";context.strokeRect(px+2.5,py+2.5,size-5,size-5);
    }context.restore();
  }
  function drawPreviews(){
    nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);holdCtx.clearRect(0,0,holdCanvas.width,holdCanvas.height);
    for(let i=0;i<3;i++){if(i){nextCtx.strokeStyle="#2c447c";nextCtx.beginPath();nextCtx.moveTo(15,i*90);nextCtx.lineTo(149,i*90);nextCtx.stroke();}paintPreview(nextCtx,nextCanvas,queue[i],i*90,21);}
    if(held)paintPreview(holdCtx,holdCanvas,held,10,22);else{holdCtx.fillStyle="#6a83ad";holdCtx.font="12px system-ui";holdCtx.textAlign="center";holdCtx.fillText("VAZIO",82,50);}
  }
  function frame(now){
    const dt=lastFrame?Math.min(.06,Math.max(0,(now-lastFrame)/1000)):0;lastFrame=now;
    if(phase==="playing")tick(dt);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=125*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    if(eventUntil&&now>eventUntil){el("eventText").textContent="PREPARE SEU COMBO";eventUntil=0;}
    if(now-lastHud>120){updateHUD();lastHud=now;}
    draw();requestAnimationFrame(frame);
  }
  function action(name){
    if(phase!=="playing")return;
    switch(name){
      case"left":if(move(-1,0))beep(310,.025,"triangle",.012);break;
      case"right":if(move(1,0))beep(360,.025,"triangle",.012);break;
      case"down":softDrop();break;
      case"rotate":rotate();break;
      case"drop":hardDrop();break;
      case"hold":hold();break;
      case"power":activatePower();break;
    }
    updateHUD();draw();
  }
  function stopRepeating(){clearTimeout(repeatStart);clearInterval(repeatInterval);repeatStart=null;repeatInterval=null;document.querySelectorAll(".touch-controls button").forEach(b=>b.classList.remove("pressed"));}
  document.querySelectorAll(".touch-controls button").forEach(btn=>{
    btn.addEventListener("pointerdown",e=>{
      e.preventDefault();stopRepeating();btn.setPointerCapture(e.pointerId);btn.classList.add("pressed");
      const a=btn.dataset.action;action(a);
      if(["left","right","down"].includes(a))repeatStart=setTimeout(()=>{repeatInterval=setInterval(()=>action(a),88);},190);
    });
    btn.addEventListener("pointerup",stopRepeating);btn.addEventListener("pointercancel",stopRepeating);btn.addEventListener("lostpointercapture",stopRepeating);
  });
  document.addEventListener("keydown",e=>{
    if(el("helpDialog").open)return;
    const keys={ArrowLeft:"left",ArrowRight:"right",ArrowDown:"down",ArrowUp:"rotate",Space:"drop",KeyC:"hold",ShiftLeft:"hold",ShiftRight:"hold",KeyX:"power"};
    if(keys[e.code]){e.preventDefault();if(!e.repeat||["left","right","down"].includes(keys[e.code]))action(keys[e.code]);}
    else if(e.code==="KeyP"||e.code==="Escape"){e.preventDefault();pause();}
    else if(e.code==="Enter"&&phase!=="playing"){e.preventDefault();start();}
  });
  document.querySelectorAll(".mode").forEach(b=>b.addEventListener("click",()=>{stopRepeating();reset(b.dataset.mode);}));
  el("playBtn").addEventListener("click",start);
  el("restartBtn").addEventListener("click",()=>start());
  el("mobileRestart").addEventListener("click",()=>start());
  el("pauseBtn").addEventListener("click",pause);
  el("soundBtn").addEventListener("click",()=>{audioReady();soundOn=!soundOn;saveAudioPrefs();updateAudioButtons();if(soundOn)beep(740,.12,"triangle",.05);});
  el("musicBtn").addEventListener("click",()=>{audioReady();musicOn=!musicOn;saveAudioPrefs();updateAudioButtons();updateMusic();if(musicOn)beep(880,.12,"sine",.026);});
  el("helpBtn").addEventListener("click",()=>{if(phase==="playing")pause();el("helpDialog").showModal();});
  el("closeHelp").addEventListener("click",()=>el("helpDialog").close());
  el("helpPlay").addEventListener("click",()=>el("helpDialog").close());
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&phase==="playing")pause();});
  const powerButton=document.createElement("button");powerButton.id="powerButton";powerButton.type="button";powerButton.className="button-primary";powerButton.style.cssText="width:100%;margin-top:12px;padding:10px;font-size:11px";powerButton.textContent="⚡ ATIVAR PODER";powerButton.addEventListener("click",()=>action("power"));document.querySelector(".power-panel").appendChild(powerButton);
  loadAudioPrefs();reset("classic");requestAnimationFrame(frame);
})();