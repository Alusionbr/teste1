"use strict";
(function(root){
  const MAX_BYTES=2*1024*1024;
  function parse(value){
    if(!value||value.version!==4||!Array.isArray(value.setlists)||!Array.isArray(value.library))throw Error("A cópia da nuvem tem um formato inválido.");
    if(value.setlists.length>1000||value.library.length>10000)throw Error("A cópia excede os limites do Estante.");
    for(const list of value.setlists)if(!list||!Array.isArray(list.songs)||list.songs.length>5000)throw Error("Repertório inválido na cópia.");
    if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_BYTES)throw Error("A cópia ultrapassa 2 MB. Exporte e reduza o histórico antes de sincronizar.");
    return EstanteDomain.migrate(value);
  }
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
    return value;
  }
  async function hash(value){
    const copy=parse(value);delete copy.revision;delete copy.updatedAt;
    const bytes=new TextEncoder().encode(JSON.stringify(canonical(copy)));
    const digest=await root.crypto.subtle.digest("SHA-256",bytes);
    return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
  }
  function decision(local,remote,base,hasLocal){
    if(!remote)return"upload";
    if(!hasLocal)return"download";
    if(local===remote)return"equal";
    if(local===base)return"download";
    if(remote===base)return"upload";
    return"conflict";
  }
  function summary(value){return value.setlists.length+" repertório(s), "+value.library.length+" música(s)"}
  const api={parse,hash,decision,summary,MAX_BYTES};
  root.EstanteCloudModel=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
