/*
 * Uji ujung-ke-ujung UI v3 (brief 16) sebagai skrip Playwright tanpa @playwright/test (pemasangan dependensi tidak tersedia
 * di lingkungan ini). Jalankan terhadap database UJI saja (backend 8010 + frontend 5180, lihat docs/progress-ui-v3.md):
 *
 *   PW_PATH=<folder paket playwright> BASE=http://127.0.0.1:5180 node tests/e2e/run.cjs [nama-uji ...]
 *
 * Uji membuat data lewat API (pesanan, retur), jadi jangan pernah diarahkan ke backend live.
 */
const { chromium } = require(process.env.PW_PATH || "playwright");
const BASE = process.env.BASE || "http://127.0.0.1:5180";
const API = `${BASE}/api/v1`;
const PASS = process.env.DEMO_PASSWORD || "Aether#Demo2026";
const PASS_IN_PAGE = PASS;
const ONLY = process.argv.slice(2);

const PERMS = {
  admin: ["dashboard.read", "master.read", "master.write", "accounting.read", "accounting.post", "accounting.close", "procurement.read", "procurement.write", "procurement.approve", "inventory.read", "inventory.write", "sales.read", "sales.write", "payments.write", "users.manage", "audit.read"],
};
const READ = ["dashboard.read", "master.read", "accounting.read", "procurement.read", "inventory.read", "sales.read"];
Object.assign(PERMS, {
  finance: [...READ, "accounting.post", "accounting.close", "payments.write", "master.write"],
  procurement: [...READ, "procurement.write", "procurement.approve", "inventory.write"],
  buyer: [...READ, "procurement.write"],
  warehouse: [...READ, "inventory.write"],
  sales: [...READ, "sales.write"],
  auditor: [...READ, "audit.read"],
});
/** Menu (lib/nav.ts) → izin baca. */
const MENU = { "/": "dashboard.read", "/procurement/orders": "procurement.read", "/procurement/receipts": "procurement.read", "/master/suppliers": "master.read", "/master/products": "master.read",
  "/inventory/stock": "inventory.read", "/inventory/movements": "inventory.read", "/inventory/transfers": "inventory.read", "/inventory/work-orders": "inventory.read", "/inventory/reorder": "inventory.read",
  "/sales/orders": "sales.read", "/sales/returns": "sales.read", "/sales/customers": "master.read", "/accounting/journals": "accounting.read", "/accounting/invoices": "accounting.read",
  "/accounting/reports": "accounting.read", "/accounting/periods": "accounting.read", "/system/audit": "audit.read", "/system/users": "users.manage" };

