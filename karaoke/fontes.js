"use strict";
/*
 * Fontes de playback com a MESMA interface — o palco não sabe de onde vem o som.
 *
 *   carregar(musica)  prepara (não toca)
 *   tocar() pausar() alternar() buscar(seg) parar()
 *   tempo()     segundos do playback agora (extrapolado entre avisos do player)
 *   duracao()   segundos (0 se ainda não sabe)
 *   tocando()   espelho do que o PLAYER informa, nunca chute nosso
 *   sinal()     true quando o player está mandando notícia (iframe vivo)
 *   volume(0..100)
 *
 * Eventos (Fontes.ouvinte(tipo, dados)):
 *   "estado"     mudou tocando/pausado
 *   "fim"        a música terminou
 *   "erro"       {msg}  — o palco mostra e oferece trocar de playback
 *   "bloqueado"  {tipo} — o navegador exige um toque (política de autoplay)
 *   "previa"     o Spotify está tocando só a prévia de 30 s
 *   "anuncio"    {ativo} — anúncio do YouTube tocando
 *
 * Relógio da letra: tempoDaLetra = tempo() − musica.offset − prefs.audioDelay
 */
const Fontes={ouvinte:null};
function emitir(tipo,dados){try{Fontes.ouvinte&&Fontes.ouvinte(tipo,dados||{})}catch(e){console.error(e)}}

/* ------------------------------------------------------------ relógio manual */
/*
 * Sem playback (ou playback que não informa o tempo): a letra anda pelo
 * relógio do aparelho. A família toca o som por fora (rádio, outro app) e
 * aperta Tocar junto. Nunca trava o palco.
 */
const FonteRelogio=(()=>{
  let base=0,inicio=0,rodando=false,total=0,acabou=false;
  const agora=()=>rodando?base+(performance.now()-inicio)/1000:base;
  return{
    tipo:"relogio",
    async carregar(musica){
      const linhas=lerLetra(letraDaMusica(musica)).linhas;
      const ultima=linhas.length&&linhas[linhas.length-1].t!=null?linhas[linhas.length-1].t+8:0;
      total=musica.duration||ultima||240;base=0;rodando=false;acabou=false;
    },
    tocar(){if(rodando)return;if(acabou){base=0;acabou=false}inicio=performance.now();rodando=true;emitir("estado")},
    pausar(){if(!rodando)return;base=agora();rodando=false;emitir("estado")},
    alternar(){rodando?this.pausar():this.tocar()},
    buscar(seg){base=clamp(seg,0,total);inicio=performance.now();acabou=false},
    parar(){base=0;rodando=false},
    tempo(){
      const t=agora();
      if(rodando&&t>=total){base=total;rodando=false;acabou=true;emitir("estado");emitir("fim")}
      return Math.min(t,total);
    },
    duracao:()=>total,tocando:()=>rodando,sinal:()=>true,volume(){}
  };
})();

/* -------------------------------------------------------- arquivo do aparelho */
/*
 * Áudio ou vídeo guardado no IndexedDB. É a fonte mais precisa (o tempo vem do
 * próprio <video>) e a única que funciona sem internet.
 */
const FonteArquivo=(()=>{
  let audio=null,url="";
  function el(){
    if(audio)return audio;
    audio=$("audioPlayer");
    audio.addEventListener("play",()=>emitir("estado"));
    audio.addEventListener("pause",()=>emitir("estado"));
    audio.addEventListener("ended",()=>{emitir("estado");emitir("fim")});
    audio.addEventListener("error",()=>{if(audio.getAttribute("src"))emitir("erro",{msg:"Não consegui tocar este arquivo. Use um formato compatível com o navegador ou escolha outro arquivo na música."})});
    return audio;
  }
  return{
    tipo:"arquivo",
    async carregar(musica){
      const a=el();
      a.pause();
      const blob=await KStore.audio.ler(musica.playback.id).catch(()=>null);
      if(url)URL.revokeObjectURL(url);url="";
      if(!blob){a.removeAttribute("src");throw Error("O arquivo desta música não está neste aparelho. Escolha o arquivo de novo na música.")}
      url=URL.createObjectURL(blob);
      a.src=url;a.load();
    },
    // Sem await antes do play(): esperar descartaria o gesto do usuário.
    tocar(){const a=el();const p=a.play();if(p&&p.catch)p.catch(e=>{if(e&&e.name==="NotAllowedError")emitir("bloqueado",{tipo:"arquivo"})})},
    pausar(){el().pause()},
    alternar(){const a=el();a.paused?this.tocar():a.pause()},
    buscar(seg){const a=el();try{a.currentTime=Math.max(0,seg)}catch{}},
    parar(){const a=el();a.pause();try{a.currentTime=0}catch{}},
    tempo:()=>audio?audio.currentTime:0,
    duracao:()=>audio&&Number.isFinite(audio.duration)?audio.duration:0,
    tocando:()=>!!audio&&!audio.paused&&!audio.ended,
    sinal:()=>true,
    volume(v){el().volume=clamp(v,0,100)/100}
  };
})();

// Escolhe a fonte da música (sem playback → relógio manual).
function fonteDaMusica(musica){
  const tipo=musica&&musica.playback&&musica.playback.tipo;
  if(tipo==="arquivo")return FonteArquivo;
  if(tipo==="youtube")return FonteYouTube;
  if(tipo==="spotify")return FonteSpotify;
  return FonteRelogio;
}
