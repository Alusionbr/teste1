"use strict";
/*
 * Permissões da sala (PURO, sem DOM): o anfitrião (a tela da festa) decide o que cada
 * celular pode fazer. O celular só PEDE; quem aplica é sempre a tela (sala-host.js).
 *
 * Ações:
 *   pedir     pedir música ou música nova para a fila
 *   fila      subir, tirar ou tocar agora um item da fila
 *   pular     pular ou voltar a música (e a vez)
 *   tocar     pausar/retomar, volume, letra, ajuste de letra, começar
 *   playback  trocar o playback de uma música
 *   editar    editar título, artista e ajustes de uma música
 * Cada ação vale: "todos", "cantor" (só quem canta agora; sem dono na música = todos)
 * ou "anfitriao" (só a tela). `bloqueados` silencia nomes inteiros.
 *
 * A identidade é o NOME que o celular informou ao entrar: serve para festa de
 * família, não é segurança (quem usar o nome de outro herda as permissões dele).
 */
const ACOES_SALA=["pedir","fila","pular","tocar","playback","editar"];
const VALORES_PERMISSAO=["todos","cantor","anfitriao"];
const NIVEIS_SALA={
  livre:{pedir:"todos",fila:"todos",pular:"todos",tocar:"todos",playback:"todos",editar:"todos"},
  cantor:{pedir:"todos",fila:"todos",pular:"cantor",tocar:"cantor",playback:"todos",editar:"anfitriao"},
  anfitriao:{pedir:"todos",fila:"anfitriao",pular:"anfitriao",tocar:"anfitriao",playback:"anfitriao",editar:"anfitriao"}
};
// Comportamento anterior à 1.0.19 (prefs.pularFila): pausar e pedir livres; fila e pular só na tela.
const PADRAO_SALA={pedir:"todos",fila:"anfitriao",pular:"anfitriao",tocar:"todos",playback:"todos",editar:"anfitriao"};
const MAX_BLOQUEADOS=40;

const chaveDoNome=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();

// Nome do nível que as ações formam: "livre", "cantor", "anfitriao" ou "personalizado".
function nivelDasAcoes(acoes){
  for(const [nome,preset] of Object.entries(NIVEIS_SALA))
    if(ACOES_SALA.every(a=>acoes[a]===preset[a]))return nome;
  return "personalizado";
}
// Aceita qualquer coisa (backup antigo, dado corrompido). `pularFila` é a preferência antiga.
function normalizarPermissoes(p,{pularFila}={}){
  const base=pularFila===true?{...PADRAO_SALA,fila:"todos",pular:"todos"}:{...PADRAO_SALA};
  const acoes={};
  for(const a of ACOES_SALA){
    const v=p&&p.acoes&&p.acoes[a];
    acoes[a]=VALORES_PERMISSAO.includes(v)?v:base[a];
  }
  if(p&&NIVEIS_SALA[p.nivel]&&!(p.acoes))Object.assign(acoes,NIVEIS_SALA[p.nivel]);
  const vistos=new Set(),bloqueados=[];
  for(const n of Array.isArray(p&&p.bloqueados)?p.bloqueados:[]){
    const nome=String(n||"").slice(0,24).trim(),k=chaveDoNome(nome);
    if(!k||vistos.has(k)||bloqueados.length>=MAX_BLOQUEADOS)continue;
    vistos.add(k);bloqueados.push(nome);
  }
  return{nivel:nivelDasAcoes(acoes),acoes,bloqueados};
}
function aplicarNivel(perm,nivel){
  if(!NIVEIS_SALA[nivel])return normalizarPermissoes(perm);
  return normalizarPermissoes({acoes:NIVEIS_SALA[nivel],bloqueados:perm&&perm.bloqueados});
}
function definirAcao(perm,acao,valor){
  if(!ACOES_SALA.includes(acao)||!VALORES_PERMISSAO.includes(valor))return normalizarPermissoes(perm);
  return normalizarPermissoes({acoes:{...normalizarPermissoes(perm).acoes,[acao]:valor},bloqueados:perm&&perm.bloqueados});
}
function bloquearNome(perm,nome,bloquear=true){
  const atual=normalizarPermissoes(perm),k=chaveDoNome(nome);
  const resto=atual.bloqueados.filter(n=>chaveDoNome(n)!==k);
  return normalizarPermissoes({acoes:atual.acoes,bloqueados:bloquear?[...resto,String(nome).slice(0,24).trim()]:resto});
}
const estaBloqueado=(perm,nome)=>normalizarPermissoes(perm).bloqueados.some(n=>chaveDoNome(n)===chaveDoNome(nome));

// Qual ação um comando representa. Devolve null para o que nunca é restrito
// (entrar na sala, e "próxima" depois dos aplausos, que sempre foi livre).
function acaoDoComando(tipo,dados={},{fase=""}={}){
  switch(tipo){
    case "pedir_nova":return "pedir";
    case "pedir":
      if(dados.modo==="playback")return "playback";
      if(dados.modo==="letra")return "tocar";
      if(dados.modo==="editar")return "editar";
      return "pedir";
    case "subir_item":case "tirar_item":case "tocar_item":return "fila";
    case "proxima":return fase==="nota"?null:"pular";
    case "anterior":return "pular";
    case "alternar":case "adiantar":case "atrasar":case "volume":case "aplausos":case "comecar":return "tocar";
    default:return null;
  }
}
// donos: nomes de quem canta agora (cantorA/cantorB do item); vazio = ninguém é dono.
function podeFazer(perm,acao,{nome="",donos=[]}={}){
  const p=normalizarPermissoes(perm);
  if(estaBloqueado(p,nome))return false;
  if(!acao)return true;
  const v=p.acoes[acao];
  if(v==="todos")return true;
  if(v==="cantor")return donos.length===0||donos.some(d=>chaveDoNome(d)===chaveDoNome(nome));
  return false;
}
const TEXTO_ACAO={
  pedir:"pedir música",fila:"mexer na fila",pular:"pular a música",tocar:"pausar ou ajustar a música",
  playback:"trocar o playback",editar:"editar músicas"
};
const ROTULO_ACAO={
  pedir:"Pedir músicas",fila:"Mexer na fila (subir, tirar, tocar agora)",pular:"Pular ou voltar a música",
  tocar:"Pausar, volume e letra",playback:"Trocar o playback de uma música",editar:"Editar músicas (título, artista)"
};
function textoDaRecusa(perm,acao,nome){
  if(estaBloqueado(perm,nome))return "O anfitrião silenciou este aparelho.";
  const v=normalizarPermissoes(perm).acoes[acao];
  return v==="cantor"?`Só quem está cantando pode ${TEXTO_ACAO[acao]||"fazer isso"}.`:`O anfitrião não liberou ${TEXTO_ACAO[acao]||"isto"}.`;
}

if(typeof module!=="undefined")module.exports={ACOES_SALA,VALORES_PERMISSAO,NIVEIS_SALA,PADRAO_SALA,ROTULO_ACAO,TEXTO_ACAO,chaveDoNome,nivelDasAcoes,normalizarPermissoes,aplicarNivel,definirAcao,bloquearNome,estaBloqueado,acaoDoComando,podeFazer,textoDaRecusa};
