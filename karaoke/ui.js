"use strict";
/*
 * Eventos da interface e inicialização. Só liga botões às funções dos outros
 * módulos — regra de dado mora em estado/biblioteca/playlists/familia, e o
 * palco em palco.js.
 */
function aoMudarEstado(){
  if(!P.aberto)renderTudo();
  if(typeof SalaHost!=="undefined")SalaHost.mudou();
}
async function salvarERender(msg){
  await salvarEstado();
  if(P.aberto)renderTudo();
  if(msg)notify(msg,true);
}
function ocupado(botao,promessa){
  if(!botao)return promessa;
  botao.disabled=true;botao.classList.add("ocupado");
  return Promise.resolve(promessa).finally(()=>{botao.disabled=false;botao.classList.remove("ocupado")});
}

/* --------------------------------------------------------------- abas */
function trocarAba(aba){
  document.querySelectorAll(".abas [data-aba]").forEach(b=>{const on=b.dataset.aba===aba;b.classList.toggle("ativa",on);b.setAttribute("aria-selected",String(on))});
  ["playlist","musicas","familia","ajustes"].forEach(a=>{$("aba"+a[0].toUpperCase()+a.slice(1)).hidden=a!==aba});
}
document.querySelectorAll(".abas [data-aba]").forEach(b=>b.addEventListener("click",()=>trocarAba(b.dataset.aba)));

/* ----------------------------------------------------------- playlist */
$("playlistSel").addEventListener("change",e=>{K.dados.activePlaylistId=e.target.value;salvarERender()});
$("btnNovaPlaylist").addEventListener("click",()=>{
  const nome=prompt("Nome da nova playlist:","Festa da família");
  if(nome==null)return;
  criarPlaylist(nome);salvarERender("Playlist criada.");
});
$("btnRenomearPlaylist").addEventListener("click",()=>{
  const p=playlistAtiva();if(!p)return;
  const nome=prompt("Novo nome da playlist:",p.nome);
  if(nome==null||!nome.trim())return;
  p.nome=nome.trim().slice(0,60);salvarERender();
});
$("btnApagarPlaylist").addEventListener("click",()=>{
  const p=playlistAtiva();if(!p)return;
  if(!confirm(`Apagar a playlist "${p.nome}"? As músicas continuam salvas em Músicas.`))return;
  removerPlaylist(p.id);salvarERender("Playlist apagada.");
});
$("btnComecar").addEventListener("click",()=>{const p=playlistAtiva();if(p)abrirPalco({playlistId:p.id,indice:0})});
$("btnSolo").addEventListener("click",()=>{const p=playlistAtiva();if(p)abrirPalco({playlistId:p.id,indice:0,solo:true})});
$("btnAddFila").addEventListener("click",()=>{
  if(!K.dados.musicas.length){trocarAba("musicas");abrirNovaMusica();return}
  abrirAddFila();
});
$("filaLista").addEventListener("click",e=>{
  const b=e.target.closest("button[data-acao]");if(!b)return;
  const li=b.closest("li"),p=playlistAtiva();if(!p)return;
  const i=Number(li.dataset.indice);
  if(b.dataset.acao==="tocarItem")abrirPalco({playlistId:p.id,indice:i});
  else if(b.dataset.acao==="subir"){moverItem(p,i,-1);salvarERender()}
  else if(b.dataset.acao==="descer"){moverItem(p,i,1);salvarERender()}
  else if(b.dataset.acao==="tirar"){removerItem(p,li.dataset.item);salvarERender()}
});
$("filaLista").addEventListener("change",e=>{
  if(e.target.dataset.acao!=="cantorItem")return;
  const p=playlistAtiva(),it=p&&p.itens.find(x=>x.id===e.target.closest("li").dataset.item);
  if(!it)return;
  it.cantorA=e.target.value;if(it.cantorB===it.cantorA)it.cantorB="";
  salvarERender();
});

/* --------------------------------------------------------- compartilhar */
async function atualizarLinkCompartilhar(){
  const p=playlistAtiva();if(!p)return;
  $("compLink").value="Gerando…";
  const link=await linkDaPlaylist(p,$("compLetras").checked);
  $("compLink").value=link;
  $("compAviso").textContent=link.length>LINK_LONGO?`Link longo (${link.length} caracteres): aplicativos de mensagem podem cortar. Tire as letras ou use Exportar backup.`:"";
}
$("btnCompartilhar").addEventListener("click",()=>{$("dlgCompartilhar").showModal();atualizarLinkCompartilhar()});
$("compLetras").addEventListener("change",atualizarLinkCompartilhar);
$("compCopiar").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText($("compLink").value);notify("Link copiado.",true)}
  catch{$("compLink").select();notify("Selecione e copie o link.")}
});
$("compEnviar").addEventListener("click",async()=>{
  const p=playlistAtiva();
  if(navigator.share)try{await navigator.share({title:`Karaokê: ${p?p.nome:""}`,url:$("compLink").value})}catch{}
  else notify("Este navegador não tem o botão de enviar. Use Copiar link.");
});

