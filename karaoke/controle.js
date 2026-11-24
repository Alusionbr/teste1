"use strict";
/*
 * Controle pelo celular. Lê o estado que a tela da festa publica e manda
 * comandos (karaoke_comando). Não guarda playlist nem letra: só o código da
 * sala, o nome e o emoji de quem está segurando o celular.
 */
const CT={painel:null,codigo:"",eu:null,versao:-1,estado:null,recebidoEm:0,timer:0,aba:"fila",resultados:[],escolhida:null,telaViva:true,falhas:0};
const CHAVE_EU="karaoke:controle:eu";

function lerEu(){try{const e=JSON.parse(localStorage.getItem(CHAVE_EU)||"null");return e&&e.nome?e:null}catch{return null}}
function gravarEu(e){try{localStorage.setItem(CHAVE_EU,JSON.stringify(e))}catch{}}

function mostrar(secao){["ctEntrar","ctQuem","ctPainel"].forEach(id=>{$(id).hidden=id!==secao})}

/* ------------------------------------------------------------ permissões */
// O anfitrião (tela) define o que cada celular pode; a tela confere de novo ao receber.
// Aqui só desligamos os botões e avisamos antes de mandar um comando que seria recusado.
function permissoesDaSala(){
  const e=CT.estado;
  return e&&e.permissoes?e.permissoes:normalizarPermissoes(null,{pularFila:!!(e&&e.pularFila)});
}
function donosAgora(){const a=CT.estado&&CT.estado.agora;return a&&a.donos||[]}
function pode(acao){
  if(!CT.estado)return true;   // sem estado ainda: a tela decide
  return podeFazer(permissoesDaSala(),acao,{nome:CT.eu?CT.eu.nome:"",donos:donosAgora()});
}
async function comando(tipo,dados={}){
  const acao=acaoDoComando(tipo,dados,{fase:CT.estado?CT.estado.fase:""});
  if(acao&&!pode(acao)){notify("🔒 "+textoDaRecusa(permissoesDaSala(),acao,CT.eu?CT.eu.nome:""));return false}
  try{
    await salaRpc("karaoke_comando",{p_codigo:CT.codigo,p_device:idDoAparelho(),p_nome:CT.eu?CT.eu.nome:"",p_tipo:tipo,p_dados:dados});
    if(navigator.vibrate)navigator.vibrate(20);
    return true;
  }catch(e){notify(e.message);return false}
}

