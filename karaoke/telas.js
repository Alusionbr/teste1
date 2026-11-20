"use strict";
/*
 * Desenho das telas (listas e formulários). Sem regra de negócio: lê o
 * estado e escreve HTML. Os eventos ficam em ui.js.
 */
function renderTudo(){renderPlaylist();renderBiblioteca();renderFamilia();renderAjustes()}

function selosMusica(m){
  const s=[];
  s.push(`<span class="selo pb-${m.playback?m.playback.tipo:"nenhum"}">${esc(rotuloPlayback(m))}</span>`);
  if(temSincronia(m))s.push(`<span class="selo ok">✓ sincronizada</span>`);
  else if(temLetra(m))s.push(`<span class="selo meio">letra sem tempo</span>`);
  else s.push(`<span class="selo falta">sem letra</span>`);
  if(temDueto(m))s.push(`<span class="selo dueto">👥 dueto</span>`);
  const melhor=melhorNota(K.dados,m.id);
  if(melhor!==null)s.push(`<span class="selo recorde" title="Seu melhor resultado no Cantar sozinho">🏆 ${melhor}</span>`);
  return s.join("");
}
function seloCantor(id){
  const c=acharCantor(id);
  return c?`<span class="cantorSelo" style="--cor:${c.cor}">${esc(c.emoji)} ${esc(c.nome)}</span>`:`<span class="cantorSelo vazio">🎤 livre</span>`;
}
function opcoesCantor(sel){
  return `<option value="">🎤 livre</option>`+K.dados.cantores.map(c=>`<option value="${c.id}"${c.id===sel?" selected":""}>${esc(c.emoji)} ${esc(c.nome)}</option>`).join("");
}

/* -------------------------------------------------------------- playlist */
function renderPlaylist(){
  const sel=$("playlistSel"),p=playlistAtiva();
  sel.innerHTML=K.dados.playlists.length?K.dados.playlists.map(x=>`<option value="${x.id}"${x===p?" selected":""}>${esc(x.nome)} (${x.itens.length})</option>`).join(""):`<option value="">Nenhuma playlist ainda</option>`;
  ["btnRenomearPlaylist","btnCompartilhar","btnApagarPlaylist"].forEach(id=>{$(id).disabled=!p});
  const itens=p?p.itens:[];
  $("btnComecar").disabled=!itens.length;$("btnSolo").disabled=!itens.length;
  $("filaVazia").hidden=!!itens.length;
  const dur=duracaoPlaylist(p);
  const cantores=new Set(itens.flatMap(i=>[i.cantorA,i.cantorB]).filter(Boolean));
  $("playlistResumo").textContent=itens.length?`${itens.length} música${itens.length>1?"s":""}${dur>=60?` · cerca de ${Math.round(dur/60)} min`:""}${cantores.size?` · ${cantores.size} cantor${cantores.size>1?"es":""}`:""}`:"";
  $("filaLista").innerHTML=itens.map((i,n)=>{
    const m=acharMusica(i.musicaId);
    const dueto=i.cantorB?` <span class="mais">&amp;</span> ${seloCantor(i.cantorB)}`:"";
    return `<li data-item="${i.id}" data-indice="${n}">
      <span class="num">${n+1}</span>
      <div class="info">
        <div class="quem">${seloCantor(i.cantorA)}${dueto}</div>
        <b>${esc(m.title)}</b><small>${esc(m.artist)}</small>
        <div class="selos">${selosMusica(m)}</div>
      </div>
      <div class="acoesItem">
        <button type="button" data-acao="tocarItem" title="Começar por esta" aria-label="Começar por esta">▶</button>
        <select data-acao="cantorItem" aria-label="Quem canta">${opcoesCantor(i.cantorA)}</select>
        <button type="button" data-acao="subir" aria-label="Subir"${n===0?" disabled":""}>↑</button>
        <button type="button" data-acao="descer" aria-label="Descer"${n===itens.length-1?" disabled":""}>↓</button>
        <button type="button" data-acao="tirar" aria-label="Tirar da playlist">✕</button>
      </div></li>`;
  }).join("");
}

