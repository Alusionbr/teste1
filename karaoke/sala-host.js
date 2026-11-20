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
    const a=P.aberto&&P.item?acharCantor(P.item.cantorA):null;
    return{
      v:1,
      playlist:p?p.nome:"",
      palco:P.aberto?P.modo:"",
      fase:P.aberto?P.fase:"",
      tocando,
      tempo:P.aberto&&P.fonte?Math.round(P.fonte.tempo()):0,
      duracao:P.aberto&&P.fonte?Math.round(P.fonte.duracao()||(P.musica&&P.musica.duration)||0):0,
      agora:P.aberto&&P.musica?{musicaId:P.musica.id,title:P.musica.title,artist:P.musica.artist,quem:P.modo==="festa"?rotuloCantores(P.item):"",cor:a?a.cor:"",offset:Number(P.musica.offset)||0,fonte:P.musica.playback?P.musica.playback.tipo:"relogio"}:null,
      indice:P.aberto&&P.modo==="festa"?P.indice:-1,
      fila:(p?p.itens:[]).map(i=>{const m=acharMusica(i.musicaId),c=acharCantor(i.cantorA);return m?{id:i.id,title:m.title,artist:m.artist,quem:rotuloCantores(i),cor:c?c.cor:""}:null}).filter(Boolean),
      musicas:[...K.dados.musicas].sort((x,y)=>fold(x.title).localeCompare(fold(y.title))).slice(0,500).map(m=>({id:m.id,title:m.title,artist:m.artist,letra:temSincronia(m)?2:temLetra(m)?1:0,pb:m.playback?m.playback.tipo:""})),
      cantores:K.dados.cantores.map(c=>({id:c.id,nome:c.nome,emoji:c.emoji,cor:c.cor})),
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

  /* ---------------------------------------------------------- comandos */
  const texto=(v,max)=>String(v??"").slice(0,max);
  // O código da sala é o convite: quem o tem pode pedir, mas não encher a tela.
  // Com aparelhos falsos o limite por minuto do servidor não basta (cada um tem o seu).
  const MAX_CANTORES=40,MAX_MUSICAS=600,MAX_FILA=200;
  // Devolve true quando mudou o dado (aí o ciclo salva).
  function aplicar(c){
    const d=c.dados||{},quem=texto(c.nome,24)||"Alguém";
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
        const m=acharMusica(d.musicaId);if(!m)return false;
        return enfileirar(m,d,quem);
      }
      case "pedir_nova":{
        const pb=d.playback&&normalizarPlayback(d.playback);
        if(!texto(d.title,160).trim())return false;
        if(pb&&pb.tipo==="arquivo")return false;
        let m=musicaParecida(d.title,d.artist);
        if(!m&&K.dados.musicas.length>=MAX_MUSICAS)return false;
        if(!m)m=criarMusica({title:d.title,artist:d.artist,duration:d.duration,synced:texto(d.synced,30000),lyrics:texto(d.lyrics,30000),playback:pb});
        else if(!m.playback&&pb)m=editarMusica(m.id,{playback:pb});
        return enfileirar(m,d,quem);
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
        const i=p.itens.findIndex(x=>x.id===d.itemId);
        const alvo=P.aberto&&P.modo==="festa"?P.indice+1:0;
        if(i<0||i<alvo)return false;
        const[x]=p.itens.splice(i,1);p.itens.splice(alvo,0,x);p.atualizadaEm=Date.now();
        return true;
      }
    }
    return false;
  }
  function enfileirar(m,d,quem){
    const p=playlistAlvo()||garantirPlaylist();
    if(p.itens.length>=MAX_FILA)return false;
    const a=acharCantor(d.cantorId)?d.cantorId:"";
    const b=acharCantor(d.cantorB)?d.cantorB:"";
    adicionarItem(p,m.id,a,b);
    notify(`🎤 ${quem} pediu “${m.title}”${a?` para ${nomeCantor(a)}`:""}.`,true);
    return true;
  }

  /* --------------------------------------------------------------- tela */
  function link(){return sala?linkControle(sala.codigo):""}
  function renderDialogo(){
    $("salaFechada").hidden=!!sala;$("salaAberta").hidden=!sala;
    $("btnSala").textContent=sala?`📱 Sala ${sala.codigo}`:"📱 Controle pelo celular";
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
  return{abrir,retomar,fechar,mudou,renderDialogo,link,aplicar,montarEstado,get sala(){return sala}};
})();