/* ------------------------------------------------------------- músicas */
$("buscaBiblioteca").addEventListener("input",renderBiblioteca);
$("bibliotecaLista").addEventListener("click",e=>{
  const b=e.target.closest("button[data-acao]");if(!b)return;
  const id=b.closest("li").dataset.musica;
  if(b.dataset.acao==="editar")abrirEditor(id);
  else if(b.dataset.acao==="paraFila")abrirAddFila(id);
  else if(b.dataset.acao==="ensaiar")abrirPalco({modo:"ensaio",musicaId:id});
  else if(b.dataset.acao==="solo")abrirPalco({modo:"solo",musicaId:id});
});

function abrirNovaMusica(){
  $("buscaResultados").innerHTML="";$("buscaStatus").textContent="";$("novaResultado").innerHTML="";$("novaVideos").innerHTML="";
  $("dlgNovaMusica").showModal();
  setTimeout(()=>$("buscaLetra").focus(),50);
}
$("btnNovaMusica").addEventListener("click",abrirNovaMusica);
let ultimosResultados=[];
$("formBuscaLetra").addEventListener("submit",async e=>{
  e.preventDefault();
  const q=$("buscaLetra").value.trim();if(!q)return;
  $("buscaStatus").textContent="Procurando…";$("buscaResultados").innerHTML="";
  try{
    ultimosResultados=await ocupado(e.submitter,buscarLetras(q));
    $("buscaStatus").textContent=ultimosResultados.length?"Escolha a versão. As com ✓ já vêm sincronizadas.":"Não achei. Confira o nome ou cadastre sem buscar.";
    $("buscaResultados").innerHTML=ultimosResultados.map((r,i)=>`<li><button type="button" data-resultado="${i}">
      <b>${esc(r.title)}</b><small>${esc(r.artist)}${r.album?" · "+esc(r.album):""}${r.duration?" · "+fmt(r.duration):""}</small>
      <span class="selos">${r.synced?`<span class="selo ok">✓ sincronizada</span>`:r.lyrics?`<span class="selo meio">letra sem tempo</span>`:`<span class="selo falta">${r.instrumental?"instrumental":"sem letra"}</span>`}</span></button></li>`).join("");
  }catch(err){
    $("buscaStatus").textContent=err.message;
  }
});
$("buscaResultados").addEventListener("click",async e=>{
  const b=e.target.closest("[data-resultado]");if(!b)return;
  const r=ultimosResultados[Number(b.dataset.resultado)];if(!r)return;
  const ja=musicaParecida(r.title,r.artist);
  if(ja&&!confirm(`"${ja.title}" já está nas músicas salvas. Cadastrar outra versão mesmo assim?`)){$("dlgNovaMusica").close();abrirEditor(ja.id);return}
  const m=criarMusica({title:r.title,artist:r.artist,album:r.album,duration:r.duration,synced:r.synced,lyrics:r.lyrics});
  await salvarEstado();
  $("dlgNovaMusica").close();
  abrirEditor(m.id,"youtube");
  notify("Música salva. Agora escolha o playback.",true);
});
// Só o link do YouTube: o título vem do próprio vídeo, a música entra na playlist e a
// letra pode ser a do vídeo (Ajustes → Fundo → “Só o vídeo do YouTube”).
async function adicionarPorVideo(id,tituloOpcional,duracao=0){
  const status=$("buscaStatus");
  status.textContent="Conferindo o vídeo…";
  try{
    let titulo=tituloOpcional||"";
    if(!titulo)try{titulo=await tituloYouTube(id)}catch(err){if([400,401,404].includes(err.codigo))throw err}
    const v=await YouTubeBase.verificar(id);
    if(!v.ok)throw Error(`${v.msg} Escolha outro vídeo (procure por “playback” ou “karaokê”).`);
    const m=criarMusica({title:titulo||"Vídeo do YouTube",artist:"",playback:{tipo:"youtube",id,titulo,duracao:Number(duracao)||0}});
    adicionarItem(garantirPlaylist(),m.id,"","");
    await salvarEstado();
    $("novaLinkYT").value="";status.textContent="";$("novaVideos").innerHTML="";
    $("dlgNovaMusica").close();trocarAba("playlist");renderTudo();
    notify(`“${m.title}” entrou na playlist.${K.dados.prefs.fundo==="tela"?"":" Dica: em Ajustes, escolha “Só o vídeo do YouTube” para ver a letra do próprio vídeo."}`,true);
  }catch(err){status.textContent=err.message}
}
// Lista de vídeos para escolher (o "Ver opções" e o plano B quando a escolha automática não acha).
async function verOpcoesDeVideo(texto,botao){
  const status=$("buscaStatus");
  status.textContent="Procurando vídeos…";
  try{
    const r=await ocupado(botao,buscarVideos(texto,{chave:K.dados.prefs.keyYT}));
    $("novaVideos").innerHTML=htmlResultadosVideos(r.lista);
    status.textContent=r.lista.length?`${textoDaFonteBusca(r)}${r.aviso?" ("+r.aviso+")":""}`:"Nenhum vídeo encontrado. Tente outras palavras.";
  }catch(err){status.textContent=err.message}
}
// Um campo só: link do YouTube entra direto; um nome o app resolve sozinho (vídeo + letra).
function ehTextoDeBusca(texto){
  const status=$("buscaStatus");
  if(ehPlaylistSemMusica(texto)){status.textContent="Esse link é de uma playlist. Abra o vídeo e copie o link dele (com watch?v=).";return false}
  if(/^https?:\/\/|youtu\.?be/i.test(texto)){status.textContent="Não reconheci esse link do YouTube.";return false}
  return true;
}
$("formNovaLink").addEventListener("submit",async e=>{
  e.preventDefault();
  const texto=$("novaLinkYT").value.trim();if(!texto)return;
  const id=lerLinkYouTube(texto),status=$("buscaStatus");
  $("novaVideos").innerHTML="";
  if(id)return ocupado(e.submitter,adicionarPorVideo(id,""));
  if(!ehTextoDeBusca(texto))return;
  status.textContent="Procurando o melhor vídeo de karaokê…";
  const linha=lerListaDeMusicas(texto).itens[0]||{titulo:texto,artista:""};
  try{
    const en=await ocupado(e.submitter,adicionarPeloNome(linha,{comLetra:$("novaComLetra").checked}));
    $("novaResultado").insertAdjacentHTML("afterbegin",htmlEntradaAuto(en));
    $("novaLinkYT").value="";
    status.textContent=en.semVideo?"Entrou sem playback: nenhum vídeo achado toca aqui. Escolha um abaixo.":"Entrou na playlist. Se o vídeo estiver errado, toque em Trocar vídeo.";
    trocarAba("playlist");renderTudo();
  }catch(err){
    status.textContent=err.message;
    // Achou vídeos, mas nenhum toca fora do YouTube: mostra a lista inteira para a família escolher.
    if(err.alternativas&&err.alternativas.length)$("novaVideos").innerHTML=htmlResultadosVideos(err.alternativas);
  }
});
$("novaVerOpcoes").addEventListener("click",e=>{
  const texto=$("novaLinkYT").value.trim();if(!texto)return;
  $("novaVideos").innerHTML="";
  if(lerLinkYouTube(texto))return ocupado(e.currentTarget,adicionarPorVideo(lerLinkYouTube(texto),""));
  if(ehTextoDeBusca(texto))verOpcoesDeVideo(texto,e.currentTarget);
});
$("novaVideos").addEventListener("click",e=>{
  const b=e.target.closest("[data-video]");if(!b)return;
  adicionarPorVideo(b.dataset.video,b.dataset.titulo,b.dataset.duracao);
});

