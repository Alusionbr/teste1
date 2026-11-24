"use strict";
/*
 * Palco: a tela da festa.
 *
 * Fases de cada música: "vez" (Agora é a vez de… com contagem) → "cantando"
 * → "nota" (aplausômetro) → próxima. No fim da playlist: "fim".
 * Modos: "festa" (playlist), "ensaio" (uma música só), "gravar" (sincronia) e
 * "solo" (uma música só, com nota e placar). P.solo vale também para a playlist
 * tocada em "Cantar sozinho" (modo "festa"): sem cantor, "Você" no lugar.
 *
 * Um requestAnimationFrame só desenha tudo (letra, barra, sinal). O relógio
 * vem SEMPRE da fonte de playback:
 *   tempoDaLetra = fonte.tempo() − musica.offset − prefs.audioDelay
 */
const P={aberto:false,modo:"festa",solo:false,fundoComLetra:"escuro",itens:[],playlistId:"",indice:0,item:null,musica:null,
  letra:{sincronizada:false,linhas:[]},fonte:null,fase:"",raf:0,idx:-2,carregado:false,carregando:null,
  contagemTimer:0,ultimaBarra:-1,arrastando:false,spans:[],notaTimer:0,duracaoAvisada:""};

const prefs=()=>K.dados.prefs;
const temPalco=()=>P.aberto;

function abrirPalco({playlistId="",indice=0,modo="festa",musicaId="",solo=false}={}){
  if(modo==="festa"){
    const p=acharPlaylist(playlistId);
    if(!p||!p.itens.length)return notify("Adicione músicas à playlist antes de começar.");
    P.itens=p.itens;P.playlistId=p.id;
  }else{
    if(!acharMusica(musicaId))return;
    P.itens=[{id:"ensaio",musicaId,cantorA:"",cantorB:""}];P.playlistId="";
  }
  P.modo=modo;P.solo=solo||modo==="solo";P.aberto=true;
  $("palco").dataset.modo=modo;
  document.body.classList.add("comPalco");
  $("palco").hidden=false;
  aplicarPrefsPalco();
  Fontes.ouvinte=aoEventoFonte;
  keepAwake();
  if(modo==="festa"&&document.fullscreenEnabled&&!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});
  carregarIndice(clamp(indice,0,P.itens.length-1));
  cancelAnimationFrame(P.raf);P.raf=requestAnimationFrame(tick);
}

function fecharPalco(){
  if(!P.aberto)return;
  P.aberto=false;
  ConviteProjeto.ocultar();
  pararTudo();
  cancelAnimationFrame(P.raf);
  if(typeof Sincronia!=="undefined")Sincronia.encerrar();
  Fontes.ouvinte=null;
  $("palco").hidden=true;
  document.body.classList.remove("comPalco","liberandoYT","liberandoSP");
  if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  releaseAwake();
  avisarSala();
  if(typeof renderTudo==="function")renderTudo();
}

// Fundo que vale para a música de agora. A preferência do aparelho (Ajustes) é a base;
// uma música de YouTube com letra pode guardar a própria escolha (letraDe): "video" = só
// o vídeo (letra do vídeo), "app" = letra sincronizada do app por cima.
function fundoEfetivo(){
  const base=prefs().fundo,m=P.musica;
  if(m&&m.playback&&m.playback.tipo==="youtube"&&temLetra(m)){
    if(m.letraDe==="video")return "tela";
    if(m.letraDe==="app")return base==="tela"?(P.fundoComLetra||"escuro"):base;
  }
  return base;
}
function aplicarPrefsPalco(){
  const pr=prefs(),el=$("palco"),fundo=fundoEfetivo();
  el.dataset.fundo=fundo;
  el.style.setProperty("--escala",String(pr.tamanho/100));
  const soVideo=fundo==="tela";
  const b=$("palcoLetraBtn");
  b.textContent=soVideo?"🔤 Letra":"🎞 Só vídeo";
  b.setAttribute("aria-pressed",String(!soVideo));
  b.title=soVideo?"Ligar a letra sincronizada do app (L)":"Desligar a letra do app e mostrar só o vídeo (L)";
  P.idx=-2;   // a letra se redesenha na hora quando volta
  semLegendasDoYouTube();
}
// Letra do app na tela = sem as legendas do próprio YouTube por baixo (letra em dobro).
function semLegendasDoYouTube(){
  if(P.fonte===FonteYouTube&&P.musica&&fundoEfetivo()!=="tela")FonteYouTube.legendas(false);
}
// Letra do app e vídeo "puro" só trocam de camada (CSS): o player do YouTube não é
// recarregado nem muda de tamanho, então o som e o relógio seguem sem soluço.
const soVideoAgora=()=>!!(P.musica&&P.musica.playback&&P.musica.playback.tipo==="youtube"&&fundoEfetivo()==="tela");

