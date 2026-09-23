"use strict";

const DB_NAME="estante",DB_VERSION=1;
let dataDbPromise=null,writeChain=Promise.resolve(),currentRevision=0;

function openDataDb(){
  if(dataDbPromise)return dataDbPromise;
  dataDbPromise=new Promise((resolve,reject)=>{
    if(!("indexedDB"in window))return reject(Error("Armazenamento seguro indisponível neste navegador."));
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;for(const store of ["documents","backups","drafts","meta"])if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:"id"})};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error("Não foi possível abrir os dados."));request.onblocked=()=>reject(Error("Feche outra aba antiga do Estante e tente novamente."));
  });return dataDbPromise
}
function requestValue(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function readDocument(){const db=await openDataDb(),tx=db.transaction("documents","readonly");return requestValue(tx.objectStore("documents").get("main"))}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error("Gravação cancelada."));tx.onerror=()=>reject(tx.error||Error("Falha ao gravar."))})}

async function initializeDataStore(){
  let existing=null;
  try{
    existing=await readDocument();
    if(existing){const runtime=runtimeFromV4(existing);currentRevision=runtime.revision;return runtime}
    const runtime=migrateLegacy(localStorage),doc=v4FromRuntime(runtime,1),db=await openDataDb(),tx=db.transaction(["documents","backups","meta"],"readwrite");
    tx.objectStore("documents").put(doc);
    tx.objectStore("backups").put({id:"legacy-"+Date.now(),createdAt:new Date().toISOString(),items:runtime.rawReads});
    tx.objectStore("meta").put({id:"migration",schemaVersion:4,completedAt:new Date().toISOString()});
    await txDone(tx);const verify=await readDocument();if(!validateSnapshotV4(verify))throw Error("A conferência dos dados migrados falhou.");
    currentRevision=verify.revision;return runtimeFromV4(verify)
  }catch(error){
    const runtime=migrateLegacy(localStorage);runtime.readOnly=true;runtime.storageError=error.message;if(existing)runtime.recovery={sourceKey:"indexedDB",items:[{key:"documento atual",status:"invalid",raw:existing}]};return runtime
  }
}

function runtimeState(){return{setlists:state.setlists,recoveredSetlists:state.recoveredSetlists,activeSetlistId:state.activeSetlistId,trash:state.trash,resume:state.resume,recovery:state.recovery}}
function showSaveState(kind,message){state.saveState=kind;const el=$("saveState");if(el){el.textContent=message;el.dataset.state=kind}if(kind==="error")renderNoticeRaw('Não foi possível salvar. <button type="button" id="retrySave">Tentar novamente</button> <button type="button" id="exportPending">Exportar alterações</button>');}
async function commitRuntime(){
  if(state.readOnly)throw Error(state.storageError||"Os dados estão em modo de recuperação.");
  const db=await openDataDb(),tx=db.transaction("documents","readwrite"),store=tx.objectStore("documents"),existing=await requestValue(store.get("main"));
  const actual=Number(existing&&existing.revision)||0;if(actual!==currentRevision){tx.abort();throw Error("Outra aba alterou seus repertórios. Recarregue para escolher qual versão manter.")}
  const next=currentRevision+1,doc=v4FromRuntime(runtimeState(),next);store.put(doc);await txDone(tx);currentRevision=next;state.documentRevision=next
}
function persistData(){
  showSaveState("saving","Salvando…");
  writeChain=writeChain.catch(()=>{}).then(commitRuntime).then(()=>{showSaveState("saved","Salvo neste aparelho");if(state.pendingSuccessNotice){const msg=state.pendingSuccessNotice;state.pendingSuccessNotice="";renderNoticeRaw(msg,true)}}).catch(error=>{state.storageError=error.message;state.pendingSuccessNotice="";showSaveState("error","Não foi possível salvar");throw error});
  writeChain.catch(()=>{});return writeChain
}
function waitForPendingWrites(){return writeChain.catch(()=>{})}
async function saveDraft(id,value){const db=await openDataDb(),tx=db.transaction("drafts","readwrite");tx.objectStore("drafts").put({id,value,updatedAt:new Date().toISOString()});await txDone(tx)}
async function loadDraft(id){const db=await openDataDb(),tx=db.transaction("drafts","readonly");return requestValue(tx.objectStore("drafts").get(id))}
async function deleteDraft(id){const db=await openDataDb(),tx=db.transaction("drafts","readwrite");tx.objectStore("drafts").delete(id);await txDone(tx)}
function exportPendingData(){const blob=new Blob([JSON.stringify(v4FromRuntime(runtimeState(),currentRevision),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="estante-alteracoes-pendentes.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)}

if(typeof module!=="undefined")module.exports={initializeDataStore,txDone};