/* ------------------------------------------------------ lista pessoal do celular */
const CHAVE_MINHA_LISTA="karaoke:controle:minha-lista:v1";
const CHAVE_MINHA_SELECIONADAS="karaoke:controle:minha-lista-selecionadas:v1";
let MINHA_LISTA=[],BUSCA_MINHA=null,preparandoMinhaLista=0;
let SELECIONADAS=new Set((()=>{try{return JSON.parse(localStorage.getItem(CHAVE_MINHA_SELECIONADAS)||"[]")}catch{return[]}})());
function lerMinhaLista(){try{const x=JSON.parse(localStorage.getItem(CHAVE_MINHA_LISTA)||"[]");return Array.isArray(x)?x.filter(m=>m&&typeof m.title==="string"&&m.playback&&m.playback.tipo==="youtube").slice(0,100):[]}catch{return[]}}
function guardarMinhaLista(){try{localStorage.setItem(CHAVE_MINHA_LISTA,JSON.stringify(MINHA_LISTA))}catch{$("ctMinhaListaStatus").textContent="Não consegui salvar. Confira o espaço disponível no celular."}}
function renderMinhaLista(){
  const salaPronta=!!(CT.codigo&&CT.estado);
  $("ctMinhaListaEnviar").disabled=!salaPronta||!SELECIONADAS.size||enviandoMinhaLista;
  $("ctMinhaListaEnviarTudo").disabled=!salaPronta||!MINHA_LISTA.length||enviandoMinhaLista||preparandoMinhaLista>0;
  $("ctMinhaListaCantor").disabled=!salaPronta;
  if(salaPronta){
    const select=$("ctMinhaListaCantor"),atual=select.value;
    select.innerHTML=opcoesCantores();
    if([...select.options].some(o=>o.value===atual))select.value=atual;
  }
  $("ctMinhaListaItens").innerHTML=MINHA_LISTA.map(m=>`<li class="itemMinhaLista">
    <label class="check"><input type="checkbox" data-minha-musica="${esc(m.id)}"${SELECIONADAS.has(m.id)?" checked":""}><span><b>${esc(m.title)}</b><small>${esc(m.artist)} · ▶ ${esc(m.playback.titulo||"YouTube")}</small></span></label>
    <button type="button" data-remover-minha="${esc(m.id)}" aria-label="Remover ${esc(m.title)} da minha lista">✕</button>
  </li>`).join("")||`<li class="vazio">Sua lista está vazia. Busque uma música para guardar neste celular.</li>`;
}
function selecionarMinha(id){SELECIONADAS.add(id);try{localStorage.setItem(CHAVE_MINHA_SELECIONADAS,JSON.stringify([...SELECIONADAS]))}catch{}}
function guardarVideoMinhaLista(video,linha){
  const m={id:video.id,title:linha.titulo,artist:linha.artista,playback:{tipo:"youtube",id:video.id,titulo:video.titulo||"",duracao:video.duracao||0}};
  const pos=MINHA_LISTA.findIndex(x=>fold(x.title+" "+x.artist)===fold(m.title+" "+m.artist));
  if(pos>=0){SELECIONADAS.delete(MINHA_LISTA[pos].id);MINHA_LISTA[pos]=m}
  else if(MINHA_LISTA.length<100)MINHA_LISTA.unshift(m);
  else throw Error("Sua playlist chegou ao limite de 100 músicas.");
  selecionarMinha(m.id);guardarMinhaLista();renderMinhaLista();return m;
}
$("ctFormMinhaLista").addEventListener("submit",async e=>{
  e.preventDefault();const q=$("ctBuscaMinhaLista").value.trim();if(!q)return;
  const st=$("ctMinhaListaStatus"),btn=e.submitter;
  const busca={linha:lerListaDeMusicas(q).itens[0]||{titulo:q,artista:""}};BUSCA_MINHA=busca;
  st.textContent="Escolhendo o vídeo de karaokê…";$("ctMinhaListaResultados").innerHTML="";btn.disabled=true;preparandoMinhaLista++;renderMinhaLista();
  try{
    const r=await resolverPlayback([busca.linha.titulo,busca.linha.artista].filter(Boolean).join(" "),{titulo:busca.linha.titulo,artista:busca.linha.artista});
    if(BUSCA_MINHA!==busca)return;
    busca.video=r.video;busca.alternativas=r.alternativas||[];
    guardarVideoMinhaLista(r.video,busca.linha);
    $("ctMinhaListaResultados").innerHTML=`<li class="autoItem"><details><summary>Trocar o vídeo de ${esc(busca.linha.titulo)}</summary><ul class="lista videos">${htmlResultadosVideos([r.video,...busca.alternativas])}</ul></details></li>`;
    st.textContent=r.video.duvida?"Vídeo escolhido: confira se é a versão desejada em Trocar vídeo.":"Pronta! Você já pode enviar a playlist à festa.";
  }catch(err){if(BUSCA_MINHA===busca)st.textContent=err.message}
  finally{btn.disabled=false;preparandoMinhaLista--;renderMinhaLista()}
});
$("ctMinhaListaResultados").addEventListener("click",async e=>{
  const b=e.target.closest("[data-video]");if(!b)return;
  const busca=BUSCA_MINHA,st=$("ctMinhaListaStatus");b.disabled=true;st.textContent="Conferindo o vídeo…";
  try{
    const v=await YouTubeBase.verificar(b.dataset.video);if(BUSCA_MINHA!==busca)return;
    if(!v.ok){st.textContent=`${v.msg} Escolha outro vídeo.`;return}
    guardarVideoMinhaLista({id:b.dataset.video,titulo:b.dataset.titulo,duracao:Number(b.dataset.duracao)||0},busca.linha);
    st.textContent="Vídeo atualizado. A música está pronta para enviar.";
  }catch(err){st.textContent=err.message}finally{b.disabled=false}
});
$("ctFormMinhaListaLote").addEventListener("submit",async e=>{
  e.preventDefault();const linhas=lerListaDeMusicas($("ctMinhaListaLoteTexto").value).itens;
  if(!linhas.length)return;
  const btn=e.submitter,st=$("ctMinhaListaStatus");btn.disabled=true;preparandoMinhaLista++;renderMinhaLista();let prontas=0;const falhas=[];
  try{
    for(let i=0;i<linhas.length;i++){
      const linha=linhas[i];st.textContent=`Preparando ${i+1} de ${linhas.length}…`;
      try{const r=await resolverPlayback(`${linha.titulo} ${linha.artista}`.trim(),{titulo:linha.titulo,artista:linha.artista});guardarVideoMinhaLista(r.video,linha);prontas++}
      catch{falhas.push(linha.titulo)}
    }
    st.textContent=`${prontas} música(s) prontas com vídeo.${falhas.length?" Não preparadas: "+falhas.join(", "):" Envie a playlist à festa."}`;
  }finally{btn.disabled=false;preparandoMinhaLista--;renderMinhaLista()}
});
$("ctMinhaListaItens").addEventListener("change",e=>{
  const c=e.target.closest("[data-minha-musica]");if(!c)return;
  c.checked?SELECIONADAS.add(c.dataset.minhaMusica):SELECIONADAS.delete(c.dataset.minhaMusica);
  try{localStorage.setItem(CHAVE_MINHA_SELECIONADAS,JSON.stringify([...SELECIONADAS]))}catch{}
  renderMinhaLista();
});
$("ctMinhaListaItens").addEventListener("click",e=>{
  const b=e.target.closest("[data-remover-minha]");if(!b)return;
  MINHA_LISTA=MINHA_LISTA.filter(m=>m.id!==b.dataset.removerMinha);SELECIONADAS.delete(b.dataset.removerMinha);
  try{localStorage.setItem(CHAVE_MINHA_SELECIONADAS,JSON.stringify([...SELECIONADAS]))}catch{}
  guardarMinhaLista();renderMinhaLista();
});
let enviandoMinhaLista=false,envioMinhaPendente=null;
async function enviarMinhaLista(todas){
  if(!CT.codigo||!CT.estado||enviandoMinhaLista||(todas&&preparandoMinhaLista>0))return;
  const cantorId=$("ctMinhaListaCantor").value,selecionadas=MINHA_LISTA.filter(m=>todas||SELECIONADAS.has(m.id));
  const chave=CT.codigo+":"+todas+":"+selecionadas.map(m=>m.id).join(",");
  if(!envioMinhaPendente||envioMinhaPendente.chave!==chave)envioMinhaPendente={chave,restantes:selecionadas.slice()};
  enviandoMinhaLista=true;renderMinhaLista();let enviadas=0;
  try{
    for(const m of envioMinhaPendente.restantes.slice()){
      if(!m.playback?.id){envioMinhaPendente.restantes.shift();continue}
      const ok=await comando("pedir_nova",{title:m.title,artist:m.artist,playback:m.playback,cantorId});
      if(!ok)break;enviadas++;envioMinhaPendente.restantes.shift();SELECIONADAS.delete(m.id);
    }
    try{localStorage.setItem(CHAVE_MINHA_SELECIONADAS,JSON.stringify([...SELECIONADAS]))}catch{}
    const faltam=envioMinhaPendente.restantes.length;
    $("ctMinhaListaStatus").textContent=faltam?`${enviadas} pedido(s) enviados. Faltam ${faltam}; toque em ${todas?"Enviar playlist":"Enviar só as músicas marcadas"} para tentar só as que faltaram.`:`${enviadas} pedido(s) enviados à festa. Quem está cantando continua normalmente.`;
    if(!faltam)envioMinhaPendente=null;
  }finally{enviandoMinhaLista=false;renderMinhaLista()}
}
$("ctMinhaListaEnviar").addEventListener("click",()=>enviarMinhaLista(false));
$("ctMinhaListaEnviarTudo").addEventListener("click",()=>enviarMinhaLista(true));
$("ctMinhaListaMais").addEventListener("toggle",()=>$("ctMinhaListaItens").classList.toggle("selecionando",$("ctMinhaListaMais").open));
MINHA_LISTA=lerMinhaLista();