// A conferência de vídeo (segundo player escondido) não pode competir com a música desta tela.
YouTubeBase.definirOcupado(()=>P.aberto&&P.fase==="cantando"&&!!P.fonte&&P.fonte!==FonteRelogio&&P.fonte.tocando());

function pararTudo(){
  clearInterval(P.contagemTimer);clearTimeout(P.notaTimer);
  if(typeof Aplausometro!=="undefined")Aplausometro.parar();
  try{P.fonte&&P.fonte.parar()}catch{}
  // Fonte que não é a atual também para: YouTube e áudio podem ter ficado de outra música.
  [FonteArquivo,FonteYouTube,FonteSpotify,FonteRelogio].forEach(f=>{if(f!==P.fonte)try{f.parar()}catch{}});
}

function esconderSobreposicoes(){
  ["palcoVez","palcoNota","palcoFim","palcoLiberar","palcoErro"].forEach(id=>{$(id).hidden=true});
  document.body.classList.remove("liberandoYT","liberandoSP");
}

/* ------------------------------------------------------------ trocar música */
function carregarIndice(i,{comecarJa=false}={}){
  ConviteProjeto.ocultar();
  pararTudo();esconderSobreposicoes();
  if(i>=P.itens.length){mostrarFim();return}
  if(i<0)i=0;
  P.indice=i;P.item=P.itens[i];P.musica=acharMusica(P.item.musicaId);
  if(!P.musica){carregarIndice(i+1,{comecarJa});return}
  aplicarPrefsPalco();   // cada música pode guardar se usa a letra do vídeo ou a do app
  P.letra=lerLetra(letraDaMusica(P.musica));
  P.idx=-2;P.ultimaBarra=-1;P.duracaoAvisada="";
  P.fonte=fonteDaMusica(P.musica);
  P.carregado=false;
  const fonte=P.fonte;
  P.carregando=fonte.carregar(P.musica).then(()=>{if(P.fonte===fonte)P.carregado=true}).catch(e=>{if(P.fonte===fonte)mostrarErro(e.message||String(e))});
  desenharCabecalho();
  prepararLetra();
  atualizarBotaoTocar();
  avisarSala();
  if(P.modo==="gravar"){P.fase="gravando";Sincronia.iniciar();return}
  if((P.modo==="festa"||P.modo==="solo")&&prefs().contagem>0&&!comecarJa)mostrarVez();
  else comecar();
}

function proxima(){
  if(!P.aberto)return;
  if(P.modo==="solo"){mostrarFim("🎤 Fim da música");return}
  if(P.modo!=="festa"){mostrarFim();return}
  carregarIndice(P.indice+1);
}
function anterior(){
  if(!P.aberto)return;
  if(P.fonte&&P.fonte.tempo()>5||P.modo!=="festa"||P.indice===0){P.fonte&&P.fonte.buscar(0);return}
  carregarIndice(P.indice-1);
}

