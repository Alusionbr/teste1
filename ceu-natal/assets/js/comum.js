/*
 * Funções comuns a todas as páginas: anúncios (AdSense), aviso de cookies (LGPD),
 * nome do site e utilitários.
 */
(function (root) {
  'use strict';

  var CFG = root.CONFIG;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var adsAtivos = false;
  function adsConfigurado() { return !root.ACESSO_PRIVADO && /^ca-pub-\d+$/.test(CFG.adsense.cliente); }

  function carregarScriptAds() {
    if (adsAtivos || !adsConfigurado()) return;
    adsAtivos = true;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CFG.adsense.cliente;
    document.head.appendChild(s);
    $$('.anuncio').forEach(carregarAnuncio);
  }

  function carregarAnuncio(el) {
    if (!el || el.dataset.carregado) return;
    if(!adsConfigurado()){el.hidden=true;return;}
    if (!adsAtivos) { el.innerHTML = '<span>Publicidade</span>'; return; }
    el.dataset.carregado = '1';
    var slot = CFG.adsense.blocos[el.getAttribute('data-bloco')] || CFG.adsense.blocos.resultado;
    el.innerHTML = '<ins class="adsbygoogle" style="display:block" data-ad-client="' + CFG.adsense.cliente +
      '" data-ad-slot="' + slot + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    try { (root.adsbygoogle = root.adsbygoogle || []).push({}); } catch (e) { /* bloqueador de anúncios */ }
  }

  function lerConsentimento() { try { return localStorage.getItem('consentimento'); } catch (e) { return null; } }
  function salvarConsentimento(v) { try { localStorage.setItem('consentimento', v); } catch (e) { /* sem armazenamento */ } }

  function iniciarCookies() {
    var barra = $('#cookies');
    if (!barra) return;
    if(!adsConfigurado()){barra.hidden=true;$$('.anuncio').forEach(function(e){e.hidden=true;});return;}
    var c = lerConsentimento();
    if (c === 'aceito') carregarScriptAds();
    else if (!c) barra.hidden = false;
    $('#cookies-aceitar').addEventListener('click', function () { salvarConsentimento('aceito'); barra.hidden = true; carregarScriptAds(); });
    $('#cookies-recusar').addEventListener('click', function () { salvarConsentimento('recusado'); barra.hidden = true; });
    $$('.anuncio').forEach(carregarAnuncio);
  }

  function evento(nome, dados) { if (!root.ACESSO_PRIVADO && lerConsentimento()==='aceito' && root.gtag) root.gtag('event', nome, dados || {}); }

  /* Origem do visitante (utm_source=telegram etc.), guardada para medir conversão */
  function origem() {
    var p = new URLSearchParams(location.search);
    var o = p.get('utm_source');
    try {
      if (o) sessionStorage.setItem('origem', o);
      return o || sessionStorage.getItem('origem') || 'direto';
    } catch (e) { return o || 'direto'; }
  }

  function compartilhar(texto) {
    if (navigator.share) navigator.share({ text: texto }).catch(function () {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  }

  function iniciar() {
    $$('[data-nome-site]').forEach(function (el) { el.textContent = CFG.nomeSite; });
    var ano = $('#ano-atual');
    if (ano) ano.textContent = new Date().getFullYear();
    $$('[data-link-telegram]').forEach(function (el) {
      if (CFG.telegram && /^[a-zA-Z0-9_]{5,32}$/.test(CFG.telegram.bot) && CFG.telegram.bot.indexOf('SEU_') !== 0) el.href = 'https://t.me/' + CFG.telegram.bot + '?start=site';
      else (el.closest('[data-link-telegram-wrap]') || el).hidden = true;
    });
    $$('input[type=date]').forEach(function(e){e.max=new Date().toISOString().slice(0,10);});
    $$('.cidade-ajuda').forEach(function(e){e.textContent=(CFG.geocodificacao.modo==='local')?'Busca local: capitais brasileiras. Confirme a cidade na lista; outras cidades precisam da busca ampliada configurada.':'Digite a cidade e confirme estado e país na lista.';});
    iniciarCookies();
    evento('origem', { origem: origem() });
  }

  root.Comum = { $: $, $$: $$, esc: esc, carregarAnuncio: carregarAnuncio, evento: evento, origem: origem, compartilhar: compartilhar, iniciar: iniciar };
})(window);
