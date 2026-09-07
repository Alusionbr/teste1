// Regressões de dados, relógio de áudio e concorrência; sem navegador ou rede.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

function harness(){
  const elements=new Map(),timers=new Map();let clock=0,id=0;
  function element(){
    const classes=new Set(),attrs=new Map();let text='',html='';
    return {children:[],dataset:{},style:{setProperty(){}},hidden:false,value:'',offsetTop:100,offsetHeight:30,clientHeight:500,
      classList:{toggle(c,on){on?classes.add(c):classes.delete(c)},remove(...c){c.forEach(x=>classes.delete(x))},contains(c){return classes.has(c)}},
      setAttribute(k,v){attrs.set(k,v)},removeAttribute(k){attrs.delete(k)},getAttribute(k){return attrs.get(k)},
      get textContent(){return text},set textContent(v){text=String(v);this.children=[]},
      get innerHTML(){return html},set innerHTML(v){html=v;this.children=[]},
      appendChild(n){this.children.push(n)},querySelectorAll(){return this.children},querySelector(){return element()},
      scrollTo(v){this.scroll=v},addEventListener(){},focus(){}
    };
  }
  const get=k=>{if(!elements.has(k))elements.set(k,element());return elements.get(k)};
  const context=vm.createContext({console,URL,URLSearchParams,AbortController,performance:{now:()=>clock},
    setTimeout(fn,ms){timers.set(++id,{fn,ms});return id},clearTimeout(n){timers.delete(n)},
    requestAnimationFrame(){return 1},cancelAnimationFrame(){},navigator:{},
    document:{getElementById:get,createElement:element,documentElement:{style:{setProperty(){}}},body:element(),querySelectorAll(){return[]}},
    window:{},localStorage:{getItem(){return null},setItem(){}}});
  const run=s=>vm.runInContext(s,context);
  ['core.js','library.js','song-prefs.js','player.js','practice.js'].forEach(f=>run(source(f)));
  run('function renderSetlistBar(){};function saveSetlists(){};function saveSetlistsSoon(){};function applyAutoSpeed(){};function karaokeStop(){};function karaokeOnSongChange(){}');
  return {run,get,context,timers,element,setClock(n){clock=n}};
}

