/**
 * Gera todos os recursos da marca D Player a partir da logo oficial (brand/d-player-logo-source.png).
 *
 *   node scripts/brand/generate-brand-assets.mjs
 *
 * - Símbolo transparente: remove o fundo escuro do quadrado por "unmultiply" (sem redesenhar a logo).
 * - Ícones do APK (legado, adaptativo, monocromático), splash e ícones/PWA do painel.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const sharp = require("sharp");

const SOURCE = path.join(root, "brand/d-player-logo-source.png");
const TILE_BG = [1, 6, 18]; // fundo do quadrado da logo (#010612)
const NAVY = "#050B1C";

const webBrand = path.join(root, "apps/web/public/brand");
const tvAssets = path.join(root, "apps/tv/assets");
mkdirSync(webBrand, { recursive: true });
mkdirSync(tvAssets, { recursive: true });

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

/* 1) Quadrado (tile) completo: bbox dos pixels opacos. */
const tileBox = bbox((x, y) => data[(y * width + x) * 4 + 3] > 200);

/* 2) Símbolo: dentro do quadrado, pixels que se destacam do fundo escuro. */
const inset = Math.round((tileBox.right - tileBox.left) * 0.06);
const symbolArea = {
  left: tileBox.left + inset,
  top: tileBox.top + inset,
  right: tileBox.right - inset,
  bottom: tileBox.bottom - inset
};
const symbol = Buffer.alloc(width * height * 4);
for (let y = symbolArea.top; y <= symbolArea.bottom; y += 1) {
  for (let x = symbolArea.left; x <= symbolArea.right; x += 1) {
    const i = (y * width + x) * 4;
    const c = [data[i], data[i + 1], data[i + 2]];
    // Quanto o pixel se destaca do fundo do quadrado (0 = fundo, 1 = cor cheia).
    let strength = 0;
    for (let k = 0; k < 3; k += 1) strength = Math.max(strength, (c[k] - TILE_BG[k]) / (255 - TILE_BG[k]));
    // Máscara opaca com borda suave: o roxo escuro do símbolo continua sólido (não fica lavado no tema claro).
    const alpha = smoothstep(0.05, 0.2, strength);
    if (alpha === 0) continue;
    for (let k = 0; k < 3; k += 1) {
      // Na borda, remove o fundo escuro misturado; no miolo, cor original.
      const edge = strength > 0 ? clamp(TILE_BG[k] + (c[k] - TILE_BG[k]) / Math.min(1, strength)) : c[k];
      symbol[i + k] = clamp(edge * (1 - alpha) + c[k] * alpha);
    }
    symbol[i + 3] = Math.round(alpha * 255);
  }
}
keepLargestComponent(symbol);
const symbolBox = bboxOf(symbol, (i) => symbol[i + 3] > 200);
const symbolPng = await sharp(symbol, { raw: { width, height, channels: 4 } })
  .extract(toRegion(symbolBox))
  .png()
  .toBuffer();
const tilePng = await sharp(SOURCE).extract(toRegion(tileBox)).png().toBuffer();

/* Símbolo centralizado num quadrado transparente, ocupando `scale` do lado. */
async function symbolSquare(size, scale, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const inner = Math.round(size * scale);
  const resized = await sharp(symbolPng).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: resized, gravity: "center" }])
    .png();
}

async function monochrome(size, scale) {
  const base = await (await symbolSquare(size, scale)).raw().toBuffer();
  for (let i = 0; i < base.length; i += 4) {
    base[i] = 255;
    base[i + 1] = 255;
    base[i + 2] = 255;
  }
  return sharp(base, { raw: { width: size, height: size, channels: 4 } }).png();
}

const navy = hexToRgb(NAVY);

// ---------- Painel web ----------
await sharp(symbolPng).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(webBrand, "d-player-symbol.png"));
await sharp(tilePng).resize(512, 512).png().toFile(path.join(webBrand, "d-player-icon.png"));
await sharp(tilePng).resize(180, 180).png().toFile(path.join(webBrand, "apple-touch-icon.png"));
await sharp(tilePng).resize(192, 192).png().toFile(path.join(webBrand, "icon-192.png"));
await sharp(tilePng).resize(48, 48).png().toFile(path.join(webBrand, "favicon-48.png"));
// Maskable (PWA): símbolo dentro da zona segura, fundo da marca.
await (await symbolSquare(512, 0.58, { ...navy, alpha: 1 })).toFile(path.join(webBrand, "icon-maskable-512.png"));

// ---------- App Android (Expo) ----------
// Ícone legado: quadrado da marca preenchendo o ícone.
await (await symbolSquare(1024, 0.64, { ...navy, alpha: 1 })).toFile(path.join(tvAssets, "d-player-icon.png"));
// Adaptativo: só o símbolo dentro da zona segura (66%) - o fundo vem de backgroundColor.
await (await symbolSquare(1024, 0.5)).toFile(path.join(tvAssets, "d-player-adaptive-foreground.png"));
await (await monochrome(1024, 0.5)).toFile(path.join(tvAssets, "d-player-monochrome.png"));
// Splash (Android 12+ mostra o ícone num círculo): símbolo com folga.
await (await symbolSquare(1024, 0.62)).toFile(path.join(tvAssets, "d-player-splash.png"));
// Logo para as telas do app (ativação, carregando).
await sharp(symbolPng).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(tvAssets, "d-player-symbol.png"));

console.log("tile", tileBox, "symbol", symbolBox);
console.log("OK: recursos gerados em apps/web/public/brand e apps/tv/assets");

/* ---------- utilitários ---------- */
function bbox(test) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!test(x, y)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return { left, top, right, bottom };
}

function bboxOf(buffer, test) {
  return bbox((x, y) => test((y * width + x) * 4));
}

function toRegion(box) {
  // Quadrado centrado no conteúdo, para não deformar.
  const side = Math.max(box.right - box.left, box.bottom - box.top) + 1;
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const left = Math.max(0, Math.round(cx - side / 2));
  const top = Math.max(0, Math.round(cy - side / 2));
  return { left, top, width: Math.min(side, width - left), height: Math.min(side, height - top) };
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Mantém só o símbolo (maior bloco conectado) e apaga sobras do contorno arredondado do quadrado. */
function keepLargestComponent(buffer) {
  const total = width * height;
  const solid = new Uint8Array(total);
  for (let p = 0; p < total; p += 1) solid[p] = buffer[p * 4 + 3] > 128 ? 1 : 0;

  const label = new Int32Array(total);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  const stack = [];
  for (let p = 0; p < total; p += 1) {
    if (!solid[p] || label[p]) continue;
    next += 1;
    let size = 0;
    label[p] = next;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop();
      size += 1;
      const x = q % width;
      for (const n of [q - 1, q + 1, q - width, q + width]) {
        if (n < 0 || n >= total || label[n] || !solid[n]) continue;
        if ((n === q - 1 && x === 0) || (n === q + 1 && x === width - 1)) continue;
        label[n] = next;
        stack.push(n);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }

  // Área permitida: o símbolo + 3px de borda suave ao redor.
  let keep = new Uint8Array(total);
  for (let p = 0; p < total; p += 1) keep[p] = label[p] === best ? 1 : 0;
  for (let step = 0; step < 3; step += 1) {
    const grown = keep.slice();
    for (let p = 0; p < total; p += 1) {
      if (keep[p]) continue;
      if (keep[p - 1] || keep[p + 1] || keep[p - width] || keep[p + width]) grown[p] = 1;
    }
    keep = grown;
  }
  for (let p = 0; p < total; p += 1) {
    if (!keep[p]) buffer[p * 4 + 3] = 0;
  }
}
