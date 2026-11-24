"use strict";
// Setas do controle remoto navegam pelo que está visível. Enter usa a ação nativa.
document.addEventListener("keydown",e=>{
  if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)||e.altKey||e.ctrlKey||e.metaKey)return;
  const atual=document.activeElement,tag=atual?.tagName,tipo=atual?.type;
  if(tag==="TEXTAREA"||tag==="SELECT"||tipo==="range")return;
  if(tag==="INPUT"&&!["checkbox","radio","button","submit"].includes(tipo)&&["ArrowLeft","ArrowRight"].includes(e.key))return;
  const dialogos=[...document.querySelectorAll("dialog[open]")],palco=document.getElementById("palco");
  const raiz=dialogos[dialogos.length-1]||(palco&&!palco.hidden?palco:document);
  const alvos=[...raiz.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&getComputedStyle(el).visibility!=="hidden");
  if(!alvos.length)return;
  let proximo;
  if(!alvos.includes(atual))proximo=alvos[0];
  else{
    const a=atual.getBoundingClientRect(),x=a.x+a.width/2,y=a.y+a.height/2;
    const horizontal=e.key==="ArrowLeft"||e.key==="ArrowRight",sinal=e.key==="ArrowLeft"||e.key==="ArrowUp"?-1:1;
    proximo=alvos.filter(el=>el!==atual).map(el=>{
      const b=el.getBoundingClientRect(),dx=b.x+b.width/2-x,dy=b.y+b.height/2-y;
      const frente=(horizontal?dx:dy)*sinal,lado=Math.abs(horizontal?dy:dx);
      return{el,frente,distancia:frente+lado*2.5};
    }).filter(x=>x.frente>2).sort((a,b)=>a.distancia-b.distancia)[0]?.el;
  }
  if(palco&&!palco.hidden&&typeof acordarControles==="function")acordarControles();
  e.preventDefault();e.stopPropagation();
  if(proximo){proximo.focus({preventScroll:true});proximo.scrollIntoView({block:"nearest",inline:"nearest"})}
},true);