/* ---------------------------------------- adicionar pelo nome: trocar / tirar */
// Vale para a música adicionada no campo único e para as do lote.
async function aoClicarEntradaAuto(e){
  const li=e.target.closest(".autoItem[data-musica]");if(!li)return;
  const id=li.dataset.musica,ent=AUTO[id],lista=li.querySelector(".autoVideos");
  const escolhido=e.target.closest("[data-video]");
  if(escolhido&&ent){
    const video=(ent.alternativas||[]).find(v=>v.id===escolhido.dataset.video)||{id:escolhido.dataset.video,titulo:escolhido.dataset.titulo,duracao:0};
    notify("Conferindo se este vídeo pode tocar aqui…",true);
    let c;
    try{c=await ocupado(escolhido,YouTubeBase.verificar(video.id))}catch(err){return notify(err.message)}
    if(!c.ok)return notify(`${c.msg} Escolha outro vídeo.`);
    const nova=await trocarVideoDaEntrada(id,video);
    li.outerHTML=htmlEntradaAuto(nova);renderTudo();
    return notify("Vídeo trocado ✓",true);
  }
  const acao=e.target.closest("[data-auto]");if(!acao||!ent)return;
  if(acao.dataset.auto==="tirar"){
    await tirarEntrada(id);li.remove();renderTudo();
    return notify("Tirada da playlist.",true);
  }
  // trocar: abre a lista (alternativas guardadas; sem elas, uma busca nova)
  if(!lista.hidden){lista.hidden=true;return}
  lista.hidden=false;
  if(!ent.alternativas||!ent.alternativas.length){
    lista.innerHTML=`<li class="vazio">Procurando…</li>`;
    try{
      const r=await buscarVideos(`${ent.musica.title} ${ent.musica.artist}`.trim(),{chave:K.dados.prefs.keyYT});
      ent.alternativas=r.lista.filter(v=>!ent.video||v.id!==ent.video.id);
    }catch(err){lista.innerHTML=`<li class="vazio">${esc(err.message)}</li>`;return}
  }
  lista.innerHTML=ent.alternativas.length?htmlResultadosVideos(ent.alternativas,{duracaoEsperada:ent.musica.duration}):`<li class="vazio">Nenhum outro vídeo encontrado.</li>`;
}
$("novaResultado").addEventListener("click",aoClicarEntradaAuto);
$("loteLista").addEventListener("click",aoClicarEntradaAuto);

