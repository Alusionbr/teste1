"use strict";
/*
 * Letra sincronizada (.lrc) — arquivo PURO: não toca em tela nem em rede, e é
 * testado em tests/lrc.test.js.
 *
 * Formatos aceitos:
 *   [01:02.50]Linha comum
 *   [01:02.50]<01:02.50>Palavra <01:03.10>por <01:03.40>palavra   (LRC "enhanced")
 *   [01:02.50]A: verso do cantor A       B: cantor B     T: todos juntos
 *   (M:, F: e D: — convenção antiga de dueto — viram A, B e T)
 *
 * A marca de dueto vale da linha em diante até aparecer outra (é assim nos
 * arquivos de dueto que circulam). O editor de dueto grava a marca sempre que
 * a parte muda, então ler e gravar de novo devolve o mesmo resultado.
 *
 * Letra sem tempo (texto simples) também passa por aqui: as linhas vêm com
 * t=null e o palco rola pela fração já tocada em vez de destacar linha.
 */
const LRC_TIME=/\[(\d+):(\d+(?:[.:]\d+)?)\]/g;
const LRC_META=/\[[a-z]{2,10}:[^\]]*\]/gi;
const WORD_TIME=/<(\d+):(\d+(?:[.:]\d+)?)>/g;
const PARTE_PREFIXO=/^\s*([ABTMFD])\s*:\s+/i;
const PARTE_NOME={A:"A",B:"B",T:"T",M:"A",F:"B",D:"T"};
// Velocidade média de canto usada para estimar o preenchimento quando o LRC
// não tem tempo por palavra: ~12 letras por segundo.
const SEG_POR_LETRA=0.085;

function temLRC(text){return /\[\d+:\d+(?:[.:]\d+)?\]/.test(String(text||""))}
function segundos(min,seg){return +min*60+parseFloat(String(seg).replace(":","."))}

function separarParte(texto,parteAtual){
  const m=texto.match(PARTE_PREFIXO);
  if(!m)return{texto,parte:parteAtual};
  return{texto:texto.slice(m[0].length),parte:PARTE_NOME[m[1].toUpperCase()]};
}

// "<00:01.00>Olá <00:01.50>mundo" → [{t:1,texto:"Olá "},{t:1.5,texto:"mundo"}]
function lerPalavras(corpo,tLinha){
  if(!WORD_TIME.test(corpo)){WORD_TIME.lastIndex=0;return null}
  WORD_TIME.lastIndex=0;
  const out=[];let ultimo=0,tAtual=tLinha,m;
  while((m=WORD_TIME.exec(corpo))){
    const antes=corpo.slice(ultimo,m.index);
    if(antes)out.push({t:tAtual,texto:antes});
    tAtual=segundos(m[1],m[2]);ultimo=m.index+m[0].length;
  }
  const resto=corpo.slice(ultimo);
  if(resto)out.push({t:tAtual,texto:resto});
  return out.filter(p=>p.texto.length);
}

/*
 * Lê letra (LRC ou texto) e devolve {sincronizada, linhas}.
 * Cada linha: {t, fim, texto, parte, palavras}
 *   t        segundos (null em letra sem tempo)
 *   fim      início da linha seguinte (ou t+6 na última)
 *   parte    "" | "A" | "B" | "T"
 *   palavras [{t,texto}] quando o LRC tem tempo por palavra; senão null
 */
function lerLetra(text){
  const bruto=String(text||"").replace(/\r/g,"");
  if(temLRC(bruto))return{sincronizada:true,linhas:lerLRC(bruto)};
  let parte="";
  const linhas=[];
  bruto.split("\n").forEach(l=>{
    const limpa=l.replace(LRC_META,"").trim();
    if(!limpa)return;
    const p=separarParte(limpa,parte);parte=p.parte;
    linhas.push({t:null,fim:null,texto:p.texto.trim(),parte,palavras:null});
  });
  return{sincronizada:false,linhas};
}

