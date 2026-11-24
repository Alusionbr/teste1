"use strict";
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const PLAYER=`<script>
let id=location.pathname.split('/').pop(),state=5,t=0;
const send=(event,info)=>parent.postMessage(JSON.stringify({event,info}),'*');
const info=()=>send('infoDelivery',{videoData:{video_id:id},playerState:state,currentTime:t,duration:180});
addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
 if(m.event==='listening'){send('onReady');info()}
 if(m.func==='playVideo'){state=1;info()}
 if(m.func==='pauseVideo'||m.func==='stopVideo'){state=2;info()}
 if(m.func==='cueVideoById'){id=m.args[0];t=0;state=5;info()}
});setInterval(()=>{if(state===1){t+=.25;info()}},250);
</script>`;
(async()=>{
 const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await ctx.route('**/*',r=>{
   const u=new URL(r.request().url());if(/youtube/.test(u.hostname)&&u.pathname.startsWith('/embed/'))return r.fulfill({contentType:'text/html',body:PLAYER});
   return u.hostname==='127.0.0.1'?r.continue():r.abort();
  });
  const base=process.env.KARAOKE_URL||'http://127.0.0.1:8770/',page=await ctx.newPage(),erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  await page.goto(base+'controle.html');await page.waitForFunction(()=>typeof MINHA_LISTA!=='undefined');
  await page.evaluate(()=>{
   CT.codigo='ABC234';CT.eu={nome:'Ana'};CT.estado={cantores:[],fila:[],musicas:[],fase:'cantando',palco:'festa'};
   window.__enviados=[];window.salaRpc=async(fn,d)=>{window.__enviados.push(d);return{ok:true}};
   window.resolverPlayback=async q=>{if(q.includes('Falhou'))throw Error('Não achei vídeo');return{video:{id:q.includes('Segunda')?'VIDEOBBBB02':'VIDEOAAAA01',titulo:q+' Karaokê',duracao:180},alternativas:[]}};
   mostrar('ctPainel');renderMinhaLista();
  });
  // Caminho principal: preparar e enviar (2 cliques), sem escolher vídeo ou marcar checkbox.
  await page.fill('#ctBuscaMinhaLista','Primeira - Artista');await page.click('#ctFormMinhaLista button[type=submit]');
  await page.waitForFunction(()=>MINHA_LISTA.length===1);
  assert.equal(await page.evaluate(()=>MINHA_LISTA[0].playback.id),'VIDEOAAAA01');
  await page.click('#ctMinhaListaEnviarTudo');await page.waitForFunction(()=>window.__enviados.length===1);
  assert.equal(await page.evaluate(()=>window.__enviados[0].p_dados.playback.id),'VIDEOAAAA01');
  await page.screenshot({path:'/tmp/karaoke-playlist-rapida-celular.png',fullPage:true});
  // Playlist de várias músicas: abrir lote, preparar e enviar (3 cliques).
  await page.click('#ctMinhaListaLote summary');await page.fill('#ctMinhaListaLoteTexto','Segunda - Artista\nFalhou - Artista');
  await page.evaluate(()=>{
   const resolver=window.resolverPlayback;
   window.resolverPlayback=async q=>q.includes('Segunda')?new Promise(resolve=>{window.__soltar=()=>resolver(q).then(resolve)}):resolver(q);
  });
  await page.click('#ctFormMinhaListaLote button');
  await page.waitForFunction(()=>typeof window.__soltar==='function');
  assert.equal(await page.locator('#ctMinhaListaEnviarTudo').isDisabled(),true,'aguarda preparar a playlist inteira antes de enviar');
  await page.evaluate(()=>window.__soltar());
  await page.waitForFunction(()=>document.querySelector('#ctMinhaListaStatus').textContent.includes('Não preparadas'));
  assert.equal(await page.evaluate(()=>MINHA_LISTA.length),2);
  await page.click('#ctMinhaListaEnviarTudo');await page.waitForFunction(()=>window.__enviados.length===3);
  const pedidos=await page.evaluate(()=>window.__enviados.slice(-2));
  assert.ok(pedidos.every(d=>d.p_tipo==='pedir_nova'&&d.p_dados.playback?.id&&!d.p_dados.modo));
  // Uma falha de envio não duplica as músicas já enviadas ao tentar de novo.
  await page.evaluate(()=>{window.__certos=[];window.__tentativas=0;window.salaRpc=async(fn,d)=>{if(++window.__tentativas===2)throw Error('rede');window.__certos.push(d);return{ok:true}}});
  await page.click('#ctMinhaListaEnviarTudo');await page.waitForFunction(()=>document.querySelector('#ctMinhaListaStatus').textContent.includes('Faltam'));
  await page.click('#ctMinhaListaEnviarTudo');await page.waitForFunction(()=>window.__certos.length===2);
  assert.equal(await page.evaluate(()=>new Set(window.__certos.map(d=>d.p_dados.playback.id)).size),2);
  // Música da biblioteca sem playback: escolher e enviar em dois cliques.
  await page.evaluate(()=>{
   CT.estado.musicas=[{id:'mSemVideo',title:'Primeira',artist:'Artista',pb:''}];mostrar('ctPainel');renderMusicas();window.__enviados=[];
   window.salaRpc=async(fn,d)=>{window.__enviados.push(d);return{ok:true}};
  });
  await page.click('[data-ct-aba=pedir]');await page.click('#ctMusicas [data-pedir]');
  await page.waitForFunction(()=>CT.painel.playbackAuto?.id==='VIDEOAAAA01');
  await page.click('#ctPnFila');await page.waitForFunction(()=>window.__enviados.length===1);
  assert.equal(await page.evaluate(()=>window.__enviados[0].p_dados.playback.id),'VIDEOAAAA01');
  // Pedido chega à tela e usa FonteYouTube, não o relógio sem áudio.
  const host=await ctx.newPage();host.on('pageerror',e=>erros.push(e.message));
  await host.setViewportSize({width:1280,height:720});await host.goto(base);await host.waitForFunction(()=>K.pronto);
  await host.evaluate(ds=>{
   prefs().contagem=0;prefs().aplausometro=false;
   for(const d of ds)SalaHost.aplicar({tipo:d.p_tipo,nome:'Ana',dados:d.p_dados});
   abrirPalco({playlistId:K.dados.activePlaylistId});
  },pedidos);
  await host.waitForFunction(()=>P.fonte===FonteYouTube&&FonteYouTube.tocando()&&FonteYouTube.tempo()>.2);
  const indice=await host.evaluate(()=>P.indice);
  await host.locator('#palcoTocar').focus();await host.keyboard.press('ArrowRight');
  assert.equal(await host.evaluate(()=>P.indice),indice,'seta navega sem trocar música');
  assert.equal(await host.evaluate(()=>document.activeElement.id),'palcoProxima');
  await host.keyboard.press('Enter');await host.waitForFunction(i=>P.indice===i+1,indice);
  assert.equal(await host.evaluate(()=>P.fonte===FonteYouTube),true);
  await host.screenshot({path:'/tmp/karaoke-navegacao-tv.png'});
  await host.evaluate(()=>{P.fonte.parar();mostrarNota()});
  await host.locator('#notaProxima').focus();await host.keyboard.press('ArrowLeft');
  assert.equal(await host.evaluate(()=>!!document.activeElement.closest('.sobre')||document.activeElement.id==='palcoSair'),true,'foco não passa para controles cobertos pela tela de aplausos');
  // Lista antiga sem playback também é preparada ao apertar Começar.
  await host.evaluate(()=>{
   fecharPalco();const p=criarPlaylist('Lista antiga');const m=criarMusica({title:'Antiga',lyrics:'Teste'});
   adicionarItem(p,m.id,'','');
   window.resolverPlayback=async()=>({video:{id:'VIDEOAAAA01',titulo:'Antiga Karaokê',duracao:180},alternativas:[]});
   renderTudo();trocarAba('playlist');
  });
  await host.click('#btnComecar');
  await host.waitForFunction(()=>P.fonte===FonteYouTube&&FonteYouTube.tocando());
  assert.equal(await host.evaluate(()=>P.musica.playback.id),'VIDEOAAAA01');
  await host.evaluate(()=>{
   fecharPalco();const p=criarPlaylist('Lista sem vídeo');const m=criarMusica({title:'Falhou',lyrics:'Teste'});
   adicionarItem(p,m.id,'','');window.resolverPlayback=async()=>{throw Error('sem vídeo')};renderTudo();trocarAba('playlist');
  });
  await host.click('#btnComecar');await host.waitForFunction(()=>!preparandoFesta);
  assert.equal(await host.evaluate(()=>P.aberto),false,'não inicia uma lista sem áudio por engano');
  // Adicionar uma música antiga à playlist também escolhe vídeo sem etapa manual.
  await host.evaluate(()=>{
   window.resolverPlayback=async()=>({video:{id:'VIDEOBBBB02',titulo:'Vídeo pronto',duracao:180},alternativas:[]});
   const m=criarMusica({title:'Biblioteca antiga',lyrics:'Teste'});window.__mAntiga=m.id;abrirAddFila(m.id);
  });
  await host.click('#addConfirmar');await host.waitForSelector('#dlgAddFila',{state:'hidden'});
  assert.equal(await host.evaluate(()=>acharMusica(window.__mAntiga).playback.id),'VIDEOBBBB02');
  assert.deepEqual(erros,[]);
  console.log('OK: 2 cliques preparar/enviar, lote, vídeo automático, falhas sem música muda, reenvio parcial, pedido existente sem playback, fonte YouTube na tela e navegação por setas/Enter.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
