// Estante 3.15.0 — alvo pelo dedo, paisagem e "adicionar" com um sentido só.
const { chromium } = require('./playwright.js');
const BASE='http://localhost:8777/estante/';
let falhas=0;
const ok=(n,c,e='')=>{console.log((c?'ok    ':'FALHA ')+n+(e?' — '+e:''));if(!c)falhas++};
// Letra longa de proposito: com poucas linhas a velocidade automatica bate no
// piso de 4 px/s e o teste nao veria a altura da tela mudar a conta.
const L=['C       G',...Array.from({length:44},(_,k)=>'verso '+(k+1)+' de um hino de coral com metrica comprida'),'[Refrao]','refrao um','refrao dois','[Ponte]','ponte um'].join(String.fromCharCode(10));

async function alvos(b,{w,h,toque}){
  const c=await b.newContext({serviceWorkers:'block',viewport:{width:w,height:h},isMobile:toque,hasTouch:toque,deviceScaleFactor:toque?2:1});
  const p=await c.newPage();
  await p.route('**/acervo.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"version":1,"songs":[]}'}));
  await p.goto(BASE,{waitUntil:'load'});
  await p.waitForFunction(()=>typeof openSong==='function');
  const r=await p.evaluate(async l=>{
    localStorage.clear();
    await openSong({title:'Hino do Coral',artist:'Coral',lyrics:l,duration:214});addSong();
    state.tab='setlist';renderList();
    document.getElementById('sidebar').classList.add('open');
    const pequenos=[...document.querySelectorAll('button:not([hidden])')]
      .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.height<44})
      .filter(e=>!e.classList.contains('rowActions')&&!e.parentElement.classList.contains('rowActions'))
      .map(e=>{const r=e.getBoundingClientRect();return (e.id||e.className||e.textContent.trim().slice(0,8))+':'+Math.round(r.height)});
    const linha=[...document.querySelectorAll('.rowActions button')].map(e=>{const r=e.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)});
    return {pequenos,linha,ponteiro:matchMedia('(pointer:coarse)').matches};
  },L);
  await c.close();return r;
}

(async()=>{
const b=await chromium.launch();

const tel=await alvos(b,{w:412,h:915,toque:true});
ok('telefone em pé: nenhum alvo abaixo de 44px', tel.pequenos.length===0, tel.pequenos.join(', '));
const deitado=await alvos(b,{w:915,h:412,toque:true});
ok('Android DEITADO (915px): alvos continuam grandes — era aqui que caía no layout de mouse', deitado.pequenos.length===0, deitado.pequenos.join(', '));
const tablet=await alvos(b,{w:1024,h:768,toque:true});
ok('tablet na estante: também pelo dedo, não pela largura', tablet.pequenos.length===0, tablet.pequenos.join(', '));
ok('a fileira ↑ ↓ × ganha largura sem esticar a lista', /^44x38$/.test(deitado.linha[0]||''), JSON.stringify(deitado.linha.slice(0,3)));
const mouse=await alvos(b,{w:1280,h:800,toque:false});
ok('no mouse o compacto volta — o desktop não foi abandonado', mouse.ponteiro===false&&mouse.pequenos.length>0, `${mouse.pequenos.length} alvos compactos`);

// ---- paisagem, espaço para a letra, e a velocidade automática acompanhando ----
const c=await b.newContext({serviceWorkers:'block',viewport:{width:844,height:390},isMobile:true,hasTouch:true});
const p=await c.newPage();const errors=[];
p.on('pageerror',e=>errors.push(e.message));
p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
await p.route('**/acervo.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"version":1,"songs":[]}'}));
await p.goto(BASE,{waitUntil:'load'});
await p.waitForFunction(()=>typeof openSong==='function');