/* ------------------------------------------------------------ consultar */
async function consultar(){
  try{
    const r=await salaRpc("karaoke_sala_ver",{p_codigo:CT.codigo,p_device:idDoAparelho(),p_nome:CT.eu?CT.eu.nome:"",p_versao:CT.versao});
    CT.falhas=0;
    if(!r||!r.existe){$("ctSalaSelo").textContent=`Sala ${CT.codigo} fechada`;$("ctTelaAviso").hidden=false;$("ctTelaAviso").textContent="Esta sala não existe mais. Leia o QR code novo na tela da festa.";return}
    CT.telaViva=!!r.tela_viva;
    $("ctTelaAviso").hidden=CT.telaViva;
    if(r.estado){CT.estado=r.estado;CT.versao=r.versao;CT.recebidoEm=Date.now();render()}
    $("ctSalaSelo").textContent=`${CT.telaViva?"🟢":"🟠"} Sala ${CT.codigo}`;
  }catch(e){
    CT.falhas++;
    if(CT.falhas>=3)$("ctSalaSelo").textContent=`🔴 Sala ${CT.codigo} — sem conexão`;
  }
}
function iniciarConsulta(){clearInterval(CT.timer);consultar();CT.timer=setInterval(consultar,2000)}
document.addEventListener("visibilitychange",()=>{if(!CT.codigo)return;if(document.hidden)clearInterval(CT.timer);else iniciarConsulta()});

