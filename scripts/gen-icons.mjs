// Generates the PNG app icons into /public with no dependencies (zlib only).
// Design: five ascending rounded bars (a 1-5 rating) on a pink-to-orange sunset gradient.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG_TOP = [255, 92, 154]; // sunset pink
const BG_BOTTOM = [255, 150, 70]; // sunset orange
const BAR = [252, 252, 251];
const BAR_LAST = [14, 154, 166]; // ocean teal

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const SS = 4; // supersampling for anti-aliasing
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(r / SS / SS); raw[o + 1] = Math.round(g / SS / SS); raw[o + 2] = Math.round(b / SS / SS);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
// scale < 1 shrinks the artwork toward the centre (maskable safe zone).
function art(scale) {
  return (u, v) => {
    const x = 0.5 + (u - 0.5) / scale, y = 0.5 + (v - 0.5) / scale;
    const bg = BG_TOP.map((c, i) => Math.round(c + (BG_BOTTOM[i] - c) * v));
    const n = 5, left = 0.2, right = 0.8, gap = 0.035;
    const w = (right - left - gap * (n - 1)) / n;
    const base = 0.76;
    for (let i = 0; i < n; i++) {
      const x0 = left + i * (w + gap);
      const h = 0.14 + i * 0.105;
      if (inRoundRect(x, y, x0, base - h, x0 + w, base, w / 2)) return i === n - 1 ? BAR_LAST : BAR;
    }
    return bg;
  };
}
const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), png(192, art(1)));
writeFileSync(new URL('icon-512.png', out), png(512, art(1)));
writeFileSync(new URL('apple-touch-icon.png', out), png(180, art(1)));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, art(0.8)));
writeFileSync(new URL('favicon.svg', out), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5c9a"/><stop offset="1" stop-color="#ff9646"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
${[0, 1, 2, 3, 4].map((i) => {
  const w = 9.2, x = 20 + i * (w + 3.5), h = 14 + i * 10.5;
  return `<rect x="${x.toFixed(1)}" y="${(76 - h).toFixed(1)}" width="${w}" height="${h}" rx="${w / 2}" fill="${i === 4 ? '#0e9aa6' : '#fcfcfb'}"/>`;
}).join('\n')}
</svg>
`);
console.log('icons written');
