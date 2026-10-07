"use strict";
(function(root){
  const DB_NAME="estante";
  const STORE="workspace";
  const CURRENT="current";
  const FALLBACK_KEY="estante:v4:workspace";
  let dbPromise=null,writeQueue=Promise.resolve(),channel=null,lastRevision=0,lastBackupAt=0,pendingBackup=null,conflicted=false;
  const writerId=(root.crypto&&root.crypto.randomUUID)?root.crypto.randomUUID():`${Date.now()}-${Math.random()}`;

  function setState(kind,message){
    const el=document.getElementById("saveState");
    if(!el)return;
    el.dataset.state=kind;
    el.textContent=message||({saving:"Salvando…",saved:"Salvo",error:"Falha ao salvar"}[kind]||"");
  }
  function openDb(){
    if(!("indexedDB" in root))return Promise.reject(Error("IndexedDB indisponível"));
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||Error("Não foi possível abrir o banco local"));
      req.onblocked=()=>reject(Error("Banco local bloqueado por outra aba"));
    });
    return dbPromise;
  }
  async function get(){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(STORE,"readonly").objectStore(STORE).get(CURRENT);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
    });
  }
  async function put(value){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(value,CURRENT);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error("Gravação cancelada"));
    });
  }
  function fallbackRead(){try{return JSON.parse(localStorage.getItem(FALLBACK_KEY)||"null")}catch{return null}}
  function fallbackWrite(value){try{localStorage.setItem(FALLBACK_KEY,JSON.stringify(value));return true}catch{return false}}
  async function load(){
    let indexed=null;try{indexed=await get()}catch{}
    const fallback=fallbackRead();
    const fallbackNewer=fallback&&indexed&&((Number(fallback.revision)||0)>(Number(indexed.revision)||0)||((Number(fallback.revision)||0)===(Number(indexed.revision)||0)&&String(fallback.updatedAt||"")>String(indexed.updatedAt||"")));
    let value=!indexed?fallback:!fallback?indexed:fallbackNewer?fallback:indexed;
    if(value&&value.revision)lastRevision=value.revision;
    return value;
  }
  function save(workspace){
    if(conflicted){setState("error","Recarregue para salvar");return false}
    const snapshot=EstanteDomain.clone(workspace);
    snapshot.version=EstanteDomain.VERSION;
    snapshot.revision=Math.max(lastRevision,Number(snapshot.revision)||0)+1;
    snapshot.updatedAt=new Date().toISOString();
    snapshot._writerId=writerId;
    lastRevision=snapshot.revision;
    Object.assign(workspace,{revision:snapshot.revision,updatedAt:snapshot.updatedAt});
    setState("saving");
    const hasIndexedDb="indexedDB" in root;
    pendingBackup=snapshot;
    const fallbackOk=hasIndexedDb?false:fallbackWrite(snapshot);
    writeQueue=writeQueue.catch(()=>{}).then(async()=>{
      try{
        await put(snapshot);setState("saved");
        if(Date.now()-lastBackupAt>30000&&fallbackWrite(snapshot))lastBackupAt=Date.now();
        if(channel)channel.postMessage({type:"saved",revision:snapshot.revision,updatedAt:snapshot.updatedAt,writerId});
        return true;
      }catch(error){
        if(fallbackOk||fallbackWrite(snapshot)){setState("saved","Salvo localmente");return true}
        setState("error");throw error;
      }
    });
    return fallbackOk||hasIndexedDb;
  }
  async function flush(){
    if(pendingBackup&&fallbackWrite(pendingBackup))lastBackupAt=Date.now();
    try{await writeQueue;return true}catch{return false}
  }
  async function requestPersistence(){try{return !!(navigator.storage&&navigator.storage.persist&&await navigator.storage.persist())}catch{return false}}
  function listen(handler){
    if(!("BroadcastChannel" in root))return;
    channel=new BroadcastChannel("estante-workspace");
    channel.onmessage=event=>{const msg=event.data||{};if(msg.type==="saved"&&msg.writerId!==writerId&&msg.revision>=lastRevision){lastRevision=Math.max(lastRevision,msg.revision);conflicted=true;setState("error","Recarregue para salvar");handler(msg)}};
  }
  function close(){if(channel)channel.close();channel=null}
  root.EstanteStorage={load,save,flush,requestPersistence,listen,close,setState,FALLBACK_KEY};
})(typeof globalThis!=="undefined"?globalThis:this);