/* --------------------------------------------------------------- desenho */
const FASES={vez:"Preparando…",cantando:"Cantando agora",nota:"Hora dos aplausos!",fim:"Fim da playlist",gravando:"Gravando sincronia",ensaio:"Ensaio"};
function render(){
  const e=CT.estado;if(!e)return;
  const a=e.agora;
  $("ctFase").textContent=e.palco?(FASES[e.fase]||""):"A tela está nas listas — toque Começar.";
  $("ctQuemCanta").textContent=a&&a.quem?a.quem:"";
  $("ctQuemCanta").hidden=!(a&&a.quem);
  $("ctQuemCanta").style.setProperty("--cor",a&&a.cor||"#ff3d9a");
  $("ctMusica").textContent=a?a.title:(e.fila.length?`${e.fila.length} música(s) na fila`:"Fila vazia — peça uma música!");
  $("ctArtista").textContent=a?a.artist:e.playlist;
  $("ctTocar").textContent=e.tocando?"⏸":"▶";
  $("ctComecar").hidden=!(!e.palco&&e.fila.length||e.fase==="vez"||e.fase==="nota");
  $("ctComecar").textContent=e.fase==="nota"?"▶ Próxima":"▶ Começar";
  $("ctAplausos").hidden=e.fase!=="nota";
  $("ctOffset").textContent=a?`${a.offset>0?"+":""}${(a.offset||0).toFixed(2).replace(".",",")} s`:"";
  if(e.nota!=null&&e.fase==="nota")$("ctFase").textContent=`👏 Nota: ${e.nota} pontos!`;
  $("ctLetra").textContent=e.fundo==="tela"?"🔤 Ligar a letra do app":"🎞 Só o vídeo (desligar a letra)";
  const eu=CT.eu?fold(CT.eu.nome):"",donos=(a&&a.donos)||[];
  if(donos.some(n=>fold(n)===eu)&&e.fase==="vez")$("ctFase").textContent="🎤 É a sua vez! Toque em Começar.";
  // Botões conforme as permissões que o anfitrião deu.
  const podeTocar=pode("tocar"),podePular=pode("pular"),podeFila=pode("fila");
  const faltam=[];
  if(!pode("pedir"))faltam.push("pedir música");
  if(!podeFila)faltam.push("mexer na fila");
  if(!podePular)faltam.push("pular a música");
  if(!podeTocar)faltam.push("pausar ou ajustar");
  if(!pode("playback"))faltam.push("trocar playback");
  $("ctOrdemFila").hidden=!faltam.length;
  $("ctOrdemFila").textContent=faltam.length?`O anfitrião não liberou para você: ${faltam.join(", ")}.`:"";
  document.querySelector('[data-cmd="anterior"]').disabled=!podePular;
  document.querySelector('[data-cmd="proxima"]').disabled=!podePular&&e.fase!=="nota";
  ["alternar","adiantar","atrasar","comecar","aplausos"].forEach(c=>{const b=document.querySelector(`[data-cmd="${c}"]`);if(b)b.disabled=!podeTocar});
  $("ctLetra").disabled=!podeTocar;$("ctVolume").disabled=!podeTocar;
  document.querySelectorAll('[data-ct-aba="pedir"],[data-ct-aba="nova"]').forEach(b=>{b.disabled=!pode("pedir")});
  if(!pode("pedir")&&CT.aba!=="fila")document.querySelector('[data-ct-aba="fila"]').click();
  const semPlayback=a&&a.fonte==="relogio"&&["vez","cantando"].includes(e.fase);
  $("ctErroPlayback").hidden=!(e.erro||semPlayback);
  $("ctErroTexto").textContent=e.erro?e.erro:"Esta música está sem playback. Adicione o link do vídeo para ouvir.";
  renderFila();renderCantores();renderMusicas();renderMinhaLista();
  if($("ctMusicaPainel").open)atualizarPainel();
}
function renderFila(){
  const e=CT.estado;
  const soMinhas=$("ctSoMinhas").checked&&CT.eu,eu=CT.eu?fold(CT.eu.nome):"";
  const meusCantores=soMinhas?e.cantores.filter(c=>fold(c.nome)===eu):[];
  $("ctFila").innerHTML=e.fila.map((i,n)=>{
    if(soMinhas&&!meusCantores.some(c=>Array.isArray(i.cantores)
      ?i.cantores.includes(c.id)
      :i.quem.split(" & ").includes(c.emoji+" "+c.nome)))return"";
    const atual=n===e.indice,passou=e.indice>=0&&n<e.indice;
    return `<li class="${atual?"atual":""}${passou?" passou":""}" data-item="${esc(i.id)}">
      <span class="num">${atual?"🎤":n+1}</span>
      <div class="info"><span class="cantorSelo" style="--cor:${esc(i.cor||"#b9aee0")}">${esc(i.quem)}</span><b>${esc(i.title)}</b><small>${esc(i.artist)}</small></div>
      <div class="acoesItem">${atual||!pode("fila")?"":`<button type="button" data-fila="tocar_item" aria-label="Tocar agora">▶</button><button type="button" data-fila="subir_item" aria-label="Tocar a seguir">⏫</button><button type="button" data-fila="tirar_item" aria-label="Tirar">✕</button>`}</div></li>`;
  }).join("")||`<li class="vazio">${soMinhas?"Você ainda não tem música na fila. Vá em <b>Pedir música</b>.":"Fila vazia. Vá em <b>Pedir música</b>."}</li>`;
}
function opcoesCantores(){
  const e=CT.estado,eu=CT.eu?fold(CT.eu.nome):"";
  return `<option value="">🎤 Quem quiser</option>`+(e?e.cantores:[]).map(c=>`<option value="${esc(c.id)}"${fold(c.nome)===eu?" selected":""}>${esc(c.emoji)} ${esc(c.nome)}</option>`).join("");
}
function renderCantores(){
  ["ctPnCantor","ctCantorNova"].forEach(id=>{const s=$(id),v=s.value,html=opcoesCantores();if(s.dataset.html!==html){s.innerHTML=html;s.dataset.html=html;if(v&&[...s.options].some(o=>o.value===v))s.value=v}});
}
function renderMusicas(){
  const e=CT.estado;if(!e)return;
  const f=fold($("ctBusca").value);
  const lista=e.musicas.filter(m=>!f||fold(`${m.title} ${m.artist}`).includes(f)).slice(0,80);
  $("ctMusicas").innerHTML=lista.map(m=>`<li><button type="button" data-pedir="${esc(m.id)}"><b>${esc(m.title)}</b> <small>${esc(m.artist)}${m.letra===2?" · ✓ sincronizada":m.letra===1?" · letra":""} · ${m.pb?NOME_PB[m.pb]||m.pb:"sem playback"}</small></button></li>`).join("")||`<li class="vazio">${e.musicas.length?"Nada encontrado.":"A festa ainda não tem músicas salvas. Use ✨ Música nova."}</li>`;
}
// Barra de progresso: extrapola a partir do último estado (o celular só recebe a cada ~2 s).
function animarProgresso(){
  const e=CT.estado;
  if(e&&e.duracao){
    const t=e.tempo+(e.tocando?(Date.now()-CT.recebidoEm)/1000:0);
    $("ctProgresso").style.width=Math.min(100,t/e.duracao*100).toFixed(1)+"%";
  }else $("ctProgresso").style.width="0%";
  requestAnimationFrame(animarProgresso);
}

