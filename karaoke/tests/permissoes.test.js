"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const P=require("../permissoes.js");

test("sem nada salvo vale o comportamento antigo (fila e pular só na tela, pausar livre)",()=>{
  const p=P.normalizarPermissoes(null);
  assert.equal(p.acoes.pedir,"todos");assert.equal(p.acoes.tocar,"todos");
  assert.equal(p.acoes.fila,"anfitriao");assert.equal(p.acoes.pular,"anfitriao");
  assert.equal(p.nivel,"personalizado");
});
test("migração da preferência antiga pularFila",()=>{
  const liberou=P.normalizarPermissoes(undefined,{pularFila:true});
  assert.equal(liberou.acoes.fila,"todos");assert.equal(liberou.acoes.pular,"todos");
  const nao=P.normalizarPermissoes(undefined,{pularFila:false});
  assert.equal(nao.acoes.fila,"anfitriao");
});
test("os 3 níveis prontos e o nível 'personalizado' quando se muda uma ação",()=>{
  for(const nivel of ["livre","cantor","anfitriao"]){
    const p=P.aplicarNivel(null,nivel);
    assert.equal(p.nivel,nivel);
  }
  const livre=P.aplicarNivel(null,"livre");
  const mexido=P.definirAcao(livre,"editar","anfitriao");
  assert.equal(mexido.nivel,"personalizado");
  assert.equal(P.definirAcao(mexido,"editar","todos").nivel,"livre","voltar ao valor do preset volta ao nome do nível");
});
test("lixo é descartado sem lançar",()=>{
  const p=P.normalizarPermissoes({acoes:{pedir:"qualquer",fila:42,tocar:"cantor"},bloqueados:["  Ana ","ana","",null,"X".repeat(50)]});
  assert.equal(p.acoes.pedir,"todos","valor inválido cai no padrão");
  assert.equal(p.acoes.tocar,"cantor");
  assert.equal(p.bloqueados.length,2,"repetido (sem acento/caixa) e vazio saem");
  assert.equal(P.normalizarPermissoes("lixo").acoes.pedir,"todos");
});
test("mapa comando → ação",()=>{
  const m=(t,d,f)=>P.acaoDoComando(t,d,{fase:f});
  assert.equal(m("pedir_nova",{}),"pedir");
  assert.equal(m("pedir",{modo:"fila"}),"pedir");
  assert.equal(m("pedir",{modo:"playback"}),"playback");
  assert.equal(m("pedir",{modo:"letra"}),"tocar");
  assert.equal(m("pedir",{modo:"editar"}),"editar");
  assert.equal(m("tirar_item"),"fila");assert.equal(m("subir_item"),"fila");assert.equal(m("tocar_item"),"fila");
  assert.equal(m("proxima",{},"cantando"),"pular");
  assert.equal(m("proxima",{},"nota"),null,"depois dos aplausos seguir sempre foi livre");
  assert.equal(m("anterior"),"pular");
  for(const t of ["alternar","adiantar","atrasar","volume","aplausos","comecar"])assert.equal(m(t),"tocar");
  assert.equal(m("entrar"),null);
});
test("'todos', 'anfitriao' e 'cantor' (com e sem dono)",()=>{
  const perm=P.aplicarNivel(null,"cantor");   // tocar e pular = cantor
  assert.equal(P.podeFazer(perm,"pedir",{nome:"Beto"}),true);
  assert.equal(P.podeFazer(perm,"tocar",{nome:"Beto",donos:["Ana"]}),false);
  assert.equal(P.podeFazer(perm,"tocar",{nome:"  ana ",donos:["Ana"]}),true,"nome sem caixa/acento/espaço sobrando");
  assert.equal(P.podeFazer(perm,"tocar",{nome:"Beto",donos:[]}),true,"música sem dono: todos");
  assert.equal(P.podeFazer(perm,"editar",{nome:"Ana",donos:["Ana"]}),false,"só o anfitrião edita");
  assert.equal(P.podeFazer(perm,null,{nome:"Beto"}),true,"comando sem ação (entrar) passa");
});
test("só o anfitrião: celular só pede",()=>{
  const perm=P.aplicarNivel(null,"anfitriao");
  assert.equal(P.podeFazer(perm,"pedir",{nome:"Ana"}),true);
  for(const a of ["fila","pular","tocar","playback","editar"])assert.equal(P.podeFazer(perm,a,{nome:"Ana",donos:["Ana"]}),false,a);
});
test("bloqueado não faz nada, nem pedir; liberar volta",()=>{
  let perm=P.aplicarNivel(null,"livre");
  perm=P.bloquearNome(perm,"Beto");
  assert.equal(P.estaBloqueado(perm,"beto"),true);
  assert.equal(P.podeFazer(perm,"pedir",{nome:"Beto"}),false);
  assert.equal(P.podeFazer(perm,null,{nome:"Beto"}),false,"nem entrar");
  assert.equal(P.podeFazer(perm,"pedir",{nome:"Ana"}),true);
  perm=P.bloquearNome(perm,"BETO",false);
  assert.equal(P.podeFazer(perm,"pedir",{nome:"Beto"}),true);
  assert.equal(perm.nivel,"livre","bloquear não muda o nível");
});
test("texto da recusa diz o motivo certo",()=>{
  const perm=P.bloquearNome(P.aplicarNivel(null,"cantor"),"Beto");
  assert.match(P.textoDaRecusa(perm,"tocar","Beto"),/silenciou/);
  assert.match(P.textoDaRecusa(perm,"tocar","Ana"),/quem está cantando/);
  assert.match(P.textoDaRecusa(perm,"editar","Ana"),/não liberou/);
});
