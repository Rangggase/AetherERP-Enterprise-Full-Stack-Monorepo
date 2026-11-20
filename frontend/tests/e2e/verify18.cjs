// Verifikasi tambahan brief 18 di database UJI (backend 8010 lewat preview 5180). Membuat pesanan dan retur baru,
// jadi jangan pernah diarahkan ke backend live. Jalankan: PW_PATH=<folder paket playwright> node tests/e2e/verify18.cjs
//  (a) hanya keyboard: masuk -> buat retur -> lihat jejak tinta -> tutup laci;
//  (b) sesudah retur: kredit, biaya kembali, stok, total faktur, jurnal sama dengan API;
//  (c) akun persediaan 1300 + 1310 = lapisan FIFO + barang dalam perjalanan; neraca saldo debit = kredit.
const { chromium } = require(process.env.PW_PATH);
const BASE = "http://127.0.0.1:5180";
const API = BASE + "/api/v1";
const PASS = "Aether#Demo2026";
let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; console.log(`${ok ? "LULUS" : "GAGAL"}  ${name}${info !== "" ? " · " + info : ""}`); };
async function api(method, path, body, token) {
  const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}
const token = async (who) => (await api("POST", "/auth/login", { email: `${who}@aether.local`, password: PASS })).body.access_token;
const fmt = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 2 }).format(Number(n));
const norm = (s) => s.replace(/\s+/g, " ");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

/** Tekan Tab sampai elemen aktif memenuhi syarat (meniru pengguna papan ketik yang melihat layar). */
async function tabTo(page, kind, value, max = 160) {
  const hit = () => page.evaluate(([k, v]) => {
    const a = document.activeElement;
    if (!a) return false;
    if (k === "name") return a.getAttribute("name") === v;
    // Hanya tombol atau tautan yang teksnya sendiri memuat label (bukan wadah seperti <dialog>).
    return (a.tagName === "BUTTON" || a.tagName === "A") && (a.textContent || "").trim().replace(/\s+/g, " ").includes(v);
  }, [kind, value]);
  if (await hit()) return true;
  for (let i = 0; i < max; i++) { await page.keyboard.press("Tab"); if (await hit()) return true; }
  return false;
}