const paisagem=await p.evaluate(async l=>{
  localStorage.clear();
  await openSong({title:'Hino do Coral',artist:'Coral',lyrics:l,duration:214});
  const alturaParada=document.getElementById('paperViewport').clientHeight;
  const velParada=speedForSong(state.current);
  toggleScroll();
  await new Promise(r=>setTimeout(r,120));
  const alturaRolando=document.getElementById('paperViewport').clientHeight;
  const cabecalho=getComputedStyle(document.querySelector('.songHeader')).display;
  const selecao=getComputedStyle(document.getElementById('paper')).userSelect;
  const velRolando=speedForSong(state.current);
  toggleScroll();
  await new Promise(r=>setTimeout(r,120));
  return {alturaParada,alturaRolando,cabecalho,selecao,velParada,velRolando,
          voltou:getComputedStyle(document.querySelector('.songHeader')).display,
          selecaoDepois:getComputedStyle(document.getElementById('paper')).userSelect};
},L);
ok('deitado, com a letra andando, o cabeçalho recolhe', paisagem.cabecalho==='none', paisagem.cabecalho);
ok('e sobra tela de verdade para a letra', paisagem.alturaRolando>paisagem.alturaParada+40, `${paisagem.alturaParada} → ${paisagem.alturaRolando}px`);
// Mais tela visível = menos distância a percorrer = velocidade MENOR para a
// letra terminar junto com a música. O que se testa é que a conta acompanhou.
ok('a velocidade automática acompanha a altura nova (o observador olha o viewport)', paisagem.velRolando<paisagem.velParada, `${paisagem.velParada} → ${paisagem.velRolando} px/s`);
ok('pausar traz o cabeçalho de volta', paisagem.voltou!=='none', paisagem.voltou);
ok('a lupa do iOS não aparece com a letra andando', paisagem.selecao==='none', paisagem.selecao);
ok('e parada a letra volta a ser selecionável e copiável', paisagem.selecaoDepois!=='none', paisagem.selecaoDepois);

// ---- "adicionar" quer dizer a mesma coisa vindo de link e de arquivo ----
const juntar=await p.evaluate(async()=>{
  const musicas=n=>Array.from({length:n},(_,i)=>({title:'Hino '+i,artist:'Coral',lyrics:'x'}));
  state.setlists=[{id:'a',name:'Ensaio de domingo',date:'',songs:musicas(3).map(storedSong)}];
  state.activeSetlistId='a';bindActiveSetlist();
  // arquivo com as 3 que já existem + 2 novas
  incomingImport={setlists:[{id:'z',name:'Do arquivo',date:'',songs:musicas(5).map(storedSong)}],activeId:'z'};
  document.getElementById('importDialog').showModal();
  finishImport('merge');
  const depois={repertorios:state.setlists.length,musicas:state.setlist.length,nome:activeSetlist().name,
                aviso:document.getElementById('notice').textContent};
  // o botão existe no diálogo
  const temBotao=!!document.getElementById('importMergeBtn');
  // e o link compartilhado usa a MESMA função
  incomingSetlist=musicas(6).map(normalizeSong);incomingName='';
  document.getElementById('sharedDialog').showModal();
  finishSharedImport('add');
  const pelolink={repertorios:state.setlists.length,musicas:state.setlist.length};
  return {depois,temBotao,pelolink};
});
ok('o diálogo de importar oferece "Juntar ao aberto"', juntar.temBotao===true);
ok('juntar acrescenta só o que falta, no repertório em uso', juntar.depois.musicas===5&&juntar.depois.repertorios===1, JSON.stringify(juntar.depois));
ok('e não cria repertório novo nem troca o nome', juntar.depois.nome==='Ensaio de domingo');
ok('o aviso diz quantas entraram', /2 músicas juntadas/.test(juntar.depois.aviso), juntar.depois.aviso);
ok('o link compartilhado passa pela mesma função e também não duplica', juntar.pelolink.musicas===6&&juntar.pelolink.repertorios===1, JSON.stringify(juntar.pelolink));

const escondidos=await p.evaluate(()=>[...document.querySelectorAll('[hidden]')]
  .filter(e=>getComputedStyle(e).display!=='none').map(e=>e.id||e.className));
ok('nenhum [hidden] vazando', escondidos.length===0, escondidos.join(', '));

console.log(errors.length?'ERROS DE PÁGINA:\n'+errors.join('\n'):'sem erros de página');
falhas+=errors.length;
await b.close();
console.log(falhas?`\n${falhas} falha(s)`:'\n3.15.0: tudo passou');
process.exit(falhas?1:0)})();
