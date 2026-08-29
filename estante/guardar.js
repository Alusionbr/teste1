"use strict";
/*
 * Guardar o repertório: persistência, instalar e lembrete de backup.
 *
 * O repertório vive só no localStorage, e isso tem um risco que não é igual
 * nos dois sistemas. No Safari, o ITP apaga o armazenamento de um site que
 * passa ~7 dias sem ser aberto — e "uma semana sem abrir" é exatamente o
 * intervalo de um coral que ensaia por semana. Instalar na tela de início tira
 * o site dessa regra; é a defesa mais eficaz que existe sem servidor.
 *
 * Três camadas, da mais silenciosa para a mais visível:
 *   1. pedirPersistencia() — não fala nada, nunca.
 *   2. ofereceInstalar()   — uma vez na vida, e só quando já há o que perder.
 *   3. lembrarBackup()     — uma vez por sessão, e só com prazo vencido.
 */

const BACKUP_DIAS=30;
// Abaixo disto ainda não há repertório que valha um aviso: quem tem duas
// músicas salvas não perdeu um show se o navegador limpar.
const MINIMO_PARA_AVISAR=5;

// iPadOS moderno se declara Mac; o toque é o que denuncia.
function ehIOS(){
  const ua=navigator.userAgent||"";
  return /iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
}
function jaInstalado(){
  return (matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
}
function totalDeMusicas(){return state.setlists.reduce((t,s)=>t+s.songs.length,0)}

/*
 * Pedir para o navegador não apagar o armazenamento. Silencioso de propósito:
 * o Chrome concede por engajamento, o Safari concede junto com a instalação na
 * tela de início, e em nenhum dos dois o usuário tem o que decidir aqui.
 */
async function pedirPersistencia(){
  try{
    if(!navigator.storage||!navigator.storage.persist)return false;
    if(await navigator.storage.persisted())return true;
    return await navigator.storage.persist();
  }catch{return false}
}

// O Chrome entrega o convite de instalação como evento; guardamos para usar no
// gesto do usuário mais tarde. `installPrompt` já existia em core.js desde a
// primeira versão do PWA e nunca tinha sido usado.
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e});

/*
 * Oferecer a instalação UMA vez, e só depois de existir repertório: antes
 * disso é propaganda de um app que a pessoa ainda não sabe se quer.
 * No iPhone não existe `beforeinstallprompt` — lá o passo a passo é a única
 * forma, e precisa estar escrito com as palavras que aparecem na tela do
 * aparelho.
 */
function ofereceInstalar(){
  if(state.installOferecido||jaInstalado())return false;
  if(totalDeMusicas()<MINIMO_PARA_AVISAR)return false;
  if(!installPrompt&&!ehIOS())return false;
  state.installOferecido=true;updatePrefs();
  if(installPrompt){
    notify('Guarde o Estante na tela de início: abre mais rápido, funciona sem internet e o repertório fica protegido. <button type="button" id="installBtn">Instalar</button>',true);
    const b=$("installBtn");
    if(b)b.onclick=async()=>{
      const p=installPrompt;installPrompt=null;
      if(!p)return notify("");
      try{await p.prompt();await p.userChoice;notify("")}catch{notify("")}
    };
  }else{
    notify('No iPhone, guarde o Estante na tela de início: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>. Sem isso o Safari pode apagar o repertório depois de alguns dias sem uso. <button type="button" id="entendiInstall">Entendi</button>',true);
    const b=$("entendiInstall");
    if(b)b.onclick=()=>notify("");
  }
  return true;
}

/*
 * Lembrete de backup: só quando há repertório de verdade e o último arquivo
 * exportado ficou velho. Na primeira vez apenas marca a data e não fala nada —
 * senão quem acabou de montar o repertório levaria um aviso no mesmo dia.
 */
function lembrarBackup(){
  if(totalDeMusicas()<MINIMO_PARA_AVISAR)return false;
  const ultimo=Number(state.ultimoBackup)||0;
  if(!ultimo){state.ultimoBackup=Date.now();updatePrefs();return false}
  if(Date.now()-ultimo<BACKUP_DIAS*864e5)return false;
  notify('Faz mais de um mês que você não exporta o repertório. Um arquivo guardado é o que salva o show se este aparelho falhar. <button type="button" id="backupAgora">Exportar agora</button>',true);
  const b=$("backupAgora");
  if(b)b.onclick=()=>{notify("");exportSetlist()};
  return true;
}
function marcarBackupFeito(){state.ultimoBackup=Date.now();updatePrefs()}

/*
 * Um aviso por abertura, no máximo — e o mais estrutural primeiro: instalar
 * resolve a causa, exportar resolve a consequência. notify() só mostra uma
 * mensagem de cada vez, então oferecer os dois juntos esconderia um deles.
 */
function guardarNaAbertura(){
  pedirPersistencia();
  setTimeout(()=>{if(!ofereceInstalar())lembrarBackup()},1500);
}