/* ---------------------------------------------------------------- "a vez de" */
function cantoresDoItem(item){
  if(P.solo)return{a:null,b:null};
  const a=acharCantor(item&&item.cantorA),b=acharCantor(item&&item.cantorB);
  return{a,b};
}
function rotuloCantores(item){
  const{a,b}=cantoresDoItem(item);
  if(a&&b)return `${a.emoji} ${a.nome} & ${b.emoji} ${b.nome}`;
  if(a)return `${a.emoji} ${a.nome}`;
  return "🎤 Quem quiser!";
}
// Rótulo do cantor no palco: sozinho é sempre "Você" (a playlist pode ter cantores marcados).
function rotuloPalco(item){return P.solo?"🎤 Você":rotuloCantores(item)}
function mostrarVez(){
  P.fase="vez";
  const{a}=cantoresDoItem(P.item);
  $("vezCantor").textContent=P.solo?"🎤 Prepare-se!":rotuloCantores(P.item);
  $("vezCantor").style.color=a?a.cor:"";
  $("vezMusica").textContent=`${P.musica.title}${P.musica.artist?" — "+P.musica.artist:""}`;
  $("palcoVez").hidden=false;
  let resta=P.solo?Math.min(prefs().contagem,3):prefs().contagem;
  const mostrar=()=>{$("vezContagem").textContent=resta>0?String(resta):"🎶"};
  mostrar();
  clearInterval(P.contagemTimer);
  P.contagemTimer=setInterval(()=>{resta--;mostrar();if(resta<=0){clearInterval(P.contagemTimer);comecar()}},1000);
  avisarSala();
}
function comecar(){
  ConviteProjeto.ocultar();
  clearInterval(P.contagemTimer);
  $("palcoVez").hidden=true;
  P.fase="cantando";
  tocarAgora();
  avisarSala();
}
// Sem await antes do play() quando já carregou: esperar descartaria o toque.
function tocarAgora(){
  const f=P.fonte;
  if(P.carregado)f.tocar();
  else P.carregando.then(()=>{if(P.fonte===f&&P.carregado&&(P.fase==="cantando"||P.fase==="gravando"))f.tocar()});
}
function alternar(){
  if(!P.aberto||!P.fonte)return;
  if(!$("palcoErro").hidden&&!$("erroTentar").hidden){tentarPlayback();return}
  if(P.fase==="vez"){comecar();return}
  if(P.fase!=="cantando"&&P.fase!=="gravando")return;
  if(P.fonte.tocando())P.fonte.pausar();else tocarAgora();
}