/* ------------------------------------------------ adicionar várias de uma vez */
let loteParado=false;
$("loteParar").addEventListener("click",()=>{loteParado=true;$("loteStatus").textContent="Parando depois desta música…"});
$("formLote").addEventListener("submit",async e=>{
  e.preventDefault();
  const {itens,ignoradas}=lerListaDeMusicas($("loteTexto").value),status=$("loteStatus");
  if(!itens.length){status.textContent="Cole uma música por linha.";return}
  loteParado=false;$("loteIr").hidden=true;$("loteParar").hidden=false;$("loteLista").innerHTML="";
  const comLetra=$("novaComLetra").checked;
  let entraram=0,falharam=0;
  for(const [i,it] of itens.entries()){
    if(loteParado)break;
    // Conferir vídeo abre um segundo player: com música tocando nesta tela, espera ela acabar.
    if(!await YouTubeBase.aguardarLivre(0)){
      status.textContent=`Esperando a música acabar para continuar (${i+1} de ${itens.length})… toque em Parar para cancelar.`;
      while(!loteParado&&!await YouTubeBase.aguardarLivre(1500)){}
      if(loteParado)break;
    }
    status.textContent=`Procurando ${i+1} de ${itens.length}: ${it.texto}…`;
    try{
      if(lerLinkYouTube(it.texto))throw Error("Link: use o campo acima.");
      const en=await adicionarPeloNome(it,{comLetra});
      $("loteLista").insertAdjacentHTML("beforeend",htmlEntradaAuto(en));entraram++;
    }catch(err){
      $("loteLista").insertAdjacentHTML("beforeend",htmlFalhaAuto(it.texto,err.message));falharam++;
    }
  }
  $("loteIr").hidden=false;$("loteParar").hidden=true;
  if(entraram)trocarAba("playlist");
  renderTudo();
  status.textContent=`${loteParado?"Parou. ":"Pronto. "}${entraram} entraram na playlist${falharam?`, ${falharam} não deu para achar`:""}${ignoradas?` (${ignoradas} ficaram de fora: máximo de ${MAX_LOTE} por vez)`:""}. Confira os vídeos e troque os que erraram. Para guardar o acervo: Ajustes → Exportar backup.`;
  $("loteTexto").value="";
});
$("btnMusicaManual").addEventListener("click",async()=>{
  const q=$("buscaLetra").value.trim();
  const [title,artist]=q.split(/\s+[-–—]\s+/);
  const m=criarMusica({title:title||"Nova música",artist:artist||""});
  await salvarEstado();
  $("dlgNovaMusica").close();
  abrirEditor(m.id);
});

