#!/usr/bin/env node
/**
 * Pemeriksa kontras token UI v3 (brief 13, 16). Tanpa dependensi.
 * Membaca src/design/tokens.css, menghitung rasio WCAG 2.2 untuk setiap pasangan teks/latar dan batas/latar yang dipakai,
 * pada latar polos, latar bertekstur (dianggap 4% lebih gelap), dan tiga varian Cahaya meja (O2).
 * Gagal (exit 1) bila ada pasangan wajib di bawah batas: teks 4,5:1, teks besar 3:1, batas komponen dan grafik 3:1.
 *   node scripts/contrast-check.mjs            ringkasan + kegagalan
 *   node scripts/contrast-check.mjs --md       tabel Markdown lengkap (untuk laporan)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/design/tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Blok aturan → peta token triplet. */
function block(selector) {
  const i = css.indexOf(selector + " {");
  if (i < 0) return {};
  const body = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return out;
}
const base = block(":root");
const variants = { siang: {}, pagi: block(':root[data-desk="pagi"]'), sore: block(':root[data-desk="sore"]'), malam: block(':root[data-desk="malam"]') };

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, bg, alpha) => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)));
const darken = (c, k) => c.map((v) => Math.round(v * (1 - k)));

/** [nama, teks/tanda, latar, batas, jenis]. Latar "x@a/y" = token x dengan opasitas a di atas token y. */
const PAIRS = [
  // Teks utama dan sekunder
  ["Teks utama", "ink", "paper", 4.5], ["Teks utama di kanvas", "ink", "canvas", 4.5], ["Teks utama di sorot", "ink", "highlight", 4.5],
  ["Teks sekunder", "ink-muted", "paper", 4.5], ["Teks sekunder di kanvas", "ink-muted", "canvas", 4.5], ["Teks sekunder di sorot (tab, isian)", "ink-muted", "highlight", 4.5],
  ["Tautan dan aksen", "accent", "paper", 4.5], ["Tautan di kanvas", "accent", "canvas", 4.5], ["Aksen di sorot", "accent", "highlight", 4.5],
  ["Teks tombol utama", "paper", "accent", 4.5], ["Teks di bilah tinta (aksi massal, chip aktif)", "paper", "ink", 4.5],
  ["Teks sukses", "ok", "paper", 4.5], ["Teks sukses di kanvas", "ok", "canvas", 4.5], ["Teks galat", "bad", "paper", 4.5], ["Teks galat di kanvas", "bad", "canvas", 4.5],
  ["Teks info", "info", "paper", 4.5], ["Teks peringatan (--warn-ink)", "warn-ink", "paper", 4.5], ["Teks peringatan di kanvas", "warn-ink", "canvas", 4.5],
  // Lencana: warna status di atas tint status
  ["Lencana sukses", "ok", "ok@0.08/paper", 4.5], ["Lencana peringatan", "warn-ink", "warn@0.08/paper", 4.5], ["Lencana galat", "bad", "bad@0.08/paper", 4.5],
  ["Lencana info", "info", "info@0.08/paper", 4.5], ["Lencana netral", "ink-muted", "ink-muted@0.07/paper", 4.5],
  // Batas kontrol isian dan fokus (3:1)
  ["Batas isian di paper", "rule-strong", "paper", 3], ["Batas isian di kanvas", "rule-strong", "canvas", 3], ["Batas isian di sorot", "rule-strong", "highlight", 3],
  ["Cincin fokus di paper", "accent", "paper", 3], ["Cincin fokus di kanvas", "accent", "canvas", 3], ["Cincin fokus di sorot", "accent", "highlight", 3],
  // Grafik dan visual (3:1)
  ["Tinta data marun", "accent", "paper", 3], ["Tinta data biru", "info", "paper", 3], ["Tinta data hijau", "ok", "paper", 3], ["Tinta data oker", "warn", "paper", 3], ["Tinta data grafit", "ink-muted", "paper", 3],
  ["Kotak gudang aman", "ok", "paper", 3], ["Kotak gudang menipis", "warn", "paper", 3], ["Kotak gudang habis", "bad", "paper", 3],
];
/** Hanya dilaporkan: elemen dekoratif tanpa syarat kontras. */
const DECOR = [["Garis pemisah (dekoratif)", "rule", "paper"], ["Garis pensil (dekoratif)", "pencil", "paper"], ["--warn sebagai teks (dilarang; pakai --warn-ink)", "warn", "paper"]];