test('BPM e compasso sobrevivem ao ciclo exportar/importar e arquivos antigos continuam válidos',()=>{
  const h=harness();
  assert.equal(h.run('normalizeSong(JSON.parse(JSON.stringify(storedSong({title:"Ensaio",bpm:96,beats:3})))).bpm'),96);
  assert.equal(h.run('normalizeSong({bpm:96,beats:3}).beats'),3);
  assert.equal(h.run('normalizeSong({titulo:"Antiga",letra:"Verso"}).bpm'),0);
  assert.equal(h.run('normalizeSong({titulo:"Antiga",letra:"Verso"}).beats'),4);
  for(const bad of ['Infinity','NaN','-1','10000'])assert.equal(h.run(`normalizeSong({bpm:${bad}}).bpm`),0);
});
test('seções incluem introdução, refrões repetidos e o último verso',()=>{
  const h=harness();
  const ranges=h.run('practiceSections(["Introdução","[Refrão]","Verso A","[Refrão]","Verso B"].map(classify))');
  assert.deepEqual(Array.from(ranges,x=>[x.start,x.end]),[[0,1],[1,3],[3,5]]);
});
test('letra sem seções usa parágrafos, ignorando linhas vazias extras',()=>{
  const h=harness();
  const ranges=h.run('practiceSections(["","Verso A","","","Verso B",""].map(classify))');
  assert.deepEqual(Array.from(ranges,x=>[x.start,x.end]),[[1,4],[4,6]]);
});
test('memorização oculta só versos do trecho e revela tudo ao fechar',()=>{
  const h=harness();
  h.run('state.lines=["[Parte A]","C G","Verso A","[Parte B]","Verso B"].map(classify);state.current={title:"Teste"};renderCurrentLyrics=()=>{}');
  const nodes=Array.from({length:5},()=>h.element());h.get('paper').children=nodes;
  h.run('resetPractice();practice.selected=0;practice.memorizing=true;applyPracticeFocus()');
  assert.equal(nodes[2].classList.contains('practiceHidden'),true);
  assert.equal(nodes[1].classList.contains('practiceHidden'),false);
  assert.equal(nodes[4].classList.contains('practiceOutside'),true);
  assert.equal(nodes[4].classList.contains('practiceHidden'),false);
  h.get('practicePanel').hidden=false;h.run('togglePracticePanel()');
  assert.equal(nodes[2].classList.contains('practiceHidden'),false);
  assert.equal(nodes[2].getAttribute('aria-hidden'),undefined);
  assert.equal(h.run('practice.selected'),-1);
});
test('retornar ao trecho LRC preserva pausa e ajusta relógio',()=>{
  const h=harness();h.setClock(30000);
  h.run('state.lines=[{type:"lyric",text:"Verso"}];state.lrc=[{t:12}];practice.sections=[{start:0,end:1}];restartPracticeSection()');
  assert.equal(h.run('syncOffset'),12);assert.equal(h.run('syncStart'),18000);assert.equal(h.run('state.syncing'),false);
});
test('marcar ritmo calcula 120 BPM e grava somente na música ativa',()=>{
  const h=harness();h.run('state.current={title:"Ensaio"};state.setlist=[state.current]');
  for(const t of [0,500,1000,1500]){h.setClock(t);h.run('tapPracticeTempo()')}
  assert.equal(h.run('state.current.bpm'),120);assert.equal(h.run('state.setlist[0].bpm'),120);
  h.run('setPracticeBpm(Infinity)');assert.equal(h.run('practice.bpm'),120);
  h.setClock(5000);h.run('tapPracticeTempo()');assert.equal(h.run('practice.taps.length'),1);
});
test('parar enquanto o áudio inicia impede início tardio',async()=>{
  const h=harness();let resume;
  h.context.window.AudioContext=class{state='running';resume(){return new Promise(r=>resume=r)}};
  const pending=h.run('startMetronome()');assert.equal(h.run('practice.starting'),true);
  h.run('stopMetronome()');resume();await pending;
  assert.equal(h.run('practice.running'),false);assert.equal(h.timers.size,0);
});
test('metrônomo agenda pelo relógio de áudio e cancela sons futuros',async()=>{
  const h=harness(),sounds=[];
  h.context.window.AudioContext=class{
    state='running';currentTime=0;destination={};async resume(){}
    createOscillator(){const n={frequency:{value:0},connect(){},disconnect(){},start(t){this.started=t},stop(t){this.stopped=t??'now'}};sounds.push(n);return n}
    createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
  };
  await h.run('startMetronome()');
  assert.equal(sounds.length,1);assert.equal(sounds[0].frequency.value,1000);assert.equal(sounds[0].started,.04);
  h.run('practice.audio.currentTime=20;schedulePracticeBeat()');
  assert.equal(sounds.length,2);assert.ok(sounds[1].started>=20);
  h.run('stopMetronome()');assert.equal(sounds[1].stopped,'now');assert.equal(h.run('practice.visualTimers.size'),0);
});
test('navegador sem áudio mantém o restante do treino utilizável',async()=>{
  const h=harness();await h.run('startMetronome()');
  assert.match(h.get('practiceHint').textContent,/não oferece áudio/);assert.equal(h.run('practice.running'),false);
});
test('resposta atrasada de A não substitui letra/créditos de B',async()=>{
  const h=harness();let finish;
  h.context.fetchLrclibSong=song=>new Promise(resolve=>{finish=()=>{song.lyrics='Letra antiga';song.source='Fonte A';resolve(song)}});
  const pending=h.run('globalThis.songA={title:"A"};openSong(songA)');
  await h.run('openSong({title:"B",lyrics:"Letra B",source:"Fonte B"})');
  finish();await pending;
  assert.equal(h.run('state.current.title'),'B');assert.equal(h.run('state.lines[0].text'),'Letra B');
  assert.equal(h.run('songA.lyrics'),undefined);assert.match(h.get('credits').textContent,/Fonte B/);
  assert.equal(h.get('scrollBtn').disabled,false);
});
test('erro atrasado de A não substitui a tela de B',async()=>{
  const h=harness();let fail;
  h.context.fetchLrclibSong=()=>new Promise((_,reject)=>{fail=reject});
  const pending=h.run('openSong({title:"A"})');await h.run('openSong({title:"B",lyrics:"Letra B"})');
  fail(Error('Falhou A'));await pending;
  assert.equal(h.run('state.lines[0].text'),'Letra B');assert.doesNotMatch(h.get('paper').innerHTML,/Falhou/);
});
test('nova edição invalida a busca pendente sem perder o texto editado',async()=>{
  const h=harness();let finish;
  h.context.fetchLrclibSong=song=>new Promise(resolve=>{finish=()=>{song.lyrics='Rede';resolve()}});
  const pending=h.run('openSong({title:"A"})');
  h.run('openSongRequest++;state.current.lyrics="Edição local";renderCurrentLyrics()');finish();await pending;
  assert.equal(h.run('state.current.lyrics'),'Edição local');
});
