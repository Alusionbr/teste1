(() => {
'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const config = window.CONVITE_CONFIG || {};
const audio = $('#partyAudio'), btn = $('#musicControl'), label = $('#musicLabel'), icon = $('#musicIcon');
const welcome = $('#welcome'), dialog = $('#rsvpDialog'), form = $('#rsvpForm'), counts = $('#guestCounts');
const error = $('#formError'), toastEl = $('#toast');
let timer, priorFocus;
const toast = (message) => {clearTimeout(timer);toastEl.textContent=message;toastEl.classList.add('visible');timer=setTimeout(()=>toastEl.classList.remove('visible'),3800)};
const musicUpdate=()=>{const playing=!audio.paused;btn.setAttribute('aria-pressed',String(playing));btn.setAttribute('aria-label',playing?'Pausar música':'Tocar música');icon.textContent=playing?'❚❚':'♫';label.textContent=playing?'Pausar música':'Tocar música'};
const play=()=>audio.play().then(musicUpdate).catch(()=>toast('Toque em Tocar música para ativar o som.'));
const enter=()=>{welcome.hidden=true;document.body.style.overflow='';$('#hero-title').setAttribute('tabindex','-1');$('#hero-title').focus({preventScroll:true})};
document.body.style.overflow='hidden';
$('#enterWithMusic').addEventListener('click',()=>{play();enter()});
$('#enterWithoutMusic').addEventListener('click',enter);
btn.addEventListener('click',()=>audio.paused?play():audio.pause());
audio.addEventListener('play',musicUpdate);audio.addEventListener('pause',musicUpdate);
function countdown(){
const start=new Date(config.inicio||'2026-10-27T18:00:00-03:00').getTime(), end=new Date(config.fim||'2026-10-27T22:00:00-03:00').getTime(), now=Date.now(), d=Math.max(0,start-now);
const nums=[Math.floor(d/86400000),Math.floor(d/3600000)%24,Math.floor(d/60000)%60,Math.floor(d/1000)%60];
$$('#countdown strong').forEach((n,i)=>n.textContent=String(nums[i]).padStart(2,'0'));
if(now>=end)$('#countdownNote').textContent='O evento já aconteceu. Obrigado pelo carinho!';
else if(now>=start)$('#countdownNote').textContent='A festa começou! Vem comemorar!';
else if(d<86400000)$('#countdownNote').textContent='Falta pouco! Esperamos por você!';
}
countdown();setInterval(countdown,1000);
const open=()=>{priorFocus=document.activeElement;error.hidden=true;dialog.showModal?dialog.showModal():dialog.setAttribute('open','');$('#guestName').focus()};
const close=()=>{dialog.close?dialog.close():dialog.removeAttribute('open');priorFocus?.focus?.()};
$$('[data-open-rsvp]').forEach(e=>e.addEventListener('click',open));
$('#closeRsvp').addEventListener('click',close);
dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
$$('input[name="attendance"]').forEach(e=>e.addEventListener('change',()=>{counts.hidden=$('input[name="attendance"]:checked').value==='nao'}));

const submitButton = form.querySelector('[type="submit"]');
const success = $('#rsvpSuccess');
const storageName='convite_angelica_resposta_chave_v1';
function getGuestKey(){
  try {const saved=localStorage.getItem(storageName);if(saved && /^[a-f0-9-]{36}$/i.test(saved))return saved;} catch(e){}
  const key=crypto.randomUUID();
  try {localStorage.setItem(storageName,key);} catch(e){}
  return key;
}
const client = window.supabase?.createClient?.(config.supabaseUrl,config.supabasePublishableKey,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
form.addEventListener('submit',async (event)=>{
  event.preventDefault();
  if(submitButton.disabled)return;
  try{
    error.hidden=true;
    if(!client)throw Error('Não foi possível conectar ao serviço de confirmação. Atualize a página e tente novamente.');
    const nome=$('#guestName').value.trim().replace(/\\s+/g,' ');
    const resposta=$('input[name="attendance"]:checked')?.value;
    if(nome.length<2 || nome.length>70)throw Error('Digite um nome entre 2 e 70 caracteres.');
    if(!['sim','talvez','nao'].includes(resposta))throw Error('Escolha sua resposta.');
    let amounts=['adults','children5','children0'].map(n=>Number(form.elements[n].value));
    if(resposta==='nao')amounts=[0,0,0];
    if(amounts.some(n=>!Number.isInteger(n)||n<0||n>30))throw Error('As quantidades devem estar entre 0 e 30.');
    if(resposta!=='nao' && (amounts.reduce((a,b)=>a+b,0)<1 || amounts.reduce((a,b)=>a+b,0)>40))throw Error('Informe entre 1 e 40 pessoas no total.');
    submitButton.disabled=true;
    submitButton.textContent='Salvando sua resposta…';
    const {data,rpcError,error:apiError}=await client.rpc('convite_angelica_registrar',{
      p_chave:getGuestKey(),p_nome:nome,p_resposta:resposta,
      p_adultos:amounts[0],p_criancas_5_9:amounts[1],p_criancas_0_4:amounts[2]
    });
    if(apiError || rpcError || !data?.ok)throw Error('Não foi possível salvar agora. Verifique sua conexão e tente novamente.');
    form.hidden=true;
    success.hidden=false;
    $('#rsvpSuccessTitle').textContent=resposta==='sim'?'Presença confirmada!':resposta==='talvez'?'Talvez registrado!':'Resposta registrada!';
    $('#rsvpSuccessMessage').textContent='Sua resposta ficou salva na lista privada da organização. Se precisar, você pode alterá-la neste aparelho.';
    success.querySelector('button')?.focus();
  }catch(e){
    error.textContent=e.message||'Ocorreu um erro. Tente novamente.';
    error.hidden=false;
  }finally{
    submitButton.disabled=false;
    submitButton.textContent='Salvar minha confirmação ✓';
  }
});
$('#editRsvp').addEventListener('click',()=>{success.hidden=true;form.hidden=false;$('#guestName').focus()});
$('#finishRsvp').addEventListener('click',close);
const addr=config.endereco||'Restaurante Dos Sertões, Estrada de Jacarepaguá, 7636, Freguesia, Rio de Janeiro, RJ';
$('#googleMaps').href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(addr)+'&travelmode=driving';
$('#waze').href='https://www.waze.com/ul?q='+encodeURIComponent(addr)+'&navigate=yes';
async function copy(value){try{await navigator.clipboard.writeText(value);return true}catch(e){const t=document.createElement('textarea');t.value=value;document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();return ok}}
$('#copyAddress').addEventListener('click',async()=>toast(await copy(addr)?'Endereço copiado!':'Copie o endereço acima.'));
$('#shareBtn').addEventListener('click',async()=>{
const data={title:'A Noite da Angélica | Convite',text:'🎉 Você está convidado para o aniversário da Angélica, dia 27/10, no Dos Sertões!',url:location.href};
if(navigator.share){try{await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}
toast(await copy(data.text+' '+data.url)?'Link do convite copiado!':'Use o endereço do navegador para compartilhar.')
});
$('#calendarBtn').addEventListener('click',()=>{
const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Convite Angelica//PT-BR','BEGIN:VEVENT','UID:convite-angelica-20261027','DTSTAMP:20261020T210000Z','DTSTART:20261027T210000Z','DTEND:20261028T010000Z','SUMMARY:Aniversário da Angélica - Dos Sertões','LOCATION:Estrada de Jacarepaguá\\, 7636\\, Freguesia\\, Rio de Janeiro','END:VEVENT','END:VCALENDAR'].join('\r\n')+'\r\n';
const url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}));
const a=document.createElement('a');a.href=url;a.download='aniversario-angelica.ics';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Adicione o evento ao calendário!');
});
})();