"use strict";
/*
 * Tela da festa (TV, projetor ou computador): abre a sala, publica o que está
 * tocando e aplica os comandos que chegam dos celulares.
 *
 * O celular nunca mexe direto no dado: ele PEDE (comando) e esta tela decide.
 * Assim a playlist e as letras continuam morando só neste aparelho, e um
 * celular sem internet não deixa nada pela metade.
 *
 * O código e o token da sala ficam no localStorage desta tela para a sala
 * sobreviver a um recarregar de página no meio da festa.
 */
const SalaHost=(()=>{
  const CHAVE="karaoke:sala",INTERVALO=1500,BATIMENTO=10000;
  let sala=null,timer=0,ocupado=false,ultimoTxt="",ultimoEnvio=0,aparelhos=0,falhas=0,notaRecente=null;

  function ler(){try{const s=JSON.parse(localStorage.getItem(CHAVE)||"null");return s&&/^[A-Z0-9]{6,12}$/.test(s.codigo)&&/^[a-f0-9]{32,64}$/.test(s.token)?s:null}catch{return null}}
  function gravar(){try{sala?localStorage.setItem(CHAVE,JSON.stringify(sala)):localStorage.removeItem(CHAVE)}catch{}}

  async function abrir(){
    let ultimoErro;
    for(let tentativa=0;tentativa<4;tentativa++){
      const nova={codigo:novoCodigoSala(),token:novoTokenSala(),depois:0};
      try{await salaRpc("karaoke_sala_abrir",{p_codigo:nova.codigo,p_token:nova.token});sala=nova;gravar();break}
      catch(e){ultimoErro=e;if(!/em uso/.test(e.message))break}
    }
    if(!sala){notify(ultimoErro?ultimoErro.message:"Não consegui abrir a sala.");return}
    ultimoTxt="";iniciar();renderDialogo();
    notify("Sala aberta! Leia o QR code com os celulares.",true);
  }
  // Ao recarregar a página: volta para a mesma sala, se ela ainda existir.
  async function retomar(){
    const s=ler();if(!s)return;
    try{await salaRpc("karaoke_sala_abrir",{p_codigo:s.codigo,p_token:s.token});sala=s;ultimoTxt="";iniciar();renderDialogo()}
    catch(e){if(e.status&&e.status<500){sala=null;gravar()}}
  }
  async function fechar(){
    const s=sala;parar();sala=null;gravar();renderDialogo();
    if(s)try{await salaRpc("karaoke_sala_fechar",{p_codigo:s.codigo,p_token:s.token})}catch{}
    notify("Sala fechada.",true);
  }
  function iniciar(){clearInterval(timer);timer=setInterval(ciclo,INTERVALO);ciclo()}
  function parar(){clearInterval(timer);timer=0}
  function mudou(extra){if(extra&&extra.nota!=null)notaRecente={nota:extra.nota,em:Date.now()};ultimoTxt=""}

  /* ------------------------------------------------------------ estado */
  function playlistAlvo(){return P.aberto&&P.modo==="festa"?acharPlaylist(P.playlistId):playlistAtiva()}
  function montarEstado(){
    const p=playlistAlvo();
    const tocando=!!(P.aberto&&P.fonte&&P.fonte.tocando());
    const a=P.aberto&&P.item&&!P.solo?acharCantor(P.item.cantorA):null;
    return{
      v:1,
      playlist:p?p.nome:"",
      palco:P.aberto?P.modo:"",
      fase:P.aberto?P.fase:"",
      tocando,
      tempo:P.aberto&&P.fonte?Math.round(P.fonte.tempo()):0,
      duracao:P.aberto&&P.fonte?Math.round(P.fonte.duracao()||(P.musica&&P.musica.duration)||0):0,
      agora:P.aberto&&P.musica?{musicaId:P.musica.id,title:P.musica.title,artist:P.musica.artist,quem:P.modo==="festa"||P.modo==="solo"?rotuloPalco(P.item):"",donos:donosDaMusica().map(c=>c.nome),cor:a?a.cor:"",offset:Number(P.musica.offset)||0,fonte:P.musica.playback?P.musica.playback.tipo:"relogio"}:null,
      indice:P.aberto&&P.modo==="festa"?P.indice:-1,
      fila:(p?p.itens:[]).map(i=>{const m=acharMusica(i.musicaId),c=acharCantor(i.cantorA);return m?{id:i.id,title:m.title,artist:m.artist,quem:rotuloCantores(i),cantores:[i.cantorA,i.cantorB].filter(Boolean),cor:c?c.cor:""}:null}).filter(Boolean),
      musicas:[...K.dados.musicas].sort((x,y)=>fold(x.title).localeCompare(fold(y.title))).slice(0,500).map(m=>({id:m.id,title:m.title,artist:m.artist,letra:temSincronia(m)?2:temLetra(m)?1:0,pb:m.playback?m.playback.tipo:""})),
      cantores:K.dados.cantores.map(c=>({id:c.id,nome:c.nome,emoji:c.emoji,cor:c.cor})),
      fundo:fundoEfetivo(),
      trava:travaLigada(),
      erro:P.aberto&&!$("palcoErro").hidden?texto($("erroTexto").textContent,160):"",
      nota:notaRecente&&Date.now()-notaRecente.em<60000?notaRecente.nota:null
    };
  }

  async function ciclo(){
    if(!sala||ocupado)return;
    ocupado=true;
    try{
      const estado=montarEstado();
      const{tempo,...semTempo}=estado;
      const txt=JSON.stringify(semTempo);
      const enviar=txt!==ultimoTxt||Date.now()-ultimoEnvio>BATIMENTO;
      const r=await salaRpc("karaoke_host_sync",{p_codigo:sala.codigo,p_token:sala.token,p_estado:enviar?{...estado,em:Date.now()}:null,p_depois:sala.depois||0});
      if(enviar){ultimoTxt=txt;ultimoEnvio=Date.now()}
      falhas=0;
      aparelhos=Number(r&&r.aparelhos)||0;
      const comandos=(r&&r.comandos)||[];
      if(comandos.length){
        sala.depois=comandos[comandos.length-1].id;gravar();
        let mexeu=false;
        for(const c of comandos){try{if(aplicar(c))mexeu=true}catch(e){console.error(e)}}
        if(mexeu){await salvarEstado();if(P.aberto&&P.musica)desenharCabecalho()}
      }
      atualizarSelo();
    }catch(e){
      falhas++;
      if(/chave da sala|token/.test(e.message)){parar();sala=null;gravar();renderDialogo();notify(e.message)}
      else if(falhas===4)notify("A sala está sem internet. Os celulares voltam a funcionar quando a conexão voltar.");
      atualizarSelo();
    }finally{ocupado=false}
  }

  /* ------------------------------------------------------------- trava */
  // Quem canta agora (o dono da vez). Sem cantor marcado na música, ninguém é dono
  // e qualquer celular pode mexer. O nome vem do celular: serve para uma festa de
  // família, não é segurança (quem usar o nome de outro passa pela trava).
  function donosDaMusica(){
    if(!P.aberto||P.modo!=="festa"||P.solo||!P.item)return[];
    return[P.item.cantorA,P.item.cantorB].filter(Boolean).map(acharCantor).filter(Boolean);
  }
  const travaLigada=()=>prefs().trava!==false;
  // Travada só enquanto a música toca (fase "cantando"): na vez, nos aplausos e no fim
  // qualquer um pode começar, pular a vez ou seguir. A tela/teclado nunca é travada.
  function bloqueadoPara(nome){
    if(!travaLigada()||!P.aberto||P.fase!=="cantando")return false;
    const donos=donosDaMusica();
    return donos.length>0&&!donos.some(c=>fold(c.nome)===fold(nome));
  }
  const MEXE_NA_MUSICA=new Set(["alternar","proxima","anterior","adiantar","atrasar","volume","tocar_item"]);
  const mexeNaMusica=(tipo,d)=>MEXE_NA_MUSICA.has(tipo)||(tipo==="pedir"&&(d.modo==="letra"||d.modo==="agora"));

  /* ---------------------------------------------------------- comandos */
  const texto=(v,max)=>String(v??"").slice(0,max);
  // O código da sala é o convite: quem o tem pode pedir, mas não encher a tela.
  // Com aparelhos falsos o limite por minuto do servidor não basta (cada um tem o seu).
  const MAX_CANTORES=40,MAX_MUSICAS=600,MAX_FILA=200;
  // Devolve true quando mudou o dado (aí o ciclo salva).
  function aplicar(c){
    const d=c.dados||{},quem=texto(c.nome,24)||"Alguém";
    if(mexeNaMusica(c.tipo,d)&&bloqueadoPara(quem)){
      notify(`🔒 ${quem} tentou mexer na música, mas ${donosDaMusica().map(x=>x.nome).join(" e ")} está cantando.`);
      return false;
    }
    switch(c.tipo){
      case "alternar":case "proxima":case "anterior":case "adiantar":case "atrasar":case "volume":case "aplausos":
        comandoPalco(c.tipo,d);return false;
      case "comecar":{
        if(P.aberto){comandoPalco("comecar");return false}
        const p=playlistAtiva();
        if(p&&p.itens.length){abrirPalco({playlistId:p.id,indice:0})}
        return false;
      }
      case "entrar":{
        const nome=texto(d.nome,24).trim();if(!nome)return false;
        if(K.dados.cantores.some(x=>fold(x.nome)===fold(nome))||K.dados.cantores.length>=MAX_CANTORES)return false;
        const novo=criarCantor({nome,emoji:EMOJIS_CANTOR.includes(d.emoji)?d.emoji:"🎤",cor:CORES_CANTOR.includes(d.cor)?d.cor:undefined});
        notify(`${novo.emoji} ${novo.nome} entrou na festa!`,true);
        return true;
      }
      case "pedir":{
        // dados.modo: "fila" (padrão, celular antigo), "seguir", "agora" ou "playback"
        // (só troca o playback, sem pedir). dados.playback opcional: youtube/spotify.
        // Liga/desliga a letra do app por cima do vídeo (não é pedido de música).
        if(d.modo==="letra"){alternarLetra();return true}
        const m=acharMusica(d.musicaId);if(!m)return false;
        const modo=["fila","seguir","agora","playback"].includes(d.modo)?d.modo:"fila";
        let mudou=false;
        if(d.playback!=null){
          const r=trocarPlayback(m,d.playback,quem);
          if(modo==="playback")return r==="mudou";
          mudou=r==="mudou";
        }
        if(modo==="playback")return false;
        const item=enfileirar(m,d,quem);
        if(!item)return mudou;
        if(modo==="fila")return true;
        const p=playlistAlvo();
        // "Tocar agora" só interrompe a tela nas listas ou no palco da festa: gravando
        // sincronia, ensaiando ou cantando uma música avulsa, entra no fim da fila.
        if(modo==="agora"&&P.aberto&&P.modo!=="festa"){notify(`🎤 ${quem} pediu “${m.title}”, mas a tela está ocupada: entrou no fim da fila.`,true);return true}
        const alvo=paraSeguir(p,item.id);
        if(alvo<0)return true;
        if(modo==="agora"){
          if(P.aberto)carregarIndice(alvo);else abrirPalco({playlistId:p.id,indice:alvo});
          notify(`🎤 ${quem} mandou tocar “${m.title}” agora.`,true);
        }else notify(`🎤 ${quem} pôs “${m.title}” para tocar a seguir.`,true);
        return true;
      }
      case "pedir_nova":{
        const pb=d.playback&&normalizarPlayback(d.playback);
        if(!texto(d.title,160).trim())return false;
        if(pb&&pb.tipo==="arquivo")return false;
        let m=musicaParecida(d.title,d.artist);
        if(!m&&K.dados.musicas.length>=MAX_MUSICAS)return false;
        if(!m)m=criarMusica({title:d.title,artist:d.artist,duration:d.duration,synced:texto(d.synced,30000),lyrics:texto(d.lyrics,30000),playback:pb});
        else if(pb&&(!m.playback||m.playback.id!==pb.id))m=editarMusica(m.id,{playback:pb});
        else if(pb)compartilharPlayback(m);
        const item=enfileirar(m,d,quem);
        if(item&&!temLetra(m))completarLetra(m.id);   // a fila não espera a rede
        return !!item;
      }
      case "tocar_item":{
        const p=playlistAlvo();if(!p)return false;
        const i=p.itens.findIndex(x=>x.id===d.itemId);if(i<0)return false;
        if(P.aberto&&P.modo==="festa")carregarIndice(i);else abrirPalco({playlistId:p.id,indice:i});
        return false;
      }
      case "tirar_item":{
        const p=playlistAlvo();if(!p)return false;
        const i=p.itens.findIndex(x=>x.id===d.itemId);if(i<0)return false;
        if(P.aberto&&P.modo==="festa"){if(i===P.indice)return false;if(i<P.indice)P.indice--}
        removerItem(p,d.itemId);return true;
      }
      case "subir_item":{ // "tocar a seguir"
        const p=playlistAlvo();if(!p)return false;
        return paraSeguir(p,d.itemId)>=0;
      }
    }
    return false;
  }
  // Põe o item logo depois da música atual (ou no começo, com a tela nas listas).
  // Devolve a posição nova, ou -1 se o item não existe ou já passou. A mesma
  // lista é mexida no lugar (splice): o palco aponta para o mesmo array.
  function paraSeguir(p,itemId){
    const i=p.itens.findIndex(x=>x.id===itemId);
    const alvo=P.aberto&&P.modo==="festa"?P.indice+1:0;
    if(i<0||i<alvo)return -1;
    const[x]=p.itens.splice(i,1);p.itens.splice(alvo,0,x);p.atualizadaEm=Date.now();
    return alvo;
  }
  // Devolve o item criado (ou null quando a fila está cheia).
  function enfileirar(m,d,quem){
    const p=playlistAlvo()||garantirPlaylist();
    if(p.itens.length>=MAX_FILA)return null;
    const a=acharCantor(d.cantorId)?d.cantorId:"";
    const b=acharCantor(d.cantorB)?d.cantorB:"";
    const item=adicionarItem(p,m.id,a,b);
    notify(`🎤 ${quem} pediu “${m.title}”${a?` para ${nomeCantor(a)}`:""}.`,true);
    return item;
  }
  // Música pedida pelo celular costuma vir só com o vídeo: a tela procura a letra do app
  // depois, uma música por vez, sem travar nada. Falha = fica só com o vídeo.
  let buscaDeLetra=Promise.resolve();
  function completarLetra(id){
    buscaDeLetra=buscaDeLetra.then(async()=>{
      const m=acharMusica(id);if(!m||temLetra(m))return;
      const x=await procurarLetraDaLinha(m.title,m.artist);
      const atual=acharMusica(id);if(!x||!atual||temLetra(atual))return;
      editarMusica(id,{synced:x.synced,lyrics:x.lyrics,duration:atual.duration||x.duration,...(!atual.artist&&x.artist?{artist:x.artist}:{})});
      await salvarEstado();
      if(typeof renderTudo==="function")renderTudo();
    }).catch(()=>{});
  }
  // Celular põe ou troca o playback (YouTube/Spotify). Arquivo é só da tela: o áudio
  // mora neste aparelho e um toque no celular o desligaria da música.
  // Devolve "mudou", "igual" ou "recusado".
  function trocarPlayback(m,bruto,quem){
    const pb=normalizarPlayback(bruto);
    if(!pb||pb.tipo==="arquivo")return "recusado";
    if(m.playback&&m.playback.tipo==="arquivo"){notify(`🎧 ${quem} tentou trocar o playback de “${m.title}”, mas ele é um arquivo guardado nesta tela.`);return "recusado"}
    if(m.playback&&m.playback.tipo===pb.tipo&&m.playback.id===pb.id)return "igual";
    editarMusica(m.id,{playback:pb});
    notify(`🎧 ${quem} trocou o playback de “${m.title}” para ${pb.tipo==="spotify"?"Spotify":"YouTube"}.`,true);
    // A música que travou (erro) ou que ainda está na contagem recomeça com o playback novo.
    if(P.aberto&&P.musica&&P.musica.id===m.id&&P.modo!=="gravar"&&(!$("palcoErro").hidden||P.fase==="vez")){
      carregarIndice(P.indice,{comecarJa:P.fase!=="vez"});
    }
    return "mudou";
  }

  /* --------------------------------------------------------------- tela */
  function link(){return sala?linkControle(sala.codigo):""}
  function renderDialogo(){
    $("salaFechada").hidden=!!sala;$("salaAberta").hidden=!sala;
    $("btnSala").textContent=sala?`📱 Sala ${sala.codigo}`:"📱 Controle remoto";
    $("btnSala").classList.toggle("ativa",!!sala);
    if(sala){
      $("salaCodigo").textContent=sala.codigo;
      $("salaLink").textContent=link();
      try{QR.desenhar($("salaQR"),link())}catch(e){console.error(e)}
    }
    atualizarSelo();
  }
  function atualizarSelo(){
    const selo=$("palcoSala");
    selo.hidden=!sala;
    if(sala)selo.textContent=`📱 ${sala.codigo}${aparelhos?` · ${aparelhos} celular${aparelhos>1?"es":""}`:""}${falhas>=3?" · sem internet":""}`;
    if(sala&&$("dlgSala").open)$("salaStatus").textContent=falhas>=3?"⚠️ Sem conexão com a sala.":aparelhos?`✅ ${aparelhos} celular${aparelhos>1?"es":""} conectado${aparelhos>1?"s":""}.`:"Esperando os celulares…";
  }
  return{abrir,retomar,fechar,mudou,renderDialogo,link,aplicar,montarEstado,bloqueadoPara,get sala(){return sala}};
})();