/* ------------------------------------------------------- eventos da fonte */
function aoEventoFonte(tipo,d){
  if(!P.aberto)return;
  if(tipo==="estado"){
    atualizarBotaoTocar();
    if(P.fonte&&P.fonte.tocando()){$("palcoLiberar").hidden=true;document.body.classList.remove("liberandoYT","liberandoSP");keepAwake();acordarControles();semLegendasDoYouTube()}
    avisarSala();
  }else if(tipo==="fim"){
    if(P.fase==="gravando"){Sincronia.aoFim();return}
    if(P.fase!=="cantando")return;
    if(P.modo==="ensaio"){mostrarFim("🎤 Fim do ensaio");return}
    mostrarNota();
  }else if(tipo==="erro"){
    mostrarErro(d.msg,d.tentarNovamente);
  }else if(tipo==="bloqueado"){
    mostrarLiberar(d.tipo,d.controles);
  }else if(tipo==="previa"){
    notify("O Spotify está tocando só a prévia de 30 s. Entre na sua conta do Spotify neste navegador para ouvir a música inteira.");
  }else if(tipo==="retomou"&&P.fonte===FonteYouTube&&!$("erroTentar").hidden){
    $("palcoErro").hidden=true;
    $("palcoLiberar").hidden=true;
    document.body.classList.remove("liberandoYT");
    atualizarBotaoTocar();
    avisarSala();
  }else if(tipo==="anuncio"&&P.fonte===FonteYouTube){
    if(d.ativo)mostrarLiberar("youtube",true);
    else if(P.fonte.tocando()){
      $("palcoLiberar").hidden=true;
      document.body.classList.remove("liberandoYT");
    }
    atualizarSinal();
    avisarSala();
  }
}
function mostrarLiberar(tipo,controles=false){
  if(P.fase!=="cantando"&&P.fase!=="gravando")return;
  const box=$("palcoLiberar");box.hidden=false;
  const botao=$("liberarTocar");
  if(tipo==="youtube"){
    document.body.classList.add("liberandoYT");
    $("liberarTexto").textContent=controles
      ?"Use o ▶ do próprio YouTube. Se aparecer um anúncio, você pode interagir com ele aqui."
      :"Toque no ▶ do vídeo para liberar o som. Depois ele volta para trás da letra.";
    botao.hidden=true;
  }else if(tipo==="spotify"){
    document.body.classList.add("liberandoSP");
    $("liberarTexto").textContent="Toque no ▶ do Spotify (no canto da tela) para começar.";
    botao.hidden=true;
  }else{
    $("liberarTexto").textContent="O navegador pediu um toque para liberar o som.";
    botao.hidden=false;
  }
}
function mostrarErro(msg,tentarNovamente=false){
  if(!P.aberto)return;
  if(!tentarNovamente)try{P.fonte&&P.fonte.pausar()}catch{}
  $("erroTexto").textContent=msg;
  $("erroOutro").hidden=!(P.musica&&P.musica.playback);
  $("erroTentar").hidden=!tentarNovamente||P.fonte!==FonteYouTube;
  $("erroControlesYT").hidden=!(tentarNovamente&&P.fonte===FonteYouTube&&FonteYouTube.pronto);
  const video=P.musica?.playback?.tipo==="youtube"&&lerLinkYouTube(P.musica.playback.id);
  $("erroYouTube").hidden=!video;
  if(video)$("erroYouTube").href=`https://www.youtube.com/watch?v=${video}`;
  else $("erroYouTube").removeAttribute("href");
  $("palcoErro").hidden=false;
  $("palcoLiberar").hidden=true;document.body.classList.remove("liberandoYT","liberandoSP");
  avisarSala();
}
function tentarPlayback(){
  if(!P.aberto||P.fonte!==FonteYouTube||$("erroTentar").hidden)return;
  $("palcoErro").hidden=true;
  FonteYouTube.recarregar();
  atualizarBotaoTocar();
  avisarSala();
}
// Playback falhou: a letra segue pelo relógio do aparelho, sem travar a festa.
// A letra continua de onde estava (ex.: a prévia do Spotify acabou aos 30 s),
// em vez de recomeçar do zero.
function seguirSemPlayback(){
  $("palcoErro").hidden=true;
  let desde=0;
  try{desde=P.fonte?P.fonte.tempo():0}catch{}
  try{P.fonte&&P.fonte.parar()}catch{}
  P.fonte=FonteRelogio;P.carregado=false;
  const f=P.fonte;
  P.carregando=f.carregar(P.musica).then(()=>{P.carregado=true;if(desde>0)f.buscar(desde)});
  P.carregando.then(()=>{if(P.fonte===f){if(P.fase==="vez")return;P.fase=P.modo==="gravar"?"gravando":"cantando";f.tocar()}});
}

