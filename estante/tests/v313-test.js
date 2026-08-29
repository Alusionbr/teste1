// Estante 3.13.0 — ensaio de coral: naipe e repetição de trecho.
const { chromium } = require('./playwright.js');
const BASE='http://localhost:8777/estante/';
let falhas=0;
const ok=(n,c,e='')=>{console.log((c?'ok    ':'FALHA ')+n+(e?' — '+e:''));if(!c)falhas++};

const LETRA=['[Todos]','verso de todos um','verso de todos dois','[Sopranos]','soprano um','soprano dois',
             '[Contraltos]','contralto um','[Refrão]','refrao um','refrao dois'].join('\n');
// .lrc com as mesmas seções, uma linha por segundo.
const LRC=LETRA.split('\n').map((t,i)=>`[00:0${i}.00]${t}`).join('\n');

(async()=>{
const b=await chromium.launch();
const c=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
const p=await c.newPage();const errors=[];
p.on('pageerror',e=>errors.push(e.message));
p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
await p.route('**/acervo.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"version":1,"songs":[]}'}));
await p.route('https://lrclib.net/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await p.goto(BASE,{waitUntil:'load'});
await p.waitForFunction(()=>typeof aplicarNaipe==='function');
await p.evaluate(()=>localStorage.clear());

// ================= 1. reconhecer a voz =================
const voz=await p.evaluate(()=>{
  state.naipe='';
  const d={};
  ['Sopranos','Soprano','soprano 2','Contraltos','Altos','Tenor','Tenores','Baixos','Barítono',
   '1ª Voz','2a voz','voz 3','Segunda Voz','Refrão','Ponte','Final','Todos','Coro','Solo','Uníssono','Coral Feminino']
    .forEach(t=>d[t]=naipeDe(t));
  state.naipe='Coral Feminino';
  d['custom: Coral Feminino']=naipeDe('Coral Feminino');
  d['custom nao vira todos']=naipeDe('Coral Masculino');
  state.naipe='';
  return d;
});
ok('plural e singular são a mesma voz', voz.Sopranos==='soprano'&&voz.Soprano==='soprano'&&voz['soprano 2']==='soprano', JSON.stringify([voz.Sopranos,voz.Soprano,voz['soprano 2']]));
ok('contralto e alto são a mesma voz', voz.Contraltos==='contralto'&&voz.Altos==='contralto');
ok('tenor e baixo/barítono', voz.Tenores==='tenor'&&voz.Baixos==='baixo'&&voz['Barítono']==='baixo', JSON.stringify([voz.Tenores,voz.Baixos,voz['Barítono']]));
ok('voz numerada, com ª, com "a" e por extenso', voz['1ª Voz']==='voz 1'&&voz['2a voz']==='voz 2'&&voz['voz 3']==='voz 3'&&voz['Segunda Voz']==='voz 2', JSON.stringify([voz['1ª Voz'],voz['2a voz'],voz['voz 3'],voz['Segunda Voz']]));
ok('seção estrutural NÃO é naipe', !voz['Refrão']&&!voz.Ponte&&!voz.Final, JSON.stringify([voz['Refrão'],voz.Ponte,voz.Final]));
ok('[Todos], [Coro], [Solo] e [Uníssono] são de todo mundo', !voz.Todos&&!voz.Coro&&!voz.Solo&&!voz['Uníssono']);
ok('seção desconhecida não vira naipe (senão esmaeceria meio hino sem motivo)', voz['Coral Feminino']==='');
ok('mas a voz que a própria pessoa cadastrou vale', voz['custom: Coral Feminino']==='coral feminino', voz['custom: Coral Feminino']);
ok('e só ela: outra seção desconhecida segue sendo de todos', voz['custom nao vira todos']==='');

// ================= 2. herança e realce =================
const realce=await p.evaluate(async l=>{
  await openSong({title:'Hino',artist:'Coral',lyrics:l,duration:200});
  setNaipe('contralto');
  const antes=[...document.getElementById('paper').children];
  const naipes=state.lines.map(x=>x.naipe);
  const dim=[...document.querySelectorAll('.outraVoz')].map(n=>n.textContent);
  setNaipe('soprano');
  const depois=[...document.getElementById('paper').children];
  const dim2=[...document.querySelectorAll('.outraVoz')].map(n=>n.textContent);
  const mesmosNos=antes.length===depois.length&&antes.every((n,i)=>n===depois[i]);
  toggleMinhaVoz();
  const semRealce=document.querySelectorAll('.outraVoz').length;
  toggleMinhaVoz();
  return {naipes,dim,dim2,mesmosNos,semRealce};
},LETRA);
ok('a linha herda o naipe da seção acima dela', JSON.stringify(realce.naipes)===JSON.stringify(['','','','soprano','soprano','soprano','contralto','contralto','','','']), JSON.stringify(realce.naipes));
ok('seção estrutural zera a herança: depois do [Refrão] é de todos', realce.naipes[9]===''&&realce.naipes[10]==='');
ok('contralto esmaece só as linhas de soprano', JSON.stringify(realce.dim)===JSON.stringify(['Sopranos','soprano um','soprano dois']), JSON.stringify(realce.dim));
ok('trocar para soprano inverte o que fica esmaecido', JSON.stringify(realce.dim2)===JSON.stringify(['Contraltos','contralto um']), JSON.stringify(realce.dim2));
ok('trocar de voz NÃO redesenha a letra (não pode piscar no meio do ensaio)', realce.mesmosNos===true);
ok('desligar "Minha voz" tira o realce sem apagar a escolha', realce.semRealce===0, String(realce.semRealce));

const naSync=await p.evaluate(async l=>{
  await openSong({title:'Hino sincronizado',artist:'Coral',synced:l,duration:200});
  setNaipe('contralto');
  highlight(4);                                  // linha de soprano, ativa
  const n=document.getElementById('paper').children[4];
  return {ativa:n.classList.contains('active'),outra:n.classList.contains('outraVoz')};
},LRC);
ok('o realce convive com a linha ativa da sincronia', naSync.ativa&&naSync.outra, JSON.stringify(naSync));

// ================= 3. tira de seções =================
const tira=await p.evaluate(async l=>{
  await openSong({title:'Hino',artist:'Coral',lyrics:l,duration:200});
  setNaipe('contralto');
  const bs=[...document.querySelectorAll('#sectionBar button')];
  return {rotulos:bs.map(b=>b.textContent),
          naipes:bs.filter(b=>b.classList.contains('secNaipe')).map(b=>b.textContent),
          minha:bs.filter(b=>b.classList.contains('secMinha')).map(b=>b.textContent),
          temVoz:bs.some(b=>b.className.includes('secVoz'))};
},LETRA);
ok('a tira traz ⟳ e Minha voz antes das seções', tira.rotulos[0]==='⟳'&&tira.temVoz, JSON.stringify(tira.rotulos));
ok('só as seções de naipe são marcadas como naipe', JSON.stringify(tira.naipes)===JSON.stringify(['Sopranos','Contraltos']), JSON.stringify(tira.naipes));
ok('e a sua ganha destaque', JSON.stringify(tira.minha)===JSON.stringify(['Contraltos']), JSON.stringify(tira.minha));
const semNaipe=await p.evaluate(async()=>{
  await openSong({title:'Sem naipe',artist:'Banda',lyrics:'[Refrão]\nlinha\n[Ponte]\noutra',duration:120});
  return [...document.querySelectorAll('#sectionBar button')].some(b=>b.className.includes('secVoz'));
});
ok('música sem naipe não ganha o botão de voz na tira', semNaipe===false);

// ================= 4. laço na rolagem =================
const rolagem=await p.evaluate(async l=>{
  await openSong({title:'Hino longo',artist:'Coral',lyrics:l,duration:200});
  const vp=document.getElementById('paperViewport');
  state.lines.forEach((x,i)=>{const n=document.getElementById('paper').children[i];n.style.minHeight='240px'});
  ligarLoop(3);                                   // [Sopranos] .. antes de [Contraltos]
  const alvo=(()=>{const f=document.getElementById('paper').children[state.loop.ate];
    return Math.max(0,f.offsetTop+f.offsetHeight-vp.clientHeight+24)})();
  vp.scrollTop=alvo+5;
  const voltou=loopRolagem();
  const pos=vp.scrollTop, base=Math.max(0,document.getElementById('paper').children[3].offsetTop-16);
  const voltas1=state.loop.voltas;
  const deNovoNaEspera=loopRolagem();             // dentro da janela de espera
  return {voltou,pos,base,voltas1,voltas2:state.loop.voltas,deNovoNaEspera};
},LETRA);
ok('a rolagem volta ao começo do trecho ao passar do fim', rolagem.voltou&&Math.abs(rolagem.pos-rolagem.base)<2, JSON.stringify(rolagem));
ok('e conta a volta', rolagem.voltas1===1, String(rolagem.voltas1));
ok('sem contar duas vezes no quadro seguinte', rolagem.voltas2===1&&rolagem.deNovoNaEspera===true, JSON.stringify([rolagem.voltas2,rolagem.deNovoNaEspera]));

const ultimaLinha=await p.evaluate(async l=>{
  await openSong({title:'Hino',artist:'Coral',lyrics:l,duration:200});
  state.lines.forEach((x,i)=>{document.getElementById('paper').children[i].style.minHeight='240px'});
  ligarLoop(8);                                   // [Refrão] até o fim da letra
  const vp=document.getElementById('paperViewport');
  vp.scrollTop=scrollDistance()+50;               // além do fim da letra
  if(!state.scrolling)toggleScroll();
  const cuidou=loopRolagem();
  const aindaRola=state.scrolling;
  if(state.scrolling)toggleScroll();
  return {cuidou,aindaRola,ate:state.loop.ate,ultima:state.lines.length-1};
},LETRA);
ok('laço que termina na última linha é tratado pelo laço, não pelo fim da rolagem', ultimaLinha.cuidou===true&&ultimaLinha.ate===ultimaLinha.ultima, JSON.stringify(ultimaLinha));

// ================= 5. laço na sincronia e no karaokê =================
const sinc=await p.evaluate(async l=>{
  await openSong({title:'Hino sincronizado',artist:'Coral',synced:l,duration:200});
  ligarLoop(3);                                   // linhas 3..5
  const antes=syncOffset;
  if(!state.syncing)toggleSync();
  const cuidou=loopSincronia(6);                  // passou do fim do trecho
  const depois=syncOffset;
  const voltas=state.loop.voltas;
  if(state.syncing)toggleSync();
  return {cuidou,antes,depois,voltas,tempoDaLinha3:state.lrc[3].t};
},LRC);
ok('na sincronia, passar do fim do trecho volta o relógio para o começo', sinc.cuidou&&Math.abs(sinc.depois-sinc.tempoDaLinha3)<0.2, JSON.stringify(sinc));
ok('e conta a volta', sinc.voltas===1, String(sinc.voltas));

const karaoke=await p.evaluate(async l=>{
  const cmds=[];
  const send0=window.ytCommand;
  window.ytCommand=(f,a)=>{cmds.push([f,a]);return true};
  await openSong({title:'Hino sincronizado',artist:'Coral',synced:l,duration:200});
  state.karaoke=true;
  ligarLoop(3);
  const start0=syncStart;
  const cuidou=loopSincronia(6);
  const mexeuNoRelogioInterno=syncStart!==start0;
  state.karaoke=false;window.ytCommand=send0;
  return {cuidou,cmds,mexeuNoRelogioInterno};
},LRC);
ok('no karaokê com .lrc o laço manda seekTo ao vídeo', karaoke.cuidou&&karaoke.cmds.some(c=>c[0]==='seekTo'), JSON.stringify(karaoke.cmds));
ok('e não mexe no relógio interno do Sincro', karaoke.mexeuNoRelogioInterno===false);

const karaokeSemLrc=await p.evaluate(async l=>{
  const cmds=[];const send0=window.ytCommand;
  window.ytCommand=(f,a)=>{cmds.push([f,a]);return true};
  await openSong({title:'Hino',artist:'Coral',lyrics:l,duration:200});
  state.lines.forEach((x,i)=>{document.getElementById('paper').children[i].style.minHeight='240px'});
  state.karaoke=true;
  ligarLoop(3);
  const fim=tempoDaLinha(state.loop.ate+1),comeco=tempoDaLinha(state.loop.de);
  const cuidou=loopKaraoke(fim+1);
  state.karaoke=false;window.ytCommand=send0;
  return {cuidou,cmds,comeco,fim,dur:200};
},LETRA);
ok('sem .lrc o laço converte linha em tempo proporcional e manda seekTo', karaokeSemLrc.cuidou&&karaokeSemLrc.cmds.some(c=>c[0]==='seekTo'), JSON.stringify(karaokeSemLrc.cmds));
ok('o tempo do começo do trecho fica dentro da duração da música', karaokeSemLrc.comeco>0&&karaokeSemLrc.fim<=200&&karaokeSemLrc.comeco<karaokeSemLrc.fim, JSON.stringify([karaokeSemLrc.comeco,karaokeSemLrc.fim]));

// ================= 6. o laço é do momento =================
const vida=await p.evaluate(async l=>{
  await openSong({title:'Hino',artist:'Coral',lyrics:l,duration:200});
  ligarLoop(3);
  const ligado=!!state.loop;
  stopAll();
  const depoisDeStopAll=!!state.loop;
  ligarLoop(3);
  await openSong({title:'Outro',artist:'Coral',lyrics:l,duration:200});
  const depoisDeTrocar=!!state.loop;
  const salvo=JSON.parse(localStorage.getItem('estante:v2:prefs')||'{}');
  return {ligado,depoisDeStopAll,depoisDeTrocar,temLoopNasPrefs:'loop' in salvo,naipeSalvo:salvo.naipe};
},LETRA);
ok('o laço liga', vida.ligado===true);
ok('stopAll() (Esc) desliga o laço', vida.depoisDeStopAll===false);
ok('trocar de música desliga o laço', vida.depoisDeTrocar===false);
ok('o laço não é salvo em lugar nenhum — é do momento', vida.temLoopNasPrefs===false);
ok('a voz, sim, fica guardada no aparelho', !!vida.naipeSalvo, String(vida.naipeSalvo));

const semSecao=await p.evaluate(async()=>{
  await openSong({title:'Sem seção',artist:'x',lyrics:'uma linha\noutra linha',duration:100});
  notify('');toggleLoop();
  return {loop:!!state.loop,aviso:document.getElementById('notice').textContent};
});
ok('música sem seção explica como marcar em vez de não fazer nada', semSecao.loop===false&&/Editar letra/.test(semSecao.aviso), semSecao.aviso);

const tecla=await p.evaluate(async l=>{
  await openSong({title:'Hino',artist:'Coral',lyrics:l,duration:200});
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'r',bubbles:true,cancelable:true}));
  const ligou=!!state.loop;
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'R',bubbles:true,cancelable:true}));
  return {ligou,desligou:!state.loop};
},LETRA);
ok('a tecla R liga e desliga o laço', tecla.ligou&&tecla.desligou, JSON.stringify(tecla));

// ================= 7. nada escondido vazando (regressão da 3.12.0) =================
const escondidos=await p.evaluate(()=>[...document.querySelectorAll('[hidden]')]
  .filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id||e.className));
ok('nenhum elemento com [hidden] ocupa espaço, com os elementos novos', escondidos.length===0, escondidos.join(', '));

console.log(errors.length?'ERROS DE PÁGINA:\n'+errors.join('\n'):'sem erros de página');
falhas+=errors.length;
await b.close();
console.log(falhas?`\n${falhas} falha(s)`:'\n3.13.0: tudo passou');
process.exit(falhas?1:0)})();
