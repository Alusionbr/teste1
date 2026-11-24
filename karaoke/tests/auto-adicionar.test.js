"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function contexto({falhar=false,existente=null}={}){
 const musicas=[],fila=[];
 const c={K:{dados:{prefs:{keyYT:''}}},musicaParecida:()=>existente,temLetra:()=>true,
  buscarLetras:async()=>[{title:'Teste',lyrics:'Letra disponível'}],acharLetra:async()=>({title:'Teste',lyrics:'Letra disponível'}),
  resolverPlayback:async()=>{if(falhar)throw Error('Nenhum vídeo disponível');return{video:{id:'VIDEOAAAA01',titulo:'Karaokê escolhido',duracao:180},alternativas:[]}},
  ajustarLetraAoVideo:l=>l?{synced:'',lyrics:l.lyrics}:null,
  criarMusica:m=>{const nova={id:'m1',...m};musicas.push(nova);return nova},editarMusica:(id,m)=>({...existente,...m,id}),
  garantirPlaylist:()=>({}),adicionarItem:(p,id)=>{fila.push(id);return{musicaId:id}},salvarEstado:async()=>{},Promise,Number,String};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../auto-adicionar.js'),'utf8')+';this.adicionar=adicionarPeloNome;',c);
 return{c,musicas,fila};
}
test('adição rápida não manda só letra para a fila quando não há vídeo',async()=>{
 const x=contexto({falhar:true});await assert.rejects(x.c.adicionar({titulo:'Teste',artista:'Artista'}),/Nenhum vídeo/);
 assert.equal(x.musicas.length,0);assert.equal(x.fila.length,0);
});
test('adição rápida seleciona playback automaticamente antes de enfileirar',async()=>{
 const x=contexto();const r=await x.c.adicionar({titulo:'Teste',artista:'Artista'});
 assert.equal(r.musica.playback.id,'VIDEOAAAA01');assert.equal(x.fila.length,1);
});