/* --------------------------------------------------------------- eventos */
$("ctLetra").addEventListener("click",()=>comando("pedir",{modo:"letra"}));
document.querySelectorAll("[data-cmd]").forEach(b=>b.addEventListener("click",()=>comando(b.dataset.cmd)));
let volumeTimer=0;
$("ctVolume").addEventListener("input",e=>{clearTimeout(volumeTimer);volumeTimer=setTimeout(()=>comando("volume",{v:Number(e.target.value)}),300)});
document.querySelectorAll("[data-ct-aba]").forEach(b=>b.addEventListener("click",()=>{
  CT.aba=b.dataset.ctAba;
  document.querySelectorAll("[data-ct-aba]").forEach(x=>x.classList.toggle("ativa",x===b));
  $("ctAbaFila").hidden=CT.aba!=="fila";$("ctAbaPedir").hidden=CT.aba!=="pedir";$("ctAbaNova").hidden=CT.aba!=="nova";
}));
$("ctFila").addEventListener("click",async e=>{
  const b=e.target.closest("[data-fila]");if(!b)return;
  const id=b.closest("li").dataset.item;
  if(b.dataset.fila==="tirar_item"&&!confirm("Tirar esta música da fila?"))return;
  if(await comando(b.dataset.fila,{itemId:id}))notify(b.dataset.fila==="subir_item"?"Vai tocar a seguir.":"Pedido enviado.",true);
});
$("ctBusca").addEventListener("input",renderMusicas);
$("ctSoMinhas").addEventListener("change",()=>{if(CT.estado)renderFila()});

/* ---------------------------------------------- painel da música (playback + tocar) */
// Escolher uma música abre o painel para trocar o playback ou pedir no fim da fila.
// Tudo vai como comando "pedir" (campos opcionais modo e playback): a tela decide.
const NOME_PB={youtube:"YouTube",spotify:"Spotify",arquivo:"Arquivo"};
function abrirPainelMusica(m,soPlayback){
  CT.painel={id:m.id,title:m.title,artist:m.artist,soPlayback:!!soPlayback,preparando:false,playbackAuto:null};
  $("ctPnTitulo").textContent=m.title;
  $("ctPnArtista").textContent=m.artist||"";
  $("ctPnCantor").dataset.html="";renderCantores();
  $("ctPnLink").value="";$("ctPnStatus").textContent="";
  $("ctPnProcurar").href=linkBuscaYouTube(m);
  $("ctPnPedido").hidden=CT.painel.soPlayback;
  atualizarPainel();
  $("ctPnTroca").open=!!soPlayback;
  if(!$("ctMusicaPainel").open)$("ctMusicaPainel").showModal();
  if(!soPlayback&&!playbackDaMusica(m.id))prepararPainel(m,CT.painel);
}
function playbackDaMusica(id){
  const e=CT.estado;if(!e)return"";
  const m=e.musicas.find(x=>x.id===id);
  if(m)return m.pb||"";
  return e.agora&&e.agora.musicaId===id&&e.agora.fonte!=="relogio"?e.agora.fonte:"";
}
function atualizarPainel(){
  const p=CT.painel;if(!p)return;
  const pb=playbackDaMusica(p.id);
  $("ctPnPlayback").textContent=p.preparando?"Escolhendo o vídeo para esta música…":p.playbackAuto?`✓ Vídeo pronto: ${p.playbackAuto.titulo}`:pb==="arquivo"?"✓ Áudio salvo na tela da festa.":pb?"✓ Música pronta para enviar.":"Não há vídeo escolhido. Tente preparar novamente ou use Mais opções.";
  $("ctPnTroca").hidden=pb==="arquivo"||!pode("playback");
  $("ctPnFila").disabled=p.preparando;

}
async function prepararPainel(m,p){
  p.preparando=true;atualizarPainel();
  try{
    const r=await resolverPlayback(`${m.title} ${m.artist||""}`.trim(),{titulo:m.title,artista:m.artist||""});
    if(CT.painel!==p)return;
    p.playbackAuto={tipo:"youtube",id:r.video.id,titulo:r.video.titulo,duracao:r.video.duracao||0};
  }catch(err){if(CT.painel===p){$("ctPnStatus").textContent=err.message;$("ctPnTroca").open=true}}
  finally{if(CT.painel===p){p.preparando=false;atualizarPainel()}}
}
// Lê o link digitado. Devolve {playback}, {erro} ou {} (campo vazio). No YouTube
// confere se o vídeo toca fora do YouTube, como o app da tela faz ao escolher.
async function lerPlaybackDoCampo(){
  const texto=$("ctPnLink").value.trim();
  if(!texto)return{};
  const yt=lerLinkYouTube(texto),sp=lerLinkSpotify(texto);
  if(sp&&!yt)return{playback:{tipo:"spotify",id:sp,titulo:""}};
  if(!yt)return{erro:ehPlaylistSemMusica(texto)?"Esse link é de uma playlist. Abra a música e copie o link dela (com watch?v=).":"Não reconheci o link. Use YouTube, YouTube Music ou uma faixa do Spotify."};
  $("ctPnStatus").textContent="Conferindo se este vídeo pode tocar na tela…";
  let titulo="";
  try{titulo=await tituloYouTube(yt)}catch(err){if([400,401,404].includes(err.codigo))return{erro:err.message}}
  const v=await YouTubeBase.verificar(yt);
  if(!v.ok)return{erro:`${v.msg} Escolha outro vídeo (clipes oficiais costumam bloquear; procure por “playback” ou “karaokê”).`};
  return{playback:{tipo:"youtube",id:yt,titulo}};
}
async function enviarPainel(modo){
  const p=CT.painel;if(!p)return;
  const botoes=[...document.querySelectorAll("#ctMusicaPainel button")];
  botoes.forEach(b=>{b.disabled=true});
  try{
    const r=await lerPlaybackDoCampo();
    if(r.erro){$("ctPnStatus").textContent=r.erro;return}
    if(modo==="playback"&&!r.playback){$("ctPnStatus").textContent="Cole o link do playback primeiro.";return}
    const dados={musicaId:p.id,modo,cantorId:$("ctPnCantor").value};
    const playback=r.playback||(modo==="fila"?p.playbackAuto:null);
    if(modo==="fila"&&!playback&&!playbackDaMusica(p.id)){$("ctPnStatus").textContent="Escolha um vídeo antes de enviar esta música à festa.";return}
    if(playback)dados.playback=playback;
    $("ctPnStatus").textContent="Enviando…";
    if(!await comando("pedir",dados)){$("ctPnStatus").textContent="Não consegui enviar. Tente de novo.";return}
    $("ctMusicaPainel").close();
    notify(modo==="fila"?"Pedido enviado para o fim da fila. 🎤":"Playback enviado. A tela atualiza em instantes. 🎧",true);
  }finally{botoes.forEach(b=>{b.disabled=false})}
}
$("ctMusicas").addEventListener("click",e=>{
  const b=e.target.closest("[data-pedir]");if(!b||!CT.estado)return;
  const m=CT.estado.musicas.find(x=>x.id===b.dataset.pedir);if(m)abrirPainelMusica(m,false);
});
$("ctPnUsar").addEventListener("click",()=>enviarPainel("playback"));
$("ctPnFila").addEventListener("click",()=>enviarPainel("fila"));
$("ctPnFechar").addEventListener("click",()=>$("ctMusicaPainel").close());
// Playback da música que está tocando falhou: abre o painel só para trocar o playback.
$("ctErroTrocar").addEventListener("click",()=>{
  const a=CT.estado&&CT.estado.agora;if(!a)return;
  abrirPainelMusica({id:a.musicaId,title:a.title,artist:a.artist},true);
});

