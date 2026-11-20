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
});

function abrirNovaMusica(){
  $("buscaResultados").innerHTML="";$("buscaStatus").textContent="";
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
$("mUsarYT").addEventListener("click",async e=>{
  const texto=$("mLinkYT").value.trim();
  const id=lerLinkYouTube(texto);
  if(!id)return notify(ehPlaylistSemMusica(texto)?"Esse link é de uma playlist. Abra a música e copie o link dela (com watch?v=).":"Não reconheci esse link do YouTube.");
  let titulo="",veredito={ok:true};
  notify("Conferindo se este vídeo pode tocar aqui…",true);
  try{
    await ocupado(e.currentTarget,(async()=>{
      try{titulo=await tituloYouTube(id)}
      catch(err){if(err.codigo===401||err.codigo===404||err.codigo===400)throw err}
      veredito=await FonteYouTube.verificar(id);
    })());
  }catch(err){return notify(err.message)}
  if(!veredito.ok)return notify(`${veredito.msg} Escolha outro vídeo (clipes oficiais costumam bloquear; procure por “playback” ou “karaokê”).`);
  definirPlaybackEditor({tipo:"youtube",id,titulo},veredito.incerto?"Playback escolhido. Não consegui conferir agora se ele toca aqui (sem resposta do YouTube).":"Playback do YouTube escolhido: pode tocar aqui ✓");
});
$("mBuscarYTApp").addEventListener("click",async e=>{
  const q=`${$("mTitulo").value} ${$("mArtista").value} playback karaoke`.trim();
  $("mVideos").innerHTML=`<li class="vazio">Procurando…</li>`;
  try{
    const lista=await ocupado(e.currentTarget,buscarVideosYouTube(q,K.dados.prefs.keyYT));
    $("mVideos").innerHTML=lista.map(v=>`<li><button type="button" data-video="${esc(v.id)}" data-titulo="${esc(v.titulo)}">${v.thumb?`<img src="${esc(v.thumb)}" alt="" width="96" height="72" loading="lazy" referrerpolicy="no-referrer">`:""}<span><b>${esc(v.titulo)}</b><small>${esc(v.canal)}</small></span></button></li>`).join("")||`<li class="vazio">Nenhum vídeo que toque aqui.</li>`;
  }catch(err){$("mVideos").innerHTML="";notify(err.message)}
});
$("mVideos").addEventListener("click",e=>{
  const b=e.target.closest("[data-video]");if(!b)return;
  $("mLinkYT").value="https://youtu.be/"+b.dataset.video;
  definirPlaybackEditor({tipo:"youtube",id:b.dataset.video,titulo:b.dataset.titulo},"Playback do YouTube escolhido.");
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
function moverAtraso(d){const pr=K.dados.prefs;pr.audioDelay=clamp(pr.audioDelay+d,0,800);$("atrasoOut").textContent=pr.audioDelay+" ms";salvarLogo()}
$("atrasoMenos").addEventListener("click",()=>moverAtraso(-50));
$("atrasoMais").addEventListener("click",()=>moverAtraso(50));
$("prefKeyYT").addEventListener("change",e=>{K.dados.prefs.keyYT=e.target.value.trim();salvarLogo();notify(K.dados.prefs.keyYT?"Chave do YouTube guardada neste aparelho.":"Chave do YouTube removida.",true)});
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
$("palcoTelaCheia").addEventListener("click",telaCheia);
$("palcoProgresso").addEventListener("input",()=>{P.arrastando=true});
$("palcoProgresso").addEventListener("change",e=>{P.arrastando=false;if(P.fonte)P.fonte.buscar(Number(e.target.value));P.idx=-2});
$("vezComecar").addEventListener("click",comecar);
$("vezPular").addEventListener("click",proxima);
$("notaMedir").addEventListener("click",medirAplausos);
$("notaProxima").addEventListener("click",proxima);
$("fimSair").addEventListener("click",fecharPalco);
$("fimRecomecar").addEventListener("click",()=>carregarIndice(0));
$("liberarTocar").addEventListener("click",()=>{$("palcoLiberar").hidden=true;P.fonte&&P.fonte.tocar()});
$("erroPular").addEventListener("click",proxima);
$("erroRelogio").addEventListener("click",seguirSemPlayback);
$("erroOutro").addEventListener("click",()=>{const id=P.musica&&P.musica.id;fecharPalco();if(id)abrirEditor(id)});
$("gravarMarcar").addEventListener("click",Sincronia.marcar);
$("gravarPausa").addEventListener("click",Sincronia.pausa);
$("gravarDesfazer").addEventListener("click",Sincronia.desfazer);
$("gravarRecomecar").addEventListener("click",Sincronia.recomecar);
$("gravarSalvar").addEventListener("click",Sincronia.salvar);
$("gravarCancelar").addEventListener("click",Sincronia.cancelar);

/* ----------------------------------------------------------- tela da festa */
$("btnSala").addEventListener("click",()=>{SalaHost.renderDialogo();$("dlgSala").showModal()});
$("salaAbrir").addEventListener("click",e=>ocupado(e.currentTarget,SalaHost.abrir()));
$("salaFechar").addEventListener("click",()=>{if(confirm("Fechar a sala? Os celulares deixam de controlar."))SalaHost.fechar()});
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
