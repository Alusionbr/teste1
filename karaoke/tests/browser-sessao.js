"use strict";
// Só verifica integração/origens com player simulado, sem login ou Premium real.
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const PLAYER=`<!doctype html><script>
const id=location.pathname.split('/').pop();
const send=(event,info)=>parent.postMessage(JSON.stringify({event,info}),'*');
let t=0,state=2,outra=false;
window.simularOutra=ativa=>{outra=ativa;t=ativa?0:40};
addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
 if(m.event==='listening'){send('initialDelivery',{videoData:{video_id:id},playerState:state});send('onReady');return}
 if(m.func==='playVideo')state=1;
 if(m.func==='pauseVideo')state=2;
 if(m.func==='seekTo')t=m.args[0];
 send('infoDelivery',{playerState:state,currentTime:t,duration:300});
});
setInterval(()=>{if(state===1)t+=.25;send('infoDelivery',{playerState:state,currentTime:t,duration:300,...(outra?{videoData:{video_id:'COMERCIAL01'}}:{})})},250);
</script>`;
(async()=>{
 const browser=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 try{
  const ctx=await browser.newContext({serviceWorkers:'block'}),page=await ctx.newPage();
  const erros=[];page.on('pageerror',e=>erros.push(e.message));
  let players=0;
  await ctx.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(['www.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)&&u.pathname.startsWith('/embed/')){players++;return r.fulfill({contentType:'text/html',body:PLAYER})}
   return u.hostname==='127.0.0.1'?r.continue():r.abort();
  });
  await page.goto(process.env.KARAOKE_URL||'http://127.0.0.1:8767/');
  await page.waitForFunction(()=>typeof K!=='undefined'&&K.pronto);
  await page.click('[data-aba="ajustes"]');
  assert.equal(await page.locator('#prefYoutubeSessao').isChecked(),false);
  assert.equal(await page.locator('a:has-text("Abrir YouTube para entrar")').getAttribute('href'),'https://www.youtube.com/');
  await page.evaluate(()=>{
   prefs().contagem=0;
   const m=criarMusica({title:'Sem conta',playback:{tipo:'youtube',id:'dQw4w9WgXcQ'}},{compartilhar:false});
   abrirPalco({musicaId:m.id,modo:'ensaio'});
  });
  await page.waitForFunction(()=>FonteYouTube.tocando()&&FonteYouTube.tempo()>.25);
  assert.match(await page.locator('#ytBox iframe').getAttribute('src'),/youtube-nocookie\.com/);
  // Outra mídia continua mandando relógio por mais que o prazo normal (12 s).
  const frame=page.frames().find(f=>f.url().includes('/embed/'));
  await frame.evaluate(()=>window.simularOutra(true));
  await page.waitForFunction(()=>FonteYouTube.emAnuncio);
  await page.waitForTimeout(13000);
  assert.equal(await page.locator('#palcoErro').isVisible(),false,'mídia com progresso não abre erro de demora');
  assert.equal(await page.evaluate(()=>P.fase),'cantando');
  await frame.evaluate(()=>window.simularOutra(false));
  await page.waitForFunction(()=>FonteYouTube.tocando()&&!FonteYouTube.emAnuncio);
  await page.evaluate(()=>fecharPalco());
  await page.check('#prefYoutubeSessao');
  await page.evaluate(()=>salvarEstado());
  await page.reload();
  await page.waitForFunction(()=>typeof K!=='undefined'&&K.pronto);
  await page.click('[data-aba="ajustes"]');
  assert.equal(await page.locator('#prefYoutubeSessao').isChecked(),true);
  await page.evaluate(()=>abrirPalco({musicaId:K.dados.musicas[0].id,modo:'ensaio'}));
  await page.waitForFunction(()=>FonteYouTube.tocando());
  assert.match(await page.locator('#ytBox iframe').getAttribute('src'),/www\.youtube\.com\/embed/);
  const antes=players;
  await page.evaluate(()=>{prefs().youtubeSessao=false;FonteYouTube.buscar(20)});
  assert.equal(players,antes,'mudar preferência não recria o player atual');
  await page.evaluate(()=>FonteYouTube.recarregar());
  await page.waitForFunction(()=>FonteYouTube.tocando());
  assert.match(await page.locator('#ytBox iframe').getAttribute('src'),/www\.youtube\.com\/embed/,'recuperação respeita a preferência capturada');
  await page.evaluate(()=>{fecharPalco();abrirPalco({musicaId:K.dados.musicas[0].id,modo:'ensaio'})});
  await page.waitForFunction(()=>FonteYouTube.tocando());
  assert.match(await page.locator('#ytBox iframe').getAttribute('src'),/youtube-nocookie\.com/);
  assert.deepEqual(erros,[]);
  console.log('OK: uso sem conta, preferência persistida, origens, outra mídia acima de 12 s, recuperação e troca sem interromper a música. Login/Premium real não testado.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