/* ------------------------------------------------------------- editor */
document.querySelectorAll("#dlgMusica [data-pb]").forEach(b=>b.addEventListener("click",()=>trocarAbaPlayback(b.dataset.pb)));
["mTitulo","mArtista","mLetra"].forEach(id=>$(id).addEventListener("input",atualizarEditor));
async function definirPlaybackEditor(playback,msg){
  salvarEditor();
  editarMusica(ED.id,{playback});
  await salvarEstado();
  atualizarEditor();
  if(msg)notify(msg,true);
}
// Confere se o vídeo toca fora do YouTube e só então troca o playback da música.
async function usarVideoNoEditor(id,tituloOpcional,botao,duracao=0){
  let titulo=tituloOpcional||"",veredito={ok:true};
  notify("Conferindo se este vídeo pode tocar aqui…",true);
  try{
    await ocupado(botao,(async()=>{
      if(!titulo)try{titulo=await tituloYouTube(id)}
      catch(err){if(err.codigo===401||err.codigo===404||err.codigo===400)throw err}
      veredito=await YouTubeBase.verificar(id);
    })());
  }catch(err){return notify(err.message)}
  if(!veredito.ok)return notify(`${veredito.msg} Escolha outro vídeo (clipes oficiais costumam bloquear; procure por “playback” ou “karaokê”).`);
  $("mLinkYT").value="https://youtu.be/"+id;
  definirPlaybackEditor({tipo:"youtube",id,titulo,duracao:Number(duracao)||0},veredito.incerto?"Playback escolhido. Não consegui conferir agora se ele toca aqui (sem resposta do YouTube).":"Playback do YouTube escolhido: pode tocar aqui ✓");
}
$("mUsarYT").addEventListener("click",e=>{
  const texto=$("mLinkYT").value.trim();
  const id=lerLinkYouTube(texto);
  if(!id)return notify(ehPlaylistSemMusica(texto)?"Esse link é de uma playlist. Abra a música e copie o link dela (com watch?v=).":"Não reconheci esse link do YouTube.");
  usarVideoNoEditor(id,"",e.currentTarget);
});
// Busca os playbacks no próprio editor (abre sozinha para música sem playback do YouTube).
async function buscarPlaybackNoEditor(){
  const q=$("mBuscaYT").value.trim();if(!q)return;
  const id=ED.id,m=acharMusica(id);
  const esperada=(m&&m.duration)||parseClock($("mDuracao").value);
  ED.buscou=true;
  $("mVideos").innerHTML=`<li class="vazio">Procurando…</li>`;
  try{
    const r=await ocupado($("mBuscarYTApp"),buscarVideos(q,{chave:K.dados.prefs.keyYT}));
    if(ED.id!==id)return;   // o editor já foi para outra música
    $("mVideos").innerHTML=(r.lista.length?htmlResultadosVideos(r.lista,{duracaoEsperada:esperada})+`<li class="vazio">${esc(textoDaFonteBusca(r))}</li>`:"")||`<li class="vazio">Nenhum vídeo encontrado. Tente outras palavras.</li>`;
  }catch(err){
    if(ED.id!==id)return;
    // Plano B à vista: o link e o atalho para o site do YouTube.
    $("mVideos").innerHTML=`<li class="vazio">${esc(err.message)}</li>`;
    $("mLinkDetalhes").open=true;$("mProcurarYT").classList.add("primario");
  }
}
$("mFormBuscaYT").addEventListener("submit",e=>{e.preventDefault();buscarPlaybackNoEditor()});
$("mBuscaYT").addEventListener("input",()=>{ED.buscaEditada=true});
$("mVideos").addEventListener("click",e=>{
  const b=e.target.closest("[data-video]");if(!b)return;
  usarVideoNoEditor(b.dataset.video,b.dataset.titulo,b,b.dataset.duracao);
});
$("mUsarSP").addEventListener("click",async e=>{
  const id=lerLinkSpotify($("mLinkSP").value);
  if(!id)return notify("Não reconheci esse link. Use o link de uma FAIXA do Spotify (open.spotify.com/track/…).");
  let titulo="";
  try{titulo=await ocupado(e.currentTarget,tituloSpotify(id))}catch{}
  definirPlaybackEditor({tipo:"spotify",id,titulo},"Playback do Spotify escolhido. Lembre: sem login no Spotify, toca só a prévia.");
});
function duracaoDoArquivo(arquivo){
  return new Promise(res=>{
    const a=new Audio(),url=URL.createObjectURL(arquivo);
    const fim=v=>{URL.revokeObjectURL(url);res(v)};
    a.preload="metadata";a.onloadedmetadata=()=>fim(Number.isFinite(a.duration)?Math.round(a.duration):0);a.onerror=()=>fim(0);
    setTimeout(()=>fim(0),5000);a.src=url;
  });
}
$("mArquivo").addEventListener("change",async e=>{
  const arquivo=e.target.files[0];e.target.value="";
  if(!arquivo)return;
  try{
    salvarEditor();
    await definirArquivo(ED.id,arquivo);
    const m=acharMusica(ED.id);
    if(!m.duration){const d=await duracaoDoArquivo(arquivo);if(d){editarMusica(ED.id,{duration:d});$("mDuracao").value=fmt(d)}}
    await salvarEstado();atualizarEditor();
    notify("Áudio guardado neste aparelho.",true);
  }catch(err){notify(err.message||"Não consegui guardar o arquivo.")}
});
$("mSemPlayback").addEventListener("click",async()=>{
  const m=acharMusica(ED.id);
  if(m&&m.playback&&m.playback.tipo==="arquivo")try{await KStore.audio.apagar(m.playback.id)}catch{}
  definirPlaybackEditor(null,"Playback removido.");
});
$("mBuscarLetra").addEventListener("click",async e=>{
  const atual=$("mLetra").value.trim();
  if(atual&&!confirm("Trocar a letra atual pela que eu encontrar?"))return;
  try{
    const r=await ocupado(e.currentTarget,acharLetra({title:$("mTitulo").value,artist:$("mArtista").value,duration:parseClock($("mDuracao").value)}));
    if(!r)return notify("Não achei a letra desta música. Confira título e artista, ou cole a letra.");
    $("mLetra").value=r.synced||r.lyrics;
    if(!parseClock($("mDuracao").value)&&r.duration)$("mDuracao").value=fmt(r.duration);
    atualizarEditor();
    notify(r.synced?"Letra sincronizada encontrada. Salve para guardar.":"Achei a letra, mas sem tempo. Grave a sincronia depois de escolher o playback.",true);
  }catch(err){notify(err.message)}
});
$("mSalvar").addEventListener("click",async()=>{salvarEditor();await salvarEstado();$("dlgMusica").close();notify("Música salva.",true)});
$("mParaFila").addEventListener("click",async()=>{salvarEditor();await salvarEstado();$("dlgMusica").close();abrirAddFila(ED.id)});
$("mApagar").addEventListener("click",async()=>{
  const m=acharMusica(ED.id);if(!m)return;
  if(!confirm(`Apagar "${m.title}"? Ela sai também das playlists.`))return;
  await removerMusica(m.id);await salvarEstado();$("dlgMusica").close();notify("Música apagada.",true);
});
$("mEnsaiar").addEventListener("click",async()=>{salvarEditor();await salvarEstado();$("dlgMusica").close();abrirPalco({modo:"ensaio",musicaId:ED.id})});
$("mGravar").addEventListener("click",async()=>{
  salvarEditor();await salvarEstado();
  const m=acharMusica(ED.id);
  if(!temLetra(m))return notify("Cole ou busque a letra antes de gravar a sincronia.");
  if(temSincronia(m)&&!confirm("Esta música já tem sincronia. Gravar uma nova por cima?"))return;
  $("dlgMusica").close();
  abrirPalco({modo:"gravar",musicaId:ED.id});
});
function moverOffsetEditor(delta){
  const m=acharMusica(ED.id);if(!m)return;
  editarMusica(ED.id,{offset:Math.round(((Number(m.offset)||0)+delta)*100)/100});
  salvarLogo();atualizarEditor();
}
$("mOffsetMenos").addEventListener("click",()=>moverOffsetEditor(-0.5));
$("mOffsetMais").addEventListener("click",()=>moverOffsetEditor(0.5));
$("mDueto").addEventListener("click",abrirDueto);

