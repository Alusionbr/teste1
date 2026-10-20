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
function getMessage(){
const name=$('#guestName').value.trim().replace(/\s+/g,' ');
if(name.length<2)throw Error('Informe seu nome para confirmar.');
const status=$('input[name="attendance"]:checked').value;
const intro=`Olá! Sou ${name}. Estou respondendo ao convite do aniversário da ${config.nomeAniversariante||'Angélica'} no Dos Sertões, dia 27/10/2026, das 18h às 22h.`;
if(status==='nao')return `${intro}\n\n😔 Infelizmente não poderei comparecer. Obrigado pelo convite!`;
const nums=['adults','children5','children0'].map(n=>{const v=Number(form.elements[n].value);if(!Number.isInteger(v)||v<0||v>30)throw Error('Informe quantidades de 0 a 30.');return v});
if(nums.reduce((a,b)=>a+b,0)===0)throw Error('Indique ao menos uma pessoa.');
return `${intro}\n\n${status==='sim'?'🎉 CONFIRMO MINHA PRESENÇA!':'🤔 TALVEZ EU VÁ.'}\n👤 Adultos: ${nums[0]}\n🧒 Crianças de 5 a 9 anos: ${nums[1]}\n👶 Crianças de 0 a 4 anos: ${nums[2]}\n📍 Estrada de Jacarepaguá, 7636, Freguesia, RJ.\n\nAté lá!`;
}
form.addEventListener('submit',e=>{e.preventDefault();try{const msg=getMessage();error.hidden=true;const phone=String(config.whatsappOrganizador||'').replace(/\D/g,'');window.location.href=`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}catch(err){error.textContent=err.message||'Verifique os dados.';error.hidden=false}});
if(/^\d{10,15}$/.test(String(config.whatsappOrganizador||'').replace(/\D/g,'')))$('#formNote').textContent='Seu WhatsApp abrirá com a mensagem pronta para o organizador. Toque em Enviar para confirmar.';
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