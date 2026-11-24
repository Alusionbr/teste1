"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function cenario(falhar=false){
 const ouvintes={},card={hidden:true,addEventListener:(t,fn)=>ouvintes[t]=fn};
 const els={conviteProjeto:card,conviteProjetoQR:{},conviteProjetoFechar:{addEventListener:(t,fn)=>ouvintes.fechar=fn}};
 let link='',grande=true,tentativas=0;
 const c={$:id=>els[id],window:{matchMedia:()=>({get matches(){return grande}})},QR:{desenhar:(el,url)=>{tentativas++;if(falhar)throw Error("canvas indisponível");link=url}},Date};
 vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../convite-projeto.js'),'utf8')+';this.C=ConviteProjeto',c);
 const estado={aberto:true,modo:'festa',fase:'nota',ligado:true};
 return{card,ouvintes,estado,C:c.C,link:()=>link,tentativas:()=>tentativas,pequena:()=>{grande=false}};
}
test('convite só aparece em pausa de festa, nunca durante canto, ensaio ou gravação',()=>{
 for(const patch of [{fase:'cantando'},{fase:'gravando'},{fase:'vez'},{modo:'ensaio'},{modo:'solo'},{aberto:false},{ligado:false},{erro:true}]){
  const c=cenario();c.C.atualizar({...c.estado,...patch},0);assert.equal(c.card.hidden,true,JSON.stringify(patch));
 }
 const c=cenario();c.pequena();c.C.atualizar(c.estado,0);assert.equal(c.card.hidden,true);
});
test('convite expira em 25 segundos e reaparece só após 15 minutos; QR não contém sala',()=>{
 const c=cenario();c.C.atualizar(c.estado,0);assert.equal(c.card.hidden,false);
 assert.equal(c.link(),'https://alusionbr.github.io/teste1/karaoke/projeto.html');
 c.C.atualizar(c.estado,25000);assert.equal(c.card.hidden,true);
 c.C.atualizar(c.estado,899999);assert.equal(c.card.hidden,true);
 c.C.atualizar(c.estado,900000);assert.equal(c.card.hidden,false);
 c.C.atualizar({...c.estado,fase:'cantando'},900001);assert.equal(c.card.hidden,true);
});
test('fechar dispensa o convite na sessão; reativar nos ajustes permite de novo',()=>{
 const c=cenario();c.C.atualizar(c.estado,0);c.ouvintes.fechar();
 c.C.atualizar(c.estado,900000);assert.equal(c.card.hidden,true);
 c.C.permitirNovamente();c.C.atualizar(c.estado,900001);assert.equal(c.card.hidden,false);
 let parou=false;c.ouvintes.keydown({key:'Enter',stopPropagation(){parou=true}});assert.equal(parou,true);
});

test('falha de QR não interrompe o palco nem repete tentativa a cada quadro',()=>{
 const c=cenario(true);c.C.atualizar(c.estado,0);c.C.atualizar(c.estado,16);
 assert.equal(c.card.hidden,true);assert.equal(c.tentativas(),1);
});