/* -------------------------------------------------------------- músicas */
function renderBiblioteca(){
  const lista=filtrarBiblioteca($("buscaBiblioteca").value);
  $("bibliotecaVazia").hidden=!!K.dados.musicas.length;
  $("bibliotecaLista").innerHTML=lista.map(m=>`<li data-musica="${m.id}">
      <div class="info"><b>${esc(m.title)}</b><small>${esc(m.artist)}${m.duration?" · "+fmt(m.duration):""}</small><div class="selos">${selosMusica(m)}</div></div>
      <div class="acoesItem">
        <button type="button" data-acao="editar">✏️ Editar</button>
        <button type="button" data-acao="paraFila">+ Playlist</button>
        <button type="button" data-acao="solo" aria-label="Cantar sozinho" title="Cantar sozinho">🎤</button>
        <button type="button" data-acao="ensaiar" aria-label="Ensaiar" title="Só ouvir e ensaiar">▶</button>
      </div></li>`).join("")||(K.dados.musicas.length?`<li class="vazio">Nada encontrado.</li>`:"");
}

/* -------------------------------------------------------------- família */
const FAM={editId:"",emoji:"🎤",cor:""};
function renderFamilia(){
  const p=playlistAtiva();
  $("familiaLista").innerHTML=K.dados.cantores.map(c=>{
    const n=p?p.itens.filter(i=>i.cantorA===c.id||i.cantorB===c.id).length:0;
    return `<li><button type="button" data-cantor="${c.id}" class="cantorCartao${c.id===FAM.editId?" editando":""}" style="--cor:${c.cor}">
      <span class="emoji">${esc(c.emoji)}</span><b>${esc(c.nome)}</b><small>${n?`${n} na playlist`:"toque para editar"}</small></button></li>`;
  }).join("");
  if(!FAM.cor)FAM.cor=CORES_CANTOR.find(x=>!K.dados.cantores.some(c=>c.cor===x))||CORES_CANTOR[0];
  $("cantorEmojis").innerHTML=EMOJIS_CANTOR.map(e=>`<button type="button" data-emoji="${e}" aria-pressed="${e===FAM.emoji}">${e}</button>`).join("");
  $("cantorCores").innerHTML=CORES_CANTOR.map(c=>`<button type="button" data-cor="${c}" aria-pressed="${c===FAM.cor}" style="--cor:${c}" aria-label="Cor ${c}"></button>`).join("");
  const editando=!!FAM.editId;
  $("formCantorTitulo").textContent=editando?"Editar cantor":"Quem vai cantar?";
  $("cantorSalvar").textContent=editando?"Salvar":"Adicionar à família";
  $("cantorCancelar").hidden=!editando;$("cantorRemover").hidden=!editando;
}

/* -------------------------------------------------------------- ajustes */
function renderAjustes(){
  const pr=K.dados.prefs;
  $("prefTamanho").value=pr.tamanho;$("tamanhoOut").textContent=pr.tamanho+"%";
  $("prefFundo").value=pr.fundo;
  $("prefContagem").value=String(pr.contagem);
  $("prefAplausometro").checked=pr.aplausometro;
  $("atrasoOut").textContent=pr.audioDelay+" ms";
  if(document.activeElement!==$("prefKeyYT"))$("prefKeyYT").value=pr.keyYT;
  $("versaoApp").textContent="v"+APP_VERSION;
}

/* ------------------------------------------------------- editor de música */
const ED={id:"",aba:"youtube"};
function abrirEditor(id,aba){
  const m=acharMusica(id);if(!m)return;
  ED.id=id;
  $("mTitulo").value=m.title;$("mArtista").value=m.artist;$("mDuracao").value=m.duration?fmt(m.duration):"";
  $("mLetra").value=letraDaMusica(m);
  $("mLinkYT").value=m.playback&&m.playback.tipo==="youtube"?"https://youtu.be/"+m.playback.id:"";
  $("mLinkSP").value=m.playback&&m.playback.tipo==="spotify"?"https://open.spotify.com/track/"+m.playback.id:"";
  $("mVideos").innerHTML="";
  trocarAbaPlayback(aba||(m.playback?m.playback.tipo:"youtube"));
  atualizarEditor();
  if(!$("dlgMusica").open)$("dlgMusica").showModal();
}
function atualizarEditor(){
  const m=acharMusica(ED.id);if(!m)return;
  const pb=m.playback;
  $("mPlaybackAtual").innerHTML=pb?`▶ <b>${esc(ROTULO_PLAYBACK[pb.tipo])}</b>: ${esc(pb.titulo||pb.id)}`:"Sem playback: a letra anda pelo relógio do aparelho.";
  $("mSemPlayback").hidden=!pb;
  const q={title:$("mTitulo").value,artist:$("mArtista").value};
  $("mProcurarYT").href=linkBuscaYouTube(q);
  $("mProcurarSP").href=linkBuscaSpotify(q);
  const texto=$("mLetra").value,info=lerLetra(texto);
  $("mLetraInfo").textContent=!info.linhas.length?"Sem letra ainda.":info.sincronizada?`✓ Letra sincronizada (${info.linhas.filter(l=>l.texto).length} versos).`:`Letra sem tempo (${info.linhas.length} versos). Grave a sincronia para o efeito de karaokê.`;
  const off=Number(m.offset)||0;
  $("mOffsetOut").textContent=off?`${off>0?"+":""}${off.toFixed(2).replace(".",",")} s`:"0 s";
}
function trocarAbaPlayback(aba){
  ED.aba=aba;
  document.querySelectorAll("#dlgMusica [data-pb]").forEach(b=>b.classList.toggle("ativa",b.dataset.pb===aba));
  $("pbYoutube").hidden=aba!=="youtube";$("pbSpotify").hidden=aba!=="spotify";$("pbArquivo").hidden=aba!=="arquivo";
}
// Grava título, artista, duração e letra do formulário. Devolve a música.
function salvarEditor(){
  const m=acharMusica(ED.id);if(!m)return null;
  const texto=$("mLetra").value;
  const campos={title:$("mTitulo").value,artist:$("mArtista").value,duration:parseClock($("mDuracao").value)||m.duration};
  if(temLRC(texto)){
    campos.synced=texto;
    if(!m.lyrics||temSincronia(m)&&m.synced!==texto)campos.lyrics=versosDaLetra(texto).map(v=>v.texto).join("\n");
  }else{campos.synced="";campos.lyrics=texto}
  return editarMusica(ED.id,campos);
}