function lerLRC(text){
  const out=[];let parte="";
  text.split("\n").forEach(l=>{
    const marcas=[...l.matchAll(LRC_TIME)];
    if(!marcas.length)return;
    let corpo=l.replace(LRC_TIME,"").replace(LRC_META,"");
    const p=separarParte(corpo,parte);parte=p.parte;corpo=p.texto;
    marcas.forEach(m=>{
      const t=segundos(m[1],m[2]);
      const palavras=lerPalavras(corpo,t);
      const texto=(palavras?palavras.map(w=>w.texto).join(""):corpo.replace(WORD_TIME,"")).replace(/\s+/g," ").trim();
      out.push({t,fim:null,texto,parte,palavras});
    });
  });
  out.sort((a,b)=>a.t-b.t);
  out.forEach((l,i)=>{l.fim=i<out.length-1?out[i+1].t:l.t+6});
  return out;
}

function fmtLRC(t){
  const cs=Math.max(0,Math.round(t*100));
  const m=Math.floor(cs/6000),s=Math.floor(cs/100)%60,c=cs%100;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(c).padStart(2,"0")}`;
}

// Inverso de lerLetra: grava LRC (linhas com t) ou texto (linhas sem t).
function paraTexto(linhas){
  let parteAnterior="";
  return linhas.map(l=>{
    let prefixo="";
    if(l.parte&&l.parte!==parteAnterior)prefixo=l.parte+": ";
    else if(!l.parte&&parteAnterior)prefixo="T: ";
    parteAnterior=l.parte||(parteAnterior?"T":"");
    if(l.t==null)return prefixo+l.texto;
    const corpo=l.palavras&&l.palavras.length?l.palavras.map(w=>`<${fmtLRC(w.t)}>${w.texto}`).join(""):l.texto;
    return `[${fmtLRC(l.t)}]${prefixo}${corpo}`;
  }).join("\n");
}

// Versos de uma letra, sem tempo nem marcação: base para gravar a sincronia.
function versosDaLetra(text){return lerLetra(text).linhas.filter(l=>l.texto)}

// Índice da última linha que já começou em `t` (-1 antes da primeira).
function indiceNoTempo(linhas,t){
  let lo=0,hi=linhas.length-1,ans=-1;
  while(lo<=hi){const mid=(lo+hi)>>1;if(linhas[mid].t<=t){ans=mid;lo=mid+1}else hi=mid-1}
  return ans;
}

/*
 * Quanto de cada palavra da linha já foi "cantado" em `t` (0..1 por palavra).
 * Com tempo por palavra: cada palavra enche entre o seu tempo e o da seguinte.
 * Sem: a linha enche no ritmo médio de canto, terminando antes da próxima
 * linha — o efeito clássico do karaokê.
 */
function preenchimento(linha,t){
  const palavras=dividirPalavras(linha);
  if(linha.t==null)return palavras.map(()=>0);
  if(linha.palavras&&linha.palavras.length){
    return linha.palavras.map((w,i)=>{
      const fim=i<linha.palavras.length-1?linha.palavras[i+1].t:Math.min(linha.fim,w.t+Math.max(0.4,w.texto.length*SEG_POR_LETRA*1.5));
      return clamp01((t-w.t)/Math.max(0.05,fim-w.t));
    });
  }
  const total=palavras.reduce((s,w)=>s+w.length,0)||1;
  const duracao=Math.max(0.6,Math.min((linha.fim-linha.t)-0.15,total*SEG_POR_LETRA+0.3));
  const letrasCantadas=clamp01((t-linha.t)/duracao)*total;
  let antes=0;
  return palavras.map(w=>{const p=clamp01((letrasCantadas-antes)/Math.max(1,w.length));antes+=w.length;return p});
}
// Pedaços que o palco desenha: as palavras do LRC enhanced ou o texto separado
// por espaço (o espaço fica grudado na palavra para a linha não se mexer).
function dividirPalavras(linha){
  if(linha.palavras&&linha.palavras.length)return linha.palavras.map(w=>w.texto);
  return (linha.texto.match(/\S+\s*/g)||[]);
}
function clamp01(v){return v<0?0:v>1?1:v}

if(typeof module!=="undefined")module.exports={lerLetra,paraTexto,versosDaLetra,indiceNoTempo,preenchimento,dividirPalavras,temLRC,fmtLRC};
