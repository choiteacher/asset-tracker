// PWA 아이콘(PNG) 생성 스크립트. 외부 도구 없이 Node 내장 zlib로 만든다.
// 실행: node scripts/make-icons.mjs  → public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
// 디자인: 보라색 둥근 사각형 위에 흰색 막대그래프 3개(자산 추이 느낌).

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PURPLE = [0x72, 0x67, 0xef, 255];
const WHITE = [255, 255, 255, 255];

/** maskable: 가장자리까지 채움(안전 영역 80% 안에 그림). */
function icon(x, y, size, { rounded }) {
  const u = x / size;
  const v = y / size;
  if (rounded) {
    const r = 0.18;
    const cx = Math.min(Math.max(u, r), 1 - r);
    const cy = Math.min(Math.max(v, r), 1 - r);
    if ((u - cx) ** 2 + (v - cy) ** 2 > r * r) return [0, 0, 0, 0];
  }
  // 막대 3개(아래 정렬), 오른쪽으로 갈수록 높게
  const bars = [
    [0.27, 0.37, 0.52],
    [0.45, 0.55, 0.4],
    [0.63, 0.73, 0.28],
  ];
  for (const [x0, x1, top] of bars) if (u >= x0 && u <= x1 && v >= top && v <= 0.72) return WHITE;
  return PURPLE;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, (x, y, s) => icon(x, y, s, { rounded: true })));
writeFileSync('public/icons/icon-512.png', png(512, (x, y, s) => icon(x, y, s, { rounded: true })));
writeFileSync('public/icons/icon-maskable-512.png', png(512, (x, y, s) => icon(x, y, s, { rounded: false })));
writeFileSync('public/icons/apple-touch-icon.png', png(180, (x, y, s) => icon(x, y, s, { rounded: false })));
console.log('아이콘 생성 완료: public/icons/');
