"use strict";
(function(root){
  let client=null,session=null,epoch=0,switching=false,syncing=false,again=false,ready=false,conflict=null,timer=null,mode="login",admin=false,adminTimer=null,meta={},hasLocal=false;
  let transition=Promise.resolve(),syncDone=Promise.resolve(),finishSync=null;
  const metaKey=id=>"estante:cloud:"+id;
  const message=(text)=>{$("accountMessage").textContent=text};
  function status(text){$("cloudState").textContent=text}
  function loadMeta(id){try{return JSON.parse(localStorage.getItem(metaKey(id))||"{}")}catch{return{}}}
  function persistMeta(){if(session)try{localStorage.setItem(metaKey(session.user.id),JSON.stringify(meta))}catch{throw Error("Não foi possível salvar o estado da sincronização.")}}
  function update(){
    const signed=!!session;
    $("accountBtn").textContent=signed?"Minha conta":"Conta opcional";
    $("accountIdentity").textContent=signed?session.user.email:"Você está usando sem conta.";
    $("authPanel").hidden=signed;$("signedPanel").hidden=!signed;
    $("adminBtn").hidden=!admin;
    $("cloudConflict").hidden=!conflict;
    $("accountGuestHint").hidden=signed;
    const emailReady=!!root.ESTANTE_CLOUD?.emailFlowsVerified;
    document.querySelectorAll("[data-auth-mode=signup],[data-auth-mode=reset]").forEach(button=>button.disabled=!emailReady);
    $("emailFlowNotice").hidden=emailReady;
  }
  function setMode(next){
    mode=next;const reset=next==="reset",signup=next==="signup";
    $("accountPasswordLabel").hidden=reset;
    $("accountPassword").required=!reset;$("accountPassword").minLength=signup?8:1;
    $("accountPassword").autocomplete=signup?"new-password":"current-password";
    $("authSubmit").textContent=reset?"Enviar recuperação":signup?"Criar conta":"Entrar";
    $("authModeTitle").textContent=reset?"Recuperar senha":signup?"Criar conta":"Entrar";
    message("");
  }
  function open(){update();if(!$("accountDialog").open)$("accountDialog").showModal()}
  function download(value,name){
    const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function adopt(value){
    stopAll();if(state.karaoke)exitKaraoke();
    state.workspace=EstanteDomain.migrate(value);
    Object.assign(state,{setlists:state.workspace.setlists,activeSetlistId:state.workspace.activeId,library:state.workspace.library,trash:state.workspace.trash,sessions:state.workspace.sessions,activeSession:state.workspace.activeSession,current:null,currentIndex:-1,results:[],selectedLibrary:new Set(),lines:[],lrc:[]});
    // Invalidate lyric work started in the previous workspace.
    if(typeof openSongRequest!=="undefined")openSongRequest++;
    renderSongNotes(null);$("sectionBar").hidden=true;$("keyControl").hidden=true;$("capoControl").hidden=true;
    for(const id of ["editDialog","notesDialog","pasteDialog","importDialog","sharedDialog","setlistDialog","revisionDialog"]){const dialog=document.getElementById(id);if(dialog?.open)dialog.close()}
    bindActiveSetlist();$("songTitle").textContent="Nenhuma música aberta";$("songArtist").textContent="Escolha uma música do seu repertório";$("paper").textContent="";$("credits").textContent="";
    renderList();updateSaveButton();updateControls();
  }
  async function replace(value,expectedHash){
    if(typeof openSongRequest!=="undefined")openSongRequest++;
    document.querySelector(".app").inert=true;$("signedPanel").inert=true;
    try{
    const next=EstanteCloudModel.parse(value);
    flushSaves();if(!await EstanteStorage.flush())throw Error("A gravação local falhou.");
    if(expectedHash!==await EstanteCloudModel.hash(workspaceSnapshot()))throw Error("workspace_changed");
    await EstanteStorage.backup(workspaceSnapshot());
    adopt(next);
    if(!EstanteStorage.save(state.workspace)||!await EstanteStorage.flush())throw Error("Falha ao guardar a cópia da nuvem neste aparelho.");
    hasLocal=true;
    }finally{document.querySelector(".app").inert=false;$("signedPanel").inert=false}
  }
  async function changeSession(next){
    const id=next?.user?.id||null;
    if(id===(session?.user?.id||null)){session=next;return}
    const ticket=++epoch;switching=true;ready=false;clearTimeout(timer);conflict=null;admin=false;
    if(typeof openSongRequest!=="undefined")openSongRequest++;
    document.querySelector(".app").inert=true;status("Abrindo seus repertórios…");
    await syncDone;
    $("adminDialog").close();clearInterval(adminTimer);$("adminSessions").textContent="";$("adminErrors").textContent="";
    try{
      flushSaves();
      const stored=await EstanteStorage.switchScope(id||"guest");
      session=next;meta=id?loadMeta(id):{};hasLocal=!!stored;
      adopt(stored||EstanteDomain.migrate(null));ready=true;
      if(!stored){EstanteStorage.save(state.workspace);if(!await EstanteStorage.flush())throw Error("Falha ao preparar o espaço local.")}
      status(id?"Salvo no aparelho; conectando à nuvem…":"Sem conta · dados neste aparelho");
    }finally{switching=false;document.querySelector(".app").inert=false;update()}
    if(id&&ticket===epoch){await sync();checkAdmin(ticket)}
  }
  function enqueueSession(next){
    transition=transition.catch(()=>{}).then(()=>changeSession(next)).catch(error=>{message(error.message);status("Verifique a conta");ready=false});
    return transition;
  }
  async function checkAdmin(ticket=epoch){
    try{
      const {data,error}=await client.from("estante_admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
      if(ticket!==epoch)return;admin=!error&&!!data;update();
    }catch{admin=false;update()}
  }
  async function remoteRequest(path,token,body){
    const response=await fetch(ESTANTE_CLOUD.url+"/rest/v1/"+path,{method:body?"POST":"GET",headers:{apikey:ESTANTE_CLOUD.key,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw result;return result;
  }
  async function fetchRemote(id,token){
    const rows=await remoteRequest("estante_workspaces?select=payload,revision,updated_at&user_id=eq."+encodeURIComponent(id),token);
    const data=rows[0]||null;if(data)data.payload=EstanteCloudModel.parse(data.payload);return data;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>sync(),1500)}
  async function sync(force=null){
    if(!client||!session||!ready||switching)return;
    if(syncing){again=true;return}
    if(conflict&&!force)return;
    if(!navigator.onLine){status("Offline · alterações guardadas neste aparelho");return}
    syncing=true;syncDone=new Promise(resolve=>{finishSync=resolve});const ticket=epoch,id=session.user.id,token=session.access_token;
    try{
      flushSaves();if(!await EstanteStorage.flush())throw Error("Falha ao salvar neste aparelho.");
      const payload=EstanteCloudModel.parse(workspaceSnapshot()),localHash=await EstanteCloudModel.hash(payload);
      const remote=force?conflict:await fetchRemote(id,token);if(ticket!==epoch)return;
      const remoteHash=remote?await EstanteCloudModel.hash(remote.payload):null;
      if(ticket!==epoch)return;
      let action=force||(EstanteCloudModel.decision(localHash,remoteHash,meta.hash,hasLocal));
      // Changes made while awaiting the server must never be replaced.
      if(localHash!==await EstanteCloudModel.hash(workspaceSnapshot())){again=true;return}
      if(ticket!==epoch)return;
      if(action==="conflict"){
        conflict=remote;status("Há duas versões · escolha em Minha conta");
        $("conflictSummary").textContent="Neste aparelho: "+EstanteCloudModel.summary(payload)+". Na nuvem: "+EstanteCloudModel.summary(remote.payload)+". Uma cópia de recuperação será mantida.";
        update();return;
      }
      if(action==="download"){
        await replace(remote.payload,localHash);if(ticket!==epoch)return;
        meta={hash:remoteHash,revision:remote.revision};persistMeta();
      }else if(action==="upload"){
        status("Sincronizando…");
        const data=await remoteRequest("rpc/estante_save_workspace",token,{p_payload:payload,p_expected:remote?.revision||0});
        if(ticket!==epoch)return;
        const saved=Array.isArray(data)?data[0]:data;if(!saved)throw Error("O servidor não confirmou a gravação.");
        meta={hash:localHash,revision:saved.revision};persistMeta();hasLocal=true;
        if(localHash!==await EstanteCloudModel.hash(workspaceSnapshot()))again=true;
      }else{meta={hash:localHash,revision:remote.revision};persistMeta()}
      conflict=null;status("Salvo neste aparelho e na nuvem");message("");update();
    }catch(error){
      if(ticket!==epoch)return;
      if(error.code==="40001"||error.message==="workspace_changed"){conflict=null;again=true;return}
      status("Salvo no aparelho · nuvem pendente");
      message(error.message?.includes("2 MB")?error.message:"A nuvem não respondeu ou recusou a cópia. Seus dados locais continuam disponíveis. Tente sincronizar novamente.");
      EstanteTelemetry.report("cloud_sync");
    }finally{syncing=false;finishSync?.();finishSync=null;if(again){again=false;schedule()}}
  }
  async function importGuest(){
    if(!session||switching||syncing)return;
    const ticket=epoch;
    const guest=await EstanteStorage.readScope("guest");if(ticket!==epoch)return;if(!guest)return message("Não há repertórios de visitante neste aparelho.");
    if(!confirm("Copiar os repertórios do visitante para esta conta? Os originais continuarão neste aparelho."))return;
    await EstanteStorage.backup(workspaceSnapshot());
    if(ticket!==epoch)return;
    const box=EstanteCloudModel.parse(guest),songIds=new Map(),arrIds=new Map();
    const map=(ids,old,prefix)=>{if(!ids.has(old))ids.set(old,EstanteDomain.uid(prefix));return ids.get(old)};
    const remap=s=>({...s,id:EstanteDomain.uid("item"),songId:map(songIds,s.songId,"song"),arrangementId:map(arrIds,s.arrangementId,"arr")});
    box.setlists.forEach(list=>state.setlists.push({...list,id:EstanteDomain.uid("setlist"),songs:list.songs.map(remap)}));
    box.library.forEach(record=>state.library.push({...record,id:map(songIds,record.id,"song"),arrangements:record.arrangements.map(a=>({...a,id:map(arrIds,a.id,"arr"),current:remap(a.current)}))}));
    state.library=EstanteDomain.rebuildLibrary(state.setlists,state.library);
    saveSetlists();renderList();message("Repertórios e biblioteca copiados. Histórico de ensaios e lixeira continuam no visitante.");
  }
  async function refreshAdmin(){
    if(!admin||!session||!$("adminDialog").open||document.hidden)return;
    const ticket=epoch;
    try{
      const [usage,errors]=await Promise.all([
        client.rpc("estante_usage_summary"),
        client.from("estante_error_counts").select("day,code,app_version,occurrences").order("day",{ascending:false}).limit(200)
      ]);
      if(ticket!==epoch)return;if(usage.error||errors.error)throw Error("Falha ao consultar o painel.");
      const rows=usage.data||[],recent=rows.reduce((n,row)=>n+Number(row.recent_pulses||0),0),day=rows.reduce((n,row)=>n+Number(row.pulses_24h||0),0);
      $("adminSummary").textContent=recent+" pulsos de atividade nos últimos 2 minutos · "+day+" nas últimas 24 horas. Cada aba pode enviar mais de um pulso. Atualizado às "+new Date().toLocaleTimeString("pt-BR");
      const names={results:"Busca",library:"Biblioteca",setlist:"Repertórios",rehearsal:"Ensaio"};
      const list=$("adminSessions");list.textContent="";
      rows.forEach(row=>{const el=document.createElement("p");el.textContent=(names[row.feature]||row.feature)+" · "+row.recent_pulses+" pulsos recentes · "+row.pulses_24h+" nas últimas 24 horas";list.appendChild(el)});
      if(!rows.length)list.textContent="Ainda não há atividade registrada.";
      const host=$("adminErrors");host.textContent="";
      (errors.data||[]).forEach(row=>{const el=document.createElement("p");el.textContent=row.day+" · "+row.code+" · "+row.occurrences+" ocorrência(s) · v"+row.app_version;host.appendChild(el)});
      if(!errors.data?.length)host.textContent="Nenhum diagnóstico recebido.";
    }catch(error){$("adminSummary").textContent=error.message}
  }
  async function start(){
    $("accountBtn").onclick=open;$("accountClose").onclick=()=>{$("accountDialog").close();$("accountPassword").value=""};
    $("continueGuest").onclick=()=>{$("accountDialog").close();$("accountPassword").value=""};
    document.querySelectorAll("[data-auth-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.authMode));
    $("syncNow").onclick=()=>sync();$("copyGuest").onclick=()=>importGuest().catch(e=>message(e.message));
    $("cloudDownload").onclick=()=>{if(confirm("Carregar a versão da nuvem? A versão local ficará em uma cópia de recuperação."))sync("download")};
    $("cloudUpload").onclick=()=>{if(confirm("Usar a versão deste aparelho na nuvem? Exporte a versão remota antes se precisar mantê-la.")){download(conflict.payload,"estante-nuvem-antes-da-troca.json");sync("upload")}};
    $("downloadRecovery").onclick=async()=>{const backup=await EstanteStorage.recovery();if(backup)download(backup,"estante-recuperacao.json");else message("Ainda não há cópia de recuperação para esta conta.")};
    $("logoutBtn").onclick=async()=>{
      try{
        flushSaves();if(!await EstanteStorage.flush())throw Error("A gravação local falhou. Exporte uma cópia antes de sair.");
        const {error}=await client.auth.signOut({scope:"local"});if(error)throw error;
        await enqueueSession(null);$("adminDialog").close();clearInterval(adminTimer);message("Você saiu. Os repertórios do visitante estão disponíveis.");
      }catch{message("Não foi possível encerrar a sessão. Verifique a conexão e tente novamente.")}
    };
    $("adminBtn").onclick=()=>{$("adminDialog").showModal();refreshAdmin();clearInterval(adminTimer);adminTimer=setInterval(refreshAdmin,15000)};
    $("adminClose").onclick=()=>{$("adminDialog").close();clearInterval(adminTimer)};
    $("adminRefresh").onclick=refreshAdmin;
    $("authForm").onsubmit=async e=>{
      e.preventDefault();if(!client)return;
      if(mode!=="login"&&!root.ESTANTE_CLOUD?.emailFlowsVerified){message("Cadastro e recuperação por e-mail estarão disponíveis em breve. Você pode usar sem conta.");return}
      $("authSubmit").disabled=true;message("Aguarde…");
      const email=$("accountEmail").value.trim(),password=$("accountPassword").value,redirectTo=location.origin+location.pathname;
      try{
        let result;
        if(mode==="reset")result=await client.auth.resetPasswordForEmail(email,{redirectTo});
        else if(mode==="signup")result=await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
        else result=await client.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;
        $("accountPassword").value="";
        message(mode==="reset"?"Se houver uma conta, você receberá o link de recuperação.":mode==="signup"&&!result.data?.session?"Confira o e-mail para confirmar o cadastro. Você pode continuar sem conta.":"");
      }catch(error){message(error.status===429?"Muitas tentativas. Aguarde antes de tentar novamente.":mode==="login"?"Não foi possível entrar. Confira e-mail e senha ou recupere sua senha.":"Não foi possível enviar o e-mail ou concluir o cadastro. Tente novamente mais tarde; o uso sem conta continua disponível.")}
      finally{$("authSubmit").disabled=false}
    };
    $("newPasswordForm").onsubmit=async e=>{
      e.preventDefault();$("newPasswordSubmit").disabled=true;
      try{const {error}=await client.auth.updateUser({password:$("newPassword").value});if(error)throw error;$("newPassword").value="";$("passwordDialog").close();message("Senha atualizada.")}
      catch{ $("passwordMessage").textContent="Não foi possível atualizar a senha. Solicite outro link de recuperação."}
      finally{$("newPasswordSubmit").disabled=false}
    };
    $("passwordCancel").onclick=()=>{$("passwordDialog").close();$("newPassword").value=""};
    ready=true;setMode("login");update();status("Sem conta · dados neste aparelho");
    if(!root.ESTANTE_CLOUD?.url||!root.EstanteSupabase){message("Conta indisponível nesta versão. Continue usando sem conta.");return}
    client=EstanteSupabase.createClient(ESTANTE_CLOUD.url,ESTANTE_CLOUD.key,{auth:{storageKey:"estante:auth:v1",flowType:"implicit",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal||AbortSignal.timeout(15000)})}});
    client.auth.onAuthStateChange((event,next)=>{
      // Never await Supabase inside its auth callback (auth lock).
      setTimeout(()=>{
        enqueueSession(next);
        if(event==="PASSWORD_RECOVERY"){$("newPassword").value="";$("passwordDialog").showModal()}
      },0);
    });
    root.addEventListener("estante:saved",e=>{if(!switching&&ready&&session&&e.detail.scope===session.user.id)schedule()});
    root.addEventListener("online",()=>sync());
    document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-(meta.checkedAt||0)>60000){meta.checkedAt=Date.now();sync()}});
    EstanteTelemetry.start();
  }
  root.EstanteAccount={start,sync,open,getSession:()=>session,getClient:()=>client};
})(window);
