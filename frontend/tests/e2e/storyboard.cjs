/*
 * Storyboard momen khas (brief 17, Fase 1): bingkai kunci dan rekaman dari rute Katalog (data contoh) dan aplikasi.
 * Bingkai diambil dengan menghentikan semua animasi lalu memindahkan currentTime-nya, jadi urutannya tepat dan berulang.
 *   PW_PATH=<playwright> BASE=http://127.0.0.1:5180 node tests/e2e/storyboard.cjs <folder-keluaran>
 * Hanya untuk dev server terhadap database uji (Katalog tidak ada di build produksi).
 */
const { chromium } = require(process.env.PW_PATH || "playwright");
const fs = require("fs");
const path = require("path");
const BASE = process.env.BASE || "http://127.0.0.1:5180";
const OUT = process.argv[2];
const PASS = process.env.DEMO_PASSWORD || "Aether#Demo2026";
fs.mkdirSync(OUT, { recursive: true });

const pause = (page) => page.evaluate(() => { for (const a of document.getAnimations()) a.pause(); return document.getAnimations().length; });
const seek = (page, t) => page.evaluate((ms) => { for (const a of document.getAnimations()) a.currentTime = ms; }, t);
const resume = (page) => page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });

async function frames(page, id, times, clip) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const n = await pause(page);
  let i = 0;
  for (const t of times) {
    await seek(page, t);
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(dir, `bingkai-${++i}-${t}ms.png`), clip: clip ? await clip() : undefined });
  }
  await resume(page);
  return n;
}
const clipOf = (page, sel, pad = 12) => async () => {
  const b = await page.locator(sel).first().boundingBox();
  return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 };
};

async function katalogMoment(browser, id, sectionSel, trigger, times, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1280, height: 860 }, recordVideo: { dir: path.join(OUT, "_video", id), size: opts.viewport ?? { width: 1280, height: 860 } } });
  await ctx.addInitScript(() => localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" })));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/__katalog`);
  await page.waitForLoadState("networkidle");
  await page.locator(sectionSel).scrollIntoViewIfNeeded();
  await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "center" }), sectionSel);
  await page.waitForTimeout(600);
  // Rekaman: putar sekali dengan kecepatan asli.
  await trigger(page);
  await page.waitForTimeout(opts.settle ?? 1600);
  // Bingkai kunci: putar lagi lalu hentikan dan geser waktunya.
  await trigger(page);
  await page.waitForTimeout(opts.startDelay ?? 40);
  const n = await frames(page, id, times, opts.full ? undefined : clipOf(page, opts.clipSel ?? sectionSel));
  await page.waitForTimeout(400);
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  fs.copyFileSync(src, path.join(OUT, `${id}.webm`));
  return n;
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill("input[name=email]", "admin@aether.local");
  await page.fill("input[name=password]", PASS);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