// Só o link do YouTube: o título vem do vídeo; a tela cria a música e põe na fila.
async function pedirPorVideo(id,tituloOpcional,duracao=0){
  const st=$("ctLinkStatus");
  st.textContent="Conferindo o vídeo…";
  try{
    let titulo=tituloOpcional||"";
    if(!titulo)try{titulo=await tituloYouTube(id)}catch(err){if([400,401,404].includes(err.codigo)){st.textContent=err.message;return}}
    const v=await YouTubeBase.verificar(id);
    if(!v.ok){st.textContent=`${v.msg} Escolha outro vídeo (procure por “playback” ou “karaokê”).`;return}
    if(await comando("pedir_nova",{title:titulo||"Vídeo do YouTube",artist:"",playback:{tipo:"youtube",id,titulo,duracao:Number(duracao)||0},cantorId:$("ctCantorNova").value})){
      st.textContent="";$("ctLinkRapido").value="";$("ctLinkResultados").innerHTML="";notify("Pedido enviado! O vídeo entra na fila da tela.",true);
    }else st.textContent="Não consegui enviar. Tente de novo.";
  }catch(err){st.textContent=err.message}
}
// Um campo só: link do YouTube pede direto; qualquer outro texto vira busca de vídeo.
$("ctFormLink").addEventListener("submit",async e=>{
  e.preventDefault();
  const texto=$("ctLinkRapido").value.trim();if(!texto)return;
  const id=lerLinkYouTube(texto),st=$("ctLinkStatus"),btn=e.submitter;
  $("ctLinkResultados").innerHTML="";
  if(id){btn.disabled=true;try{await pedirPorVideo(id,"")}finally{btn.disabled=false}return}
  if(ehPlaylistSemMusica(texto)){st.textContent="Esse link é de uma playlist. Abra o vídeo e copie o link dele (com watch?v=).";return}
  if(/^https?:\/\/|youtu\.?be/i.test(texto)){st.textContent="Não reconheci o link. Use um link do YouTube ou do YouTube Music.";return}
  // Um nome: o app escolhe o melhor vídeo sozinho; o celular confirma ou troca antes de pedir.
  btn.disabled=true;st.textContent="Procurando o melhor vídeo de karaokê…";
  const linha=lerListaDeMusicas(texto).itens[0]||{titulo:texto,artista:""};
  try{
    const r=await resolverPlayback(`${linha.titulo} ${linha.artista}`.trim(),{titulo:linha.titulo,artista:linha.artista});
    if(r.video.compartilhado){linha.titulo=r.video.musica||linha.titulo;linha.artista=r.video.artista||linha.artista}
    CT.escolhaAuto={linha,video:r.video,alternativas:r.alternativas};
    $("ctLinkResultados").innerHTML=htmlEscolhaAuto(CT.escolhaAuto);
    st.textContent=r.video.compartilhado?"Playback salvo pela comunidade.":r.video.duvida?"Não tenho certeza de que é esse vídeo. Confira antes de pedir.":"";
  }catch(err){
    st.textContent=err.message;
    if(err.alternativas&&err.alternativas.length)$("ctLinkResultados").innerHTML=htmlResultadosVideos(err.alternativas);
  }
  finally{btn.disabled=false}
});
function htmlEscolhaAuto({linha,video}){
  return `<li class="autoItem"><div class="autoTexto"><b>${esc(linha.titulo)}${linha.artista?" — "+esc(linha.artista):""}</b><small>▶ ${esc(video.titulo)}${video.duracao?" · "+fmt(video.duracao):""}</small></div>
    <div class="autoAcoes"><button type="button" class="primario" data-pedir-auto>Pedir na fila</button><button type="button" data-outros-auto>Outros vídeos</button></div></li>`;
}
$("ctLinkResultados").addEventListener("click",async e=>{
  const esc1=CT.escolhaAuto;
  if(esc1&&e.target.closest("[data-outros-auto]")){
    if(esc1.video.compartilhado){
      try{
        const r=await buscarVideos([esc1.linha.titulo,esc1.linha.artista].join(" ").trim());
        if(CT.escolhaAuto!==esc1)return;
        const ids=new Set([esc1.video.id,...esc1.alternativas.map(v=>v.id)]);
        esc1.alternativas.push(...r.lista.filter(v=>!ids.has(v.id)));
      }catch{if(!esc1.alternativas.length){notify("Busca indisponível. Você ainda pode pedir o playback salvo.");return}}
    }
    $("ctLinkResultados").innerHTML=esc1.alternativas.length?htmlResultadosVideos(esc1.alternativas):`<li class="vazio">Nenhum outro vídeo encontrado.</li>`;
    return;
  }
  if(esc1&&e.target.closest("[data-pedir-auto]")){
    const btn=e.target.closest("button"),st=$("ctLinkStatus");btn.disabled=true;
    try{
      if(await comando("pedir_nova",{title:esc1.linha.titulo,artist:esc1.linha.artista,playback:{tipo:"youtube",id:esc1.video.id,titulo:esc1.video.titulo,duracao:esc1.video.duracao||0},cantorId:$("ctCantorNova").value})){
        st.textContent="";$("ctLinkRapido").value="";$("ctLinkResultados").innerHTML="";CT.escolhaAuto=null;notify("Pedido enviado! O vídeo entra na fila da tela.",true);
      }else st.textContent="Não consegui enviar. Tente de novo.";
    }finally{btn.disabled=false}
    return;
  }
  const b=e.target.closest("[data-video]");if(!b)return;
  pedirPorVideo(b.dataset.video,b.dataset.titulo,b.dataset.duracao);
});