/* ------------------------------------------------------------ nota e fim */
function mostrarNota(){
  P.fase="nota";
  const{a}=cantoresDoItem(P.item);
  $("notaTitulo").textContent=P.solo?"👏 Mandou bem!":`Aplausos para ${rotuloCantores(P.item)}!`;
  $("notaTitulo").style.color=a?a.cor:"";
  $("notaResultado").textContent="";
  $("notaDeNovo").hidden=!P.solo;
  mostrarRecorde(null);
  $("notaBarra").style.width="0%";
  const comMic=prefs().aplausometro&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
  $("notaMedir").hidden=!comMic;$("notaMedidor").hidden=!comMic;
  if(!comMic)$("notaResultado").textContent="👏👏👏 Muito bem!";
  const prox=P.itens[P.indice+1],pm=prox&&acharMusica(prox.musicaId);
  $("notaProximoInfo").textContent=pm?`Próximo: ${P.solo?"":rotuloCantores(prox)+" — "}${pm.title}`:(P.modo==="solo"?"":"Esta foi a última da playlist.");
  $("palcoNota").hidden=false;
  avisarSala();
}
async function medirAplausos(){
  const btn=$("notaMedir");btn.disabled=true;
  $("notaResultado").textContent="Aplaudam! 👏👏👏";
  try{
    const r=await Aplausometro.medir(5,nivel=>{$("notaBarra").style.width=Math.round(nivel*100)+"%"});
    if(P.fase!=="nota")return;
    $("notaBarra").style.width=r.nota+"%";
    $("notaResultado").textContent=`${"⭐".repeat(r.estrelas)} ${r.nota} pontos — ${r.frase}`;
    if(P.solo){const g=registrarNota(K.dados,P.musica.id,r.nota);salvarEstado();mostrarRecorde(g)}
    avisarSala({nota:r.nota});
  }catch(e){
    $("notaResultado").textContent=e.message||"Não consegui usar o microfone.";
  }finally{btn.disabled=false}
}
// Linha do recorde na tela de nota (só no "Cantar sozinho"). g = resultado de
// registrarNota; null mostra o recorde que já existe (ou nada).
function mostrarRecorde(g){
  const el=$("notaRecorde");
  let txt="";
  if(P.solo&&P.musica){
    if(g)txt=g.recorde?(g.anterior===null?"🏆 Primeira nota desta música!":`🏆 Novo recorde! (antes: ${g.anterior})`):`Seu recorde: ${g.melhor}`;
    else{const m=melhorNota(K.dados,P.musica.id);if(m!==null)txt=`Seu recorde: ${m}`}
  }
  el.textContent=txt;el.hidden=!txt;
}
function mostrarFim(titulo){
  pararTudo();esconderSobreposicoes();
  P.fase="fim";
  $("palcoFim").querySelector(".vezCantor").textContent=titulo||"🎉 Fim da playlist!";
  $("fimDica").textContent=P.solo?"Cante de novo ou volte para escolher outra.":"Que festa! Adicione mais músicas ou comece de novo.";
  $("palcoFim").hidden=false;
  atualizarBotaoTocar();
  avisarSala();
}

