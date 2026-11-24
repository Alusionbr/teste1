"use strict";
/* Convite público, separado do QR da sala: sem código de sala, cantores ou playback. */
const ConviteProjeto=(()=>{
  const URL_PROJETO="https://alusionbr.github.io/teste1/karaoke/projeto.html";
  const INTERVALO=15*60*1000,DURACAO=25000;
  const CHAVE="karaoke:convite-projeto";
  let salvo={};try{salvo=JSON.parse(sessionStorage.getItem(CHAVE)||"{}")}catch{}
  let ultimo=Number.isFinite(salvo?.ultimo)?salvo.ultimo:null,ate=0,dispensado=salvo?.dispensado===true,desenhado=false;
  function guardar(){try{sessionStorage.setItem(CHAVE,JSON.stringify({ultimo,dispensado}))}catch{}}
  const telaGrande=window.matchMedia("(min-width: 900px) and (min-height: 600px)");
  function ocultar(){const el=$("conviteProjeto");if(el&&!el.hidden)el.hidden=true;ate=0}
  function atualizar({aberto,modo,fase,ligado,erro=false},agora=Date.now()){
    const el=$("conviteProjeto");if(!el)return;
    if(!aberto||modo!=="festa"||!ligado||dispensado||erro||!telaGrande.matches||!["nota","fim"].includes(fase)){ocultar();return}
    if(!el.hidden){if(agora>=ate)ocultar();return}
    if(ultimo!==null&&agora-ultimo<INTERVALO)return;
    try{
      if(!desenhado){QR.desenhar($("conviteProjetoQR"),URL_PROJETO);desenhado=true}
    }catch{dispensado=true;guardar();ocultar();return} // convite nunca pode impedir a festa
    ultimo=agora;guardar();ate=agora+DURACAO;el.hidden=false;
  }
  function iniciar(){
    $("conviteProjetoFechar").addEventListener("click",()=>{dispensado=true;guardar();ocultar()});
    // Enter/espaço nos botões do convite não acionam os atalhos de próxima música.
    $("conviteProjeto").addEventListener("keydown",e=>{if(["Enter"," ","ArrowLeft","ArrowRight"].includes(e.key))e.stopPropagation()});
  }
  function permitirNovamente(){dispensado=false;ultimo=null;guardar()}
  iniciar();
  return{atualizar,ocultar,permitirNovamente};
})();
