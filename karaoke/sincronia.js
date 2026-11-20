"use strict";
/*
 * Gravar sincronia tocando.
 *
 * Para música sem LRC (ou com tempo de outra gravação): o playback toca e a
 * pessoa toca em "Marcar" no instante em que cada verso começa. O tempo é
 * medido no PRÓPRIO playback (fonte.tempo()), então a sincronia salva casa com
 * aquele playback — por isso o offset da música volta a zero ao salvar.
 *
 * Desconta o atraso da caixa Bluetooth (o som chega atrasado ao ouvido) e um
 * tempo médio de reação do dedo (REACAO), senão toda linha acenderia tarde.
 */
const Sincronia=(()=>{
  const REACAO=0.15;
  let versos=[],marcas=[],ativo=false;

  const versoAtual=()=>marcas.filter(m=>m.tipo==="verso").length;

  function iniciar(){
    versos=versosDaLetra(letraDaMusica(P.musica));
    marcas=[];ativo=true;
    if(!versos.length){fecharPalco();notify("Esta música ainda não tem letra. Cole ou busque a letra antes de gravar a sincronia.");return}
    $("gravarPainel").hidden=false;
    render();
    notify("Toque ▶ para o playback começar e marque cada verso quando ele começar a ser cantado.",true);
  }
  function encerrar(){ativo=false;$("gravarPainel").hidden=true}

  function agora(){return Math.max(0,P.fonte.tempo()-prefs().audioDelay/1000-REACAO)}
  function marcar(){
    if(!ativo)return;
    if(!P.fonte.tocando()){tocarAgora();return}
    if(versoAtual()>=versos.length)return;
    const t=agora(),ultima=marcas[marcas.length-1];
    marcas.push({t:ultima?Math.max(t,ultima.t+0.05):t,tipo:"verso",i:versoAtual()});
    render();
  }
  // Pausa instrumental: a linha anterior para de "encher" aqui.
  function pausa(){
    if(!ativo||!marcas.length||!P.fonte.tocando())return;
    const ultima=marcas[marcas.length-1];
    if(ultima.tipo==="pausa")return;
    marcas.push({t:Math.max(agora(),ultima.t+0.05),tipo:"pausa"});
    render();
  }
  function desfazer(){if(marcas.pop())render()}
  function recomecar(){marcas=[];P.fonte.buscar(0);tocarAgora();render()}

  function render(){
    const n=versoAtual();
    $("gravarVerso").textContent=n<versos.length?versos[n].texto:"✅ Todos os versos marcados!";
    $("gravarProximo").textContent=versos[n+1]?versos[n+1].texto:"";
    $("gravarConta").textContent=`verso ${Math.min(n+1,versos.length)} de ${versos.length}`;
    $("gravarSalvar").disabled=n<versos.length;
    $("gravarDesfazer").disabled=!marcas.length;
  }
  function tick(){}
  function aoFim(){
    if(versoAtual()<versos.length)notify(`A música acabou com ${versos.length-versoAtual()} verso(s) sem marcar. Desfaça e marque de novo, ou recomece.`);
    else notify("Música encerrada. Salve a sincronia.",true);
    atualizarBotaoTocar();
  }

  async function salvar(){
    if(versoAtual()<versos.length)return;
    let parte="";
    const linhas=marcas.map(m=>{
      if(m.tipo==="verso"){parte=versos[m.i].parte;return{t:m.t,fim:null,texto:versos[m.i].texto,parte,palavras:null}}
      return{t:m.t,fim:null,texto:"",parte,palavras:null};
    });
    const m=P.musica;
    const texto=paraTexto(linhas);
    const plano=m.lyrics&&m.lyrics.trim()?m.lyrics:versos.map(v=>(v.parte?v.parte+": ":"")+v.texto).join("\n");
    editarMusica(m.id,{synced:texto,lyrics:plano,offset:0});
    await salvarEstado();
    encerrar();
    notify("Sincronia salva! Tocando do começo para conferir.",true);
    // Confere na hora: mesmo palco, modo ensaio.
    P.modo="ensaio";$("palco").dataset.modo="ensaio";
    carregarIndice(0,{comecarJa:true});
  }
  function cancelar(){encerrar();fecharPalco()}

  // Espaço/Enter marcam, Backspace desfaz, P marca pausa.
  function tecla(e){
    if(!ativo)return false;
    if(e.key===" "||e.key==="Enter"){e.preventDefault();marcar();return true}
    if(e.key==="Backspace"){e.preventDefault();desfazer();return true}
    if(e.key==="p"){pausa();return true}
    return false;
  }
  return{iniciar,encerrar,marcar,pausa,desfazer,recomecar,salvar,cancelar,tick,aoFim,tecla};
})();