// Música nova: a letra é buscada AQUI no celular (LRCLIB) e vai junto no pedido.
$("ctFormNova").addEventListener("submit",async e=>{
  e.preventDefault();
  const q=$("ctBuscaNova").value.trim();if(!q)return;
  $("ctNovaStatus").textContent="Procurando…";$("ctNovaResultados").innerHTML="";$("ctNovaEscolhida").hidden=true;
  try{
    CT.resultados=await buscarLetras(q);
    $("ctNovaStatus").textContent=CT.resultados.length?"Escolha a versão:":"Não achei. Confira o nome.";
    $("ctNovaResultados").innerHTML=CT.resultados.slice(0,12).map((r,i)=>`<li><button type="button" data-res="${i}"><b>${esc(r.title)}</b><small>${esc(r.artist)}${r.duration?" · "+fmt(r.duration):""}${r.synced?" · ✓ sincronizada":r.lyrics?" · letra":""}</small></button></li>`).join("");
  }catch(err){$("ctNovaStatus").textContent=err.message}
});
$("ctNovaResultados").addEventListener("click",e=>{
  const b=e.target.closest("[data-res]");if(!b)return;
  CT.escolhida=CT.resultados[Number(b.dataset.res)];
  $("ctNovaInfo").innerHTML=`🎵 <b>${esc(CT.escolhida.title)}</b> — ${esc(CT.escolhida.artist)}`;
  $("ctNovaProcurar").href=linkBuscaYouTube(CT.escolhida);
  $("ctNovaEscolhida").hidden=false;
  CT.playbackEscolhido=null;$("ctNovaEnviar").disabled=true;$("ctNovaLinkDet").open=false;$("ctNovaLink").value="";
  $("ctNovaPb").textContent="Preparando o vídeo desta música…";
  buscarPlaybackDaMusica(CT.escolhida);
  $("ctNovaEscolhida").scrollIntoView({behavior:"smooth",block:"start"});
});
// Depois de escolher a letra, já lista os vídeos de playback daquela música.
async function buscarPlaybackDaMusica(r){
  const st=$("ctNovaVideosStatus"),ul=$("ctNovaVideos");ul.innerHTML="";st.textContent="Escolhendo o vídeo de karaokê…";
  try{
    const res=await resolverPlayback(`${r.title} ${r.artist}`.trim(),{titulo:r.title,artista:r.artist,duracaoEsperada:r.duration});
    if(CT.escolhida!==r)return;
    CT.playbackEscolhido={tipo:"youtube",id:res.video.id,titulo:res.video.titulo,duracao:res.video.duracao||0};
    $("ctNovaPb").textContent=`✓ Vídeo pronto: ${res.video.titulo}`;
    ul.innerHTML=htmlResultadosVideos(res.alternativas||[],{duracaoEsperada:r.duration});
    st.textContent="Vídeo escolhido automaticamente. Envie para a festa.";
  }catch(err){if(CT.escolhida===r){st.textContent=err.message;$("ctNovaLinkDet").open=true}}
  finally{if(CT.escolhida===r)$("ctNovaEnviar").disabled=false}
}
$("ctNovaVideos").addEventListener("click",async e=>{
  const b=e.target.closest("[data-video]");if(!b)return;
  const st=$("ctNovaVideosStatus");
  st.textContent="Conferindo o vídeo…";
  const v=await YouTubeBase.verificar(b.dataset.video);
  if(!v.ok){st.textContent=`${v.msg} Escolha outro vídeo.`;return}
  CT.playbackEscolhido={tipo:"youtube",id:b.dataset.video,titulo:b.dataset.titulo||""};
  $("ctNovaPb").textContent=`▶ Playback escolhido: ${b.dataset.titulo||b.dataset.video}`;
  st.textContent="Pronto. Toque em Pedir esta música.";
});
$("ctNovaEnviar").addEventListener("click",async()=>{
  const r=CT.escolhida;if(!r)return;
  const link=$("ctNovaLink").value.trim();
  let playback=CT.playbackEscolhido||null;
  if(link){
    const yt=lerLinkYouTube(link),sp=lerLinkSpotify(link);
    if(yt)playback={tipo:"youtube",id:yt,titulo:""};
    else if(sp)playback={tipo:"spotify",id:sp,titulo:""};
    else return notify("Não reconheci o link. Use um link do YouTube, YouTube Music ou de uma faixa do Spotify.");
  }
  if(!playback)return notify("Não consegui escolher um vídeo. Use outro resultado ou cole um link antes de enviar.");
  const ok=await comando("pedir_nova",{title:r.title,artist:r.artist,duration:r.duration,synced:(r.synced||"").slice(0,30000),lyrics:r.synced?"":(r.lyrics||"").slice(0,30000),playback,cantorId:$("ctCantorNova").value});
  if(ok){notify("Pedido enviado! A música entra na fila da tela.",true);$("ctNovaEscolhida").hidden=true;$("ctNovaLink").value="";$("ctNovaResultados").innerHTML="";$("ctNovaVideos").innerHTML="";$("ctNovaStatus").textContent="";CT.playbackEscolhido=null}
});