/* --------------------------------------------------------------- desenho */
function desenharCabecalho(){
  const{a}=cantoresDoItem(P.item);
  const selo=$("palcoCantor");
  selo.textContent=P.solo?"🎤 Você":P.modo==="festa"?rotuloCantores(P.item):(P.modo==="gravar"?"⏺ Gravando":"🎤 Ensaio");
  selo.style.setProperty("--cor",a?a.cor:"#ff3d9a");
  $("palcoTitulo").textContent=`${P.musica.title}${P.musica.artist?" — "+P.musica.artist:""}`+(P.modo==="festa"?`  ·  ${P.indice+1}/${P.itens.length}`:"");
  $("spBox").hidden=!(P.musica.playback&&P.musica.playback.tipo==="spotify");
  $("palco").dataset.fonte=P.musica.playback?P.musica.playback.tipo:"relogio";
  atualizarOffset();
}
function corDaParte(parte){
  const{a,b}=cantoresDoItem(P.item);
  if(parte==="B")return b?b.cor:"#2de2e6";
  if(parte==="T")return "#ffd23f";
  return a?a.cor:"#ff3d9a";
}
function rotuloDaParte(parte){
  const{a,b}=cantoresDoItem(P.item);
  if(P.solo)return "";
  if(parte==="A")return a?`${a.emoji} ${a.nome}`:"Cantor A";
  if(parte==="B")return b?`${b.emoji} ${b.nome}`:"Cantor B";
  if(parte==="T")return "🎶 Todos juntos";
  return "";
}
function prepararLetra(){
  const{linhas,sincronizada}=P.letra;
  const corrida=$("letraCorrida");
  $("semSincronia").hidden=!(linhas.length&&!sincronizada);
  corrida.hidden=sincronizada||!linhas.length;
  ["linhaAnterior","linhaAtual","linhaProxima","linhaParte","palcoContagem"].forEach(id=>{$(id).textContent=""});
  P.spans=[];
  if(!linhas.length){$("linhaAtual").textContent="🎤 Sem letra salva — cante de memória!";$("linhaProxima").textContent=P.musica.title;return}
  if(!sincronizada){
    corrida.innerHTML=linhas.map(l=>`<p style="--cor:${corDaParte(l.parte)}">${esc(l.texto)}</p>`).join("");
    corrida.scrollTop=0;
  }
}
function montarLinhas(i){
  const L=P.letra.linhas,atual=$("linhaAtual");
  const linha=L[i];
  $("linhaAnterior").textContent=i>0?(L[i-1].texto||"♪"):"";
  if(!linha){
    atual.textContent=`🎤 ${P.musica.title}`;atual.style.setProperty("--cor","#ffffff");
    $("linhaParte").textContent="";P.spans=[];
  }else if(!linha.texto){
    atual.textContent="♪  ♪  ♪";atual.style.setProperty("--cor","#9d8cff");P.spans=[];
    $("linhaParte").textContent="";
  }else{
    const cor=corDaParte(linha.parte);
    atual.style.setProperty("--cor",cor);
    atual.innerHTML=dividirPalavras(linha).map(w=>`<span class="w">${esc(w)}</span>`).join("");
    P.spans=[...atual.children].map(el=>({el,p:-1}));
    const rot=rotuloDaParte(linha.parte);
    $("linhaParte").textContent=rot;$("linhaParte").style.color=cor;
  }
  const prox=L[i+1];
  $("linhaProxima").textContent=prox?(prox.texto||"♪"):"";
  $("linhaProxima").style.setProperty("--cor",prox?corDaParte(prox.parte):"#fff");
  // Reinicia a animação de entrada.
  atual.classList.remove("entra");void atual.offsetWidth;atual.classList.add("entra");
}
function desenharLetra(tl){
  const{linhas,sincronizada}=P.letra;
  if(!linhas.length)return;
  if(!sincronizada){rolarCorrida(tl);return}
  const i=indiceNoTempo(linhas,tl);
  if(i!==P.idx){P.idx=i;montarLinhas(i)}
  const linha=linhas[i];
  if(linha&&P.spans.length){
    const ps=preenchimento(linha,tl);
    P.spans.forEach((s,k)=>{const p=Math.round((ps[k]||0)*1000)/10;if(p!==s.p){s.p=p;s.el.style.setProperty("--p",p+"%")}});
  }
  // Contagem antes da primeira linha e depois de partes instrumentais longas.
  const prox=linhas[i+1];
  let texto="";
  if(prox){
    const falta=prox.t-tl;
    const vazio=i<0||!linha.texto||tl-linha.t>Math.max(3,linha.texto.length*0.085+1.5);
    if(vazio&&falta<=3.2&&falta>0&&(i<0||prox.t-(linha?linha.t:0)>5))texto="● ".repeat(Math.ceil(falta)).trim();
  }
  const c=$("palcoContagem");if(c.textContent!==texto)c.textContent=texto;
}
// Letra sem tempo: rola pela fração já tocada (posição, não velocidade — não
// acumula erro, e voltar a música reposiciona a letra).
function rolarCorrida(tl){
  const box=$("letraCorrida");
  const dur=(P.fonte&&P.fonte.duracao())||P.musica.duration||0;
  if(dur<15)return;
  const dist=box.scrollHeight-box.clientHeight;
  if(dist<=0)return;
  const prog=clamp((tl-8)/(dur-16),0,1);
  box.scrollTop=prog*dist;
}

function atualizarBarra(t){
  const q=Math.floor(t*4);
  if(q===P.ultimaBarra)return;
  P.ultimaBarra=q;
  const dur=(P.fonte&&P.fonte.duracao())||P.musica.duration||0;
  $("palcoTempo").textContent=fmt(t);
  $("palcoDuracao").textContent=fmt(dur);
  if(!P.arrastando){const r=$("palcoProgresso");r.max=String(Math.max(1,dur));r.value=String(Math.min(t,dur||t))}
}
function atualizarSinal(){
  const f=P.fonte,el=$("palcoSinal");
  let txt="",cls="";
  if(f===FonteYouTube&&FonteYouTube.emAnuncio){txt="📺 Outra mídia no YouTube — a letra espera";cls="alerta"}
  else if(f===FonteYouTube&&FonteYouTube.carregando){txt="Carregando YouTube…";cls="alerta"}
  else if(f===FonteRelogio){txt="⏱ relógio";cls=""}
  else if((f===FonteYouTube||f===FonteSpotify)&&f.tocando()&&!f.sinal()){txt="⚠️ sem sinal do player";cls="alerta"}
  else if(f===FonteYouTube||f===FonteSpotify){txt=f.tocando()?"● sincronizado":"";cls="ok"}
  if(el.textContent!==txt){el.textContent=txt;el.className=cls}
}
function atualizarBotaoTocar(){
  const tocando=!!(P.fonte&&P.fonte.tocando());
  $("palcoTocar").textContent=tocando?"⏸":"▶";
  $("palcoTocar").setAttribute("aria-label",tocando?"Pausar":"Tocar");
}
function atualizarOffset(){
  const v=Number(P.musica&&P.musica.offset)||0;
  $("palcoOffset").textContent=v?`${v>0?"+":""}${v.toFixed(2).replace(".",",")} s`:"0 s";
}

