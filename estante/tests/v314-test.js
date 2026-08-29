// Estante 3.14.0 — guardar o repertório e funcionar no telefone.
const { chromium } = require('./playwright.js');
const BASE='http://localhost:8777/estante/';
let falhas=0;
const ok=(n,c,e='')=>{console.log((c?'ok    ':'FALHA ')+n+(e?' — '+e:''));if(!c)falhas++};

(async()=>{
const b=await chromium.launch();
const c=await b.newContext({serviceWorkers:'block',viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const p=await c.newPage();const errors=[];
p.on('pageerror',e=>errors.push(e.message));
p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
await p.route('**/acervo.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"version":1,"songs":[]}'}));
await p.goto(BASE,{waitUntil:'load'});
await p.waitForFunction(()=>typeof guardarNaAbertura==='function');

// ============ 1. persistência é silenciosa ============
const persist=await p.evaluate(async()=>{
  localStorage.clear();
  let pedidos=0,persistido=false;
  Object.defineProperty(navigator,'storage',{configurable:true,value:{
    persisted:async()=>persistido, persist:async()=>{pedidos++;persistido=true;return true}}});
  notify('');
  const r1=await pedirPersistencia();
  const avisou=document.getElementById('notice').textContent;
  const r2=await pedirPersistencia();          // já persistido: não pede de novo
  return {pedidos,r1,r2,avisou};
});
ok('pede persistência ao navegador', persist.pedidos===1&&persist.r1===true, JSON.stringify(persist));
ok('e não pede de novo quando já está concedida', persist.pedidos===1&&persist.r2===true);
ok('sem falar nada com o usuário — não há o que decidir aqui', persist.avisou==='');
const semApi=await p.evaluate(async()=>{
  const s=Object.getOwnPropertyDescriptor(navigator,'storage');
  Object.defineProperty(navigator,'storage',{configurable:true,value:undefined});
  const r=await pedirPersistencia();
  Object.defineProperty(navigator,'storage',s);
  return r;
});
ok('navegador sem a API não quebra nada', semApi===false);

// ============ 2. convite de instalar ============
const cedo=await p.evaluate(()=>{
  state.installOferecido=false;state.setlists=[{id:'a',name:'x',date:'',songs:[]}];bindActiveSetlist();
  installPrompt={prompt:async()=>{},userChoice:Promise.resolve({outcome:'accepted'})};
  notify('');
  return {ofereceu:ofereceInstalar(),aviso:document.getElementById('notice').textContent};
});
ok('não oferece instalar antes de existir repertório', cedo.ofereceu===false&&cedo.aviso==='');

const convite=await p.evaluate(async()=>{
  const P=n=>Array.from({length:n},(_,i)=>storedSong({title:'Hino '+i,artist:'Coral',lyrics:'x'}));
  state.setlists=[{id:'a',name:'x',date:'',songs:P(6)}];state.activeSetlistId='a';bindActiveSetlist();
  state.installOferecido=false;notify('');
  let chamouPrompt=0;
  installPrompt={prompt:async()=>{chamouPrompt++},userChoice:Promise.resolve({outcome:'accepted'})};
  const primeira=ofereceInstalar();
  const aviso=document.getElementById('notice').textContent;
  const temBotao=!!document.getElementById('installBtn');
  const some=noticeTimer===null;                 // aviso com botão não some sozinho
  document.getElementById('installBtn').click();
  await new Promise(r=>setTimeout(r,30));
  const segunda=ofereceInstalar();               // uma vez na vida
  return {primeira,segunda,aviso,temBotao,some,chamouPrompt,
          registrado:JSON.parse(localStorage.getItem('estante:v2:prefs')).installOferecido};
});
ok('com repertório, oferece instalar', convite.primeira===true&&/tela de início/i.test(convite.aviso), convite.aviso);
ok('o convite traz botão e por isso não some sozinho', convite.temBotao&&convite.some);
ok('o botão dispara o prompt do navegador', convite.chamouPrompt===1);
ok('oferece uma vez só, e fica registrado no aparelho', convite.segunda===false&&convite.registrado===true);

const noIphone=await p.evaluate(()=>{
  state.installOferecido=false;installPrompt=null;notify('');
  const ua=Object.getOwnPropertyDescriptor(Navigator.prototype,'userAgent');
  Object.defineProperty(navigator,'userAgent',{configurable:true,get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'});
  const r=ofereceInstalar(),aviso=document.getElementById('notice').textContent;
  delete navigator.userAgent;if(ua)Object.defineProperty(Navigator.prototype,'userAgent',ua);
  return {r,aviso};
});
ok('no iPhone, que não tem prompt, ensina o caminho com as palavras da tela', noIphone.r===true&&/Adicionar à Tela de Início/.test(noIphone.aviso), noIphone.aviso);

const instalado=await p.evaluate(()=>{
  state.installOferecido=false;notify('');
  const mm=window.matchMedia;
  window.matchMedia=q=>/standalone/.test(q)?{matches:true}:mm(q);
  const r=ofereceInstalar();window.matchMedia=mm;return r;
});
ok('quem já instalou não recebe convite nenhum', instalado===false);

// ============ 3. lembrete de backup ============
const backup=await p.evaluate(()=>{
  state.installOferecido=true;state.ultimoBackup=0;notify('');
  const primeira=lembrarBackup();                      // só marca a data
  const marcou=!!state.ultimoBackup, avisoCedo=document.getElementById('notice').textContent;
  state.ultimoBackup=Date.now()-40*864e5;              // 40 dias atrás
  const vencido=lembrarBackup();
  const aviso=document.getElementById('notice').textContent;
  const temBotao=!!document.getElementById('backupAgora');
  state.ultimoBackup=Date.now()-2*864e5;              // 2 dias atrás
  const recente=lembrarBackup();
  return {primeira,marcou,avisoCedo,vencido,aviso,temBotao,recente};
});
ok('na primeira vez só anota a data, sem avisar', backup.primeira===false&&backup.marcou&&backup.avisoCedo==='');
ok('com prazo vencido, lembra e oferece exportar', backup.vencido&&backup.temBotao&&/mês/.test(backup.aviso), backup.aviso);
ok('backup recente não incomoda', backup.recente===false);
const poucas=await p.evaluate(()=>{
  state.setlists=[{id:'a',name:'x',date:'',songs:[storedSong({title:'Um',artist:'y'})]}];bindActiveSetlist();
  state.ultimoBackup=Date.now()-40*864e5;
  return lembrarBackup();
});
ok('repertório pequeno não vale um aviso', poucas===false);

// ============ 4. exportar funciona no iPhone ============
const exportar=await p.evaluate(async()=>{
  const P=n=>Array.from({length:n},(_,i)=>storedSong({title:'Hino '+i,artist:'Coral',lyrics:'x'}));
  state.setlists=[{id:'a',name:'x',date:'',songs:P(6)}];state.activeSetlistId='a';bindActiveSetlist();
  const cliques=[];const click0=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){cliques.push(this.download)};
  const compartilhados=[];
  Object.defineProperty(navigator,'canShare',{configurable:true,value:d=>!!(d&&d.files)});
  Object.defineProperty(navigator,'share',{configurable:true,value:async d=>{compartilhados.push(d.files[0].name)}});
  state.ultimoBackup=0;notify('');
  await exportSetlist();
  const comShare={arquivo:compartilhados[0],baixou:cliques.length,aviso:document.getElementById('notice').textContent,marcou:!!state.ultimoBackup};

  Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{const e=new Error('x');e.name='AbortError';throw e}});
  notify('');await exportSetlist();
  const cancelou={aviso:document.getElementById('notice').textContent,baixou:cliques.length};

  delete navigator.canShare;delete navigator.share;
  notify('');await exportSetlist();
  const semShare={baixou:cliques.length,nome:cliques[cliques.length-1],aviso:document.getElementById('notice').textContent};
  HTMLAnchorElement.prototype.click=click0;
  return {comShare,cancelou,semShare};
});
ok('onde dá para compartilhar arquivo, exporta por compartilhamento', exportar.comShare.arquivo==='estante-repertorio.json'&&exportar.comShare.baixou===0, JSON.stringify(exportar.comShare));
ok('e exportar conta como backup feito', exportar.comShare.marcou===true);
ok('cancelar o envio avisa em vez de sumir calado', /Não enviou/.test(exportar.cancelou.aviso)&&exportar.cancelou.baixou===0, exportar.cancelou.aviso);
ok('sem compartilhamento de arquivo, cai para o download de sempre', exportar.semShare.baixou===1&&exportar.semShare.nome==='estante-repertorio.json', JSON.stringify(exportar.semShare));
ok('e avisa que gerou o arquivo', /gerado/.test(exportar.semShare.aviso), exportar.semShare.aviso);

// ============ 5. o telefone ============
const tel=await p.evaluate(async()=>{
  await openSong({title:'Hino',artist:'Coral',lyrics:'C  G\nlinha um\nlinha dois',duration:200});
  openSongEditor();
  const campos=[...document.querySelectorAll('dialog[open] input,dialog[open] textarea')]
    .map(e=>[e.id,parseFloat(getComputedStyle(e).fontSize)]).filter(x=>x[1]<16);
  document.querySelector('dialog[open]').close();
  const rf=document.documentElement.requestFullscreen;document.documentElement.requestFullscreen=null;
  await fullscreen();const r1=document.getElementById('fullscreenBtn').textContent;
  await fullscreen();const r2=document.getElementById('fullscreenBtn').textContent;
  document.documentElement.requestFullscreen=rf;
  return {campos,
    linha:getComputedStyle(document.querySelector('.lineLyric')).touchAction,
    pedal:getComputedStyle(document.getElementById('scrollBtn')).touchAction,
    rotulos:[r1,r2],
    ajuste:getComputedStyle(document.documentElement).webkitTextSizeAdjust};
});
ok('nenhum campo de diálogo abaixo de 16px (zoom do Safari ao focar)', tel.campos.length===0, JSON.stringify(tel.campos));
ok('duplo toque na letra é do app, não zoom do sistema', tel.linha==='manipulation', tel.linha);
ok('os pedais também não disparam duplo-toque-zoom', tel.pedal==='manipulation', tel.pedal);
ok('o ⛶ sobrevive ao atalho de tela cheia do iPhone', tel.rotulos[0]==='⛶ Sair'&&tel.rotulos[1]==='⛶ Tela', JSON.stringify(tel.rotulos));
ok('o Safari não infla o texto sozinho em paisagem', tel.ajuste==='100%', tel.ajuste);

const escondidos=await p.evaluate(()=>[...document.querySelectorAll('[hidden]')]
  .filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id||e.className));
ok('nenhum [hidden] vazando com os elementos novos', escondidos.length===0, escondidos.join(', '));

console.log(errors.length?'ERROS DE PÁGINA:\n'+errors.join('\n'):'sem erros de página');
falhas+=errors.length;
await b.close();
console.log(falhas?`\n${falhas} falha(s)`:'\n3.14.0: tudo passou');
process.exit(falhas?1:0)})();
