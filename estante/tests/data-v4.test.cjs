const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

global.normalizeSong=(m={})=>({title:m.title??m.titulo??'Sem título',artist:m.artist??m.artista??'',album:m.album||'',duration:m.duration??m.duracao??0,lyrics:m.lyrics??m.letra??'',synced:m.synced??m.sincronizada??'',instrumental:!!m.instrumental,source:m.source??m.fonte??'',vagUrl:m.vagUrl??m.urlVagalume??'',vagId:String(m.vagId||''),catalogUrl:String(m.catalogUrl||''),key:Number(m.key)||0,capo:Number(m.capo)||0,speed:Number(m.speed)||0,auto:!!m.auto,notes:String(m.notes||''),videoId:String(m.videoId||''),videoOffset:Number(m.videoOffset)||0});
const migration=require('../migration.js');
const {txDone}=require('../storage.js');
function fakeStorage(values){return{values,getItem(key){return Object.hasOwn(this.values,key)?this.values[key]:null},setItem(key,value){this.values[key]=value}}}

test('B02 preserves malformed v3 and offers recovery while using a valid older source',()=>{
  const broken='{not-json',legacy=JSON.stringify([{title:'Canção',lyrics:'  verso preservado'}]);
  const storage=fakeStorage({'estante:v3:setlists':broken,'estante:v2:setlist':legacy});
  const result=migration.migrateLegacy(storage);
  assert.equal(storage.values['estante:v3:setlists'],broken);
  assert.equal(result.setlists.length,1);
  assert.equal(result.setlists[0].songs[0].lyrics,'  verso preservado');
  assert.equal(result.recovery.items[0].raw,broken);
});

test('B02 handles legacy object instead of calling map and keeps it recoverable',()=>{
  const storage=fakeStorage({'estante:v3:setlists':JSON.stringify({})});
  const result=migration.migrateLegacy(storage);
  assert.deepEqual(result.setlists,[]);
  assert.equal(storage.values['estante:v3:setlists'],'{}');
  assert.equal(result.recovery.items[0].status,'invalid-shape');
});

test('aborted transaction rejects without modifying legacy evidence',async()=>{
  const storage=fakeStorage({'estante:v3:setlists':'{broken'}),tx={error:new Error('abort')};
  const promise=txDone(tx);tx.onabort();
  await assert.rejects(promise,/abort/);
  assert.equal(storage.values['estante:v3:setlists'],'{broken');
});

test('migration keeps ten active setlists and every excess setlist recoverable',()=>{
  const sets=Array.from({length:20},(_,i)=>({id:'r'+i,name:'Show '+i,songs:[{id:'e'+i,title:'Música '+i,lyrics:'texto'}]}));
  const result=migration.migrateLegacy(fakeStorage({'estante:v3:setlists':JSON.stringify({setlists:sets,activeId:'r12'})}));
  assert.equal(result.setlists.length,10);
  assert.equal(result.recoveredSetlists.length,10);
  assert.equal(result.setlists.length+result.recoveredSetlists.length,20);
  assert.equal(result.activeId,'r12');
});

test('duplicate setlist and entry ids are regenerated without merging songs',()=>{
  const duplicate={setlists:[{id:'same',name:'A',songs:[{id:'entry',title:'X'},{id:'entry',title:'X'}]},{id:'same',name:'B',songs:[{id:'entry',title:'X'}]}]};
  const result=migration.migrateLegacy(fakeStorage({'estante:v3:setlists':JSON.stringify(duplicate)}));
  assert.notEqual(result.setlists[0].id,result.setlists[1].id);
  assert.notEqual(result.setlists[0].songs[0].entryId,result.setlists[0].songs[1].entryId);
  assert.equal(result.setlists.reduce((n,s)=>n+s.songs.length,0),3);
});

test('unsafe imported URLs are discarded',()=>{
  const song=migration.migrateSong({title:'X',vagUrl:'javascript:alert(1)',catalogUrl:'https://example.com/x'},'r1');
  assert.equal(song.vagUrl,'');assert.equal(song.catalogUrl,'https://example.com/x');
});