/* ------------------------------------------------------------- dueto */
$("duetoLinhas").addEventListener("click",e=>{
  const b=e.target.closest("[data-parte]");if(!b)return;
  const l=DU.linhas[Number(b.closest("li").dataset.linha)];
  l.parte=l.parte===b.dataset.parte?"":b.dataset.parte;
  renderDueto();
});
$("duetoAlternar").addEventListener("click",()=>{let k=0;DU.linhas.forEach(l=>{if(l.texto)l.parte=k++%2?"B":"A"});renderDueto()});
$("duetoLimpar").addEventListener("click",()=>{DU.linhas.forEach(l=>{l.parte=""});renderDueto()});
$("duetoSalvar").addEventListener("click",()=>{
  // Linha sem parte depois de uma com parte vira "Todos" (a marca vale até a próxima).
  $("mLetra").value=paraTexto(DU.linhas);
  $("dlgDueto").close();atualizarEditor();
  notify("Dueto marcado. Salve a música para guardar.",true);
});

/* -------------------------------------------------- adicionar à playlist */
$("addBusca").addEventListener("input",renderAddFila);
$("addMusicas").addEventListener("click",e=>{const b=e.target.closest("[data-escolher]");if(!b)return;AF.musicaId=b.dataset.escolher;renderAddFila()});
$("dlgAddFila").addEventListener("click",e=>{
  const b=e.target.closest("[data-lado]");if(!b)return;
  if(b.dataset.lado==="a"){AF.a=b.dataset.cantor;if(AF.b===AF.a)AF.b=""}
  else AF.b=AF.b===b.dataset.cantor?"":b.dataset.cantor;
  renderAddFila();
});
$("addDueto").addEventListener("change",e=>{
  $("addCantoresB").hidden=!e.target.checked;
  if(e.target.checked&&!AF.b){const outro=K.dados.cantores.find(c=>c.id!==AF.a);AF.b=outro?outro.id:""}
  if(!e.target.checked)AF.b="";
  renderAddFila();
});
$("addConfirmar").addEventListener("click",async()=>{
  const p=garantirPlaylist();
  const m=acharMusica(AF.musicaId);if(!m)return;
  adicionarItem(p,m.id,AF.a,$("addDueto").checked?AF.b:"");
  await salvarEstado();
  $("dlgAddFila").close();
  trocarAba("playlist");
  notify(`"${m.title}" entrou na playlist ${p.nome}.`,true);
});

/* ------------------------------------------------------------- família */
$("familiaLista").addEventListener("click",e=>{
  const b=e.target.closest("[data-cantor]");if(!b)return;
  const c=acharCantor(b.dataset.cantor);if(!c)return;
  FAM.editId=c.id;FAM.emoji=c.emoji;FAM.cor=c.cor;
  $("cantorNome").value=c.nome;renderFamilia();$("cantorNome").focus();
});
$("cantorEmojis").addEventListener("click",e=>{const b=e.target.closest("[data-emoji]");if(!b)return;FAM.emoji=b.dataset.emoji;renderFamilia()});
$("cantorCores").addEventListener("click",e=>{const b=e.target.closest("[data-cor]");if(!b)return;FAM.cor=b.dataset.cor;renderFamilia()});
function limparFormCantor(){FAM.editId="";FAM.emoji="🎤";FAM.cor="";$("cantorNome").value="";renderFamilia()}
$("formCantor").addEventListener("submit",async e=>{
  e.preventDefault();
  const nome=$("cantorNome").value.trim();if(!nome)return;
  if(FAM.editId)editarCantor(FAM.editId,{nome,emoji:FAM.emoji,cor:FAM.cor});
  else criarCantor({nome,emoji:FAM.emoji,cor:FAM.cor});
  const editou=!!FAM.editId;
  limparFormCantor();
  await salvarERender(editou?"Cantor atualizado.":`${nome} entrou na família! 🎤`);
});
$("cantorCancelar").addEventListener("click",limparFormCantor);
$("cantorRemover").addEventListener("click",async()=>{
  const c=acharCantor(FAM.editId);if(!c)return;
  if(!confirm(`Remover ${c.nome}? As músicas da playlist ficam sem cantor.`))return;
  removerCantor(c.id);limparFormCantor();await salvarERender("Cantor removido.");
});