(async () => {
  const browser = await chromium.launch();
  const log = [];
  const replay = (sel) => async (page) => { await page.locator(`${sel} button:has-text("Putar ulang")`).first().click(); };

  log.push(["M1", await katalogMoment(browser, "m1-jejak-tinta", "#m1", replay("#m1"), [0, 140, 340, 560, 800, 1100], { settle: 1500, clipSel: "#m1 .ink-threads" })]);
  log.push(["M2", await katalogMoment(browser, "m2-upacara-posting", "#m2", async (p) => { await p.getByRole("button", { name: "Simpan retur contoh" }).click(); }, [0, 80, 160, 260, 420, 700], { full: true, settle: 1800 })]);
  log.push(["M3", await katalogMoment(browser, "m3-angka-mekanis", "#m3", async (p) => { await p.locator("#m3").getByRole("button", { name: "Tambah" }).click(); await p.waitForTimeout(140); }, [0, 60, 120, 180, 240, 300], { settle: 900, startDelay: 10 })]);
  log.push(["M7", await katalogMoment(browser, "m7-akun-t", "#m7", replay("#m7"), [0, 100, 200, 300], { settle: 800 })]);
  log.push(["M10", await katalogMoment(browser, "m10-tutup-buku", "#m10", async (p) => {
    const b = p.locator("#m10").getByRole("button", { name: /Tutup buku|Buka lagi/ });
    if ((await b.innerText()).includes("Buka lagi")) { await b.click(); await p.waitForTimeout(300); }
    await p.locator("#m10").getByRole("button", { name: /Tutup buku/ }).click();
  }, [0, 150, 300, 450, 600, 800], { settle: 1500 })]);

  // M5 dan M8: tanpa gerak; bingkai keadaan (desktop, ponsel, hover, filter).
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/__katalog`);
    await page.waitForLoadState("networkidle");
    const dir5 = path.join(OUT, "m5-rantai-dokumen"); fs.mkdirSync(dir5, { recursive: true });
    await page.locator("#m5").screenshot({ path: path.join(dir5, "bingkai-1-desktop.png") });
    const dir8 = path.join(OUT, "m8-gudang-hidup"); fs.mkdirSync(dir8, { recursive: true });
    await page.locator("#m8").scrollIntoViewIfNeeded();
    await page.locator("#m8").screenshot({ path: path.join(dir8, "bingkai-1-diam.png") });
    await page.locator('#m8 [data-box="1"]').hover();
    await page.waitForTimeout(250);
    await page.locator("#m8").screenshot({ path: path.join(dir8, "bingkai-2-hover-slip.png") });
    await page.locator('#m8 [data-box="0"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(250);
    await page.locator("#m8").screenshot({ path: path.join(dir8, "bingkai-3-fokus-panah.png") });
    await ctx.close();
    const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mp = await m.newPage();
    await mp.goto(`${BASE}/__katalog`);
    await mp.waitForLoadState("networkidle");
    await mp.locator("#m5").screenshot({ path: path.join(dir5, "bingkai-2-ponsel.png") });
    await mp.locator("#m1").screenshot({ path: path.join(OUT, "m1-jejak-tinta", "bingkai-ponsel-vertikal.png") });
    await m.close();
    log.push(["M5/M8", "keadaan"]);
  }

  // M4: daftar → detail dengan View Transition, dihentikan di tengah.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, recordVideo: { dir: path.join(OUT, "_video", "m4"), size: { width: 1280, height: 860 } } });
    await ctx.addInitScript(() => localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" })));
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/sales/orders`);
    await page.waitForLoadState("networkidle");
    const link = page.locator("table tbody tr td a").first();
    await link.hover();
    await page.waitForTimeout(600);
    await link.click();
    await page.waitForTimeout(80);
    const dir = path.join(OUT, "m4-transisi-ruang"); fs.mkdirSync(dir, { recursive: true });
    await pause(page);
    let i = 0;
    for (const t of [0, 75, 150, 225, 300]) { await seek(page, t); await page.waitForTimeout(60); await page.screenshot({ path: path.join(dir, `bingkai-${++i}-${t}ms.png`) }); }
    await resume(page);
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Kembali ke daftar" }).click();
    await page.waitForTimeout(900);
    const video = page.video();
    await ctx.close();
    fs.copyFileSync(await video.path(), path.join(OUT, "m4-transisi-ruang.webm"));
    log.push(["M4", "ok"]);
  }

  // M11: masuk → buku terbuka.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, recordVideo: { dir: path.join(OUT, "_video", "m11"), size: { width: 1280, height: 860 } } });
    await ctx.addInitScript(() => localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" })));
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill("input[name=email]", "admin@aether.local");
    await page.fill("input[name=password]", PASS);
    await page.waitForTimeout(400);
    await page.click("button[type=submit]");
    await page.waitForFunction(() => document.getAnimations().some((a) => String(a.effect?.pseudoElement ?? "").includes("view-transition")), null, { timeout: 5000 }).catch(() => {});
    const dir = path.join(OUT, "m11-membuka-buku"); fs.mkdirSync(dir, { recursive: true });
    await pause(page);
    let i = 0;
    for (const t of [0, 175, 350, 525, 700]) { await seek(page, t); await page.waitForTimeout(60); await page.screenshot({ path: path.join(dir, `bingkai-${++i}-${t}ms.png`) }); }
    await resume(page);
    await page.waitForTimeout(1200);
    const video = page.video();
    await ctx.close();
    fs.copyFileSync(await video.path(), path.join(OUT, "m11-membuka-buku.webm"));
    log.push(["M11", "ok"]);
  }
  await browser.close();
  fs.rmSync(path.join(OUT, "_video"), { recursive: true, force: true });
  console.log(JSON.stringify(log));
})().catch((e) => { console.error(e); process.exit(1); });
