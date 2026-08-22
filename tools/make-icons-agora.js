/*
 * make-icons-agora.js — gera os ícones PNG do Agora usando só a biblioteca
 * padrão do Node (zlib). Mesma técnica de tools/make-icons.js, com suporte a
 * círculo, que é o desenho do Agora.
 *
 * Uso:
 *   node tools/make-icons-agora.js
 *
 * Saída: agora/icon-192.png e agora/icon-512.png
 * O ícone vetorial (agora/icon.svg) é escrito à mão e não passa por aqui.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'agora');
const BG = [13, 17, 23];      // #0d1117 — fundo do app
const INK = [126, 224, 184];  // #7ee0b8 — verde do acento

// Coordenadas normalizadas (0..1), iguais às do icon.svg: um ponto grande (a
// tarefa do momento) e três barras cada vez mais apagadas (o resto da lista).
const CIRCULOS = [{ cx: 0.363, cy: 0.5, r: 0.145, a: 1 }];
const BARRAS = [
  { x: 0.582, y: 0.344, w: 0.230, h: 0.051, a: 0.55 },
  { x: 0.582, y: 0.475, w: 0.176, h: 0.051, a: 0.35 },
  { x: 0.582, y: 0.605, w: 0.121, h: 0.051, a: 0.20 }
];

function misturar(px, i, alfa) {
  px[i] = Math.round(BG[0] * (1 - alfa) + INK[0] * alfa);
  px[i + 1] = Math.round(BG[1] * (1 - alfa) + INK[1] * alfa);
  px[i + 2] = Math.round(BG[2] * (1 - alfa) + INK[2] * alfa);
}

function desenhar(size) {
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0]; px[i * 4 + 1] = BG[1]; px[i * 4 + 2] = BG[2]; px[i * 4 + 3] = 255;
  }
  for (const c of CIRCULOS) {
    const cx = c.cx * size, cy = c.cy * size, r = c.r * size;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        // Uma faixa de 1px suaviza a borda; sem isso o círculo fica serrilhado.
        const alfa = d <= r - 0.5 ? 1 : d >= r + 0.5 ? 0 : (r + 0.5 - d);
        if (alfa > 0) misturar(px, (y * size + x) * 4, alfa * c.a);
      }
    }
  }
  for (const b of BARRAS) {
    const x0 = Math.round(b.x * size), x1 = Math.round((b.x + b.w) * size);
    const y0 = Math.round(b.y * size), y1 = Math.round((b.y + b.h) * size);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        misturar(px, (y * size + x) * 4, b.a);
      }
    }
  }
  return px;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPNG(px, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // byte de filtro: 0 = sem filtro
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bits por canal
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

[192, 512].forEach(size => {
  const arquivo = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(arquivo, toPNG(desenhar(size), size));
  console.log(`gerado ${path.relative(process.cwd(), arquivo)}`);
});
