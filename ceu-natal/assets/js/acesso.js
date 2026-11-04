(function(root){
  'use strict';
  // Executa no head, antes de qualquer medição. Não importa dados por URL pública.
  var hash=new URLSearchParams(location.hash.slice(1)), token=hash.get('acesso');
  var query=new URLSearchParams(location.search), antigo=Array.from(query.keys()).some(function(k){return /^(?:[ab]_)?(?:n|d|h|lat|lon|tz|c)$/.test(k);});
  root.ACESSO_PRIVADO=!!token||antigo;
  if(root.ACESSO_PRIVADO)history.replaceState(null,'',location.pathname);
  function receber(tipo,callback){
    if(antigo){var a=document.createElement('p');a.className='aviso-acesso';a.textContent='Este link antigo continha dados pessoais. O endereço foi limpo. Preencha o formulário ou gere um novo acesso com código no bot.';document.querySelector('main').prepend(a);}
    if(!token)return;
    var dialog=document.createElement('dialog');dialog.className='modal';
    dialog.innerHTML='<form><h2>Abra sua leitura</h2><p>Digite o código de 6 números enviado pelo bot. O acesso expira em 15 minutos e funciona uma vez.</p><label>Código de acesso<input name="codigo" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><p class="erro" role="alert"></p><div class="acoes"><button class="btn" type="submit">Abrir leitura</button><button type="button" class="btn secundario">Cancelar</button></div></form>';
    document.body.append(dialog);dialog.showModal();
    var form=dialog.querySelector('form'),erro=dialog.querySelector('.erro'),botao=dialog.querySelector('[type=submit]');
    dialog.querySelector('[type=button]').onclick=function(){token=null;dialog.close();dialog.remove();};
    dialog.addEventListener('cancel',function(){token=null;});
    form.addEventListener('submit',async function(e){
      e.preventDefault();botao.disabled=true;erro.textContent='';
      try{
        var r=await fetch('/api/acesso',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token,codigo:form.elements.codigo.value}),cache:'no-store'});
        if(!r.headers.get('content-type')?.includes('application/json'))throw new Error('O acesso privado não está disponível neste endereço. Volte ao bot.');
        var d=await r.json();if(!r.ok)throw new Error(d.erro||'Não foi possível abrir.');
        token=null;
        if(d.tipo!==tipo)throw new Error('Abra o link na página indicada pelo bot.');
        callback(d);dialog.close();dialog.remove();
      }catch(e){erro.textContent=e.message||'Falha de conexão. Tente novamente.';}
      finally{botao.disabled=false;}
    });
  }
  root.Acesso={receber:receber};
})(window);