/* ------------------------------------------------- adicionar à playlist */
const AF={musicaId:"",a:"",b:"",fixa:false};
function abrirAddFila(musicaId){
  const p=playlistAtiva();
  AF.musicaId=musicaId||"";AF.fixa=!!musicaId;
  AF.a=proximoCantor(K.dados.cantores,p?p.itens:[]);
  AF.b="";
  $("addDueto").checked=false;$("addCantoresB").hidden=true;
  $("addBusca").value="";
  $("addMusicaEscolha").hidden=AF.fixa;
  renderAddFila();
  $("dlgAddFila").showModal();
  if(!AF.fixa)setTimeout(()=>$("addBusca").focus(),50);
}
function renderAddFila(){
  const m=acharMusica(AF.musicaId);
  $("addMusicaEscolhida").hidden=!m;
  if(m)$("addMusicaEscolhida").innerHTML=`🎵 <b>${esc(m.title)}</b> ${esc(m.artist)}`;
  if(!AF.fixa){
    const lista=filtrarBiblioteca($("addBusca").value).slice(0,60);
    $("addMusicas").innerHTML=lista.map(x=>`<li><button type="button" data-escolher="${x.id}" class="${x.id===AF.musicaId?"escolhida":""}"><b>${esc(x.title)}</b> <small>${esc(x.artist)}</small></button></li>`).join("")||`<li class="vazio">Nenhuma música salva. Cadastre em <b>Músicas</b>.</li>`;
  }
  const chips=(sel,lado)=>K.dados.cantores.map(c=>`<button type="button" data-lado="${lado}" data-cantor="${c.id}" aria-pressed="${c.id===sel}" style="--cor:${c.cor}">${esc(c.emoji)} ${esc(c.nome)}</button>`).join("");
  $("addCantores").innerHTML=chips(AF.a,"a")+`<button type="button" data-lado="a" data-cantor="" aria-pressed="${!AF.a}">🎤 livre</button>`;
  $("addCantoresB").innerHTML=chips(AF.b,"b");
  if(!K.dados.cantores.length)$("addCantores").insertAdjacentHTML("beforeend",`<p class="dica">Dica: cadastre a família em <b>Família</b> para ter a vez de cada um.</p>`);
  $("addConfirmar").disabled=!m;
}

/* ------------------------------------------------------------- dueto */
const DU={linhas:[]};
function abrirDueto(){
  DU.linhas=lerLetra($("mLetra").value).linhas;
  if(!DU.linhas.some(l=>l.texto))return notify("Cole ou busque a letra antes de marcar o dueto.");
  renderDueto();
  $("dlgDueto").showModal();
}
function renderDueto(){
  $("duetoLinhas").innerHTML=DU.linhas.map((l,i)=>l.texto?`<li data-linha="${i}"><span class="texto">${esc(l.texto)}</span><span class="partes">${["A","B","T"].map(p=>`<button type="button" data-parte="${p}" aria-pressed="${l.parte===p}">${p==="T"?"Todos":p}</button>`).join("")}</span></li>`:"").join("");
}