function color(spec, tokens, textured) {
  const tex = (name, c) => (textured && (name === "paper" || name === "canvas") ? darken(c, 0.04) : c);
  if (spec.includes("@")) {
    const [fg, rest] = spec.split("@");
    const [a, bg] = rest.split("/");
    return mix(tokens[fg], tex(bg, tokens[bg]), Number(a));
  }
  return tex(spec, tokens[spec]);
}

const md = process.argv.includes("--md");
const rows = [];
let failures = 0;
for (const [variant, over] of Object.entries(variants)) {
  const tokens = { ...base, ...over };
  for (const textured of [false, true]) {
    for (const [name, fg, bg, min] of PAIRS) {
      const r = ratio(color(fg, tokens, false), color(bg, tokens, textured));
      const ok = r >= min;
      if (!ok) failures++;
      rows.push({ variant, textured, name, fg, bg, min, r, ok });
    }
  }
}
// Skala umur: label memakai pickInk (paper atau ink, mana yang lebih kontras), minimal 4,5:1.
for (let i = 1; i <= 5; i++) {
  const bg = base[`age-${i}`];
  const best = Math.max(ratio(base.paper, bg), ratio(base.ink, bg));
  const ok = best >= 4.5;
  if (!ok) failures++;
  rows.push({ variant: "siang", textured: false, name: `Label skala umur ${i} (pickInk)`, fg: ratio(base.paper, bg) >= ratio(base.ink, bg) ? "paper" : "ink", bg: `age-${i}`, min: 4.5, r: best, ok });
}

const fmt = (n) => n.toFixed(2).replace(".", ",");
if (md) {
  console.log("| Pasangan | Teks/tanda | Latar | Minimal | Polos | Bertekstur |\n|---|---|---|---|---|---|");
  for (const r of rows.filter((x) => x.variant === "siang" && !x.textured)) {
    const t = rows.find((x) => x.variant === "siang" && x.textured && x.name === r.name);
    console.log(`| ${r.name} | --${r.fg} | ${r.bg.startsWith("--") ? r.bg : r.bg.includes("@") ? r.bg : `--${r.bg}`} | ${fmt(r.min)}:1 | ${fmt(r.r)}:1 ${r.ok ? "" : "GAGAL"} | ${t ? `${fmt(t.r)}:1 ${t.ok ? "" : "GAGAL"}` : "–"} |`);
  }
  for (const [name, fg, bg] of DECOR) console.log(`| ${name} | --${fg} | --${bg} | – | ${fmt(ratio(base[fg], base[bg]))}:1 | ${fmt(ratio(base[fg], darken(base[bg], 0.04)))}:1 |`);
  const worst = (v) => rows.filter((x) => x.variant === v).reduce((a, b) => (b.r / b.min < a.r / a.min ? b : a));
  console.log("\nVarian Cahaya meja (pasangan terlemah relatif terhadap batasnya):");
  for (const v of Object.keys(variants)) { const w = worst(v); console.log(`- ${v}: ${w.name}${w.textured ? " (bertekstur)" : ""} ${fmt(w.r)}:1, batas ${fmt(w.min)}:1`); }
} else {
  const total = rows.length;
  console.log(`Kontras: ${total - failures} dari ${total} pasangan lolos (${Object.keys(variants).length} varian nada × polos/bertekstur, ditambah skala umur).`);
  for (const r of rows.filter((x) => !x.ok)) console.log(`GAGAL  [${r.variant}${r.textured ? ", bertekstur" : ""}] ${r.name}: --${r.fg} di ${r.bg} = ${fmt(r.r)}:1 < ${fmt(r.min)}:1`);
  for (const [name, fg, bg] of DECOR) console.log(`info   ${name}: ${fmt(ratio(base[fg], base[bg]))}:1`);
}
process.exit(failures ? 1 : 0);
