"use strict";
/*
 * Armazenamento no aparelho.
 *
 * - Estado (cantores, músicas, playlists, ajustes): IndexedDB "karaoke",
 *   gaveta "dados", com uma cópia no localStorage como reserva. Se o
 *   IndexedDB falhar (modo privado de alguns navegadores), a cópia segura o app.
 * - Áudios de playback escolhidos do aparelho: IndexedDB "karaoke", gaveta
 *   "audio", chave = id da música. Não vão para a exportação nem para o link
 *   (arquivo de música pesa megabytes).
 */
const KStore=(()=>{
  const DB_NAME="karaoke",COPIA="karaoke:v1:dados";
  let db=null;

  function abrir(){
    if(db)return db;
    if(!("indexedDB" in self))return Promise.reject(Error("IndexedDB indisponível"));
    db=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains("dados"))d.createObjectStore("dados");if(!d.objectStoreNames.contains("audio"))d.createObjectStore("audio")};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||Error("Não foi possível abrir o armazenamento."));
    }).catch(e=>{db=null;throw e});
    return db;
  }
  async function operar(gaveta,modo,fn){
    const d=await abrir();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction(gaveta,modo);
      const req=fn(tx.objectStore(gaveta));
      tx.oncomplete=()=>resolve(req&&req.result);
      tx.onabort=tx.onerror=()=>reject(tx.error||Error("Falha ao gravar no aparelho."));
    });
  }

  function lerCopia(){try{return JSON.parse(localStorage.getItem(COPIA)||"null")}catch{return null}}
  function gravarCopia(v){try{localStorage.setItem(COPIA,JSON.stringify(v));return true}catch{return false}}

  // Lê o mais recente entre o IndexedDB e a cópia (compara `salvoEm`).
  async function carregar(){
    let principal=null;
    try{principal=await operar("dados","readonly",s=>s.get("atual"))}catch{}
    const copia=lerCopia();
    if(principal&&copia)return (copia.salvoEm||0)>(principal.salvoEm||0)?copia:principal;
    return principal||copia||null;
  }
  // Devolve true quando pelo menos um dos dois lugares gravou.
  async function salvar(dados){
    const v={...dados,salvoEm:Date.now()};
    const okCopia=gravarCopia(v);
    let okDb=false;
    try{await operar("dados","readwrite",s=>s.put(v,"atual"));okDb=true}catch{}
    return okDb||okCopia;
  }

  const audio={
    guardar:(id,blob)=>operar("audio","readwrite",s=>s.put(blob,id)),
    ler:id=>operar("audio","readonly",s=>s.get(id)),
    apagar:id=>operar("audio","readwrite",s=>s.delete(id)),
    chaves:()=>operar("audio","readonly",s=>s.getAllKeys())
  };

  async function pedirPersistencia(){try{return !!(navigator.storage&&navigator.storage.persist&&await navigator.storage.persist())}catch{return false}}

  return{carregar,salvar,audio,pedirPersistencia};
})();
