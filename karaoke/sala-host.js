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
  const CONVITE_MS=5*60*1000;
  let convite=null;   // {segredo, expira}: transferência iniciada por ESTA tela (QR/link)
  let sala=null,timer=0,ocupado=false,ultimoTxt="",ultimoEnvio=0,aparelhos=0,falhas=0,notaRecente=null,transferenciaPendente=null,transferenciaStatus=null,transferindo=false;

  const pausa=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const b64url={
    codificar(bytes){let s="";bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")},
    decodificar(s){const b=atob(s.replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0))}
  };
  async function transformar(bytes,Stream){return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream("deflate-raw"))).arrayBuffer())}
  async function cifrarPacote(pacote,chaveTexto){
    let bytes=new TextEncoder().encode(JSON.stringify(pacote)),formato="json";
    if(typeof CompressionStream==="function")try{bytes=await transformar(bytes,CompressionStream);formato="deflate-raw"}catch{}
    const iv=crypto.getRandomValues(new Uint8Array(12)),chave=await crypto.subtle.importKey("raw",b64url.decodificar(chaveTexto),"AES-GCM",false,["encrypt"]);
    const cifrado=await crypto.subtle.encrypt({name:"AES-GCM",iv},chave,bytes);
    return{v:1,formato,iv:b64url.codificar(iv),dados:b64url.codificar(new Uint8Array(cifrado))};
  }
  async function decifrarPacote(envelope,chaveTexto){
    if(!envelope||envelope.v!==1)throw Error("A transferência da sala está inválida.");
    const chave=await crypto.subtle.importKey("raw",b64url.decodificar(chaveTexto),"AES-GCM",false,["decrypt"]);
    let bytes=new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:b64url.decodificar(envelope.iv)},chave,b64url.decodificar(envelope.dados)));
    if(envelope.formato==="deflate-raw")bytes=await transformar(bytes,DecompressionStream);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function ler(){try{const s=JSON.parse(localStorage.getItem(CHAVE)||"null");return s&&/^[A-Z0-9]{6,12}$/.test(s.codigo)&&/^[a-f0-9]{32,64}$/.test(s.token)?s:null}catch{return null}}
  function gravar(){try{sala?localStorage.setItem(CHAVE,JSON.stringify(sala)):localStorage.removeItem(CHAVE)}catch{}}

  async function solicitarTransferencia(entrada){
    // Aceita o código, o código com convite (ABC123.xxxx) ou o link inteiro.
    const lido=lerLinkAssumir(entrada)||{codigo:String(entrada||"").trim().toUpperCase(),convite:""};
    const codigo=lido.codigo,conviteRecebido=lido.convite;
    if(!/^[A-Z0-9]{6,12}$/.test(codigo))throw Error("Digite o código da sala (6 a 12 letras ou números).");
    if(sala&&sala.codigo===codigo)throw Error("Este aparelho já é a tela principal desta sala.");
    const id=novoTokenSala().slice(0,20),token=novoTokenSala(),chave=b64url.codificar(crypto.getRandomValues(new Uint8Array(32)));
    const device=idDoAparelho();
    await salaRpc("karaoke_comando",{p_codigo:codigo,p_device:device,p_nome:"Projetor",p_tipo:"entrar",p_dados:{transferir:{id,token,chave,device,...(conviteRecebido?{convite:conviteRecebido}:{})}}});
    $("salaAssumirStatus").textContent=conviteRecebido?"Convite enviado. A troca acontece sozinha…":"Pedido enviado. Aprove a troca na tela principal atual.";
    $("salaAssumir").disabled=true;
    const limite=Date.now()+120000;
    try{
      while(Date.now()<limite){
        await pausa(1200);
        const r=await salaRpc("karaoke_sala_ver",{p_codigo:codigo,p_device:device,p_nome:"Projetor",p_versao:-1});
        if(!r.existe)throw Error("A sala foi fechada antes da transferência.");
        const estado=r.estado||{};
        if(estado.transferenciaStatus?.id===id&&estado.transferenciaStatus.status==="recusada")throw Error("A tela principal recusou a transferência.");
        const h=estado.transferencia;
        if(!h||h.id!==id)continue;
        const pacote=await decifrarPacote(h.envelope,chave);
        if(pacote?.v!==1||!pacote.playlist)throw Error("Não consegui abrir os dados da sala.");
        const nova=importarPacote(pacote.playlist);
        if(!nova||!nova.itens.length)throw Error("A sala não tem músicas na fila para transferir.");
        if(pacote.prefs)K.dados.prefs={...K.dados.prefs,...pacote.prefs,keyYT:K.dados.prefs.keyYT||""};
        K.dados.activePlaylistId=nova.id;
        await salvarEstado();
        await salaRpc("karaoke_sala_abrir",{p_codigo:codigo,p_token:token});
        sala={codigo,token,depois:Number(h.depois)||0};gravar();transferenciaStatus=null;iniciar();renderDialogo();if($("dlgSala").open)$("dlgSala").close();
        $("salaAssumirStatus").textContent="Sala transferida para este aparelho.";
        if(pacote.palco?.aberto&&pacote.palco.modo==="festa"){
          abrirPalco({playlistId:nova.id,indice:clamp(Number(pacote.palco.indice)||0,0,nova.itens.length-1)});
          clearInterval(P.contagemTimer);P.contagemTimer=0;
          P.carregando.then(()=>{if(P.aberto&&P.musica&&P.fonte){if(pacote.palco.tempo>0)P.fonte.buscar(pacote.palco.tempo);P.fase="vez";$("vezContagem").textContent="▶";}});
        }
        notify("Sala transferida. Toque na tela para continuar a música.",true);
        return true;
      }
      throw Error("A tela atual não respondeu. A sala continua no aparelho anterior.");
    }finally{$("salaAssumir").disabled=false}
  }

  async function aceitarTransferencia(){
    const pedido=transferenciaPendente,s=sala;
    if(!pedido||!s||transferindo)return;
    if(Date.now()>pedido.expira){transferenciaPendente=null;renderDialogo();return notify("O pedido de transferência expirou. Peça novamente.")}
    transferindo=true;$("salaTransferirAceitar").disabled=true;$("salaTransferenciaStatus").textContent="Preparando a sala…";
    try{
      const p=playlistAlvo()||playlistAtiva();
      if(!p||!p.itens.length)throw Error("Adicione uma música à fila antes de transferir a sala.");
      const pacote={v:1,playlist:pacotePlaylist(p,true),prefs:{...K.dados.prefs,keyYT:""},palco:P.aberto&&P.modo==="festa"?{aberto:true,modo:"festa",indice:P.indice,tempo:Math.max(0,Math.floor(P.fonte?.tempo?.()||0))}:null};
      const envelope=await cifrarPacote(pacote,pedido.chave);
      const estado={...montarEstado(),transferencia:{id:pedido.id,depois:Number(s.depois)||0,envelope}};
      if(new TextEncoder().encode(JSON.stringify(estado)).length>195000)throw Error("A fila tem letras demais para transferir de uma vez. Reduza a fila e tente de novo.");
      await salaRpc("karaoke_sala_transferir",{p_codigo:s.codigo,p_token_atual:s.token,p_token_novo:pedido.token,p_estado:estado});
      parar();sala=null;gravar();transferenciaPendente=null;transferenciaStatus=null;transferindo=false;
      $("salaTransferirAceitar").disabled=false;   // senão o botão fica morto na próxima transferência desta tela
      const codigoAntigo=s.codigo;
      fecharPalco();renderDialogo();if($("dlgSala").open)$("dlgSala").close();
      notify("A sala agora está no novo aparelho.",true,{label:"Abrir como controle",run:()=>{location.href=linkControle(codigoAntigo)}});
    }catch(e){transferindo=false;$("salaTransferirAceitar").disabled=false;$("salaTransferenciaStatus").textContent=e.message;notify(e.message)}
  }
  // Convite de transferência iniciado por esta tela: QR + link para o aparelho novo abrir.
  function criarConvite(){
    if(!sala)throw Error("Abra a sala primeiro.");
    convite={segredo:novoTokenSala().slice(0,24),expira:Date.now()+CONVITE_MS};
    return{link:linkAssumir(sala.codigo,convite.segredo),expira:convite.expira};
  }
  function cancelarConvite(){convite=null}
  function recusarTransferencia(){
    if(!transferenciaPendente)return;
    transferenciaStatus={id:transferenciaPendente.id,status:"recusada"};transferenciaPendente=null;ultimoTxt="";renderDialogo();notify("Pedido de transferência recusado.",true);
  }

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
      permissoes:prefs().permissoes,
      pularFila:prefs().permissoes.acoes.fila!=="anfitriao"&&prefs().permissoes.acoes.pular!=="anfitriao",   // celulares antigos
      erro:P.aberto&&!$("palcoErro").hidden?texto($("erroTexto").textContent,160):"",
      nota:notaRecente&&Date.now()-notaRecente.em<60000?notaRecente.nota:null,
      ...(transferenciaStatus?{transferenciaStatus}: {})
    };
  }

  async function ciclo(){
    if(!sala||ocupado)return;
    if(transferenciaPendente&&Date.now()>transferenciaPendente.expira){transferenciaStatus={id:transferenciaPendente.id,status:"recusada"};transferenciaPendente=null;ultimoTxt="";renderDialogo()}
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

  function donosDaMusica(){
    if(!P.aberto||P.modo!=="festa"||P.solo||!P.item)return[];
    return[P.item.cantorA,P.item.cantorB].filter(Boolean).map(acharCantor).filter(Boolean);
  }

  // Quem está na sala: nomes vistos nos comandos (o painel do anfitrião lista e permite bloquear).
  const vistos=new Map(),ultimaRecusa=new Map();
  function registrarNome(nome){if(nome&&nome!=="Alguém"){vistos.set(nome,Date.now());if(vistos.size>60){const velho=[...vistos.entries()].sort((a,b)=>a[1]-b[1])[0];vistos.delete(velho[0])}}}
  function avisarRecusa(quem,acao){
    const k=chaveDoNome(quem)+"|"+acao,agora=Date.now();
    if(agora-(ultimaRecusa.get(k)||0)<60000)return;
    ultimaRecusa.set(k,agora);
    notify(`🔒 ${quem} tentou ${TEXTO_ACAO[acao]||"mexer"}, mas não está liberado. ${estaBloqueado(prefs().permissoes,quem)?"(aparelho silenciado)":""}`.trim());
  }

  /* ---------------------------------------------------------- comandos */
  const texto=(v,max)=>String(v??"").slice(0,max);
  // O código da sala é o convite: quem o tem pode pedir, mas não encher a tela.
  // Com aparelhos falsos o limite por minuto do servidor não basta (cada um tem o seu).
  const MAX_CANTORES=40,MAX_MUSICAS=600,MAX_FILA=200;
  // Devolve true quando mudou o dado (aí o ciclo salva).
  function aplicar(c){
    const d=c.dados||{},quem=texto(c.nome,24)||"Alguém";
    registrarNome(quem);
    // Permissões do anfitrião: quem decide é esta tela, nunca o celular.
    const acao=acaoDoComando(c.tipo,d,{fase:P.fase});
    if(!d.transferir&&!podeFazer(prefs().permissoes,acao,{nome:quem,donos:donosDaMusica().map(x=>x.nome)})){avisarRecusa(quem,acao||"pedir");return false}
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
        if(d.transferir&&typeof d.transferir==="object"){
          const t=d.transferir;
          if(transferenciaPendente||!/^[a-f0-9]{20}$/.test(t.id||"")||!/^[a-f0-9]{32,64}$/.test(t.token||"")||!/^[A-Za-z0-9_-]{43}$/.test(t.chave||"")||!sala)return false;
          transferenciaPendente={id:t.id,token:t.token,chave:t.chave,device:t.device,nome:quem,expira:Date.now()+90000};
          transferenciaStatus={id:t.id,status:"solicitada"};ultimoTxt="";$("salaTransferirAceitar").disabled=false;renderDialogo();
          // Convite desta tela (QR/link): é a aprovação, vale uma vez e por 5 min. Errado ou vencido: cai no fluxo manual.
          if(convite&&typeof t.convite==="string"&&t.convite===convite.segredo&&Date.now()<convite.expira){
            convite=null;
            notify(`${quem} abriu o convite: transferindo a sala…`,true);
            setTimeout(()=>aceitarTransferencia(),0);
            return false;
          }
          notify(`${quem} pediu para tornar este aparelho a tela principal. Abra Controle remoto para aprovar.`,true);
          return false;
        }
        const nome=texto(d.nome,24).trim();if(!nome)return false;
        if(K.dados.cantores.some(x=>fold(x.nome)===fold(nome))||K.dados.cantores.length>=MAX_CANTORES)return false;
        const novo=criarCantor({nome,emoji:EMOJIS_CANTOR.includes(d.emoji)?d.emoji:"🎤",cor:CORES_CANTOR.includes(d.cor)?d.cor:undefined});
        notify(`${novo.emoji} ${novo.nome} entrou na festa!`,true);
        return true;
      }
      case "pedir":{
        if(d.modo==="letra"){alternarLetra();return true}
        if(d.modo==="editar")return false;   // edição pelo celular: ainda não existe (1.0.20)
        const m=acharMusica(d.musicaId);if(!m)return false;
        if(d.modo==="playback")return trocarPlayback(m,d.playback,quem)==="mudou";
        // Pedidos de versões antigas também entram no fim, inclusive os modos "agora" e "seguir".
        const pb=normalizarPlayback(d.playback);
        let musica=m;
        if(pb&&pb.tipo!=="arquivo"){
          if(!m.playback)musica=editarMusica(m.id,{playback:pb});
          else compartilharPlayback({...m,playback:pb});
        }
        return !!enfileirar(musica,d,quem)||musica!==m;
      }
      case "pedir_nova":{
        const pb=d.playback&&normalizarPlayback(d.playback);
        if(!texto(d.title,160).trim())return false;
        if(pb&&pb.tipo==="arquivo")return false;
        let m=musicaParecida(d.title,d.artist);
        if(!m&&K.dados.musicas.length>=MAX_MUSICAS)return false;
        if(!m)m=criarMusica({title:d.title,artist:d.artist,duration:d.duration,synced:texto(d.synced,30000),lyrics:texto(d.lyrics,30000),playback:pb});
        else if(pb&&!m.playback)m=editarMusica(m.id,{playback:pb});
        else if(pb)compartilharPlayback({...m,playback:pb});
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
      // Sincronia de outra gravação sairia fora do tempo: confere com a duração do vídeo.
      const aj=ajustarLetraAoVideo(x,atual.playback&&atual.playback.duracao||0);
      if(!aj)return;
      editarMusica(id,{synced:aj.synced,lyrics:aj.lyrics,duration:atual.duration||x.duration,...(!atual.artist&&x.artist?{artist:x.artist}:{})});
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
    const estavaSemPlayback=!m.playback;
    editarMusica(m.id,{playback:pb});
    notify(`🎧 ${quem} trocou o playback de “${m.title}” para ${pb.tipo==="spotify"?"Spotify":"YouTube"}.`,true);
    // A música que travou (erro) ou que ainda está na contagem recomeça com o playback novo.
    if(P.aberto&&P.musica&&P.musica.id===m.id&&(P.fase==="vez"||
      (P.fase==="cantando"&&(estavaSemPlayback||!$("palcoErro").hidden)))){
      carregarIndice(P.indice,{comecarJa:P.fase!=="vez"});
    }
    return "mudou";
  }

  /* --------------------------------------------------------------- tela */
  function link(){return sala?linkControle(sala.codigo):""}
  function renderDialogo(){
    $("salaFechada").hidden=!!sala;$("salaAberta").hidden=!sala;
    $("btnSala").textContent=sala?(transferenciaPendente?"📱 Aprovar troca de tela":`📱 Sala ${sala.codigo}`):"📱 Controle remoto";
    $("btnSala").classList.toggle("ativa",!!sala);
    if(sala){
      $("salaCodigo").textContent=sala.codigo;
      $("salaLink").textContent=link();
      try{QR.desenhar($("salaQR"),link())}catch(e){console.error(e)}
    }
    renderPermissoes();
    $("salaTransferenciaPendente").hidden=!transferenciaPendente;
    if(transferenciaPendente){$("salaTransferenciaPedido").textContent=`${transferenciaPendente.nome} quer usar outro aparelho como tela principal.`;$("salaTransferenciaStatus").textContent="A fila e a música atual serão transferidas; a tela nova pedirá um toque para continuar."}
    $("salaAssumirArea").hidden=!!sala;
    if(sala)$("salaAssumirStatus").textContent="";
    atualizarSelo();
  }
  function renderPermissoes(){
    const p=prefs().permissoes;
    $("permNivel").value=p.nivel;
    const opcoes=[["todos","Todos"],["cantor","Só quem canta"],["anfitriao","Só o anfitrião"]];
    const html=ACOES_SALA.map(a=>`<label class="permLinha"><span>${esc(ROTULO_ACAO[a])}</span><select data-perm-acao="${a}">${opcoes.map(([v,t])=>`<option value="${v}"${p.acoes[a]===v?" selected":""}>${t}</option>`).join("")}</select></label>`).join("");
    if($("permAcoes").dataset.html!==html){$("permAcoes").innerHTML=html;$("permAcoes").dataset.html=html}
    const nomes=new Map();
    for(const n of vistos.keys())nomes.set(chaveDoNome(n),n);
    for(const c of K.dados.cantores)if(!nomes.has(chaveDoNome(c.nome)))nomes.set(chaveDoNome(c.nome),c.nome);
    for(const b of p.bloqueados)if(!nomes.has(chaveDoNome(b)))nomes.set(chaveDoNome(b),b);
    const lista=[...nomes.values()].map(n=>{const bl=estaBloqueado(p,n);return `<li><span>${bl?"🔇 ":""}${esc(n)}</span><button type="button" data-bloquear="${bl?0:1}" data-nome="${esc(n)}">${bl?"Liberar":"Silenciar"}</button></li>`}).join("");
    const pessoas=$("permPessoas"),htmlP=lista||`<li class="vazio">Ninguém mexeu ainda. Quem entrar ou pedir música aparece aqui.</li>`;
    if(pessoas.dataset.html!==htmlP){pessoas.innerHTML=htmlP;pessoas.dataset.html=htmlP}
  }
  function atualizarSelo(){
    const selo=$("palcoSala");
    selo.hidden=!sala;
    if(sala)selo.textContent=`📱 ${sala.codigo}${aparelhos?` · ${aparelhos} celular${aparelhos>1?"es":""}`:""}${falhas>=3?" · sem internet":""}`;
    if(sala&&$("dlgSala").open)renderPermissoes();
    if(sala&&$("dlgSala").open)$("salaStatus").textContent=falhas>=3?"⚠️ Sem conexão com a sala.":aparelhos?`✅ ${aparelhos} celular${aparelhos>1?"es":""} conectado${aparelhos>1?"s":""}.`:"Esperando os celulares…";
  }
  return{criarConvite,cancelarConvite,abrir,retomar,fechar,mudou,renderDialogo,link,aplicar,montarEstado,solicitarTransferencia,aceitarTransferencia,recusarTransferencia,get sala(){return sala}};
})();
