"use strict";
(function(root){
  const VERSION=4;
  const STATUSES=["learning","rehearsing","ready"];
  const STATUS_LABELS={learning:"A aprender",rehearsing:"Em ensaio",ready:"Pronta"};

  function uid(prefix="id"){
    if(root.crypto&&typeof root.crypto.randomUUID==="function")return `${prefix}_${root.crypto.randomUUID()}`;
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
  }
  function fold(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," e ").replace(/[^a-z0-9]+/g," ").trim()}
  function text(value,max=200000){return String(value||"").slice(0,max)}
  function number(value,min=-Infinity,max=Infinity){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0}
  function clone(value){return JSON.parse(JSON.stringify(value))}
  function songIdentity(song){return `${fold(song&&song.title)}|${fold(song&&song.artist)}`}
  function arrangementFingerprint(song){return JSON.stringify([text(song&&song.lyrics),text(song&&song.synced),number(song&&song.key,-11,11),number(song&&song.capo,0,12),text(song&&song.notes,10000),text(song&&song.videoId,24)])}

  function normalizeHistoryEntry(entry={}){
    return{revision:Math.max(1,number(entry.revision,1)),savedAt:text(entry.savedAt||new Date().toISOString(),40),reason:text(entry.reason||"Edição",80),snapshot:normalizeSong(entry.snapshot||{},false)};
  }
  function normalizeSong(source={},withHistory=true){
    const kind=source.kind==="note"?"note":"song";
    if(kind==="note")return{id:text(source.id||uid("item"),80),kind,title:text(source.title||"Pausa",100),artist:"",duration:number(source.duration,0,86400),notes:text(source.notes,10000),status:STATUSES.includes(source.status)?source.status:"ready",createdAt:text(source.createdAt||new Date().toISOString(),40)};
    const song={
      id:text(source.id||source.itemId||uid("item"),80),kind:"song",songId:text(source.songId||uid("song"),80),arrangementId:text(source.arrangementId||uid("arr"),80),arrangementName:text(source.arrangementName||"Principal",80),
      title:text(source.title??source.titulo??"Sem título",200),artist:text(source.artist??source.artista??"",200),album:text(source.album,300),duration:number(source.duration??source.duracao,0,86400),lyrics:text(source.lyrics??source.letra),synced:text(source.synced??source.sincronizada),instrumental:!!source.instrumental,
      source:text(source.source??source.fonte,80),vagUrl:text(source.vagUrl??source.urlVagalume,1000),vagId:text(source.vagId,100),catalogUrl:text(source.catalogUrl,1000),key:number(source.key,-11,11),capo:number(source.capo,0,12),speed:number(source.speed,0,200),auto:!!source.auto,notes:text(source.notes,10000),sectionNotes:source.sectionNotes&&typeof source.sectionNotes==="object"?clone(source.sectionNotes):{},videoId:text(source.videoId,24),videoOffset:number(source.videoOffset,-120,120),tags:Array.isArray(source.tags)?source.tags.map(x=>text(x,40)).filter(Boolean).slice(0,20):[],status:STATUSES.includes(source.status)?source.status:"learning",revision:Math.max(1,number(source.revision,1)),updatedAt:text(source.updatedAt||new Date().toISOString(),40),detached:!!source.detached
    };
    song.history=withHistory&&Array.isArray(source.history)?source.history.slice(-20).map(normalizeHistoryEntry):[];
    return song;
  }
  function normalizeSetlist(source={}){
    return{id:text(source.id||uid("setlist"),80),name:text(source.name||"Repertório",60),date:text(source.date,20),archived:!!source.archived,createdAt:text(source.createdAt||new Date().toISOString(),40),updatedAt:text(source.updatedAt||new Date().toISOString(),40),songs:Array.isArray(source.songs)?source.songs.map(s=>normalizeSong(s)):[]};
  }
  function normalizeSession(source={}){
    return{id:text(source.id||uid("session"),80),setlistId:text(source.setlistId,80),startedAt:text(source.startedAt||new Date().toISOString(),40),endedAt:text(source.endedAt,40),notes:text(source.notes,10000),items:Array.isArray(source.items)?source.items.map(x=>({itemId:text(x.itemId,80),status:STATUSES.includes(x.status)?x.status:"learning",notes:text(x.notes,2000)})):[]};
  }
  function arrangementFromSong(song){const current=normalizeSong(song,false);current.history=[];return{id:current.arrangementId,name:current.arrangementName,revision:current.revision,updatedAt:current.updatedAt,current,history:Array.isArray(song.history)?clone(song.history).slice(-20):[]};}
  function libraryRecord(song){return{id:song.songId,title:song.title,artist:song.artist,identity:songIdentity(song),tags:clone(song.tags||[]),arrangements:[arrangementFromSong(song)],updatedAt:song.updatedAt};}
  function rebuildLibrary(setlists,existing=[]){
    const records=new Map();
    (existing||[]).forEach(record=>{if(record&&record.id)records.set(record.id,clone(record))});
    for(const setlist of setlists)for(const raw of setlist.songs){
      if(raw.kind==="note")continue;
      const song=normalizeSong(raw);
      let record=records.get(song.songId)||[...records.values()].find(x=>x.identity===songIdentity(song));
      if(!record){record=libraryRecord(song);records.set(record.id,record);song.songId=record.id}
      else{
        song.songId=record.id;record.title=song.title;record.artist=song.artist;record.identity=songIdentity(song);record.tags=[...new Set([...(record.tags||[]),...(song.tags||[])])].slice(0,20);
        let arrangement=(record.arrangements||[]).find(x=>x.id===song.arrangementId);
        if(!arrangement){
          arrangement=(record.arrangements||[]).find(x=>x.name===song.arrangementName&&arrangementFingerprint(x.current)===arrangementFingerprint(song));
          if(arrangement)song.arrangementId=arrangement.id;
        }
        if(!arrangement){arrangement=arrangementFromSong(song);record.arrangements=record.arrangements||[];record.arrangements.push(arrangement)}
      }
      Object.assign(raw,song);
    }
    return[...records.values()].map(record=>({id:text(record.id||uid("song"),80),title:text(record.title||"Sem título",200),artist:text(record.artist,200),identity:text(record.identity||`${fold(record.title)}|${fold(record.artist)}`,500),tags:Array.isArray(record.tags)?record.tags.map(x=>text(x,40)).slice(0,20):[],arrangements:Array.isArray(record.arrangements)?record.arrangements.map(a=>{const current=normalizeSong(a.current||{},false);current.songId=record.id;current.arrangementId=text(a.id||current.arrangementId,80);current.arrangementName=text(a.name||current.arrangementName,80);return{id:current.arrangementId,name:current.arrangementName,revision:Math.max(1,number(a.revision||current.revision,1)),updatedAt:text(a.updatedAt||current.updatedAt,40),current,history:Array.isArray(a.history)?a.history.slice(-20).map(normalizeHistoryEntry):[]}}):[],updatedAt:text(record.updatedAt||new Date().toISOString(),40)}));
  }
  function migrate(box,legacySongs=[]){
    const source=box&&typeof box==="object"?box:{};
    let setlists=Array.isArray(source.setlists)?source.setlists.map(normalizeSetlist):[];
    if(!setlists.length)setlists=[normalizeSetlist({name:"Repertório",songs:Array.isArray(legacySongs)?legacySongs:[]})];
    const workspace={version:VERSION,revision:Math.max(0,number(source.revision,0)),updatedAt:text(source.updatedAt||new Date().toISOString(),40),activeId:setlists.some(s=>s.id===source.activeId)?source.activeId:setlists[0].id,setlists,library:[],trash:Array.isArray(source.trash)?source.trash.slice(-100).map(x=>{const item=x.item&&x.item.kind==="setlist"?{kind:"setlist",...normalizeSetlist(x.item)}:normalizeSong(x.item||{});return{id:text(x.id||uid("trash"),80),removedAt:text(x.removedAt||new Date().toISOString(),40),setlistId:text(x.setlistId,80),index:number(x.index,0),item}}):[],sessions:Array.isArray(source.sessions)?source.sessions.map(normalizeSession):[],activeSession:source.activeSession?normalizeSession(source.activeSession):null};
    workspace.library=rebuildLibrary(workspace.setlists,Array.isArray(source.library)?source.library:[]);
    return workspace;
  }
  function snapshotForHistory(song){const snap=normalizeSong(song,false);delete snap.history;return snap}
  function revise(song,previous,reason="Edição"){
    const next=normalizeSong(song),before=normalizeSong(previous||song);
    if(arrangementFingerprint(next)===arrangementFingerprint(before)&&next.title===before.title&&next.artist===before.artist)return next;
    const history=Array.isArray(before.history)?before.history.slice(-19):[];
    history.push({revision:before.revision||1,savedAt:new Date().toISOString(),reason:text(reason,80),snapshot:snapshotForHistory(before)});
    next.revision=(before.revision||1)+1;next.updatedAt=new Date().toISOString();next.history=history;return next;
  }
  function readiness(items=[]){
    const songs=items.filter(x=>x&&x.kind!=="note"),missing=songs.filter(x=>!x.instrumental&&!String(x.lyrics||x.synced).trim());
    return{ready:songs.length-missing.length,total:songs.length,missing,complete:!missing.length};
  }
  function progress(items=[]){const counts={learning:0,rehearsing:0,ready:0};items.filter(x=>x&&x.kind!=="note").forEach(x=>counts[STATUSES.includes(x.status)?x.status:"learning"]++);return counts}
  function newSession(setlistId,items=[]){return normalizeSession({setlistId,items:items.filter(x=>x.kind!=="note").map(x=>({itemId:x.id,status:x.status||"learning",notes:""}))})}
  function finishSession(session,items=[],notes=""){const done=normalizeSession(session);done.endedAt=new Date().toISOString();done.notes=text(notes,10000);done.items=items.filter(x=>x.kind!=="note").map(x=>({itemId:x.id,status:x.status||"learning",notes:text(x.sessionNotes,2000)}));return done}
  function packageSetlist(setlist,includeContent=true){const normalized=normalizeSetlist(setlist);return{kind:"estante-setlist",version:VERSION,createdAt:new Date().toISOString(),setlist:{...normalized,songs:normalized.songs.map(song=>includeContent?song:{id:song.id,kind:song.kind,songId:song.songId,arrangementId:song.arrangementId,arrangementName:song.arrangementName,title:song.title,artist:song.artist,duration:song.duration,status:song.status,notes:song.notes,tags:song.tags,revision:song.revision})}}}

  const api={VERSION,STATUSES,STATUS_LABELS,uid,fold,songIdentity,normalizeSong,normalizeSetlist,normalizeSession,migrate,rebuildLibrary,revise,readiness,progress,newSession,finishSession,packageSetlist,clone};
  root.EstanteDomain=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