/* -------------------------------------------------------------- ajustes */
$("prefTamanho").addEventListener("input",e=>{K.dados.prefs.tamanho=Number(e.target.value);$("tamanhoOut").textContent=e.target.value+"%";aplicarPrefsPalco();salvarLogo()});
$("prefFundo").addEventListener("change",e=>{K.dados.prefs.fundo=e.target.value;aplicarPrefsPalco();salvarLogo()});
$("prefContagem").addEventListener("change",e=>{K.dados.prefs.contagem=Number(e.target.value);salvarLogo()});
$("prefAplausometro").addEventListener("change",e=>{K.dados.prefs.aplausometro=e.target.checked;salvarLogo()});
// Permissões dos celulares (painel do anfitrião no diálogo da sala).
function salvarPermissoes(nova){K.dados.prefs.permissoes=nova;salvarLogo();SalaHost.mudou();SalaHost.renderDialogo()}
$("permNivel").addEventListener("change",e=>{if(e.target.value!=="personalizado")salvarPermissoes(aplicarNivel(prefs().permissoes,e.target.value))});
$("permAcoes").addEventListener("change",e=>{
  const s=e.target.closest("[data-perm-acao]");if(!s)return;
  salvarPermissoes(definirAcao(prefs().permissoes,s.dataset.permAcao,s.value));
});
$("permPessoas").addEventListener("click",e=>{
  const b=e.target.closest("[data-bloquear]");if(!b)return;
  salvarPermissoes(bloquearNome(prefs().permissoes,b.dataset.nome,b.dataset.bloquear==="1"));
});
function moverAtraso(d){const pr=K.dados.prefs;pr.audioDelay=clamp(pr.audioDelay+d,0,800);$("atrasoOut").textContent=pr.audioDelay+" ms";salvarLogo()}
$("atrasoMenos").addEventListener("click",()=>moverAtraso(-50));
$("atrasoMais").addEventListener("click",()=>moverAtraso(50));
$("prefYoutubeSessao").addEventListener("change",e=>{
  K.dados.prefs.youtubeSessao=e.target.checked;salvarLogo();
  notify(e.target.checked?"Sessão do YouTube habilitada para a próxima música. Entre no YouTube neste mesmo navegador.":"O player volta a priorizar o modo de privacidade na próxima música.",true);
});
$("prefKeyYT").addEventListener("change",e=>{K.dados.prefs.keyYT=e.target.value.trim();salvarLogo();notify(K.dados.prefs.keyYT?"Chave do YouTube guardada neste aparelho.":"Chave do YouTube removida.",true)});
$("btnLimparPlacar").addEventListener("click",async()=>{
  if(!(K.dados.placar||[]).length)return notify("Você ainda não tem notas guardadas.");
  if(!confirm("Apagar todas as suas notas e recordes do Cantar sozinho?"))return;
  limparPlacar(K.dados);await salvarERender("Placar apagado.");
});
$("btnExportar").addEventListener("click",()=>{
  baixarArquivo(`karaoke-backup-${new Date().toISOString().slice(0,10)}.json`,backupJSON(),"application/json");
  notify("Backup exportado.",true);
});

/* ------------------------------------------------------------- importar */
let importacao=null;
$("arquivoImportar").addEventListener("change",async e=>{
  const arq=e.target.files[0];e.target.value="";if(!arq)return;
  try{
    const{dados,resumo}=await lerBackup(arq);
    importacao={tipo:"backup",dados};
    $("importarTitulo").textContent="Importar backup";
    $("importarResumo").innerHTML=`O arquivo tem <b>${resumo.musicas}</b> música(s), <b>${resumo.cantores}</b> cantor(es) e <b>${resumo.playlists}</b> playlist(s).<br>Hoje você tem ${K.dados.musicas.length} música(s), ${K.dados.cantores.length} cantor(es) e ${K.dados.playlists.length} playlist(s).<br><b>Substituir</b> apaga o que está aqui.`;
    $("importarSubstituir").hidden=false;
    $("dlgImportar").showModal();
  }catch(err){notify(err.message)}
});
$("importarAdicionar").addEventListener("click",async()=>{
  if(!importacao)return;
  if(importacao.tipo==="backup")aplicarBackup(importacao.dados,"adicionar");
  else importarPacote(importacao.dados);
  importacao=null;$("dlgImportar").close();
  await salvarERender("Importado.");trocarAba("playlist");
});
$("importarSubstituir").addEventListener("click",async()=>{
  if(!importacao||importacao.tipo!=="backup")return;
  if(!confirm("Substituir TUDO o que está neste aparelho pelo backup?"))return;
  aplicarBackup(importacao.dados,"substituir");
  importacao=null;$("dlgImportar").close();
  await salvarERender("Backup restaurado.");
});
async function receberLinkPlaylist(){
  if(!/#playlistz?=/.test(location.hash))return;
  try{
    const d=await lerLinkPlaylist(location.hash);
    history.replaceState(null,"",location.pathname+location.search);
    if(!d)return;
    importacao={tipo:"link",dados:d};
    $("importarTitulo").textContent="Playlist recebida";
    const comLetra=d.musicas.filter(m=>m.synced||m.lyrics).length;
    $("importarResumo").innerHTML=`<b>${esc(d.nome)}</b>: ${d.itens.length} música(s), ${d.cantores.length} cantor(es)${comLetra?`, ${comLetra} com letra`:""}.<br>Músicas e cantores que você já tem são reaproveitados.`;
    $("importarSubstituir").hidden=true;
    $("dlgImportar").showModal();
  }catch(err){notify(err.message||"Não consegui abrir esse link de playlist.")}
}

/* ---------------------------------------------------------------- palco */
$("palcoSair").addEventListener("click",fecharPalco);
$("palcoTocar").addEventListener("click",alternar);
$("palcoProxima").addEventListener("click",proxima);
$("palcoAnterior").addEventListener("click",anterior);
$("palcoAdiantar").addEventListener("click",()=>ajustarOffset(-0.25));
$("palcoAtrasar").addEventListener("click",()=>ajustarOffset(0.25));
$("palcoFundoBtn").addEventListener("click",trocarFundo);
$("palcoLetraBtn").addEventListener("click",alternarLetra);
$("palcoTelaCheia").addEventListener("click",telaCheia);
$("palcoProgresso").addEventListener("input",()=>{P.arrastando=true});
$("palcoProgresso").addEventListener("change",e=>{P.arrastando=false;if(P.fonte)P.fonte.buscar(Number(e.target.value));P.idx=-2});
$("vezComecar").addEventListener("click",comecar);
$("vezPular").addEventListener("click",proxima);
$("notaMedir").addEventListener("click",medirAplausos);
$("notaProxima").addEventListener("click",proxima);
$("notaDeNovo").addEventListener("click",()=>carregarIndice(P.indice,{comecarJa:true}));
$("fimSair").addEventListener("click",fecharPalco);
$("fimRecomecar").addEventListener("click",()=>carregarIndice(0));
$("liberarTocar").addEventListener("click",()=>{$("palcoLiberar").hidden=true;P.fonte&&P.fonte.tocar()});
$("erroPular").addEventListener("click",proxima);
$("erroTentar").addEventListener("click",tentarPlayback);
$("erroControlesYT").addEventListener("click",()=>{
  $("palcoErro").hidden=true;
  mostrarLiberar("youtube",true);
  avisarSala();
});
$("erroRelogio").addEventListener("click",seguirSemPlayback);
$("erroOutro").addEventListener("click",()=>{const id=P.musica&&P.musica.id;fecharPalco();if(id)abrirEditor(id)});
$("gravarMarcar").addEventListener("click",Sincronia.marcar);
$("gravarPausa").addEventListener("click",Sincronia.pausa);
$("gravarDesfazer").addEventListener("click",Sincronia.desfazer);
$("gravarRecomecar").addEventListener("click",Sincronia.recomecar);
$("gravarSalvar").addEventListener("click",Sincronia.salvar);
$("gravarCancelar").addEventListener("click",Sincronia.cancelar);

/* ----------------------------------------------------------- tela da festa */
for(const id of ["btnSala","palcoSala"]){
  $(id).addEventListener("click",()=>{SalaHost.renderDialogo();$("dlgSala").showModal()});
}
$("salaAbrir").addEventListener("click",e=>ocupado(e.currentTarget,SalaHost.abrir()));
$("salaFechar").addEventListener("click",()=>{if(confirm("Fechar a sala? Os celulares deixam de controlar."))SalaHost.fechar()});
$("salaAssumirForm").addEventListener("submit",e=>{
  e.preventDefault();const btn=$("salaAssumir");btn.disabled=true;$("salaAssumirStatus").textContent="Enviando pedido…";
  SalaHost.solicitarTransferencia($("salaAssumirCodigo").value).catch(err=>{$("salaAssumirStatus").textContent=err.message}).finally(()=>{btn.disabled=false});
});
$("salaTransferirAceitar").addEventListener("click",()=>SalaHost.aceitarTransferencia());
$("salaTransferirRecusar").addEventListener("click",()=>SalaHost.recusarTransferencia());
$("salaCopiar").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(SalaHost.link());notify("Link copiado.",true)}catch{notify(SalaHost.link())}});