test('B01 edits the owning entry after switching visible repertory',()=>{
  const root=path.join(__dirname,'..');
  const nodes=new Map();
  function node(){return{classList:{toggle(){},add(){},remove(){}},querySelector(){return node()},querySelectorAll(){return[]},appendChild(){},setAttribute(){},removeAttribute(){},style:{},dataset:{},textContent:'',innerHTML:'',hidden:false,disabled:false,value:'',scrollTop:0}}
  const context={console,URL,Date,Math,crypto:globalThis.crypto,AbortController,setTimeout,clearTimeout,performance:{now:()=>1},navigator:{onLine:true},localStorage:fakeStorage({}),document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},querySelectorAll(){return[]},querySelector(){return null},documentElement:{style:{setProperty(){}},dataset:{}},body:{classList:{toggle(){}}}},window:{},matchMedia:()=>({matches:false}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},renderHome(){},persistData(){return Promise.resolve()},saveDraft(){},loadDraft(){},deleteDraft(){},renderList(){},stopAll(){},releaseAwake(){},karaokeStop(){},renderNoticeRaw(){}};
  vm.createContext(context);
  for(const file of ['core.js','library.js','migration.js','setlists.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  vm.runInContext(`
    renderHome=()=>{};renderList=()=>{};persistData=()=>Promise.resolve();stopAll=()=>{};releaseAwake=()=>{};karaokeStop=()=>{};
    state.setlists=[
      {id:'A',name:'A',songs:[{entryId:'a1',ownerSetlistId:'A',title:'Igual',artist:'Artista',key:1}]},
      {id:'B',name:'B',songs:[{entryId:'b1',ownerSetlistId:'B',title:'Igual',artist:'Artista',key:7}]}
    ];
    state.activeSetlistId='A';bindActiveSetlist();state.current=state.setlists[0].songs[0];state.currentIndex=0;state.stage=true;
    switchSetlist('B');state.current.key=3;state.key=3;persistCurrent();
  `,context);
  const keys=vm.runInContext(`[state.setlists[0].songs[0].key,state.setlists[1].songs[0].key]`,context);
  assert.deepEqual(Array.from(keys),[3,7]);
});

test('LRC file offset is applied once with documented sign',()=>{
  const context={module:{exports:{}},exports:{}};vm.createContext(context);
  const source=fs.readFileSync(path.join(__dirname,'../library.js'),'utf8');
  vm.runInContext(source+';module.exports={parseLRC};',context);
  assert.equal(context.module.exports.parseLRC('[offset:+500]\n[00:10.00]linha')[0].t,10.5);
  assert.equal(context.module.exports.parseLRC('[offset:-500]\n[00:10.00]linha')[0].t,9.5);
});

test('media and lyric clocks round-trip with song and device offsets',()=>{
  const context={module:{exports:{}},exports:{},console,URL,encodeURIComponent,setTimeout,clearTimeout,performance:{now:()=>1000},navigator:{onLine:true},document:{body:{classList:{add(){},remove(){}}}},window:{},state:{current:{videoOffset:2},audioDelay:500,karaoke:true,setlist:[],currentIndex:0,videoPlaying:false},YouTubeAdapter:{},notify(){},updateControls(){},stopTickIfIdle(){},releaseAwake(){},keepAwake(){},startTick(){},applyAutoSpeed(){},rememberSongPref(){},updatePrefsSoon(){},fetchSafe(){},scrollDistance(){return 0},LEAD_IN:4,$(){return{scrollTop:0}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../karaoke.js'),'utf8')+';module.exports={karaokeLyricTime,karaokeSeek};ytPlayer={getCurrentTime:()=>12.5,seekTo:(v)=>globalThis.seeked=v};',context);
  assert.equal(context.module.exports.karaokeLyricTime(),10);
  context.module.exports.karaokeSeek(10);assert.equal(context.seeked,12.5);
});
test('serialization never truncates recovery items silently',()=>{const trash=Array.from({length:21},(_,i)=>({type:'song',value:{title:'X'+i}}));const doc=migration.v4FromRuntime({setlists:[],recoveredSetlists:[],trash},1);assert.equal(doc.trash.length,21)});

test('null and invalid records are reported without losing valid neighbors',()=>{const source={setlists:[null,{id:'r1',name:'Válido',songs:[null,{title:'Boa',lyrics:'linha'}]}]};const result=migration.migrateLegacy(fakeStorage({'estante:v3:setlists':JSON.stringify(source)}));assert.equal(result.setlists.length,1);assert.equal(result.setlists[0].songs.length,1);assert.equal(result.setlists[0].songs[0].title,'Boa');assert.equal(result.recovery.items.filter(x=>x.status==='invalid-record').length,2)});

test('late response for song A never replaces song B',async()=>{
  const root=path.join(__dirname,'..'),nodes=new Map();function node(){return{classList:{toggle(){},add(){},remove(){}},querySelector(){return node()},querySelectorAll(){return[]},appendChild(){},style:{},dataset:{},textContent:'',innerHTML:'',hidden:false,disabled:false,scrollTop:0,children:[]}}
  let resolveA,persisted=0,rendered=[];const state={loadToken:0,songAbort:null,current:null,lines:[],lrc:[],setlist:[],setlists:[],currentIndex:-1,karaoke:false,scrolling:false,syncing:false,stage:false};
  const context={console,URL,Date,Math,AbortController,setTimeout,clearTimeout,performance:{now:()=>1},requestAnimationFrame:()=>1,cancelAnimationFrame(){},lastActive:-1,rendered,state,$(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},stopAll(){},applySongPrefs(){},updateControls(){},updateSaveButton(){},updateStageContext(){},karaokeOnSongChange(){},fetchLrclibSong(song){return new Promise(resolve=>{resolveA=()=>{song.lyrics='resposta A';resolve(song)}})},fetchVagalume(){},persistCurrent(){persisted++},renderHome(){},saveSetlistsSoon(){},parseLRC(){return[]},classify(x){return{text:x,type:'lyric'}},renderSectionBar(){},applyAutoSpeed(){},safeUrl(){return''},esc(x){return String(x)},transposeLine(x){return x},chordShift(){return 0},notify(){},releaseAwake(){},karaokeStop(){},keepAwake(){},startTick(){},scrollDistance(){return 0},LEAD_IN:4,fmt(){return''}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'player.js'),'utf8')+';stopAll=()=>{};renderCurrentLyrics=()=>rendered.push(state.current.title);',context);
  const a=vm.runInContext(`openSong({title:'A',artist:'x',lyrics:'',synced:''})`,context);await new Promise(r=>setImmediate(r));await vm.runInContext(`openSong({title:'B',artist:'x',lyrics:'B pronta',synced:''})`,context);resolveA();await a;
  assert.equal(state.current.title,'B');assert.equal(nodes.get('songTitle').textContent,'B');assert.deepEqual(rendered,['B']);assert.equal(persisted,0);
});

test('remote live and studio recordings keep separate identities',()=>{const context={module:{exports:{}},exports:{},console,state:{},searchMusic(){},fetchLrclibSong(){},LRCLIB_HEADERS:{},fold:s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim(),fetchSafe(){},markSource(){},fetchRetrying(){},sourceError(){},fetchVagalume(){},searchLocal(){return[]},fetchFromAcervo(){},URLSearchParams,setTimeout};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../search-engine.js'),'utf8')+';module.exports={mergeSongs};',context);const rows=[{title:'Canção',artist:'A',duration:180,lyrics:'studio'},{title:'Canção (Ao Vivo)',artist:'A',duration:220,synced:'live'}];assert.equal(context.module.exports.mergeSongs(rows,'Canção').length,2)});