(async () => {
  const ts = await token("sales"), ta = await token("admin");
  // Siapkan pesanan yang sudah difakturkan lewat API (aturan bisnis backend berlaku).
  const so = (await api("POST", "/sales/orders", { customer_id: 1, branch_id: 2, items: [{ product_id: 5, quantity: 10 }] }, ts)).body;
  await api("POST", `/sales/orders/${so.id}/confirm`, null, ts);
  await api("POST", `/sales/orders/${so.id}/deliver`, {}, ta);
  const inv = (await api("POST", `/sales/orders/${so.id}/invoice`, {}, ta)).body;
  const product = (await api("GET", "/master/products", null, ta)).body.find((p) => p.id === 5);
  const onHand = async () => (await api("GET", "/inventory/balances?branch_id=2", null, ta)).body.find((b) => b.product_id === 5)?.on_hand;
  const stockBefore = Number(await onHand());
  const invBefore = (await api("GET", `/invoices/${inv.id}`, null, ta)).body;
  console.log(`siap: ${so.so_no}, ${invBefore.invoice_no} total ${invBefore.total_amount}, stok ${product.sku} di cabang 2 = ${stockBefore}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "id-ID", timezoneId: "Asia/Jakarta" });
  await ctx.addInitScript(() => localStorage.setItem("aether.prefs", JSON.stringify({ motion: "full" })));
  const page = await ctx.newPage();
  page.on("response", (r) => { if (r.request().method() !== "GET") console.log(`   [jaringan] ${r.request().method()} ${r.url().replace(BASE, "")} → ${r.status()}`); });
  page.on("console", (m) => { if (m.type() === "error") console.log(`   [konsol] ${m.text().slice(0, 200)}`); });

  // (a) Hanya keyboard.
  await page.goto(BASE + "/login");
  check("keyboard: sampai ke isian email", await tabTo(page, "name", "email", 10));
  await page.keyboard.type("admin@aether.local"); // retur butuh sales.write + inventory.write; di data demo hanya admin
  check("keyboard: sampai ke isian kata sandi", await tabTo(page, "name", "password", 5));
  await page.keyboard.type(PASS);
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  check("keyboard: masuk dengan Enter", true, page.url().replace(BASE, ""));

  await page.keyboard.press("Control+K");
  await page.waitForSelector("dialog[open] input");
  await page.keyboard.type(so.so_no);
  await page.waitForTimeout(800);
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === `/sales/orders/${so.id}`, { timeout: 8000 }).catch(() => {});
  check("keyboard: palet membuka pesanan", page.url().endsWith(`/sales/orders/${so.id}`), page.url().replace(BASE, ""));
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);

  check("keyboard: Tab sampai ke Buat retur", await tabTo(page, "text", "Buat retur"));
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname.endsWith("/return"), { timeout: 8000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  check("keyboard: form retur terbuka", page.url().endsWith(`/sales/orders/${so.id}/return`));

  check("keyboard: Tab sampai ke jumlah retur", await tabTo(page, "name", "return-qty-5", 60));
  await page.keyboard.type("2");
  await page.keyboard.press("Enter"); // kirim form dari isian
  await page.waitForSelector("dialog.dialog-sheet[open]", { timeout: 5000 });
  await page.waitForTimeout(300);
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check("keyboard: dialog konfirmasi memfokuskan tombol aman lebih dulu", first === "Kembali", first);
  check("keyboard: Tab sampai ke Ya, simpan retur", await tabTo(page, "text", "Ya, simpan retur", 10));
  const focused = await page.evaluate(() => `${document.activeElement?.tagName} "${document.activeElement?.textContent?.trim()}" disabled=${document.activeElement?.disabled}`);
  console.log(`   [fokus sebelum Enter] ${focused}`);
  await page.keyboard.press("Enter");
  try {
    await page.waitForSelector(".struk", { timeout: 8000 });
  } catch (e) {
    await page.screenshot({ path: __dirname + "/verify18-gagal.png" });
    console.log("   [keadaan]", JSON.stringify(await page.evaluate(() => ({ url: location.pathname, dialog: !!document.querySelector("dialog[open]"), alert: [...document.querySelectorAll("[role=alert]")].map((a) => a.textContent.trim()).join(" | "), focus: `${document.activeElement?.tagName} ${document.activeElement?.textContent?.trim().slice(0, 40)}` }))));
    throw e;
  }
  const strukText = norm(await page.locator(".struk").first().innerText());
  check("keyboard: Tab sampai ke Lihat jejak tinta di struk", await tabTo(page, "text", "Lihat jejak tinta"));
  await page.keyboard.press("Enter");
  await page.waitForSelector("dialog.drawer[open]", { timeout: 8000 });
  await page.waitForTimeout(1600); // anggaran jejak tinta 1.200 ms
  const drawerText = norm(await page.locator("dialog.drawer[open]").innerText());
  check("keyboard: laci jejak tinta terbuka dengan 4150, 1200, 1300, 5100", ["4150", "1200", "1300", "5100"].every((c) => drawerText.includes(c)));
  check("keyboard: laci menyatakan seimbang", drawerText.includes("Seimbang"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ open: !!document.querySelector("dialog.drawer[open]"), focus: document.activeElement ? `${document.activeElement.tagName} ${(document.activeElement.textContent || "").trim().slice(0, 40)}` : "-" }));
  check("keyboard: Escape menutup laci", !after.open, `fokus kembali ke ${after.focus}`);

  // (b) Angka sesudah retur.
  const ret = (await api("GET", "/sales/returns", null, ta)).body.find((r) => r.so_id === so.id);
  check("retur tercatat untuk pesanan ini", !!ret, ret ? ret.return_no : "-");
  check("struk: kredit sama dengan API", strukText.includes(norm(fmt(ret.total_amount))), fmt(ret.total_amount));
  check("struk: biaya kembali sama dengan API", strukText.includes(norm(fmt(ret.cogs_reversed))), fmt(ret.cogs_reversed));
  const stockAfter = Number(await onHand());
  check(`stok ${product.sku} cabang 2 naik sebesar jumlah retur`, stockAfter - stockBefore === 2, `${stockBefore} → ${stockAfter}`);
  check("struk: perubahan stok sama dengan jumlah retur", strukText.includes(product.sku) && /\+\s?2\b/.test(strukText));
  const invAfter = (await api("GET", `/invoices/${inv.id}`, null, ta)).body;
  check("total faktur API berkurang sebesar kredit", Math.abs(Number(invBefore.total_amount) - Number(invAfter.total_amount) - Number(ret.total_amount)) < 0.005, `${invBefore.total_amount} → ${invAfter.total_amount}`);
  await page.goto(`${BASE}/accounting/invoices/${inv.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const invText = norm(await page.locator("main").innerText());
  check("halaman faktur menampilkan total dari API", invText.includes(norm(fmt(invAfter.total_amount))), fmt(invAfter.total_amount));
  const js = (await api("GET", `/accounting/journals?page_size=200&start=${ret.return_date}&end=${ret.return_date}`, null, ta)).body.items;
  const je = js.find((j) => j.id === ret.journal_entry_id);
  const sum = (k) => je.lines.reduce((s, l) => s + Number(l[k]), 0);
  check("jurnal retur seimbang di API", Math.abs(sum("debit") - sum("credit")) < 0.005, `${je.entry_no} D ${sum("debit")} = K ${sum("credit")}`);

  // (c) Persediaan FIFO dan neraca saldo.
  const fifo = Number((await api("GET", "/inventory/valuation", null, ta)).body.fifo_value);
  const tb = (await api("GET", `/accounting/reports/trial-balance?as_of=${today}`, null, ta)).body;
  // Persediaan dibukukan di 1300 (barang jadi) dan 1310 (bahan baku), lihat INVENTORY_ACCOUNT di backend.
  const glInv = tb.rows.filter((r) => ["1300", "1310"].includes(String(r.code))).reduce((s, r) => s + Number(r.debit_balance) - Number(r.credit_balance), 0);
  // Barang dalam perjalanan: sudah keluar dari lapisan cabang asal (TRANSFER_OUT), belum masuk cabang tujuan, tetap di akun persediaan.
  const transit = (await api("GET", "/inventory/transfers", null, ta)).body.filter((x) => x.status === "IN_TRANSIT").map((x) => x.id);
  let moves = [];
  for (let pg = 1; pg <= 50; pg++) {
    const b = (await api("GET", `/inventory/movements?page=${pg}&page_size=200`, null, ta)).body;
    const items = b.items ?? b;
    moves = moves.concat(items);
    if (!b.items || items.length < 200) break;
  }
  const transitValue = moves.filter((m) => m.ref_type === "TRANSFER" && m.type === "TRANSFER_OUT" && transit.includes(m.ref_id)).reduce((s, m) => s + Math.abs(Number(m.quantity)) * Number(m.unit_cost), 0);
  check("akun persediaan (1300 + 1310) = lapisan FIFO + barang dalam perjalanan", Math.abs(glInv - fifo - transitValue) < 0.01, `${fmt(glInv)} = ${fmt(fifo)} + ${fmt(transitValue)}`);
  check("info: nilai lapisan FIFO saja ≠ akun persediaan selama ada transfer dalam perjalanan", true, `selisih ${fmt(glInv - fifo)}`);
  check("neraca saldo: total debit = total kredit", tb.balanced === true && Math.abs(Number(tb.total_debit) - Number(tb.total_credit)) < 0.005, `${fmt(tb.total_debit)} = ${fmt(tb.total_credit)}`);
  await page.goto(`${BASE}/accounting/reports?laporan=tb&sampai=${today}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const tbText = norm(await page.locator("main").innerText());
  const intPart = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.trunc(Number(tb.total_debit)));
  check("halaman laporan menampilkan total neraca saldo dari API", tbText.includes(intPart), intPart);

  await browser.close();
  console.log(`\n${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
