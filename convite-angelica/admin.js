(() => {
'use strict';
const $=s=>document.querySelector(s);
const config=window.CONVITE_CONFIG||{};
const client=window.supabase?.createClient?.(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const tokenKey='convite_angelica_admin_token_session';
let secret='', records=[],busy=false;
const feedback=(msg,failed=false)=>{const el=$('#dashboardNotice');el.textContent=msg;el.className='feedback '+(failed?'error':'ok');};
const denied=(msg)=>{const el=$('#authError');el.hidden=false;el.textContent=msg};
const isoDate=s=>s?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s)):'—';
const csvText=v=>{const str=String(v??'').replace(/"/g,'""');return '"'+(/^[\s]*[=+@\-]/.test(str)?"'"+str:str)+'"'};
function getLink(){return location.origin+location.pathname+'#chave='+secret;}
function verifyForm(){
  const t=$('#tokenInput').value.trim();
  if(!/^[0-9a-f]{64}$/i.test(t)){denied('A chave deve conter 64 caracteres. Use o link privado completo.');return;}
  authorize(t);
}
const session=()=>{try{return sessionStorage.getItem(tokenKey)||''}catch{return ''}};
const setSession=v=>{try{if(v)sessionStorage.setItem(tokenKey,v);else sessionStorage.removeItem(tokenKey)}catch{}};
async function authorize(t){
  if(!client){denied('Não foi possível conectar ao Supabase. Atualize a página.');return}
  secret=t;
  $('#unlockButton').disabled=true;
  $('#authError').hidden=true;
  try{
    const {data,error}=await client.rpc('convite_angelica_admin_listar',{p_token:secret});
    if(error||!data?.ok){secret='';setSession('');throw Error('Chave inválida ou sem autorização. Confira o link privado.')}
    setSession(secret);
    $('#authSection').hidden=true;$('#dashboard').hidden=false;
    records=Array.isArray(data.itens)?data.itens:[];
    render();
    $('#lastUpdated').textContent='Atualizado em '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium'}).format(new Date());
  }catch(e){denied(e.message||'Falha de autenticação. Tente novamente.')}
  finally{$('#unlockButton').disabled=false}
}
async function refresh(){
  if(!secret ||busy)return;
  busy=true;$('#refreshButton').disabled=true;
  try{
    const {data,error}=await client.rpc('convite_angelica_admin_listar',{p_token:secret});
    if(error||!data?.ok)throw Error('Não foi possível consultar a lista. Verifique a conexão e a chave.');
    records=Array.isArray(data.itens)?data.itens:[];
    render();$('#lastUpdated').textContent='Atualizado em '+new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium'}).format(new Date());
    feedback('Lista atualizada.');
  }catch(e){feedback(e.message||'Erro ao atualizar.',true)}
  finally{busy=false;$('#refreshButton').disabled=false}
}
function countStats(){
  const yes=records.filter(r=>r.resposta==='sim'), maybe=records.filter(r=>r.resposta==='talvez');
  const sum=(arr,key)=>arr.reduce((a,r)=>a+Number(r[key]||0),0);
  const c=[sum(yes,'adultos'),sum(yes,'criancas_5_9'),sum(yes,'criancas_0_4')];
  $('#statTotal').textContent=records.length;
  $('#statSim').textContent=yes.length;
  $('#statTalvez').textContent=maybe.length;
  $('#statNao').textContent=records.filter(r=>r.resposta==='nao').length;
  $('#statPessoas').textContent=c.reduce((a,b)=>a+b,0);
  $('#details').textContent='Confirmados — Adultos: '+c[0]+' · Crianças 5 a 9: '+c[1]+' · Crianças 0 a 4: '+c[2];
  $('#reviewed').textContent=records.filter(r=>r.conferido).length+' de '+records.length+' respostas conferidas. Pessoas em “Talvez”: '+(sum(maybe,'adultos')+sum(maybe,'criancas_5_9')+sum(maybe,'criancas_0_4'));
}
function elt(tag,classes,text){
 const e=document.createElement(tag);if(classes)e.className=classes;if(text!==undefined)e.textContent=String(text);return e;
}
function render(){
 countStats();
 const q=$('#searchInput').value.trim().toLocaleLowerCase('pt-BR'), filter=$('#filterSelect').value;
 const rows=records.filter(r=>r.nome.toLocaleLowerCase('pt-BR').includes(q)&&(filter==='todos'||r.resposta===filter||(filter==='pendentes'&&!r.conferido)));
 const list=$('#guestList');list.replaceChildren();
 if(!rows.length){list.append(elt('div','empty',records.length?'Nenhuma resposta corresponde ao filtro.':'Ainda não há confirmações cadastradas.'));return;}
 rows.forEach(r=>{
  const card=elt('article','guest'),first=elt('div');
  first.append(elt('strong','',r.nome),elt('small','', 'Enviado: '+isoDate(r.criado_em)));
  const col2=elt('div');const p=elt('span','pill '+r.resposta,r.resposta==='sim'?'✓ Confirmado':r.resposta==='talvez'?'? Talvez':'× Não vai');col2.append(p);
  const numbers=elt('p','count-text',r.resposta==='nao'?'Não participará.':r.adultos+' adulto(s) · '+r.criancas_5_9+' criança(s) 5–9 · '+r.criancas_0_4+' criança(s) 0–4');
  const controls=elt('div','controls'),label=elt('label'),toggle=elt('input');
  toggle.type='checkbox';toggle.checked=Boolean(r.conferido);toggle.setAttribute('aria-label','Marcar conferido para '+r.nome);
  label.append(toggle,document.createTextNode('Conferido'));
  toggle.addEventListener('change',async()=>{
    toggle.disabled=true;const newState=toggle.checked;
    try{const {data,error}=await client.rpc('convite_angelica_admin_conferir',{p_token:secret,p_id:r.id,p_conferido:newState});
      if(error||!data?.ok)throw Error('Não foi possível atualizar a conferência.');
      r.conferido=newState;countStats();feedback('Conferência salva.');
    }catch(e){toggle.checked=!newState;feedback(e.message||'Erro ao salvar.',true)}
    finally{toggle.disabled=false}
  });
  const remove=elt('button','remove','Excluir');remove.type='button';remove.setAttribute('aria-label','Excluir resposta de '+r.nome);
  remove.addEventListener('click',async()=>{
    if(!window.confirm('Excluir definitivamente a resposta de '+r.nome+'? Esta ação não pode ser desfeita.'))return;
    remove.disabled=true;
    try{const {data,error}=await client.rpc('convite_angelica_admin_excluir',{p_token:secret,p_id:r.id});
      if(error||!data?.ok)throw Error('Não foi possível excluir o registro.');
      records=records.filter(x=>x.id!==r.id);render();feedback('Resposta excluída.');
    }catch(e){feedback(e.message||'Erro ao excluir.',true);remove.disabled=false}
  });
  controls.append(label,remove);card.append(first,col2,numbers,controls);list.append(card);
 });
}
function exportCSV(){
 const headings=['Nome','Resposta','Adultos','Crianças 5-9','Crianças 0-4','Conferido','Enviado em'];
 const rows=records.map(r=>[r.nome,r.resposta,r.adultos,r.criancas_5_9,r.criancas_0_4,r.conferido?'Sim':'Não',isoDate(r.criado_em)]);
 const csv='\ufeff'+[headings,...rows].map(row=>row.map(csvText).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='lista-angelica-27-10-2026.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 feedback('Arquivo CSV gerado.');
}
$('#authForm').addEventListener('submit',e=>{e.preventDefault();verifyForm()});
$('#refreshButton').addEventListener('click',refresh);
$('#searchInput').addEventListener('input',render);
$('#filterSelect').addEventListener('change',render);
$('#exportButton').addEventListener('click',exportCSV);
$('#sharePrivateButton').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(getLink());feedback('Link privado copiado. Compartilhe somente com pessoas autorizadas.')}
 catch{feedback('Copie o link privado da sua mensagem original.',true)}
});
$('#lockButton').addEventListener('click',()=>{
 secret='';setSession('');records=[];$('#authSection').hidden=false;$('#dashboard').hidden=true;$('#tokenInput').value='';$('#authError').hidden=true;$('#tokenInput').focus()
});
const parsed=new URLSearchParams(location.hash.slice(1));
const fromLink=parsed.get('chave');
if(location.hash)history.replaceState(null,'',location.pathname+location.search);
if(fromLink && /^[a-f0-9]{64}$/i.test(fromLink)){authorize(fromLink)}
else if(session() && /^[a-f0-9]{64}$/i.test(session()))authorize(session());
setInterval(()=>{if(!$('#dashboard').hidden && document.visibilityState==='visible')refresh()},60000);
})();