/* ------------------------------------------------------------ entrar */
let emojiEscolhido="🎤";
function renderEmojis(){$("ctEmojis").innerHTML=EMOJIS_CANTOR.map(e=>`<button type="button" data-emoji="${e}" aria-pressed="${e===emojiEscolhido}">${e}</button>`).join("")}
$("ctEmojis").addEventListener("click",e=>{const b=e.target.closest("[data-emoji]");if(!b)return;emojiEscolhido=b.dataset.emoji;renderEmojis()});
$("ctFormQuem").addEventListener("submit",async e=>{
  e.preventDefault();
  const nome=$("ctNome").value.trim();if(!nome)return;
  CT.eu={nome:nome.slice(0,24),emoji:emojiEscolhido};gravarEu(CT.eu);
  abrirPainel();
});
$("ctFormSala").addEventListener("submit",e=>{
  e.preventDefault();
  const c=$("ctCodigo").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!/^[A-Z0-9]{6,12}$/.test(c))return notify("O código tem 6 letras ou números.");
  history.replaceState(null,"","?sala="+c);
  entrarNaSala(c);
});
function abrirPainel(){
  $("ctSerTela").href=linkAssumir(CT.codigo);
  mostrar("ctPainel");iniciarConsulta();
  // Avisa a tela que este celular chegou (a tela ignora nome repetido).
  if(CT.eu)salaRpc("karaoke_comando",{p_codigo:CT.codigo,p_device:idDoAparelho(),p_nome:CT.eu.nome,p_tipo:"entrar",p_dados:{nome:CT.eu.nome,emoji:CT.eu.emoji}}).catch(()=>{});
}
function entrarNaSala(codigo){
  CT.codigo=codigo;CT.eu=lerEu();
  $("ctSalaSelo").textContent=`Sala ${codigo}`;
  if(!CT.eu){renderEmojis();mostrar("ctQuem");setTimeout(()=>$("ctNome").focus(),50);return}
  abrirPainel();
}

(()=>{
  const c=(new URLSearchParams(location.search).get("sala")||"").toUpperCase();
  if(/^[A-Z0-9]{6,12}$/.test(c))entrarNaSala(c);else mostrar("ctEntrar");
  renderMinhaLista();
  requestAnimationFrame(animarProgresso);
})();