// Playback com duração bem diferente da letra costuma ter outra introdução:
// avisa uma vez por música e diz o que fazer (Letra −/+).
function avisarDuracao(f){
  const m=P.musica;
  if(P.duracaoAvisada||!m||!m.playback||m.playback.tipo==="arquivo"||P.fase!=="cantando"||!P.letra.sincronizada||soVideoAgora())return;
  const dur=f.duracao&&f.duracao();
  if(!(dur>0)||!f.tocando())return;
  P.duracaoAvisada=m.id+"|"+m.playback.id;
  const d=diferencaDuracao(m.duration,dur);
  if(!d)return;
  notify(`Este playback dura ${fmt(dur)} e a letra foi medida numa gravação de ${fmt(m.duration)}. Se a letra sair fora do tempo, ajuste com Letra − / Letra + (teclas [ e ]) ou escolha outro playback.`);
}

function tick(){
  if(!P.aberto)return;
  P.raf=requestAnimationFrame(tick);
  ConviteProjeto.atualizar({aberto:P.aberto,modo:P.modo,fase:P.fase,ligado:prefs().conviteProjeto,erro:!$("palcoErro").hidden||$("dlgSala").open});
  const f=P.fonte;if(!f||!P.musica)return;
  const t=f.tempo();
  atualizarBarra(t);
  atualizarSinal();
  avisarDuracao(f);
  if(P.fase==="gravando"){Sincronia.tick(t);return}
  if(P.fase!=="cantando"&&P.fase!=="vez")return;
  if(soVideoAgora())return;   // letra escondida: nem desenha (poupa a TV fraca)
  desenharLetra(t-(Number(P.musica.offset)||0)-prefs().audioDelay/1000);
}

/* --------------------------------------------------------------- ajustes */
// "Letra +" atrasa a letra (offset sobe); "Letra −" adianta. A mensagem
// descreve o efeito, não o sinal: ninguém precisa decorar convenção na festa.
function ajustarOffset(delta){
  if(!P.musica)return;
  const v=Math.round(((Number(P.musica.offset)||0)+delta)*100)/100;
  P.musica=editarMusica(P.musica.id,{offset:v})||P.musica;
  salvarLogo();
  atualizarOffset();
  P.idx=-2;
  notify(v===0?"Letra desta música no ponto zero.":`Letra ${v>0?"atrasada":"adiantada"} ${Math.abs(v).toFixed(2).replace(".",",")} s nesta música.`,true);
}
// Liga/desliga a letra sincronizada do app por cima do vídeo. Desligada = só o vídeo
// do YouTube (a letra vem nele); ligada = volta ao último fundo com letra (padrão:
// vídeo escurecido atrás da letra).
function alternarLetra(){
  const pr=prefs(),m=P.musica;
  // Música de YouTube com letra própria: a escolha fica guardada na música.
  if(m&&m.playback&&m.playback.tipo==="youtube"&&temLetra(m)){
    const paraApp=fundoEfetivo()==="tela";
    P.musica=editarMusica(m.id,{letraDe:paraApp?"app":"video"});
    aplicarPrefsPalco();salvarLogo();avisarSala();
    notify(paraApp?"Letra sincronizada do app ligada nesta música (fica guardada).":"Só o vídeo: a letra é a do próprio vídeo (fica guardado nesta música).",true);
    return;
  }
  if(pr.fundo==="tela")pr.fundo=P.fundoComLetra||"escuro";
  else{P.fundoComLetra=pr.fundo;pr.fundo="tela"}
  aplicarPrefsPalco();salvarLogo();avisarSala();
  notify(pr.fundo==="tela"?"Só o vídeo do YouTube: a letra é a do próprio vídeo.":"Letra sincronizada ligada junto ao playback.",true);
}
function trocarFundo(){
  const ordem=FUNDOS;
  const pr=prefs();
  const atual=fundoEfetivo();
  if(atual!=="tela")P.fundoComLetra=atual;
  pr.fundo=ordem[(ordem.indexOf(atual)+1)%ordem.length];
  const m=P.musica;
  if(m&&m.playback&&m.playback.tipo==="youtube"&&temLetra(m)&&m.letraDe){
    P.musica=editarMusica(m.id,{letraDe:pr.fundo==="tela"?"video":"app"});
  }
  aplicarPrefsPalco();salvarLogo();avisarSala();
  notify({opaco:"Só som: vídeo escondido atrás da letra.",escuro:"Vídeo escurecido atrás da letra.",video:"Vídeo aparecendo atrás da letra.",tela:"Só o vídeo do YouTube: a letra é a do próprio vídeo."}[pr.fundo],true);
}
function telaCheia(){
  if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  else document.documentElement.requestFullscreen?.().catch(()=>notify("Este navegador não deixa usar tela cheia aqui."));
}

