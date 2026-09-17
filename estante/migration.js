"use strict";

const DATA_SCHEMA_VERSION=4;
const MAX_ACTIVE_SETLISTS=10;
const LEGACY_DATA_KEYS=["estante:v3:setlists","estante:v2:setlist","estante:repertorio"];

function stableId(prefix="id"){
  try{if(crypto&&crypto.randomUUID)return prefix+"_"+crypto.randomUUID()}catch{}
  return prefix+"_"+Date.now().toString(36)+Math.random().toString(36).slice(2,10)
}

function readLegacyValue(storage,key){
  let raw;
  try{raw=storage.getItem(key)}catch(error){return{key,status:"unavailable",raw:null,error:String(error&&error.message||error)}}
  if(raw===null)return{key,status:"missing",raw:null,value:null};
  try{return{key,status:"valid-json",raw,value:JSON.parse(raw)}}
  catch(error){return{key,status:"invalid-json",raw,error:String(error&&error.message||error)}}
}

function safeText(value,max=200000){return typeof value==="string"?value.slice(0,max):""}
function safeUrl(value){
  const text=safeText(value,2000).trim();if(!text)return"";
  try{const u=new URL(text);return u.protocol==="https:"||u.protocol==="http:"?u.href:""}catch{return""}
}
function safeNumber(value,min,max,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function isRecord(value){return!!value&&typeof value==="object"&&!Array.isArray(value)}

function migrateSong(raw={},ownerSetlistId=""){
  if(!isRecord(raw))raw={};
  const song=normalizeSong(raw);
  return Object.assign(song,{
    entryId:safeText(raw.entryId||raw.id,100)||stableId("e"),
    ownerSetlistId,
    title:safeText(song.title,300)||"Sem título",
    artist:safeText(song.artist,300),album:safeText(song.album,500),
    lyrics:safeText(song.lyrics),synced:safeText(song.synced),notes:safeText(song.notes,10000),
    source:safeText(song.source,200),vagUrl:safeUrl(song.vagUrl),catalogUrl:safeUrl(song.catalogUrl),
    vagId:safeText(song.vagId,100),videoId:/^[\w-]{11}$/.test(String(song.videoId||""))?String(song.videoId):"",
    duration:safeNumber(song.duration,0,86400),key:safeNumber(song.key,-11,11),capo:safeNumber(song.capo,0,11),
    speed:safeNumber(song.speed,0,140),videoOffset:safeNumber(song.videoOffset,-120,120),
    contentRevision:Math.max(1,Math.floor(Number(raw.contentRevision)||1))
  })
}

function migrateSetlist(raw={},name="Repertório"){
  if(!isRecord(raw))raw={};
  const id=safeText(raw.id,100)||stableId("r");
  const source=Array.isArray(raw.entries)?raw.entries.map(entry=>Object.assign({},entry.song||{},entry.settings||{},{entryId:entry.id,contentRevision:entry.contentRevision})):(Array.isArray(raw.songs)?raw.songs:[]);
  const entryIds=new Set(),songs=source.filter(isRecord).map(song=>{const migrated=migrateSong(song,id);if(entryIds.has(migrated.entryId))migrated.entryId=stableId("e");entryIds.add(migrated.entryId);return migrated});
  return{id,name:safeText(raw.name||name,60)||name,date:safeText(raw.date,30),createdAt:raw.createdAt||new Date().toISOString(),updatedAt:raw.updatedAt||new Date().toISOString(),songs}
}
function uniqueSetlists(list){const ids=new Set();return list.map(set=>{if(ids.has(set.id)){set.id=stableId("r");set.songs.forEach(song=>song.ownerSetlistId=set.id)}ids.add(set.id);return set})}

function validateSnapshotV4(doc){const validSet=set=>isRecord(set)&&Array.isArray(set.entries);return!!doc&&doc.schemaVersion===4&&doc.id==="main"&&Array.isArray(doc.setlists)&&Array.isArray(doc.recoveredSetlists||[])&&doc.setlists.every(validSet)&&(doc.recoveredSetlists||[]).every(validSet)}
function partitionSetlists(all,activeId){const preferred=all.find(set=>set.id===activeId),ordered=preferred&&all.length>MAX_ACTIVE_SETLISTS?[preferred,...all.filter(set=>set!==preferred)]:all,active=ordered.slice(0,MAX_ACTIVE_SETLISTS);return{active,recovered:ordered.slice(MAX_ACTIVE_SETLISTS),activeId:active.some(set=>set.id===activeId)?activeId:(active[0]&&active[0].id)||""}}

function runtimeFromV4(doc){
  if(!validateSnapshotV4(doc))throw Error("Dados salvos em formato desconhecido.");
  const combined=uniqueSetlists([...(doc.setlists||[]).map(migrateSetlist),...(doc.recoveredSetlists||[]).map(migrateSetlist)]),partition=partitionSetlists(combined,doc.activeSetlistId);
  return{setlists:partition.active,recoveredSetlists:partition.recovered,activeId:partition.activeId,resume:doc.resume||null,trash:Array.isArray(doc.trash)?doc.trash:[],revision:Number(doc.revision)||0,recovery:doc.recovery||null}
}

function v4FromRuntime(runtime,revision){
  const entry=(song)=>({id:song.entryId||stableId("e"),song:{title:song.title,artist:song.artist,album:song.album,duration:song.duration,lyrics:song.lyrics,synced:song.synced,instrumental:!!song.instrumental,source:song.source,vagUrl:safeUrl(song.vagUrl),vagId:song.vagId,catalogUrl:safeUrl(song.catalogUrl)},settings:{key:song.key,capo:song.capo,speed:song.speed,auto:!!song.auto,notes:song.notes,videoId:song.videoId,videoOffset:song.videoOffset},contentRevision:song.contentRevision||1});
  const set=(s)=>({id:s.id,name:s.name,date:s.date||"",createdAt:s.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),entries:(s.songs||[]).map(entry)});
  return{id:"main",schemaVersion:4,revision,activeSetlistId:runtime.activeSetlistId||"",setlists:(runtime.setlists||[]).map(set),recoveredSetlists:(runtime.recoveredSetlists||[]).map(set),trash:(runtime.trash||[]),resume:runtime.resume||null,recovery:runtime.recovery||null,updatedAt:new Date().toISOString()}
}

