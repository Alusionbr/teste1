"use strict";
(function(root){
  const DB_NAME="estante",STORE="workspace",FALLBACK_KEY="estante:v4:workspace";
  let dbPromise=null,writeQueue=Promise.resolve(),channel=null,lastRevision=0,lastBackupAt=0,pendingBackup=null,conflicted=false,scope="guest",listener=null;
  const writerId=root.crypto?.randomUUID?.()||String(Date.now())+Math.random();
  const currentKey=()=>scope==="guest"?"current":"account:"+scope;
  const fallbackKey=()=>scope==="guest"?FALLBACK_KEY:FALLBACK_KEY+":account:"+scope;
  function setState(kind,message){
    const el=document.getElementById("saveState");if(!el)return;
    el.dataset.state=kind;el.textContent=message||({saving:"Salvando…",saved:"Salvo",error:"Falha ao salvar"}[kind]||"");
  }
  function openDb(){
    if(!("indexedDB" in root))return Promise.reject(Error("IndexedDB indisponível"));
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error("Falha no banco local"));
      req.onblocked=()=>reject(Error("Banco local bloqueado por outra aba"));
    });return dbPromise;
  }
  async function get(key=currentKey()){
    const db=await openDb();
    return new Promise((resolve,reject)=>{const req=db.transaction(STORE,"readonly").objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});
  }
  async function put(value,key=currentKey()){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
      const read=store.get(key);
      read.onsuccess=()=>{
        const prior=read.result;
        if(prior&&prior._writerId!==writerId&&Number(prior.revision)>=Number(value.revision)){conflicted=true;tx.abort();return}
        store.put(value,key);
      };
      tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error("Outra aba alterou estes dados"));
    });
  }
  function fallbackRead(key=fallbackKey()){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}
  function fallbackWrite(value,key=fallbackKey()){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  async function readScope(target=scope){
    const key=target==="guest"?"current":"account:"+target,backup=target==="guest"?FALLBACK_KEY:FALLBACK_KEY+":account:"+target;
    let indexed=null;try{indexed=await get(key)}catch{}
    const fallback=fallbackRead(backup);
    if(!indexed)return fallback;if(!fallback)return indexed;
    const newer=Number(fallback.revision)>Number(indexed.revision)||(Number(fallback.revision)===Number(indexed.revision)&&String(fallback.updatedAt)>String(indexed.updatedAt));
    return newer?fallback:indexed;
  }
  async function load(){const value=await readScope();lastRevision=Number(value?.revision)||0;return value}
  function save(workspace){
    if(conflicted){setState("error","Recarregue para salvar");return false}
    const snapshot=EstanteDomain.clone(workspace),key=currentKey(),backup=fallbackKey(),savingScope=scope;
    snapshot.version=EstanteDomain.VERSION;snapshot.revision=Math.max(lastRevision,Number(snapshot.revision)||0)+1;
    snapshot.updatedAt=new Date().toISOString();snapshot._writerId=writerId;lastRevision=snapshot.revision;
    Object.assign(workspace,{revision:snapshot.revision,updatedAt:snapshot.updatedAt});setState("saving");pendingBackup={snapshot,backup};
    const hasDb="indexedDB" in root,fallbackOk=hasDb?false:fallbackWrite(snapshot,backup);
    writeQueue=writeQueue.catch(()=>{}).then(async()=>{
      try{
        await put(snapshot,key);
        if(Date.now()-lastBackupAt>30000&&fallbackWrite(snapshot,backup))lastBackupAt=Date.now();
      }catch(error){
        if(conflicted){pendingBackup=null;setState("error","Recarregue para salvar");listener?.({type:"saved"});throw error}
        if(!fallbackOk&&!fallbackWrite(snapshot,backup)){setState("error");root.dispatchEvent?.(new CustomEvent("estante:diagnostic",{detail:"local_save"}));throw error}
      }
      setState("saved");
      channel?.postMessage({type:"saved",revision:snapshot.revision,writerId});
      root.dispatchEvent?.(new CustomEvent("estante:saved",{detail:{scope:savingScope}}));
      return true;
    });
    // Keep a rejecting queue for flush(), while preventing unhandled rejections.
    writeQueue.catch(()=>{});
    return fallbackOk||hasDb;
  }
  async function flush(){
    try{await writeQueue;if(conflicted)return false;if(pendingBackup&&fallbackWrite(pendingBackup.snapshot,pendingBackup.backup))lastBackupAt=Date.now();return true}catch{return false}
  }
  async function switchScope(target){
    if(!await flush())throw Error("Exporte seus dados antes de trocar de conta: a gravação local falhou.");
    close();scope=target||"guest";lastRevision=0;pendingBackup=null;conflicted=false;lastBackupAt=0;writeQueue=Promise.resolve();
    if(listener)listen(listener);return load();
  }
  async function backup(workspace){
    const copy=EstanteDomain.clone(workspace);
    // Backup is durable before accepting a cloud replacement.
    const db=await openDb();
    return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(copy,"recovery:"+scope);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error("Falha no backup"))});
  }
  async function recovery(){return get("recovery:"+scope)}
  async function requestPersistence(){try{return !!(navigator.storage?.persist&&await navigator.storage.persist())}catch{return false}}
  function listen(handler){
    listener=handler;close();if(!("BroadcastChannel" in root))return;
    channel=new BroadcastChannel("estante-workspace:"+scope);
    channel.onmessage=event=>{const msg=event.data||{};if(msg.type==="saved"&&msg.writerId!==writerId&&msg.revision>=lastRevision){lastRevision=Math.max(lastRevision,msg.revision);conflicted=true;setState("error","Recarregue para salvar");handler(msg)}};
  }
  function close(){channel?.close();channel=null}
  root.EstanteStorage={load,save,flush,requestPersistence,listen,close,setState,FALLBACK_KEY,switchScope,readScope,backup,recovery,getScope:()=>scope};
})(typeof globalThis!=="undefined"?globalThis:this);