/* --------------------------------------------- comandos (teclado e celular) */
function comandoPalco(tipo,dados={}){
  if(!P.aberto)return false;
  switch(tipo){
    case "alternar":alternar();break;
    case "proxima":if(P.fase==="nota"||P.fase==="vez"||P.fase==="cantando")proxima();break;
    case "anterior":anterior();break;
    case "comecar":if(P.fase==="vez")comecar();else if(P.fase==="nota")proxima();break;
    case "adiantar":ajustarOffset(-0.25);break;
    case "atrasar":ajustarOffset(0.25);break;
    case "volume":P.fonte&&P.fonte.volume(Number(dados.v));break;
    case "aplausos":if(P.fase==="nota"&&!$("notaMedir").hidden)medirAplausos();break;
    default:return false;
  }
  return true;
}

function avisarSala(extra){if(typeof SalaHost!=="undefined")SalaHost.mudou(extra)}

document.addEventListener("keydown",e=>{
  if(!P.aberto||$("dlgSala").open)return;
  if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)&&e.target.type!=="range")return;
  if(P.fase==="gravando"&&Sincronia.tecla(e))return;
  const k=e.key;
  // Na barra de progresso, as setas movem a barra (padrão do navegador), não trocam de música.
  if(e.target&&e.target.type==="range"&&(k==="ArrowLeft"||k==="ArrowRight"))return;
  if(k===" "||k==="k"){e.preventDefault();alternar()}
  else if(k==="ArrowRight"||k==="n"){e.preventDefault();proxima()}
  else if(k==="ArrowLeft"){e.preventDefault();anterior()}
  else if(k==="Escape"&&!document.fullscreenElement){fecharPalco()}
  else if(k==="f"){telaCheia()}
  else if(k==="l"){alternarLetra()}
  else if(k==="["){ajustarOffset(-0.25)}
  else if(k==="]"){ajustarOffset(0.25)}
  else if(k==="Enter"&&(P.fase==="vez"||P.fase==="nota")){e.preventDefault();comandoPalco("comecar")}
});

// Na TV os controles somem depois de 4 s sem mexer, para sobrar só a letra.
// Qualquer toque, mouse ou tecla traz de volta.
let ociosoTimer=0;
function acordarControles(){
  const el=$("palco");el.classList.remove("ocioso");
  clearTimeout(ociosoTimer);
  ociosoTimer=setTimeout(()=>{if(P.aberto&&P.fase==="cantando"&&P.fonte&&P.fonte.tocando())el.classList.add("ocioso")},4000);
}
["pointermove","pointerdown","keydown"].forEach(t=>document.addEventListener(t,()=>{if(P.aberto)acordarControles()},{passive:true}));
