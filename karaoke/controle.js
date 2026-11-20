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

async function comando(tipo,dados={}){
  try{
    await salaRpc("karaoke_comando",{p_codigo:CT.codigo,p_device:idDoAparelho(),p_nome:CT.eu?CT.eu.nome:"",p_tipo:tipo,p_dados:dados});
    if(navigator.vibrate)navigator.vibrate(20);
    return true;
  }catch(e){notify(e.message);return false}
}

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
  // Trava: enquanto uma música toca, só quem canta mexe nela. O celular só avisa e desliga
  // os botões; quem decide é a tela (sala-host.js, bloqueadoPara).
  const eu=CT.eu?fold(CT.eu.nome):"",donos=(a&&a.donos)||[];
  const euDono=donos.some(n=>fold(n)===eu);
  CT.travado=!!(e.trava&&e.fase==="cantando"&&donos.length&&!euDono);
  $("ctTrava").hidden=!CT.travado;
  if(CT.travado)$("ctTrava").textContent=`🔒 ${donos.join(" e ")} está cantando e controla esta música. Você pode mexer na fila.`;
  if(euDono&&e.fase==="vez")$("ctFase").textContent="🎤 É a sua vez! Toque em Começar.";
  document.querySelectorAll('[data-cmd="alternar"],[data-cmd="proxima"],[data-cmd="anterior"],[data-cmd="adiantar"],[data-cmd="atrasar"],#ctLetra,#ctVolume').forEach(b=>{b.disabled=CT.travado});
  $("ctErroPlayback").hidden=!e.erro;
  if(e.erro)$("ctErroTexto").textContent="⚠️ O playback desta música falhou. "+e.erro;
  renderFila();renderCantores();renderMusicas();
  if($("ctMusicaPainel").open)atualizarPainel();
}
function renderFila(){
  const e=CT.estado;
  const soMinhas=$("ctSoMinhas").checked&&CT.eu,eu=CT.eu?fold(CT.eu.nome):"";
  $("ctFila").innerHTML=e.fila.map((i,n)=>{
    if(soMinhas&&!fold(i.quem).includes(eu))return"";
    const atual=n===e.indice,passou=e.indice>=0&&n<e.indice;
    return `<li class="${atual?"atual":""}${passou?" passou":""}" data-item="${esc(i.id)}">
      <span class="num">${atual?"🎤":n+1}</span>
      <div class="info"><span class="cantorSelo" style="--cor:${esc(i.cor||"#b9aee0")}">${esc(i.quem)}</span><b>${esc(i.title)}</b><small>${esc(i.artist)}</small></div>
      <div class="acoesItem">${atual?"":`<button type="button" data-fila="tocar_item" aria-label="Tocar agora"${CT.travado?" disabled":""}>▶</button><button type="button" data-fila="subir_item" aria-label="Tocar a seguir">⏫</button><button type="button" data-fila="tirar_item" aria-label="Tirar">✕</button>`}</div></li>`;
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
// Escolher uma música abre o painel: pôr/trocar o playback e decidir quando toca.
// Tudo vai como comando "pedir" (campos opcionais modo e playback): a tela decide.
const NOME_PB={youtube:"YouTube",spotify:"Spotify",arquivo:"Arquivo"};
function abrirPainelMusica(m,soPlayback){
  CT.painel={id:m.id,title:m.title,artist:m.artist,soPlayback:!!soPlayback};
  $("ctPnTitulo").textContent=m.title;
  $("ctPnArtista").textContent=m.artist||"";
  $("ctPnCantor").dataset.html="";renderCantores();
  $("ctPnLink").value="";$("ctPnStatus").textContent="";
  $("ctPnProcurar").href=linkBuscaYouTube(m);
  $("ctPnPedido").hidden=CT.painel.soPlayback;
  atualizarPainel();
  $("ctPnAgora").disabled=!!CT.travado;
  if(!$("ctMusicaPainel").open)$("ctMusicaPainel").showModal();
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
  $("ctPnPlayback").textContent=pb==="arquivo"?"🎧 Playback: arquivo guardado na tela (só dá para trocar lá).":pb?`🎧 Playback atual: ${NOME_PB[pb]||pb}. Cole outro link para trocar.`:"Sem playback: a letra anda pelo relógio. Cole um link do YouTube ou do Spotify.";
  $("ctPnTroca").hidden=pb==="arquivo";
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
    const e=CT.estado;
    if(modo==="agora"&&e&&e.palco&&["vez","cantando","nota"].includes(e.fase)&&!confirm("Isso interrompe a música que está tocando. Tocar agora?"))return;
    const r=await lerPlaybackDoCampo();
    if(r.erro){$("ctPnStatus").textContent=r.erro;return}
    if(modo==="playback"&&!r.playback){$("ctPnStatus").textContent="Cole o link do playback primeiro.";return}
    const dados={musicaId:p.id,modo,cantorId:$("ctPnCantor").value};
    if(r.playback)dados.playback=r.playback;
    $("ctPnStatus").textContent="Enviando…";
    if(!await comando("pedir",dados)){$("ctPnStatus").textContent="Não consegui enviar. Tente de novo.";return}
    $("ctMusicaPainel").close();
    notify({fila:"Pedido enviado! 🎤",seguir:"Vai tocar a seguir. ⏫",agora:"Pedido enviado: toca agora! ▶",playback:"Playback enviado. A tela atualiza em instantes. 🎧"}[modo],true);
  }finally{botoes.forEach(b=>{b.disabled=false})}
}
$("ctMusicas").addEventListener("click",e=>{
  const b=e.target.closest("[data-pedir]");if(!b||!CT.estado)return;
  const m=CT.estado.musicas.find(x=>x.id===b.dataset.pedir);if(m)abrirPainelMusica(m,false);
});
$("ctPnUsar").addEventListener("click",()=>enviarPainel("playback"));
$("ctPnAgora").addEventListener("click",()=>enviarPainel("agora"));
$("ctPnSeguir").addEventListener("click",()=>enviarPainel("seguir"));
$("ctPnFila").addEventListener("click",()=>enviarPainel("fila"));
$("ctPnFechar").addEventListener("click",()=>$("ctMusicaPainel").close());
// Playback da música que está tocando falhou: abre o painel só para trocar o playback.
$("ctErroTrocar").addEventListener("click",()=>{
  const a=CT.estado&&CT.estado.agora;if(!a)return;
  abrirPainelMusica({id:a.musicaId,title:a.title,artist:a.artist},true);
});

// Só o link do YouTube: o título vem do vídeo; a tela cria a música e põe na fila.
async function pedirPorVideo(id,tituloOpcional){
  const st=$("ctLinkStatus");
  st.textContent="Conferindo o vídeo…";
  try{
    let titulo=tituloOpcional||"";
    if(!titulo)try{titulo=await tituloYouTube(id)}catch(err){if([400,401,404].includes(err.codigo)){st.textContent=err.message;return}}
    const v=await YouTubeBase.verificar(id);
    if(!v.ok){st.textContent=`${v.msg} Escolha outro vídeo (procure por “playback” ou “karaokê”).`;return}
    if(await comando("pedir_nova",{title:titulo||"Vídeo do YouTube",artist:"",playback:{tipo:"youtube",id,titulo},cantorId:$("ctCantorNova").value})){
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
    CT.escolhaAuto={linha,video:r.video,alternativas:r.alternativas};
    $("ctLinkResultados").innerHTML=htmlEscolhaAuto(CT.escolhaAuto);
    st.textContent=r.video.duvida?"Não tenho certeza de que é esse vídeo. Confira antes de pedir.":"";
  }catch(err){
    st.textContent=err.message;
    if(err.alternativas&&err.alternativas.length)$("ctLinkResultados").innerHTML=htmlResultadosVideos(err.alternativas);
  }
  finally{btn.disabled=false}
});
function htmlEscolhaAuto({linha,video}){
  return `<li class="autoItem"><div class="autoTexto"><b>${esc(linha.titulo)}${linha.artista?" — "+esc(linha.artista):""}</b><small>▶ ${esc(video.titulo)} · ${fmt(video.duracao)}</small></div>
    <div class="autoAcoes"><button type="button" class="primario" data-pedir-auto>Pedir na fila</button><button type="button" data-outros-auto>Outros vídeos</button></div></li>`;
}
$("ctLinkResultados").addEventListener("click",async e=>{
  const esc1=CT.escolhaAuto;
  if(esc1&&e.target.closest("[data-outros-auto]")){
    $("ctLinkResultados").innerHTML=esc1.alternativas.length?htmlResultadosVideos(esc1.alternativas):`<li class="vazio">Nenhum outro vídeo encontrado.</li>`;
    return;
  }
  if(esc1&&e.target.closest("[data-pedir-auto]")){
    const btn=e.target.closest("button"),st=$("ctLinkStatus");btn.disabled=true;
    try{
      if(await comando("pedir_nova",{title:esc1.linha.titulo,artist:esc1.linha.artista,playback:{tipo:"youtube",id:esc1.video.id,titulo:esc1.video.titulo},cantorId:$("ctCantorNova").value})){
        st.textContent="";$("ctLinkRapido").value="";$("ctLinkResultados").innerHTML="";CT.escolhaAuto=null;notify("Pedido enviado! O vídeo entra na fila da tela.",true);
      }else st.textContent="Não consegui enviar. Tente de novo.";
    }finally{btn.disabled=false}
    return;
  }
  const b=e.target.closest("[data-video]");if(!b)return;
  pedirPorVideo(b.dataset.video,b.dataset.titulo);
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
  CT.playbackEscolhido=null;$("ctNovaLinkDet").open=false;$("ctNovaLink").value="";
  $("ctNovaPb").textContent="Escolha o playback abaixo (ou peça sem playback).";
  buscarPlaybackDaMusica(CT.escolhida);
  $("ctNovaEscolhida").scrollIntoView({behavior:"smooth",block:"start"});
});
// Depois de escolher a letra, já lista os vídeos de playback daquela música.
async function buscarPlaybackDaMusica(r){
  const st=$("ctNovaVideosStatus"),ul=$("ctNovaVideos");
  ul.innerHTML="";st.textContent="Procurando playbacks…";
  try{
    const res=await buscarVideos(`${r.title} ${r.artist} playback karaokê`);
    if(CT.escolhida!==r)return;
    ul.innerHTML=htmlResultadosVideos(res.lista,{duracaoEsperada:r.duration});
    st.textContent=res.lista.length?`${textoDaFonteBusca(res)} Toque num vídeo para usar como playback.`:"Nenhum vídeo encontrado. Cole um link abaixo ou peça sem playback.";
  }catch(err){if(CT.escolhida===r){st.textContent=err.message;$("ctNovaLinkDet").open=true}}
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
  requestAnimationFrame(animarProgresso);
})();