/* --------------------------------------------------------------- início */
window.addEventListener("pagehide",flushSaves);
document.addEventListener("visibilitychange",()=>{
  if(document.hidden)flushSaves();
  else if(P.aberto)keepAwake();
});
(async()=>{
  await carregarEstado();
  renderTudo();
  receberLinkPlaylist();
  window.addEventListener("hashchange",receberLinkPlaylist);
  if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(e=>{
    if(e&&e.usage!=null)$("armazenamentoInfo").textContent=`Usando ${(e.usage/1048576).toFixed(1)} MB neste aparelho.`;
  }).catch(()=>{});
  KStore.pedirPersistencia();
  SalaHost.retomar();
})();

/* ------------------------------------------- convite de transferência da sala */
let conviteTimer=0;
function mostrarConvite(){
  try{
    const c=SalaHost.criarConvite();
    $("salaConviteCaixa").hidden=false;$("conviteLink").textContent=c.link;
    try{QR.desenhar($("conviteQR"),c.link)}catch(e){console.error(e)}
    clearInterval(conviteTimer);
    const atualizar=()=>{
      const s=Math.max(0,Math.round((c.expira-Date.now())/1000));
      $("conviteRestante").textContent=s>0?`Vale por mais ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}. Uso único.`:"Convite vencido. Gere outro.";
      if(s<=0){clearInterval(conviteTimer);$("salaConviteCaixa").hidden=true}
    };
    atualizar();conviteTimer=setInterval(atualizar,1000);
  }catch(e){notify(e.message)}
}
function fecharConvite(){clearInterval(conviteTimer);SalaHost.cancelarConvite();$("salaConviteCaixa").hidden=true}
$("salaConvidar").addEventListener("click",mostrarConvite);
$("conviteCancelar").addEventListener("click",fecharConvite);
$("conviteCopiar").addEventListener("click",()=>{
  navigator.clipboard.writeText($("conviteLink").textContent).then(()=>notify("Link do convite copiado.",true),()=>notify("Não consegui copiar; selecione o link e copie."));
});
// Abrir o app por um link de convite (#assumir=CODIGO.CONVITE): preenche e pede a troca sozinho.
function lerHashAssumir(){
  if(!/#assumir=/.test(location.hash))return;
  const texto=location.hash;
  history.replaceState(null,"",location.pathname+location.search);   // o convite não fica na barra de endereço
  $("btnSala").click();
  $("salaAssumirCodigo").value=texto.replace(/^#assumir=/,"");
  $("salaAssumirForm").requestSubmit();
}
window.addEventListener("hashchange",lerHashAssumir);
lerHashAssumir();
