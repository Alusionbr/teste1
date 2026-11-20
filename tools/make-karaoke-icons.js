/*
 * make-karaoke-icons.js — gera karaoke/icon-192.png e karaoke/icon-512.png a
 * partir de karaoke/icon.svg, desenhando o SVG no Chromium do Playwright.
 * Ferramenta só de desenvolvimento: o app não depende dela.
 *
 * Uso: node tools/make-karaoke-icons.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const dir = path.join(__dirname, '..', 'karaoke');
  const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    // Ícone "maskable": o desenho já tem fundo cheio, então ocupa a área toda.
    await page.setContent(`<html><body style="margin:0;background:#140b2b">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    const file = path.join(dir, `icon-${size}.png`);
    await page.screenshot({ path: file, omitBackground: false });
    console.log('Ícone gerado:', file);
    await page.close();
  }
  await browser.close();
})();
