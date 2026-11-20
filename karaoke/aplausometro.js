"use strict";
/*
 * Aplausômetro: mede a animação da plateia pelo microfone, por alguns
 * segundos, e dá uma nota divertida. NÃO mede afinação — e a tela não promete
 * isso.
 *
 * O microfone só liga quando alguém aperta "Medir" e desliga sozinho ao fim
 * (ou ao sair do palco). Nada é gravado, guardado ou enviado: só o volume
 * médio vira um número.
 */
const Aplausometro=(()=>{
  let fluxo=null,ctx=null,timer=0;

  // Função pura (tests/aplausometro.test.js): amostras de volume RMS 0..1 → nota.
  // Usa a média dos 30% mais altos: um aplauso curto e forte vale, um silêncio
  // no começo não derruba a nota.
  function notaDosAplausos(amostras){
    const db=amostras.filter(x=>x>0).map(x=>20*Math.log10(x)).sort((a,b)=>b-a);
    if(!db.length)return 0;
    const topo=db.slice(0,Math.max(1,Math.ceil(db.length*0.3)));
    const media=topo.reduce((s,x)=>s+x,0)/topo.length;
    return Math.round(Math.max(0,Math.min(100,(media+55)/45*100)));
  }
  function estrelas(nota){return Math.max(1,Math.min(5,Math.ceil(nota/20)))}
  function frase(nota){
    if(nota>=90)return"A casa veio abaixo! 🔥";
    if(nota>=75)return"Show de estrela! 🌟";
    if(nota>=55)return"Muito bem! 👏";
    if(nota>=35)return"A família gostou! 😄";
    return"Aplaudam mais alto! 📣";
  }

  async function medir(segundos,aoNivel){
    parar();
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw Error("Este navegador não dá acesso ao microfone.");
    try{fluxo=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
    catch{throw Error("Sem permissão para o microfone. O aplausômetro pode ser desligado em Ajustes.")}
    const AC=window.AudioContext||window.webkitAudioContext;
    ctx=new AC();
    const fonte=ctx.createMediaStreamSource(fluxo),analisador=ctx.createAnalyser();
    analisador.fftSize=2048;fonte.connect(analisador);
    const buf=new Float32Array(analisador.fftSize),amostras=[];
    return new Promise(resolve=>{
      const fim=performance.now()+segundos*1000;
      timer=setInterval(()=>{
        analisador.getFloatTimeDomainData(buf);
        let soma=0;for(let i=0;i<buf.length;i++)soma+=buf[i]*buf[i];
        const rms=Math.sqrt(soma/buf.length);
        amostras.push(rms);
        if(aoNivel)aoNivel(notaDosAplausos([rms])/100);
        if(performance.now()>=fim){
          parar();
          const nota=notaDosAplausos(amostras);
          resolve({nota,estrelas:estrelas(nota),frase:frase(nota)});
        }
      },50);
    });
  }
  function parar(){
    clearInterval(timer);timer=0;
    if(fluxo){fluxo.getTracks().forEach(t=>t.stop());fluxo=null}
    if(ctx){ctx.close().catch(()=>{});ctx=null}
  }
  return{medir,parar,notaDosAplausos,estrelas,frase};
})();
if(typeof module!=="undefined")module.exports=Aplausometro;