async function api(method, path, body, token) {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
const token = async (who) => (await api("POST", "/auth/login", { email: `${who}@aether.local`, password: PASS })).body.access_token;

async function login(page, who) {
  await page.goto(`${BASE}/login`);
  await page.fill("input[name=email]", `${who}@aether.local`);
  await page.fill("input[name=password]", PASS);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}
const results = [];
function check(name, ok, detail = "") { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${detail ? ` · ${detail}` : ""}`); }

const TESTS = {
  /** 1. Login setiap peran; menu dan dasbor sesuai izin; backend tetap menolak permintaan tanpa izin. */
  async peran(browser) {
    for (const who of Object.keys(PERMS)) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await login(page, who);
      const links = await page.$$eval('aside nav[aria-label="Menu utama"] a', (as) => as.map((a) => new URL(a.href).pathname));
      const expected = Object.entries(MENU).filter(([, p]) => PERMS[who].includes(p)).map(([to]) => to).sort();
      check(`peran ${who}: menu sesuai izin`, JSON.stringify([...links].sort()) === JSON.stringify(expected), `${links.length} menu`);
      const h1 = await page.textContent("h1");
      check(`peran ${who}: dasbor terbuka`, h1?.includes("Dasbor"));
      await ctx.close();
    }
    const t = await token("warehouse");
    const denied = await api("POST", "/sales/orders", { customer_id: 1, branch_id: 2, items: [{ product_id: 5, quantity: 1 }] }, t);
    check("backend menolak gudang membuat pesanan penjualan", denied.status === 403, `HTTP ${denied.status}`);
    const t2 = await token("sales");
    const denied2 = await api("POST", "/accounting/periods/7/close", null, t2);
    check("backend menolak penjualan menutup periode", denied2.status === 403, `HTTP ${denied2.status}`);
  },

  /** 2–3. Alur retur lengkap lewat UI; angka sama dengan respons API; upacara posting tidak menahan navigasi. */
  async retur(browser) {
    const ts = await token("sales"), ta = await token("admin");
    const so = (await api("POST", "/sales/orders", { customer_id: 1, branch_id: 2, items: [{ product_id: 5, quantity: 10 }, { product_id: 4, quantity: 2 }] }, ts)).body;
    await api("POST", `/sales/orders/${so.id}/confirm`, null, ts);
    await api("POST", `/sales/orders/${so.id}/deliver`, {}, ta);
    await api("POST", `/sales/orders/${so.id}/invoice`, {}, ta);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, "admin");
    await page.goto(`${BASE}/sales/orders/${so.id}/return`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Tambah jumlah retur FG-CAB-01/ }).click();
    await page.getByRole("button", { name: /Tambah jumlah retur FG-CAB-01/ }).click();
    await page.getByRole("button", { name: /Tambah jumlah retur FG-HUB-01/ }).click();
    await page.getByRole("button", { name: "Simpan retur" }).click();
    const respP = page.waitForResponse((r) => r.url().includes(`/sales/orders/${so.id}/return`) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Ya, simpan retur" }).click();
    const resp = await (await respP).json();
    const t0 = Date.now();
    await page.locator(".struk").first().waitFor({ timeout: 5000 });
    // Navigasi segera selama upacara berjalan.
    await page.click('aside a[href="/sales/orders"]');
    await page.waitForURL(`${BASE}/sales/orders`, { timeout: 3000 });
    check("upacara posting tidak menahan navigasi", Date.now() - t0 < 2500, `${Date.now() - t0} ms`);
    const strukText = await page.locator(".struk").first().innerText();
    const fmt = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(Number(n));
    check("struk memuat nomor retur dari API", strukText.includes(resp.return_no), resp.return_no);
    check("struk memuat kredit dari API", strukText.replace(/\s/g, " ").includes(fmt(resp.total_amount).replace(/\s/g, " ")), fmt(resp.total_amount));
    check("struk memuat biaya kembali dari API", strukText.replace(/\s/g, " ").includes(fmt(resp.cogs_reversed).replace(/\s/g, " ")), fmt(resp.cogs_reversed));
    // Jurnal retur sesuai aturan Sprint 9.
    const js = (await api("GET", `/accounting/journals?page_size=200&start=${resp.return_date}&end=${resp.return_date}`, null, ta)).body.items;
    const je = js.find((j) => j.id === resp.journal_entry_id);
    const amt = (code, side) => je.lines.filter((l) => l.account_code === code).reduce((s, l) => s + Number(l[side]), 0);
    check("jurnal retur: debit 4150 = kredit", Math.abs(amt("4150", "debit") - Number(resp.total_amount)) < 0.005);
    check("jurnal retur: kredit 1200 = kredit", Math.abs(amt("1200", "credit") - Number(resp.total_amount)) < 0.005);
    check("jurnal retur: debit 1300 = biaya kembali", Math.abs(amt("1300", "debit") - Number(resp.cogs_reversed)) < 0.005);
    check("jurnal retur: kredit 5100 = biaya kembali", Math.abs(amt("5100", "credit") - Number(resp.cogs_reversed)) < 0.005);
    // M1 di detail retur menampilkan akun dan jumlah yang sama.
    await page.goto(`${BASE}/sales/returns/${resp.id}`);
    await page.waitForLoadState("networkidle");
    const m1 = await page.locator(".ink-threads").innerText();
    check("M1 menampilkan 4150, 1200, 1300, 5100", ["4150", "1200", "1300", "5100"].every((c) => m1.includes(c)));
    check("M1 menyatakan seimbang", m1.includes("Seimbang"));
    await ctx.close();
  },

  /** 4. Mode gerak Minimal: tidak ada animasi setelah interaksi selesai. */
  async minimal(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => localStorage.setItem("aether.prefs", JSON.stringify({ motion: "minimal" })));
    const page = await ctx.newPage();
    await login(page, "admin");
    await page.goto(`${BASE}/sales/orders`);
    await page.waitForLoadState("networkidle");
    await page.locator("table tbody tr").first().click();
    await page.keyboard.press("Escape");
    await page.goto(`${BASE}/sales/returns/1`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /Riwayat/ }).click();
    await page.waitForTimeout(600);
    const n = await page.evaluate(() => document.getAnimations().filter((a) => !(a.effect?.target instanceof Element && a.effect.target.closest("[data-loading-indicator]"))).length);
    check("mode Minimal: getAnimations() kosong setelah interaksi", n === 0, `${n} animasi`);
    const attr = await page.evaluate(() => document.documentElement.dataset.motion);
    check("mode Minimal diterapkan ke <html>", attr === "minimal");
    await ctx.close();
  },

  /** 5. Transisi ruang dan jalur cadangannya (deteksi fitur dipaksa salah). */
  async ruang(browser) {
    for (const off of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript((disable) => {
        localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" }));
        if (disable) delete Document.prototype.startViewTransition;
        else {
          const orig = Document.prototype.startViewTransition;
          window.__vt = 0;
          Document.prototype.startViewTransition = function (cb) { window.__vt++; return orig.call(this, cb); };
        }
      }, off);
      const page = await ctx.newPage();
      await login(page, "admin");
      await page.goto(`${BASE}/sales/orders`);
      await page.waitForLoadState("networkidle");
      const link = page.locator("table tbody tr td a").first();
      const no = (await link.innerText()).trim();
      await link.click();
      await page.waitForURL(/\/sales\/orders\/\d+$/);
      await page.waitForTimeout(500);
      const h1 = (await page.textContent("h1"))?.trim();
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      check(`transisi ruang ${off ? "cadangan (tanpa API)" : "View Transition"}: detail terbuka`, h1 === no, `${no} → ${h1}`);
      check(`transisi ruang ${off ? "cadangan" : "View Transition"}: fokus di h1`, focused === "H1", focused);
      if (!off) check("View Transition API benar-benar dipanggil", (await page.evaluate(() => window.__vt)) >= 1);
      await page.getByRole("button", { name: "Kembali ke daftar" }).click();
      await page.waitForURL(`${BASE}/sales/orders`);
      check(`kembali ${off ? "(cadangan)" : "(View Transition)"} ke daftar`, true);
      await ctx.close();
    }
  },

  /** 6. Papan ketik: Ctrl+K, "/", Escape, Tab. */
  async papan(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, "admin");
    await page.keyboard.press("Control+K");
    await page.waitForSelector("dialog.index-card[open]");
    check("Ctrl+K membuka palet perintah", true);
    await page.keyboard.type("RET-2026-000001");
    await page.waitForTimeout(800);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/sales\/returns\/\d+$/, { timeout: 5000 });
    check("palet: Enter membuka dokumen", true, page.url().replace(BASE, ""));
    await page.goto(`${BASE}/sales/orders`);
    await page.waitForLoadState("networkidle");
    await page.locator("main h1").click();
    await page.keyboard.press("/");
    const searchFocused = await page.evaluate(() => document.activeElement?.hasAttribute("data-page-search"));
    check('"/" memfokuskan pencarian halaman', searchFocused);
    await page.keyboard.press("Tab");
    const visible = await page.evaluate(() => { const el = document.activeElement; return !!el && getComputedStyle(el).outlineStyle !== "none"; });
    check("Tab: fokus tampak", visible);
    await page.locator("table tbody tr").first().click();
    await page.waitForSelector("dialog.drawer[open]");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check("Escape menutup laci", !(await page.$("dialog.drawer[open]")));
    await ctx.close();
  },

  /** M10 Tutup Buku di database uji: dialog berdampak, cap DITUTUP, lalu dibuka kembali agar data uji kembali seperti semula. */
  async tutupbuku(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" })));
    const page = await ctx.newPage();
    await login(page, "finance");
    await page.goto(`${BASE}/accounting/periods`);
    await page.waitForLoadState("networkidle");
    const open = page.locator(".books li", { has: page.locator(".book[data-state=open]") }).first();
    const month = (await open.locator(".month").innerText()).trim();
    await open.getByRole("button", { name: "Tutup buku" }).click();
    const dlg = page.locator("dialog.dialog-sheet[open]");
    await dlg.waitFor();
    await page.waitForFunction(() => /Jurnal di periode ini/.test(document.querySelector("dialog.dialog-sheet[open]")?.textContent ?? ""));
    check(`M10: dialog menyebut jumlah jurnal dan laba (${month})`, /Laba bersih periode/.test(await dlg.innerText()));
    await dlg.getByRole("button", { name: "Ya, tutup buku" }).click();
    const closed = page.locator(".books li", { hasText: month }).locator(".book[data-state=closed]");
    await closed.waitFor({ timeout: 5000 });
    check(`M10: buku ${month} tertutup dengan cap`, await closed.locator(".cap").isVisible());
    check("M10: struk periode ditutup", (await page.locator(".struk").first().innerText()).includes("Periode ditutup"));
    await page.locator(".books li", { hasText: month }).getByRole("button", { name: "Buka kembali" }).click();
    await page.locator(".books li", { hasText: month }).locator(".book[data-state=open]").waitFor({ timeout: 5000 });
    check(`M10: ${month} dibuka kembali (data uji dipulihkan)`, true);
    await ctx.close();
  },

  /** M11 Membuka Buku: sekali per sesi browser, memakai View Transition, data dasbor dimuat bersamaan. */
  async bukabuku(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" }));
      const orig = Document.prototype.startViewTransition;
      window.__vt = 0;
      if (orig) Document.prototype.startViewTransition = function (cb) { window.__vt++; window.__book = document.documentElement.hasAttribute("data-book"); return orig.call(this, cb); };
    });
    const page = await ctx.newPage();
    await login(page, "admin");
    await page.waitForTimeout(800);
    check("M11: transisi membuka buku berjalan setelah masuk", (await page.evaluate(() => window.__vt)) >= 1 && (await page.evaluate(() => window.__book)) === true);
    check("M11: tanda sekali per sesi tersimpan", (await page.evaluate(() => sessionStorage.getItem("aether.book-opened"))) === "1");
    await page.getByRole("button", { name: /Menu pengguna/ }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await page.waitForURL(`${BASE}/login`);
    await page.evaluate(() => { window.__vt = 0; });
    await page.fill("input[name=email]", "admin@aether.local");
    await page.fill("input[name=password]", PASS_IN_PAGE);
    await page.click("button[type=submit]");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.waitForTimeout(500);
    check("M11: masuk kedua di sesi yang sama tanpa upacara", (await page.evaluate(() => window.__vt)) === 0);
    await ctx.close();
  },

  /** Diam: setelah halaman tenang 2 detik, getAnimations() kosong di 5 halaman utama. */
  async diam(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" })));
    const page = await ctx.newPage();
    await login(page, "admin");
    for (const p of ["/", "/sales/orders", "/sales/returns/1", "/inventory/stock", "/accounting/reports"]) {
      await page.goto(BASE + p);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      const n = await page.evaluate(() => document.getAnimations().length);
      check(`diam di ${p}`, n === 0, `${n} animasi`);
    }
    await ctx.close();
  },
};

(async () => {
  const browser = await chromium.launch();
  for (const [name, fn] of Object.entries(TESTS)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    try { await fn(browser); } catch (e) { check(`${name}: tanpa galat`, false, String(e.message).split("\n")[0]); }
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} lulus, ${failed} gagal`);
  process.exit(failed ? 1 : 0);
})();
