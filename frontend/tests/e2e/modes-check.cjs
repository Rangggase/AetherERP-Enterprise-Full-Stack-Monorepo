// Mode gerak: prefers-reduced-motion sistem dan preferensi Dikurangi -> hanya fade (opacity), tanpa transform; Minimal -> tanpa animasi.
const { chromium } = require(process.env.PW_PATH);
const BASE = "http://127.0.0.1:5180";
let pass = 0, fail = 0;
const check = (n, ok, info = "") => { ok ? pass++ : fail++; console.log(`${ok ? "LULUS" : "GAGAL"}  ${n}${info !== "" ? " · " + info : ""}`); };

async function run(browser, label, ctxOpts, prefs) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...ctxOpts });
  await ctx.addInitScript((p) => { try { sessionStorage.setItem("aether.book-opened", "1"); if (p) localStorage.setItem("aether.prefs", JSON.stringify(p)); } catch {} }, prefs);
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[name=email]", "admin@aether.local");
  await page.fill("input[name=password]", "Aether#Demo2026");
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(BASE + "/sales/orders", { waitUntil: "networkidle" });
  const level = await page.evaluate(() => document.documentElement.dataset.motion);
  // Rekam semua animasi yang dimulai selama laci dibuka.
  await page.evaluate(() => {
    window.__anims = [];
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (k, o) { const a = orig.call(this, k, o); window.__anims.push({ props: [...new Set((Array.isArray(k) ? k : [k]).flatMap((f) => Object.keys(f)).filter((p) => !["offset", "easing", "composite"].includes(p)))], duration: typeof o === "number" ? o : o && o.duration }); return a; };
  });
  await page.locator("table tbody tr").first().click();
  await page.waitForSelector("dialog.drawer[open]");
  await page.waitForTimeout(30);
  // Animasi CSS dan WAAPI yang sedang berjalan, dengan properti dari keyframe-nya.
  const live = await page.evaluate(() => document.getAnimations().map((a) => ({
    type: a.constructor.name, name: a.animationName || a.transitionProperty || "",
    props: [...new Set(a.effect.getKeyframes().flatMap((f) => Object.keys(f)).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)))],
    duration: a.effect.getTiming().duration,
  })));
  const waapi = (await page.evaluate(() => window.__anims)).concat(live.filter((a) => a.type !== "CSSTransition"));
  await page.waitForTimeout(1200);
  const idle = await page.evaluate(() => document.getAnimations().length);
  await ctx.close();
  return { level, waapi, idle };
}

(async () => {
  const browser = await chromium.launch();
  const sys = await run(browser, "sistem", { reducedMotion: "reduce" }, null);
  check("prefers-reduced-motion sistem → data-motion=reduced (preferensi Ikuti sistem)", sys.level === "reduced", sys.level);
  check("sistem dikurangi: animasi laci hanya opacity", sys.waapi.length > 0 && sys.waapi.every((a) => a.props.every((p) => p === "opacity")), JSON.stringify(sys.waapi));
  check("sistem dikurangi: lapisan muncul ≤220 ms (brief 6, tabel durasi)", sys.waapi.every((a) => a.duration <= 220), sys.waapi.map((a) => a.duration).join(","));
  const red = await run(browser, "Dikurangi", {}, { motion: "reduced" });
  check("preferensi Dikurangi → data-motion=reduced", red.level === "reduced", red.level);
  check("Dikurangi: animasi laci hanya opacity", red.waapi.length > 0 && red.waapi.every((a) => a.props.every((p) => p === "opacity")), JSON.stringify(red.waapi));
  const full = await run(browser, "Penuh", {}, { motion: "full" });
  check("pembanding Penuh: laci memakai transform", full.waapi.some((a) => a.props.includes("transform")), JSON.stringify(full.waapi));
  const min = await run(browser, "Minimal", { reducedMotion: "reduce" }, { motion: "minimal" });
  check("Minimal: tidak ada animasi WAAPI saat laci dibuka", min.waapi.length === 0, JSON.stringify(min.waapi));
  check("semua mode: diam setelah 1,2 detik", [sys, red, full, min].every((r) => r.idle === 0), [sys, red, full, min].map((r) => r.idle).join(","));

  // Momen khas di mode Dikurangi: M1 langsung di keadaan akhir (tanpa benang yang tergambar), paling banyak fade 120 ms.
  // Setiap Element.animate di dalam .ink-threads dicatat sejak awal halaman, jadi tidak bergantung pada waktu pengambilan sampel.
  for (const [label, prefs] of [["Dikurangi", { motion: "reduced" }], ["Penuh", { motion: "full" }]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((p) => {
      try { sessionStorage.setItem("aether.book-opened", "1"); localStorage.setItem("aether.prefs", JSON.stringify(p)); } catch {}
      window.__ink = [];
      const orig = Element.prototype.animate;
      Element.prototype.animate = function (k, o) { const a = orig.call(this, k, o); if (this.closest && this.closest(".ink-threads")) window.__ink.push({ props: [...new Set((Array.isArray(k) ? k : [k]).flatMap((f) => Object.keys(f)).filter((q) => !["offset", "easing", "composite"].includes(q)))], duration: typeof o === "number" ? o : o && o.duration }); return a; };
    }, prefs);
    const page = await ctx.newPage();
    await page.goto(BASE + "/login");
    await page.fill("input[name=email]", "admin@aether.local");
    await page.fill("input[name=password]", "Aether#Demo2026");
    await page.click("button[type=submit]");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto(BASE + "/sales/returns/1", { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    const anims = await page.evaluate(() => window.__ink);
    const balanced = await page.evaluate(() => /Seimbang/.test(document.querySelector(".ink-threads")?.textContent ?? ""));
    const replay = await page.getByRole("button", { name: "Putar ulang" }).count();
    if (label === "Dikurangi") {
      check("Dikurangi: M1 tanpa benang tergambar (hanya opacity, atau tanpa animasi)", anims.every((a) => a.props.every((p) => p === "opacity")), JSON.stringify(anims) );
      check("Dikurangi: M1 fade paling lama 120 ms", anims.every((a) => a.duration <= 120), anims.map((a) => a.duration).join(",") || "tanpa animasi");
      check("Dikurangi: M1 langsung menyatakan seimbang", balanced);
      check("Dikurangi: tombol Putar ulang tidak ditawarkan", replay === 0);
    } else {
      check("pembanding Penuh: M1 menggambar benang", anims.some((a) => a.props.some((p) => p !== "opacity")), JSON.stringify(anims.slice(0, 2)));
      check("pembanding Penuh: tombol Putar ulang ada", replay === 1);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
