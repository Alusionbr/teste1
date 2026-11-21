"use strict";
/*
 * Diagnóstico (Ajustes): separa "é a internet" de "é o app" com número.
 *  - mede o tempo de resposta de cada serviço de que o app depende;
 *  - mostra o que o player do YouTube mandou (gravador de fonte-youtube.js): maior
 *    intervalo entre mensagens, mensagens de outro vídeo, quantas vezes a letra teria parado;
 *  - lista os últimos avisos e erros.
 * Só leitura. O relatório não leva letras, nomes de cantores nem a chave do YouTube.
 */
const Diagnostico=(()=>{
  const erros=[];
  window.addEventListener("error",e=>{erros.push({em:Date.now(),msg:String(e.message||e).slice(0,160)});if(erros.length>20)erros.shift()});
  window.addEventListener("unhandledrejection",e=>{erros.push({em:Date.now(),msg:"promessa: "+String(e.reason&&e.reason.message||e.reason).slice(0,160)});if(erros.length>20)erros.shift()});

  const hora=t=>new Date(t).toLocaleTimeString("pt-BR");
  async function medir(nome,fn){
    const ini=performance.now();
    try{await fn();return{nome,ms:Math.round(performance.now()-ini),ok:true}}
    catch(e){return{nome,ms:Math.round(performance.now()-ini),ok:false,erro:String(e.message||e).slice(0,80)}}
  }
  async function medirServicos(){
    const alvos=[
      ["Sala (Supabase)",()=>salaRpc("karaoke_catalogo_buscar",{p_consulta:"diagnostico"},6000)],
      ["Letras (LRCLIB)",()=>fetchSafe("https://lrclib.net/api/search?q=teste",{},6000).then(r=>{if(!r.ok)throw Error("status "+r.status)})],
      ["YouTube (miniaturas)",()=>fetchSafe("https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",{mode:"no-cors"},6000)]
    ];
    if(typeof INSTANCIAS_BUSCA!=="undefined")alvos.push(["Busca ("+INSTANCIAS_BUSCA[0].replace("https://","")+")",()=>fetchSafe(INSTANCIAS_BUSCA[0]+"/search?q=teste&filter=videos",{},6000).then(r=>{if(!r.ok)throw Error("status "+r.status)})]);
    return Promise.all(alvos.map(([n,f])=>medir(n,f)));
  }
  function linhaMedida(m){return `  ${m.nome}: ${m.ok?m.ms+" ms":"FALHOU ("+m.erro+", "+m.ms+" ms)"}`}
  function leituraRede(){
    const c=navigator.connection||{};
    return `online: ${navigator.onLine?"sim":"NÃO"} · tipo: ${c.effectiveType||"?"} · descida: ${c.downlink||"?"} Mb/s · latência: ${c.rtt||"?"} ms`;
  }
  async function montar(){
    const L=[];
    L.push(`Karaokê em Casa ${typeof APP_VERSION!=="undefined"?APP_VERSION:"?"} — ${new Date().toLocaleString("pt-BR")}`);
    L.push(`Aparelho: ${navigator.userAgent.slice(0,120)}`);
    L.push(`Tela: ${innerWidth}×${innerHeight} · memória do aparelho: ${navigator.deviceMemory||"?"} GB · núcleos: ${navigator.hardwareConcurrency||"?"}`);
    L.push(`Rede: ${leituraRede()}`);
    L.push("","Tempo de resposta dos serviços:");
    (await medirServicos()).forEach(m=>L.push(linhaMedida(m)));
    if(typeof FonteYouTube!=="undefined"){
      const d=FonteYouTube.diagnostico();
      L.push("","Player do YouTube (sincronia da letra):");
      L.push(`  mensagens recebidas: ${d.mensagens} · maior intervalo entre mensagens: ${d.maiorIntervaloMs} ms (ideal ≈ 250)`);
      L.push(`  vezes em que a letra teria parado: ${d.congelamentos} · mensagens de OUTRO vídeo ignoradas: ${d.outraMidia} · origem do player: ${d.origem}`);
      L.push(`  duração lida do vídeo: ${d.duracaoVideo||"?"} s · em outra mídia agora: ${d.emAnuncio?"SIM":"não"} · estado do player: ${d.estado}`);
      L.push(`  últimas mensagens (ms desde a 1ª · vídeo pedido · video_id da mensagem · estado · tempo · duração · outra mídia):`);
      d.registro.slice(-40).forEach(r=>L.push(`    ${r.t} · ${r.v} · ${r.id||"-"} · ${r.e} · ${r.c} · ${r.d} · ${r.a?"OUTRA":"-"}`));
    }
    if(typeof SalaHost!=="undefined"){
      try{const bytes=JSON.stringify(SalaHost.montarEstado()).length;L.push("",`Estado enviado aos celulares: ${(bytes/1024).toFixed(1)} KB a cada mudança (acima de ~40 KB pesa em rede móvel)`)}catch{}
    }
    const fontes=Object.entries(sourceStatus||{}).map(([n,s])=>`  ${n}: ${s.ok?"ok":"FALHOU"} (${hora(s.at)})${s.detail&&!s.ok?" "+String(s.detail).slice(0,60):""}`);
    if(fontes.length)L.push("","Saúde das fontes nesta sessão:",...fontes);
    const avisos=[...AVISOS].reverse().slice(0,12).map(a=>`  ${hora(a.em)} ${a.ok?"✓":"!"} ${a.msg}`);
    if(avisos.length)L.push("","Últimos avisos:",...avisos);
    const errs=[...erros].reverse().slice(0,8).map(a=>`  ${hora(a.em)} ${a.msg}`);
    if(errs.length)L.push("","Erros do app:",...errs);
    return L.join("\n");
  }
  return{montar};
})();
document.addEventListener("click",async e=>{
  const alvo=e.target.closest("#diagMedir,#diagCopiar");if(!alvo)return;
  const pre=document.getElementById("diagTexto");
  if(alvo.id==="diagMedir"){
    pre.textContent="Medindo…";alvo.disabled=true;
    try{pre.textContent=await Diagnostico.montar()}finally{alvo.disabled=false}
  }else{
    if(!pre.textContent||/^Toque em|^Medindo/.test(pre.textContent))pre.textContent=await Diagnostico.montar();
    try{await navigator.clipboard.writeText(pre.textContent);notify("Relatório copiado. Cole na conversa.",true)}
    catch{const r=document.createRange();r.selectNodeContents(pre);const s=getSelection();s.removeAllRanges();s.addRange(r);notify("Selecionei o texto: use Copiar do aparelho.")}
  }
});