function migrateLegacy(storage){
  const reads=LEGACY_DATA_KEYS.map(key=>readLegacyValue(storage,key));
  let source=null,sourceKey="";
  const v3=reads[0];
  if(v3.status==="valid-json"&&v3.value&&Array.isArray(v3.value.setlists)){source=v3.value.setlists;sourceKey=v3.key}
  if(!source){for(const read of reads.slice(1)){if(read.status!=="valid-json")continue;const list=Array.isArray(read.value)?read.value:(read.value&&Array.isArray(read.value.setlist)?read.value.setlist:null);if(list){source=[{name:"Repertório",songs:list}];sourceKey=read.key;break}}}
  const recovery=reads.filter(r=>r.status==="invalid-json"||r.status==="unavailable"||(r.status==="valid-json"&&r.raw!==null&&!((r.key===LEGACY_DATA_KEYS[0]&&isRecord(r.value)&&Array.isArray(r.value.setlists))||(r.key!==LEGACY_DATA_KEYS[0]&&(Array.isArray(r.value)||(isRecord(r.value)&&Array.isArray(r.value.setlist))))))).map(r=>({key:r.key,status:r.status==="valid-json"?"invalid-shape":r.status,raw:r.raw,error:r.error}));
  (source||[]).forEach((set,index)=>{if(!isRecord(set))recovery.push({key:`${sourceKey}[${index}]`,status:"invalid-record",raw:set});else{const songs=Array.isArray(set.entries)?set.entries:Array.isArray(set.songs)?set.songs:[];songs.forEach((song,songIndex)=>{if(!isRecord(song))recovery.push({key:`${sourceKey}[${index}].songs[${songIndex}]`,status:"invalid-record",raw:song})})}});
  const all=uniqueSetlists((source||[]).filter(isRecord).map(migrateSetlist));
  const activeCandidate=v3.value&&v3.value.activeId;
  const partition=partitionSetlists(all,activeCandidate);
  return{setlists:partition.active,recoveredSetlists:partition.recovered,activeId:partition.activeId,resume:null,revision:0,recovery:recovery.length?{sourceKey,items:recovery}:null,rawReads:reads}
}

if(typeof module!=="undefined")module.exports={DATA_SCHEMA_VERSION,MAX_ACTIVE_SETLISTS,stableId,readLegacyValue,safeUrl,migrateLegacy,migrateSetlist,migrateSong,uniqueSetlists,runtimeFromV4,v4FromRuntime,validateSnapshotV4};
