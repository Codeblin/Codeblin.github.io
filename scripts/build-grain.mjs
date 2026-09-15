/**
 * 128×128 grayscale noise tile. A static PNG, not an SVG filter — feTurbulence
 * over a full-viewport layer re-rasterises on scroll and is what made the
 * page flicker.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const label = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const payload = Buffer.concat([label, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, crc]);
}

const SIZE = 128;
const raw = Buffer.alloc((SIZE + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  raw[y * (SIZE + 1)] = 0;
  for (let x = 0; x < SIZE; x += 1) {
    // Deterministic so the file is stable across builds.
    // Dark-field grain: values sit around --void so the tile can be used as a
    // real background, not an opacity overlay (overlays flicker on scroll).
    // Integer hash — the previous linear mix tiled into rings, which is a
    // watermark, not grain.
    let h = Math.imul(x + 1, 1597334677) ^ Math.imul(y + 1, 3812015801);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    raw[y * (SIZE + 1) + 1 + x] = (h >>> 0) % 36;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destDir = path.join(root, 'apps/web/public');
mkdirSync(destDir, { recursive: true });
writeFileSync(path.join(destDir, 'grain.png'), png);
console.log(`Wrote grain.png (${png.length} bytes)`);
