"use strict";
/*
 * Teste da sala contra o Supabase REAL (fetch puro, mesma chave publicável que o
 * navegador usa). Rode depois de aplicar as migrações da sala:
 *
 *   node karaoke/tests/sala-real.js
 *
 * Cria uma sala com código aleatório, percorre o fluxo (abrir → celular pede →
 * tela recebe → celular lê → fechar) e confere as recusas de segurança. A sala
 * de teste é sempre fechada no final, mesmo se algum passo falhar.
 * Não faz parte de `node --test`: precisa de internet e do banco preparado.
 */
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");

const fonte=fs.readFileSync(path.join(__dirname,"..","sala.js"),"utf8");
// KARAOKE_SUPABASE_URL só existe para testar este script contra um servidor de mentira.
const URL_BASE=process.env.KARAOKE_SUPABASE_URL||fonte.match(/SALA_SUPABASE_URL="([^"]+)"/)[1];
const CHAVE=fonte.match(/SALA_SUPABASE_KEY="([^"]+)"/)[1];

async function rpc(fn,corpo){
  const r=await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:CHAVE,Authorization:"Bearer "+CHAVE,"Content-Type":"application/json"},body:JSON.stringify(corpo)});
  const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{}
  return{status:r.status,dados:d,msg:d&&(d.message||"")};
}
const ALFA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codigo=[...crypto.randomBytes(6)].map(b=>ALFA[b%ALFA.length]).join("");
let token=crypto.randomBytes(20).toString("hex");
const tokenAntigo=token;
const outroToken=crypto.randomBytes(20).toString("hex");
const tokenProjetor=crypto.randomBytes(20).toString("hex");
const cel="ap-teste-"+crypto.randomBytes(4).toString("hex");

(async()=>{
  let passos=0;
  const ok=(nome)=>{passos++;console.log("  ✓",nome)};
  try{
    let r=await rpc("karaoke_sala_abrir",{p_codigo:codigo,p_token:token});
    if(r.status===404||/Could not find the function/.test(r.msg))throw Error("As funções da sala ainda não existem no Supabase. Aplique karaoke/supabase/001_sala.sql primeiro.");
    assert.equal(r.status,200,r.msg);assert.equal(r.dados.ok,true);ok("abrir sala");

    r=await rpc("karaoke_sala_abrir",{p_codigo:codigo,p_token:outroToken});
    assert.equal(r.status,400);assert.match(r.msg,/em uso/);ok("outro token na mesma sala é recusado");

    r=await rpc("karaoke_sala_abrir",{p_codigo:"abc",p_token:token});
    assert.equal(r.status,400);ok("código inválido é recusado");

    r=await rpc("karaoke_comando",{p_codigo:codigo,p_device:cel,p_nome:"Teste",p_tipo:"pedir",p_dados:{musicaId:"m-1"}});
    assert.equal(r.status,200,r.msg);ok("celular manda um pedido");

    r=await rpc("karaoke_comando",{p_codigo:codigo,p_device:cel,p_nome:"Teste",p_tipo:"apagar_tudo",p_dados:{}});
    assert.equal(r.status,400);assert.match(r.msg,/comando invalido/);ok("comando fora da lista é recusado");

    r=await rpc("karaoke_host_sync",{p_codigo:codigo,p_token:outroToken,p_estado:{},p_depois:0});
    assert.equal(r.status,400);assert.match(r.msg,/token/);ok("tela com token errado não lê comandos");

    r=await rpc("karaoke_host_sync",{p_codigo:codigo,p_token:token,p_estado:{agora:{title:"Música de teste"},fila:[]},p_depois:0});
    assert.equal(r.status,200,r.msg);assert.equal(r.dados.comandos.length,1);
    assert.equal(r.dados.comandos[0].tipo,"pedir");assert.equal(r.dados.comandos[0].dados.musicaId,"m-1");ok("tela publica o estado e recebe o pedido");
    const ultimo=r.dados.comandos[0].id;

    r=await rpc("karaoke_host_sync",{p_codigo:codigo,p_token:token,p_estado:null,p_depois:ultimo});
    assert.equal(r.dados.comandos.length,0);ok("pedido já lido não volta");

    r=await rpc("karaoke_sala_ver",{p_codigo:codigo,p_device:cel,p_nome:"Teste",p_versao:-1});
    assert.equal(r.dados.existe,true);assert.equal(r.dados.estado.agora.title,"Música de teste");
    const versao=r.dados.versao;ok("celular lê o estado");

    r=await rpc("karaoke_sala_ver",{p_codigo:codigo,p_device:cel,p_nome:"Teste",p_versao:versao});
    assert.equal(r.dados.estado,null);ok("mesma versão não reenvia o estado");

    r=await rpc("karaoke_host_sync",{p_codigo:codigo,p_token:token,p_estado:null,p_depois:ultimo});
    assert.equal(r.dados.aparelhos,1);ok("a tela vê 1 celular conectado");

    r=await rpc("karaoke_sala_transferir",{p_codigo:codigo,p_token_atual:outroToken,p_token_novo:tokenProjetor,p_estado:{transferencia:{id:"teste",envelope:{v:1}}}});
    assert.equal(r.status,400);assert.match(r.msg,/token/);ok("transferência com token antigo incorreto é recusada");
    r=await rpc("karaoke_sala_transferir",{p_codigo:codigo,p_token_atual:token,p_token_novo:tokenProjetor,p_estado:{transferencia:{id:"teste",envelope:{v:1}}}});
    assert.equal(r.status,200,r.msg);assert.equal(r.dados.ok,true);ok("a tela atual transfere a sala e publica o pacote de retomada");
    r=await rpc("karaoke_host_sync",{p_codigo:codigo,p_token:tokenAntigo,p_estado:null,p_depois:ultimo});
    assert.equal(r.status,400);assert.match(r.msg,/token/);ok("a tela anterior perde a autorização de anfitriã");
    token=tokenProjetor;
    r=await rpc("karaoke_sala_abrir",{p_codigo:codigo,p_token:token});
    assert.equal(r.status,200,r.msg);ok("o projetor assume a tela principal com o novo token");

    for(const t of ["salas","comandos","aparelhos"]){
      const g=await fetch(`${URL_BASE}/rest/v1/${t}?select=*`,{headers:{apikey:CHAVE,Authorization:"Bearer "+CHAVE}});
      assert.ok(g.status>=400,`/rest/v1/${t} não pode responder 2xx (respondeu ${g.status})`);
    }
    ok("as tabelas não são acessíveis direto pela API");

    r=await rpc("karaoke_sala_fechar",{p_codigo:codigo,p_token:outroToken});
    r=await rpc("karaoke_sala_ver",{p_codigo:codigo,p_device:cel,p_nome:"x",p_versao:-1});
    assert.equal(r.dados.existe,true);ok("fechar com token errado não fecha");
  }catch(e){
    console.error("\nFALHOU:",e.message||e);
    process.exitCode=1;
  }finally{
    const f=await rpc("karaoke_sala_fechar",{p_codigo:codigo,p_token:token}).catch(()=>null);
    if(f&&(f.status===200||f.status===204)){   // função sem retorno: o PostgREST responde 204
      const v=await rpc("karaoke_sala_ver",{p_codigo:codigo,p_device:cel,p_nome:"x",p_versao:-1});
      if(v.dados&&v.dados.existe===false)console.log("  ✓ sala de teste fechada e apagada");
      else{console.error("A sala de teste não foi apagada:",codigo);process.exitCode=1}
    }
    if(!process.exitCode)console.log(`\nOK — ${passos} verificações passaram contra o Supabase real.`);
  }
})();
