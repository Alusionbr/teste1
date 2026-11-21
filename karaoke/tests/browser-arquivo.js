"use strict";
// Requer Playwright, ffmpeg e o servidor local descrito no README.
const {chromium}=require("playwright");
const {execFileSync}=require("node:child_process");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const assert=require("node:assert/strict");
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"karaoke-arquivo-"));
  const fixture=path.join(dir,"karaoke.webm"),audio=path.join(dir,"audio.wav");
  execFileSync("ffmpeg",["-v","error","-f","lavfi","-i","color=c=blue:s=320x180:r=10","-f","lavfi","-i","sine=frequency=440:sample_rate=44100","-t","12","-c:v","libvpx","-c:a","libvorbis",fixture]);
  execFileSync("ffmpeg",["-v","error","-f","lavfi","-i","sine=frequency=440:sample_rate=44100","-t","3",audio]);
  const browser=await chromium.launch({args:["--autoplay-policy=no-user-gesture-required"]});
  try{
    const ctx=await browser.newContext({serviceWorkers:"block"});
    const page=await ctx.newPage();
    const erros=[];page.on("pageerror",e=>erros.push(e.message));
    await ctx.route("**/*",r=>new URL(r.request().url()).hostname==="127.0.0.1"?r.continue():r.abort());
    await page.goto(process.env.KARAOKE_URL||"http://127.0.0.1:8765/");
    await page.waitForFunction(()=>typeof K!=="undefined"&&K.dados);
    await page.evaluate(()=>{
      K.dados.prefs.contagem=0;K.dados.prefs.aplausometro=false;K.dados.prefs.fundo="tela";
      const m=criarMusica({title:"Teste local",synced:"[00:00.00]Teste\n[00:06.00]Vídeo"});
      abrirEditor(m.id,"arquivo");
    });
    await page.setInputFiles("#mArquivo",fixture);
    await page.waitForFunction(()=>acharMusica(ED.id)?.playback?.video===true);
    await page.click("#mSalvar");
    await ctx.setOffline(true);
    await page.evaluate(()=>abrirPalco({musicaId:ED.id,modo:"ensaio"}));
    await page.waitForFunction(()=>FonteArquivo.tocando()&&FonteArquivo.tempo()>0.3);
    assert.equal(await page.locator("#audioPlayer").isVisible(),true);
    assert.equal(await page.locator("#palcoLetra").isVisible(),false);
    assert.equal(await page.locator("iframe").count(),0);
    await page.evaluate(()=>{FonteArquivo.pausar();FonteArquivo.buscar(5)});
    await page.waitForFunction(()=>Math.abs(FonteArquivo.tempo()-5)<0.2);
    await page.click("#palcoLetraBtn");
    assert.equal(await page.locator("#palcoLetra").isVisible(),true);
    await page.evaluate(()=>FonteArquivo.tocar());
    await page.waitForFunction(()=>FonteArquivo.tempo()>5.3);
    // Áudio continua sendo uma fonte de som, sem esconder a letra.
    await page.evaluate(()=>{
      fecharPalco();
      abrirEditor(ED.id,"arquivo");
    });
    await page.setInputFiles("#mArquivo",audio);
    await page.waitForFunction(()=>acharMusica(ED.id)?.playback?.titulo==="audio.wav");
    assert.equal(await page.evaluate(()=>!!acharMusica(ED.id).playback.video),false);
    await page.click("#mSalvar");
    await page.evaluate(()=>abrirPalco({musicaId:ED.id,modo:"ensaio"}));
    await page.waitForFunction(()=>FonteArquivo.tocando());
    assert.equal(await page.locator("#audioPlayer").isVisible(),false);
    assert.equal(await page.locator("#palcoLetra").isVisible(),true);
    await page.evaluate(()=>FonteArquivo.buscar(2.8));
    await page.waitForFunction(()=>P.fase==="fim");
    await page.evaluate(()=>fecharPalco());
    assert.equal(await page.evaluate(()=>FonteArquivo.tocando()),false);
    assert.deepEqual(erros,[]);
    console.log("OK: upload e reprodução offline de vídeo, letra, pausa, busca, áudio e encerramento.");
  }finally{await browser.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
