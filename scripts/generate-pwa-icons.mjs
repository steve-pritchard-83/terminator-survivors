import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const iconDir = path.resolve('public/icons');
const fontDir = path.resolve('public/fonts');
const audioDir = path.resolve('public/audio');
fs.mkdirSync(iconDir, { recursive: true });
fs.mkdirSync(fontDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

// Verify fonts and audio assets in public/
const fontTtf = path.join(fontDir, 'terminator-real-nfi.ttf');
const audioBg = path.join(audioDir, 'backgroundmusic.mp3');
if (!fs.existsSync(fontTtf) || !fs.existsSync(audioBg)) {
  console.warn('Warning: Core font or background music asset missing in public/');
}

// Preserve custom artwork PWA icons if already staged in public/icons
const existingIcon512 = path.join(iconDir, 'icon-512.png');
if (fs.existsSync(existingIcon512) && fs.statSync(existingIcon512).size > 8192) {
  console.log('Verified core fonts, audio, and custom PWA icons in public/');
  process.exit(0);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}
function createIconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.36;
  const eyeY = cy - size * 0.04,
    eyeDx = size * 0.13,
    eyeR = size * 0.065;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      let R = 5,
        G = 13,
        B = 26;
      const dx = x - cx,
        dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < r && (dy < size * 0.12 || Math.abs(dx) < size * 0.18)) {
        R = 140;
        G = 156;
        B = 176;
      }
      const dLeft = Math.hypot(x - (cx - eyeDx), y - eyeY);
      const dRight = Math.hypot(x - (cx + eyeDx), y - eyeY);
      if (dLeft < eyeR || dRight < eyeR) {
        R = 255;
        G = 18;
        B = 18;
      } else if (dLeft < eyeR * 1.8 || dRight < eyeR * 1.8) {
        R = Math.min(255, R + 90);
        G = Math.max(0, G - 40);
        B = Math.max(0, B - 40);
      }
      raw[idx] = R;
      raw[idx + 1] = G;
      raw[idx + 2] = B;
      raw[idx + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync(path.join(iconDir, 'icon-192.png'), createIconPng(192));
fs.writeFileSync(path.join(iconDir, 'icon-512.png'), createIconPng(512));
fs.writeFileSync(path.join(iconDir, 'icon-maskable-512.png'), createIconPng(512));
fs.writeFileSync(
  path.join(iconDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="20" fill="#050d1a"/><path d="M32 40 L96 40 L88 84 L74 104 L54 104 L40 84 Z" fill="#9ca8b8" stroke="#4dd2ff" stroke-width="3"/><circle cx="48" cy="60" r="10" fill="#ff1111"/><circle cx="80" cy="60" r="10" fill="#ff1111"/></svg>`
);
console.log('Generated PWA icons in public/');
