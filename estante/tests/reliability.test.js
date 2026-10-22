"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Domain=require("../domain.js");
const source=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

test("restaurar o último repertório preserva IDs únicos e o conteúdo",()=>{
  const workspace=Domain.migrate(null,[{title:"Canção",lyrics:"Texto"}]);
  const state={workspace,setlists:workspace.setlists,activeSetlistId:workspace.activeId,setlist:workspace.setlists[0].songs,library:workspace.library,trash:[],sessions:[],activeSession:null,currentIndex:-1};
  const context=vm.createContext({state,EstanteDomain:Domain,EstanteStorage:{save:()=>true},storedSong:Domain.normalizeSong,renderList(){},updateSaveButton(){},notify(){}});
  vm.runInContext(source("setlists.js"),context);
  vm.runInContext("deleteSetlist(state.activeSetlistId);restoreTrash(state.trash.at(-1).id)",context);
  assert.equal(state.setlists.length,2);
  assert.equal(new Set(state.setlists.map(s=>s.id)).size,2);
  assert.equal(state.setlists.find(s=>s.songs.length).songs[0].title,"Canção");
});

test("link apenas com a ordem conserva os ajustes musicais",()=>{
  const song=Domain.normalizeSong({title:"Canção",instrumental:true,key:3,capo:2,speed:24,auto:true});
  const item=Domain.packageSetlist({songs:[song]},false).setlist.songs[0];
  assert.deepEqual([item.key,item.capo,item.speed,item.auto],[3,2,24,true]);
  assert.equal(item.instrumental,true);
  assert.equal(item.lyrics,undefined);
});

test("editar arranjo da Biblioteca fora do repertório ativo persiste a revisão",()=>{
  const original=Domain.normalizeSong({title:"Canção",lyrics:"Original"});
  const state={setlist:[],setlists:[{songs:[]}],current:{...original},library:Domain.rebuildLibrary([{songs:[original]}])};
  let saves=0;
  const fields={editText:"Corrigida",editTitle:"Canção",editArtist:"",editArrangement:"Principal",editScope:"arrangement"};
  const elements={songTitle:{},songArtist:{},editDialog:{close(){}}};
  const $=id=>elements[id]||(elements[id]={value:fields[id]});
  const context=vm.createContext({state,EstanteDomain:Domain,storedSong:Domain.normalizeSong,$,sameSong:(a,b)=>a.arrangementId===b.arrangementId,hasLRC:()=>false,stopAll(){},renderCurrentLyrics(){},renderList(){},updateSaveButton(){},notify(){},saveSetlists(){saves++},bindActiveSetlist(){}});
  const setlists=source("setlists.js");
  vm.runInContext(setlists.slice(setlists.indexOf("function libraryRecordFor"),setlists.indexOf("function createSetlist")),context);
  vm.runInContext(source("song-edit.js").slice(source("song-edit.js").indexOf("function saveSongEdit()")),context);
  vm.runInContext("saveSongEdit()",context);
  assert.equal(state.library[0].arrangements[0].current.lyrics,"Corrigida");
  assert.equal(state.library[0].arrangements[0].revision,2);
  assert.equal(saves,1);
});

test("substituir um backup substitui também a sessão ativa",()=>{
  const old=Domain.migrate(null,[{title:"Antiga",lyrics:"Texto"}]);
  const state={workspace:old,setlists:old.setlists,activeSetlistId:old.activeId,setlist:old.setlists[0].songs,library:old.library,trash:[],sessions:[],activeSession:Domain.newSession(old.activeId,old.setlists[0].songs),currentIndex:-1,tab:"setlist"};
  const incoming=Domain.migrate(null,[{title:"Nova",lyrics:"Novo"}]);
  const context=vm.createContext({state,EstanteDomain:Domain,storedSong:Domain.normalizeSong,$:()=>({close(){}}),notify(){},renderList(){},updateSaveButton(){},saveSetlists(){},newSetlistId:()=>Domain.uid("setlist"),bindActiveSetlist(){state.setlist=state.setlists.find(s=>s.id===state.activeSetlistId).songs}});
  const text=source("player.js");
  vm.runInContext(text.slice(text.indexOf("let incomingImport=null;"),text.indexOf("async function fullscreen()")),context);
  context.backup=incoming;
  vm.runInContext("incomingImport={setlists:backup.setlists,activeId:backup.activeId,workspace:backup};finishImport('replace')",context);
  assert.equal(state.activeSession,null);
  assert.equal(state.setlist[0].title,"Nova");
});
