/*
 * make-icons.js — gera os ícones PNG do Estante a partir de um desenho simples,
 * usando só a biblioteca padrão do Node (zlib). Sem dependência externa.
 *
 * Uso:
 *   node tools/make-icons.js
 *
 * Saída: estante/icon-192.png e estante/icon-512.png
 * O ícone vetorial (estante/icon.svg) é escrito à mão e não passa por aqui.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'estante');
const BG = [13, 17, 23];      // #0d1117 — mesmo fundo do app
const INK = [255, 193, 94];   // #ffc15e — âmbar do modo palco

// Desenho: três "livros" na estante e uma linha de base, em coordenadas 0..1.
// Cada retângulo é {x, y, w, h} normalizado; assim o mesmo desenho serve
// para qualquer tamanho.
const SHAPES = [
  { x: 0.20, y: 0.24, w: 0.11, h: 0.46 },
  { x: 0.34, y: 0.18, w: 0.11, h: 0.52 },
  { x: 0.48, y: 0.28, w: 0.11, h: 0.42 },
  { x: 0.62, y: 0.22, w: 0.11, h: 0.48 },
  { x: 0.16, y: 0.73, w: 0.61, h: 0.07 }
];

function drawIcon(size) {
  // Buffer RGBA: 4 bytes por pixel, fundo sólido.
  const px = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = BG[0];
    px[i * 4 + 1] = BG[1];
    px[i * 4 + 2] = BG[2];
    px[i * 4 + 3] = 255;
  }
  for (const s of SHAPES) {
    const x0 = Math.round(s.x * size), x1 = Math.round((s.x + s.w) * size);
    const y0 = Math.round(s.y * size), y1 = Math.round((s.y + s.h) * size);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * size + x) * 4;
        px[i] = INK[0];
        px[i + 1] = INK[1];
        px[i + 2] = INK[2];
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
  // Cada linha do PNG começa com o byte de filtro (0 = sem filtro).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
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

for (const size of [192, 512]) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, toPNG(drawIcon(size), size));
  console.log('Ícone gerado:', file);
}
