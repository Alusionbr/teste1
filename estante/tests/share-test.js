// Compartilhamento: nenhum toque pode terminar sem resposta na tela.
// Reproduz os dois caminhos mudos relatados num Android.
const { chromium } = require('./playwright.js');
const BASE='http://localhost:8777/estante/';
let falhas=0;
const ok=(n,c,e='')=>{console.log((c?'ok    ':'FALHA ')+n+(e?' — '+e:''));if(!c)falhas++};
(async()=>{const b=await chromium.launch();
const c=await b.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
const p=await c.newPage();const errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.route('**/acervo.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"version":1,"songs":[]}'}));
await p.goto(BASE,{waitUntil:'load'});
await p.waitForFunction(()=>typeof openShareDialog==='function');

const r=await p.evaluate(async()=>{
  const out={};
  const P='graca senhor luz caminho verdade vida amor eterno canta povo alma coracao'.split(' ');
  const letraDe=s=>{let x=s*9301+49297;const r=()=>((x=(x*9301+49297)%233280)/233280);
    return Array.from({length:34},()=>Array.from({length:9},()=>P[Math.floor(r()*P.length)]).join(' ')).join('\n')};
  for(let i=0;i<10;i++)state.setlist.push(storedSong({title:'Hino '+(i+1),artist:'Coral',lyrics:letraDe(i+1),duration:200}));
  const aviso=()=>document.getElementById('notice').textContent;
  const aberto=()=>document.getElementById('shareDialog').open;

  // 1. tocar antes de os links ficarem prontos
  linkCompleto='';linkSimples='';ultimoLink='';notify('');
  openShareDialog();                                   // sem await, de propósito
  out.travados={ordem:document.getElementById('shareListOnlyBtn').disabled,
                cheio:document.getElementById('shareFullBtn').disabled,
                copiar:document.getElementById('shareCopyBtn').disabled};
  await shareSetlist(false);
  out.corrida={aviso:aviso(),aberto:aberto()};
  await new Promise(r=>setTimeout(r,500));
  out.depois={ordem:document.getElementById('shareListOnlyBtn').disabled,aberto:aberto()};

  // 2. AbortError (Android usa o mesmo erro para "não consegui abrir")
  const share0=Object.getOwnPropertyDescriptor(navigator,'share');
  Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{const e=new Error('x');e.name='AbortError';throw e}});
  notify('');
  await shareSetlist(false);
  out.abort={aberto:aberto(),reserva:document.getElementById('shareFallback').hidden?'':document.getElementById('shareFallback').textContent};

  // 3. falha declarada (NotAllowedError)
  Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{const e=new Error('y');e.name='NotAllowedError';throw e}});
  document.getElementById('shareFallback').hidden=true;notify('');
  await shareSetlist(true);
  out.negado={aberto:aberto(),reserva:document.getElementById('shareFallback').textContent};

  // 4. aparelho sem navigator.share: copia e avisa
  delete navigator.share;notify('');
  document.getElementById('shareDialog').close();document.getElementById('shareDialog').showModal();
  await shareSetlist(false);
  out.semShare={aviso:aviso()};

  // 5. sucesso fecha o diálogo
  Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{}});
  document.getElementById('shareDialog').showModal();notify('');
  await shareSetlist(true);
  out.sucesso={aberto:aberto(),aviso:aviso()};
  if(share0)Object.defineProperty(navigator,'share',share0);else delete navigator.share;
  return out;
});

ok('durante o cálculo, os TRÊS botões ficam travados (antes só "Com as letras")',
   r.travados.ordem&&r.travados.cheio&&r.travados.copiar, JSON.stringify(r.travados));
ok('tocar antes da hora avisa em vez de fechar calado', /preparado/.test(r.corrida.aviso), r.corrida.aviso);
ok('e o diálogo continua aberto para a pessoa tentar de novo', r.corrida.aberto===true);
ok('terminado o cálculo, os botões liberam', r.depois.ordem===false&&r.depois.aberto===true, JSON.stringify(r.depois));
ok('AbortError não some em silêncio: o diálogo fica aberto', r.abort.aberto===true);
ok('e oferece copiar o link', /Copiar link/.test(r.abort.reserva), r.abort.reserva);
ok('falha declarada explica que o aparelho não abriu a tela', /não abriu a tela/.test(r.negado.reserva), r.negado.reserva);
ok('aparelho sem compartilhamento cai para copiar e avisa', /copiado|copiar/i.test(r.semShare.aviso), r.semShare.aviso);
ok('sucesso fecha o diálogo e confirma', r.sucesso.aberto===false&&/compartilhado/i.test(r.sucesso.aviso), JSON.stringify(r.sucesso));

console.log(errors.length?'ERROS DE PÁGINA:\n'+errors.join('\n'):'sem erros de página');
falhas+=errors.length;
await b.close();
console.log(falhas?`\n${falhas} falha(s)`:'\ncompartilhamento: tudo passou');
process.exit(falhas?1:0)})();
