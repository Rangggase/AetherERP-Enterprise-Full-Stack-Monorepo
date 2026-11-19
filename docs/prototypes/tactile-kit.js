/* Interactions for the tactile kit. Plain DOM + Web Animations API; no libraries. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => mq.matches || html.classList.contains("rm");
  const E = { out: "cubic-bezier(.2,.8,.2,1)", in: "cubic-bezier(.4,0,1,1)", spring: "cubic-bezier(.3,1.35,.5,1)" };
  const T = { press: 90, fast: 140, mid: 220, slow: 360, draw: 600 };
  const rupiah = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
  const rupiah2 = (n) => "Rp " + n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Animate; under reduced motion every transform is dropped and only opacity/colour remain. */
  function anim(el, frames, opts) {
    if (!el || !el.animate) return { finished: Promise.resolve() };
    if (reduced()) {
      frames = frames.map(({ transform, ...rest }) => rest).filter((f) => Object.keys(f).some((k) => k !== "offset" && k !== "easing"));
      if (frames.length < 2) return { finished: Promise.resolve() };
    }
    return el.animate(frames, { fill: "none", ...opts });
  }
  /** Number or text change: crossfade with a 4 px shift. No count-up. */
  async function swapText(el, text) {
    if (el.textContent === text) return;
    await anim(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-4px)" }], { duration: 110, easing: E.in }).finished;
    el.textContent = text;
    anim(el, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: T.fast, easing: E.out });
  }
  /** Group entrance: 30 ms apart, at most 6 staggered; the rest arrive with the sixth. */
  function stagger(container) {
    [...container.children].forEach((c, i) => {
      anim(c, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: T.mid, easing: E.out, delay: Math.min(i, 5) * 30, fill: "backwards" });
    });
  }
  const onFirstView = (el, fn) => {
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: 0.35 });
    io.observe(el);
  };

  /* ---------- Toasts ---------- */
  const toasts = $("#toasts");
  function toast(kind, title, text) {
    const t = document.createElement("div");
    t.className = `toast ${kind}`;
    t.setAttribute("role", kind === "bad" ? "alert" : "status");
    t.innerHTML = `<span class="ic">${glyph(kind === "bad" ? "gagal" : "berhasil", 20)}</span><div><b style="font-weight:600">${title}</b>${text ? `<div class="small muted">${text}</div>` : ""}</div><button class="x" aria-label="Tutup pemberitahuan">${glyph("tutup", 16)}</button>`;
    toasts.prepend(t);
    anim(t, [{ opacity: 0, transform: "translateY(-12px)" }, { opacity: 1, transform: "none" }], { duration: T.mid, easing: E.out });
    let timer = setTimeout(close, 4000);
    t.addEventListener("mouseenter", () => clearTimeout(timer));
    t.addEventListener("mouseleave", () => { timer = setTimeout(close, 2000); });
    $(".x", t).onclick = close;
    async function close() { clearTimeout(timer); await anim(t, [{ opacity: 1 }, { opacity: 0, transform: "translateX(8px)" }], { duration: T.fast, easing: E.in }).finished; t.remove(); }
  }

  /* ---------- Buttons: loading → success / failure ---------- */
  const tickSvg = '<svg class="tick glyph" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M5 12.5 9.5 17 19 7.5"/></svg>';
  /** In the app `work` is the real mutation promise; here it is a timer. */
  async function runKey(btn, work) {
    if (btn.dataset.state === "loading") return; // no double submit
    const cap = $(".cap", btn);
    const original = cap ? cap.innerHTML : "";
    btn.dataset.state = "loading";
    btn.setAttribute("aria-busy", "true");
    try {
      const r = await work();
      btn.dataset.state = "";
      if (cap) cap.innerHTML = tickSvg;
      requestAnimationFrame(() => { btn.dataset.state = "success"; });
      btn.removeAttribute("aria-busy");
      setTimeout(() => { btn.dataset.state = ""; if (cap) cap.innerHTML = original; }, 1500);
      return r;
    } catch (e) {
      btn.dataset.state = "error";
      btn.removeAttribute("aria-busy");
      if (cap) cap.innerHTML = glyph("gagal", 16);
      anim(btn, [0, -4, 4, -4, 4, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 300, easing: "linear" });
      setTimeout(() => { btn.dataset.state = ""; if (cap) cap.innerHTML = original; }, 2000);
      throw e;
    }
  }
  const wait = (ms, ok = true) => new Promise((res, rej) => setTimeout(() => (ok ? res() : rej(new Error("gagal"))), ms));

  /* ---------- Tokens ---------- */
  const SW = [["Kanvas", "#F4F1EA"], ["Permukaan", "#FBFAF6"], ["Sorot", "#EFEBE2"], ["Garis", "#DCD6CA"], ["Garis kontrol", "#8C8478"], ["Teks", "#1E1B18"], ["Teks redup", "#6B645A"], ["Aksen", "#7A2E2A"], ["Aksen gelap", "#5A201D"], ["Sukses", "#3F6B4E"], ["Peringatan", "#B07A1E"], ["Teks peringatan", "#8A5F12"], ["Galat", "#9E3B32"], ["Info", "#3D5A73"]];
  $("#swatches").innerHTML = SW.map(([n, h]) => `<div class="swatch"><div class="chipc" style="background:${h}"></div><b>${n}</b><code>${h}</code></div>`).join("");
  const MOTION = [["Tekan", "--t-press", 90, "spring"], ["Cepat", "--t-fast", 140, "out"], ["Sedang", "--t-mid", 220, "out"], ["Lambat", "--t-slow", 360, "out"], ["Gambar garis", "--t-draw", 600, "out"]];
  $("#motion").innerHTML = MOTION.map(([n, v, ms, e]) => `<div style="display:grid;grid-template-columns:170px 1fr;gap:12px;align-items:center"><span class="small"><b style="font-weight:600">${n}</b> <span class="muted">${ms} ms · ${e === "spring" ? "pegas" : "keluar"}</span></span><div class="mv-track"><span class="mv-dot" data-ms="${ms}" data-e="${e}"></span></div></div>`).join("") +
    `<p class="small muted" style="margin:6px 0 0">Easing keluar cubic-bezier(.2,.8,.2,1) · masuk cubic-bezier(.4,0,1,1) · pegas cubic-bezier(.3,1.35,.5,1). Dalam <i>reduced motion</i> titik tidak bergeser; hanya opacity yang berubah.</p>`;
  $("#playMotion").onclick = () => $$(".mv-dot").forEach((d) => {
    const w = d.parentElement.clientWidth - 22;
    anim(d, [{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${w}px)`, opacity: 1 }], { duration: Number(d.dataset.ms) * 2, easing: E[d.dataset.e], fill: "forwards" });
  });

  /* ---------- Glyph strip ---------- */
  $("#glyphMini").innerHTML = [...Object.entries(GLYPHS.modules).slice(0, 12), ...Object.entries(GLYPHS.actions).slice(0, 12)]
    .map(([k, g]) => `<span style="display:flex;gap:8px;align-items:center;font-size:13px">${glyph(k, 20)}${g.label}</span>`).join("");

  /* ---------- Key demos ---------- */
  $("#demoOk").onclick = (e) => runKey(e.currentTarget, () => wait(1100)).then(() => toast("good", "Pesanan disimpan", "SO-2026-000025 · penawaran")).catch(() => {});
  $("#demoFail").onclick = (e) => runKey(e.currentTarget, () => wait(900, false)).catch(() => toast("bad", "Pengiriman gagal dicatat", "Stok tidak cukup di Gudang Surabaya. Kurangi jumlah atau pilih gudang lain."));

  /* ---------- Steppers ---------- */
  function wireStepper(st, onChange) {
    const input = $("input", st);
    const max = Number(st.dataset.max ?? Infinity), min = 0;
    const set = (v) => { v = Math.max(min, Math.min(max, v)); input.value = String(v); sync(); onChange?.(v); };
    const sync = () => { const v = Number(input.value) || 0; $$(".mini-key", st).forEach((b) => { b.disabled = Number(b.dataset.d) < 0 ? v <= min : v >= max; }); };
    $$(".mini-key", st).forEach((b) => b.addEventListener("click", () => set((Number(input.value) || 0) + Number(b.dataset.d))));
    input.addEventListener("input", () => { sync(); onChange?.(Number(input.value) || 0); });
    input.addEventListener("keydown", (e) => { if (e.key === "ArrowUp") { e.preventDefault(); set((Number(input.value) || 0) + 1); } if (e.key === "ArrowDown") { e.preventDefault(); set((Number(input.value) || 0) - 1); } });
    sync();
    return set;
  }
  $$("#input [data-stepper]").forEach((s) => wireStepper(s));

  /* ---------- Switches ---------- */
  function wireSwitch(b, onChange) {
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-checked") !== "true";
      b.setAttribute("aria-checked", String(on));
      const st = $(".state", b); if (st) st.textContent = on ? "Aktif" : "Mati";
      onChange?.(on);
    });
  }
  $$("[data-sw]").forEach((b) => wireSwitch(b));
  wireSwitch($("#rmToggle"), (on) => html.classList.toggle("rm", on));

  /* ---------- Tabs ---------- */
  $$("[data-tabs]").forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const select = (t, focus) => {
      const cur = tabs.find((x) => x.getAttribute("aria-selected") === "true");
      if (cur === t) return;
      tabs.forEach((x) => { const on = x === t; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; $("#" + x.getAttribute("aria-controls")).hidden = !on; });
      const dir = tabs.indexOf(t) > tabs.indexOf(cur) ? 1 : -1;
      anim($("#" + t.getAttribute("aria-controls")), [{ opacity: 0, transform: `translateX(${8 * dir}px)` }, { opacity: 1, transform: "none" }], { duration: T.mid, easing: E.out });
      if (focus) t.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") select(tabs[(i + 1) % tabs.length], true);
        if (e.key === "ArrowLeft") select(tabs[(i - 1 + tabs.length) % tabs.length], true);
      });
    });
  });

  /* ---------- Status ---------- */
  const STATUS = [["good", "berhasil", "Lunas"], ["info", "kirim", "Terfaktur"], ["warn", "peringatan", "Perlu persetujuan"], ["bad", "tutup", "Dibatalkan"], ["idle", "edit", "Draf"]];
  $("#badges").innerHTML = STATUS.map(([k, g, t]) => `<span class="badge ${k}">${glyph(g, 14)}${t}</span>`).join("");
  $("#stamps").innerHTML = STATUS.map(([k, , t]) => `<span class="stamp ${k}">${t}</span>`).join("") +
    `<span class="stamp sm good">Periode Nov 2026 · Terbuka</span><span class="stamp sm idle" style="display:inline-flex;gap:4px;align-items:center">${glyph("gembok", 12)}Periode Okt 2026 · Ditutup</span>`;
  function stampIn(el) {
    anim(el, [{ opacity: 0, transform: "rotate(-4deg) scale(1.15)" }, { opacity: 1, transform: "rotate(-4deg) scale(1)" }], { duration: T.mid, easing: E.spring });
  }
  function setStamp(el, kind, text, animate) {
    el.className = el.className.replace(/\b(good|warn|bad|info|idle)\b/, kind);
    el.textContent = text;
    if (animate) stampIn(el);
  }
  $("#payBtn").onclick = (e) => runKey(e.currentTarget, () => wait(1000)).then(() => {
    setStamp($("#docStamp"), "good", "Lunas", true); // changed in this session: stamped once
    swapText($("#docOut"), "Rp 0");
    $$("#docRail li").forEach((li, i) => { li.className = i === 0 ? "done" : i === 2 ? "now" : ""; });
    e.currentTarget.disabled = true;
    toast("good", "Pembayaran dicatat", "INV-2026-000019 lunas. Jurnal kas diposting.");
  }).catch(() => {});
  $("#resetPay").onclick = () => { setStamp($("#docStamp"), "info", "Terbuka", false); $("#docOut").textContent = "Rp 2.600.000"; $$("#docRail li").forEach((li, i) => { li.className = i === 0 ? "now" : ""; }); $("#payBtn").disabled = false; };

  /* ---------- Task cards ---------- */
  const TASKS = [
    { n: 3, t: "pesanan pembelian perlu persetujuan", d: "Rp48,2 jt · tertua PO-2026-000011, 4 hari", to: "Pesanan pembelian, filter: perlu persetujuan" },
    { n: 4, t: "faktur piutang lewat jatuh tempo", d: "Rp33,8 jt · tertua INV-2026-000019, 67 hari", to: "Faktur & tagihan, filter: lewat jatuh tempo" },
    { n: 1, t: "stok di bawah titik pesan ulang", d: "FG-CAB-01 di Gudang Bandung · tersedia 100", to: "Saran pesan ulang" },
    { n: 2, t: "retur tercatat bulan ini", d: "Kredit Rp1,3 jt · terakhir RET-2026-000004", to: "Retur, filter: November" },
  ];
  const taskCard = (x) => `<button class="sheet lift task" data-to="${x.to}">${x.n >= 2 ? '<span class="stack-back b1"></span>' : ""}${x.n >= 3 ? '<span class="stack-back b2"></span>' : ""}<span class="n">${x.n}</span><span class="t">${x.t}</span><span class="d">${x.d}</span><span class="go">${glyph("kirim", 18)}</span></button>`;
  $("#tasks").innerHTML = TASKS.map(taskCard).join("");
  $("#tasks").setAttribute("data-stagger", "");
  document.addEventListener("click", (e) => { const t = e.target.closest(".task[data-to]"); if (t) toast("good", "Membuka daftar", t.dataset.to); });

  /* ---------- Table ---------- */
  const ROWS = [
    ["SO-2026-000024", "Toko Digital Makmur", "28 Agu 2026", "info", "Terfaktur", 2600000],
    ["SO-2026-000023", "CV Sinar Jaya", "27 Agu 2026", "info", "Terkirim", 1950000],
    ["SO-2026-000022", "PT Mitra Elektrik", "26 Agu 2026", "warn", "Terkonfirmasi", 5400000],
    ["SO-2026-000021", "Toko Digital Makmur", "25 Agu 2026", "idle", "Penawaran", 90000],
    ["SO-2026-000020", "PT Mitra Elektrik", "24 Agu 2026", "idle", "Penawaran", 3600000],
    ["SO-2026-000018", "CV Sinar Jaya", "21 Agu 2026", "info", "Terfaktur", 285000],
    ["SO-2026-000017", "PT Kabel Prima", "20 Agu 2026", "info", "Terfaktur", 19750000],
    ["SO-2026-000015", "Toko Digital Makmur", "16 Agu 2026", "good", "Lunas", 285000],
    ["SO-2026-000013", "PT Kabel Prima", "13 Agu 2026", "good", "Lunas", 18850000],
    ["SO-2026-000010", "PT Mitra Elektrik", "9 Agu 2026", "good", "Lunas", 16250000],
    ["SO-2026-000008", "CV Sinar Jaya", "6 Agu 2026", "good", "Lunas", 11950000],
    ["SO-2026-000005", "PT Kabel Prima", "2 Agu 2026", "good", "Lunas", 9350000],
  ];
  const statusGlyph = { good: "berhasil", info: "kirim", warn: "peringatan", bad: "tutup", idle: "edit" };
  const badge = (k, t) => `<span class="badge ${k}">${glyph(statusGlyph[k], 14)}${t}</span>`;
  const ckCell = (label) => `<label class="cb" style="min-height:0"><input type="checkbox" aria-label="Pilih ${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path pathLength="1" d="M5 12.5 9.5 17 19 7.5"/></svg></label>`;
  $("#tbl tbody").innerHTML = ROWS.map((r) => `<tr tabindex="0" data-no="${r[0]}"><td class="ck">${ckCell(r[0])}</td><td class="tnum" style="font-weight:500">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${badge(r[3], r[4])}</td><td class="num">${rupiah(r[5])}</td></tr>`).join("");
  $("#tblMobile tbody").innerHTML = ROWS.slice(0, 6).map((r) => `<tr><td class="tnum" style="font-weight:500">${r[0]}</td><td>${r[1]}</td><td>${badge(r[3], r[4])}</td><td class="num">${rupiah(r[5])}</td></tr>`).join("");
  const wrap = $("#tblWrap");
  wrap.addEventListener("scroll", () => wrap.classList.toggle("scrolled", wrap.scrollTop > 0), { passive: true });
  const sync = () => {
    const boxes = $$("#tbl tbody input[type=checkbox]");
    const n = boxes.filter((b) => b.checked).length;
    boxes.forEach((b) => b.closest("tr").setAttribute("aria-selected", String(b.checked)));
    $("#ckAll").checked = n === boxes.length; $("#ckAll").indeterminate = n > 0 && n < boxes.length;
    $("#bulkN").textContent = `${n} dipilih`;
    $("#bulk").classList.toggle("on", n > 0);
  };
  $("#tbl").addEventListener("change", (e) => { if (e.target.id === "ckAll") $$("#tbl tbody input").forEach((b) => { b.checked = e.target.checked; }); sync(); });
  $("#bulkClear").onclick = () => { $$("#tbl tbody input").forEach((b) => { b.checked = false; }); sync(); };
  const openRow = (tr) => { const r = ROWS.find((x) => x[0] === tr.dataset.no); $("#drawerT").textContent = r[0]; $("#dwCust").textContent = r[1]; $("#dwDate").textContent = r[2]; $("#dwTotal").textContent = rupiah(r[5]); const s = $("#dwStamp"); s.className = `stamp sm ${r[3]}`; s.textContent = r[4]; openDrawer(tr); };
  $("#tbl tbody").addEventListener("click", (e) => { if (e.target.closest("label,input,button,a")) return; const tr = e.target.closest("tr"); if (tr) openRow(tr); });
  $("#tbl tbody").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("tr")) { e.preventDefault(); openRow(e.target); } });
  $$("[data-density]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-density]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("#tbl").classList.toggle("dense", b.dataset.density === "rapat");
    try { localStorage.setItem("aether.density", b.dataset.density); } catch { /* ignore */ }
  }));
  // Chips enter and leave.
  const chipFilters = ["Status: Terfaktur", "Pelanggan: Toko Digital", "Gudang: Surabaya"];
  let chipN = 0;
  function addChip(text) {
    const c = document.createElement("span");
    c.className = "chip";
    c.innerHTML = `${text}<button aria-label="Hapus filter ${text}">${glyph("tutup", 14)}</button>`;
    $("#chips").append(c);
    anim(c, [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }], { duration: T.fast, easing: E.spring });
    $("button", c).onclick = async () => { await anim(c, [{ opacity: 1 }, { opacity: 0, transform: "scale(.92)" }], { duration: 110, easing: E.in }).finished; c.remove(); $("#addChip").focus(); };
  }
  addChip(chipFilters[chipN++]);
  $("#addChip").onclick = () => addChip(chipFilters[chipN++ % chipFilters.length]);

  /* ---------- Layers ---------- */
  let opener = null;
  function openLayer(d, frames, from) {
    opener = from || document.activeElement;
    d.showModal();
    anim(d, frames, { duration: T.mid, easing: E.out });
    try { d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.mid, easing: E.out, pseudoElement: "::backdrop" }); } catch { /* older engines */ }
  }
  async function closeLayer(d, frames) {
    await anim(d, frames, { duration: T.fast, easing: E.in }).finished;
    d.close();
    opener?.focus?.();
  }
  const drawer = $("#drawer"), dialog = $("#dialog"), palette = $("#palette");
  const DRAWER_IN = [{ opacity: 0, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }];
  const DRAWER_OUT = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }];
  const DLG_IN = [{ opacity: 0, transform: "scale(.98)" }, { opacity: 1, transform: "none" }];
  const DLG_OUT = [{ opacity: 1 }, { opacity: 0, transform: "scale(.98)" }];
  function openDrawer(from) { openLayer(drawer, DRAWER_IN, from); }
  $("#openDrawer").onclick = (e) => { openRow($("#tbl tbody tr")); opener = e.currentTarget; };
  for (const [d, out] of [[drawer, DRAWER_OUT], [dialog, DLG_OUT], [palette, DLG_OUT]]) {
    d.addEventListener("cancel", (e) => { e.preventDefault(); closeLayer(d, out); });
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-close]")) closeLayer(d, out); });
  }
  $("#openDialog").onclick = (e) => openLayer(dialog, DLG_IN, e.currentTarget);
  $("#dlgGo").onclick = (e) => runKey(e.currentTarget, () => wait(900)).then(() => { closeLayer(dialog, DLG_OUT); toast("good", "SO-2026-000022 dibatalkan", "Cadangan stok dilepas."); }).catch(() => {});

  // Menu (generic): open below its button, arrows move, Escape returns focus.
  function menu(btn, items, onPick) {
    const holder = btn.parentElement;
    holder.style.position = "relative";
    let m = null;
    const close = (focus = true) => { if (!m) return; const mm = m; m = null; btn.setAttribute("aria-expanded", "false"); anim(mm, [{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: E.in }).finished.then(() => mm.remove()); if (focus) btn.focus(); };
    btn.addEventListener("click", () => {
      if (m) return close();
      m = document.createElement("div");
      m.className = "menu"; m.setAttribute("role", "menu");
      m.style.top = btn.offsetHeight + 6 + "px"; m.style.right = "0";
      m.innerHTML = items.map((it, i) => `<button role="${it.radio ? "menuitemradio" : "menuitem"}" ${it.radio ? `aria-checked="${!!it.checked}"` : ""} tabindex="${i ? -1 : 0}" data-i="${i}">${it.g ? glyph(it.g, 16) : ""}${it.label}</button>`).join("");
      holder.append(m);
      btn.setAttribute("aria-expanded", "true");
      anim(m, [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: T.fast, easing: E.out });
      const its = $$("[role^=menuitem]", m);
      its[0].focus();
      m.addEventListener("keydown", (e) => {
        const i = its.indexOf(document.activeElement);
        if (e.key === "ArrowDown") { e.preventDefault(); its[(i + 1) % its.length].focus(); }
        if (e.key === "ArrowUp") { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
        if (e.key === "Escape") { e.preventDefault(); close(); }
        if (e.key === "Tab") close(false);
      });
      m.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) { onPick?.(items[Number(b.dataset.i)], b); close(); } });
    });
    document.addEventListener("pointerdown", (e) => { if (m && !holder.contains(e.target)) close(false); });
  }
  menu($("#openMenu"), [{ label: "Cetak", g: "cetak" }, { label: "Ekspor CSV", g: "ekspor" }, { label: "Salin nomor", g: "edit" }], (it) => toast("good", it.label, "Contoh aksi menu."));
  $("#toastOk").onclick = () => toast("good", "Retur dicatat", "RET-2026-000004 · kredit Rp 650.000");
  $("#toastBad").onclick = () => toast("bad", "Retur tidak bisa dicatat", "Jumlah melebihi sisa yang bisa diretur (3). Kurangi jumlahnya.");

  /* ---------- Skeleton ---------- */
  $("#skRows").innerHTML = Array.from({ length: 5 }, () => '<div style="display:flex;gap:18px;padding:12px 0;border-bottom:1px solid var(--line)"><div class="sk" style="height:12px;width:120px"></div><div class="sk" style="height:12px;flex:1"></div><div class="sk" style="height:12px;width:80px"></div></div>').join("");

  /* ---------- Chart ---------- */
  const MONTHS12 = ["Des", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov"];
  const REV12 = [0, 0, 0, 0, 0, 0, 15.6, 20.4, 29.1, 31.4, 36.9, 40.5];
  const COGS12 = [0, 0, 0, 0, 0, 0, 6.1, 8.3, 11.2, 12.6, 15.1, 17.4];
  function chartSvg(n, width = 720) {
    const months = MONTHS12.slice(-n), rev = REV12.slice(-n), cogs = COGS12.slice(-n);
    const W = Math.max(320, Math.round(width)), H = 250, L = 34, R = 118, Tp = 12, B = 26, max = 50;
    const x = (i) => L + (i * (W - L - R)) / (n - 1), y = (v) => Tp + (1 - v / max) * (H - Tp - B);
    const path = (a) => a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const last = n - 1;
    return { months, rev, cogs, x, y, W, H, svg: `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <g class="grid">${[0, 25, 50].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}</g>
      ${months.map((m, i) => `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${m}</text>`).join("")}
      <path class="ln draw" pathLength="1" d="${path(cogs)}" stroke="#6B645A" stroke-dasharray="1" />
      <path class="ln draw" pathLength="1" d="${path(rev)}" stroke="#7A2E2A" />
      <circle cx="${x(last)}" cy="${y(rev[last])}" r="4" fill="#7A2E2A"/><circle cx="${x(last)}" cy="${y(cogs[last])}" r="4" fill="#6B645A"/>
      <text class="lab" x="${x(last) + 10}" y="${y(rev[last]) + 4}">Pendapatan ${rev[last].toFixed(1).replace(".", ",")}</text>
      <text class="lab m" x="${x(last) + 10}" y="${y(cogs[last]) + 4}">HPP ${cogs[last].toFixed(1).replace(".", ",")}</text>
      <line class="xh" x1="0" x2="0" y1="${Tp}" y2="${H - B}"/>
      <circle class="xd1" r="4" fill="#FBFAF6" stroke="#7A2E2A" stroke-width="2" opacity="0"/><circle class="xd2" r="4" fill="#FBFAF6" stroke="#6B645A" stroke-width="2" opacity="0"/>
    </svg><div class="slip" aria-hidden="true"></div>` };
  }
  function mountChart(el, n, { draw }) {
    const c = chartSvg(n, el.clientWidth || 720);
    el.innerHTML = c.svg;
    el.setAttribute("aria-label", `Pendapatan dan HPP bulanan, jutaan rupiah. ${c.months.map((m, i) => `${m}: ${c.rev[i].toFixed(1)} dan ${c.cogs[i].toFixed(1)}`).join("; ")}`);
    const lines = $$(".ln", el);
    // The HPP line keeps a dashed look after drawing: draw it with the dash trick, then switch to the real dash.
    const finish = () => { lines.forEach((l) => l.classList.remove("draw", "drawn")); lines[0].setAttribute("stroke-dasharray", "5 3"); lines[0].removeAttribute("pathLength"); };
    if (draw && !reduced()) {
      requestAnimationFrame(() => requestAnimationFrame(() => { lines.forEach((l) => l.classList.add("drawn")); setTimeout(finish, T.draw + 40); }));
    } else finish();
    const svg = $("svg", el), slip = $(".slip", el), xh = $(".xh", el), d1 = $(".xd1", el), d2 = $(".xd2", el);
    let idx = c.months.length - 1;
    const show = (i) => {
      idx = i;
      const sx = c.x(i);
      xh.setAttribute("x1", sx); xh.setAttribute("x2", sx);
      d1.setAttribute("cx", sx); d1.setAttribute("cy", c.y(c.rev[i])); d1.setAttribute("opacity", 1);
      d2.setAttribute("cx", sx); d2.setAttribute("cy", c.y(c.cogs[i])); d2.setAttribute("opacity", 1);
      const k = svg.getBoundingClientRect().width / c.W;
      slip.innerHTML = `<b style="font-weight:600">${c.months[i]} 2026</b><div style="display:grid;grid-template-columns:1fr auto;gap:0 14px;margin-top:2px"><span>Pendapatan</span><span class="tnum">Rp${c.rev[i].toFixed(1).replace(".", ",")} jt</span><span class="muted">HPP</span><span class="tnum muted">Rp${c.cogs[i].toFixed(1).replace(".", ",")} jt</span></div>`;
      const left = Math.min(sx * k + 12, svg.clientWidth - 170);
      slip.style.left = left + "px"; slip.style.top = Math.max(0, c.y(c.rev[i]) * k - 64) + "px";
      slip.classList.add("on");
    };
    const hide = () => { slip.classList.remove("on"); d1.setAttribute("opacity", 0); d2.setAttribute("opacity", 0); el.classList.remove("kb"); };
    svg.addEventListener("pointermove", (e) => { const k = svg.getBoundingClientRect(); const vx = ((e.clientX - k.left) / k.width) * c.W; let best = 0; c.months.forEach((_, i) => { if (Math.abs(c.x(i) - vx) < Math.abs(c.x(best) - vx)) best = i; }); show(best); });
    svg.addEventListener("pointerleave", hide);
    el.onkeydown = (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); el.classList.add("kb"); show(Math.max(0, Math.min(c.months.length - 1, idx + (e.key === "ArrowRight" ? 1 : -1)))); } if (e.key === "Escape") hide(); };
    el.onblur = hide;
    return c;
  }
  function chartTable(c) {
    return `<table class="tbl dense" style="margin-top:6px"><thead><tr><th>Bulan</th><th class="num">Pendapatan (jt)</th><th class="num">HPP (jt)</th></tr></thead><tbody>${c.months.map((m, i) => `<tr><td>${m}</td><td class="num">${c.rev[i].toFixed(1).replace(".", ",")}</td><td class="num">${c.cogs[i].toFixed(1).replace(".", ",")}</td></tr>`).join("")}</tbody></table>`;
  }
  const chartEl = $("#chart");
  let chartRange = 6;
  // First paint shows the axes; the lines draw once when the chart first scrolls into view.
  let cdata = mountChart(chartEl, 6, { draw: false });
  $$(".ln", chartEl).forEach((l) => { l.style.opacity = 0; });
  onFirstView(chartEl, () => { cdata = mountChart(chartEl, chartRange, { draw: true }); $("#chartTable").innerHTML = chartTable(cdata); });
  $("#chartTable").innerHTML = chartTable(cdata);
  $$("[data-range]").forEach((b) => b.addEventListener("click", async () => {
    if (Number(b.dataset.range) === chartRange) return;
    $$("[data-range]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    chartRange = Number(b.dataset.range);
    await anim($("svg", chartEl), [{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: E.in }).finished;
    cdata = mountChart(chartEl, chartRange, { draw: false }); // values change; the line is not redrawn
    anim($("svg", chartEl), [{ opacity: 0 }, { opacity: 1 }], { duration: T.fast, easing: E.out });
    $("#chartTable").innerHTML = chartTable(cdata);
  }));

  /* ---------- KPI ---------- */
  let kpiAlt = false;
  $("#kpiSwap").onclick = () => {
    kpiAlt = !kpiAlt;
    swapText($("#kpiFig"), kpiAlt ? "Rp41,2 jt" : "Rp40,5 jt");
    $("#kpiChg").lastChild.textContent = kpiAlt ? "naik 13,4% dari Oktober" : "naik 11,5% dari Oktober";
  };

  /* ---------- Command palette ---------- */
  const NAV = [
    { g: "", items: [["dasbor", "Dasbor"]] },
    { g: "Pengadaan", items: [["pesanan-pembelian", "Pesanan pembelian", 3], ["penerimaan-barang", "Penerimaan barang"], ["pemasok", "Pemasok"]] },
    { g: "Gudang", items: [["produk", "Produk"], ["level-stok", "Level stok", 1], ["kartu-stok", "Kartu stok"], ["transfer", "Transfer antar gudang"], ["perakitan", "Perakitan"], ["pesan-ulang", "Saran pesan ulang"]] },
    { g: "Penjualan", items: [["pesanan-penjualan", "Pesanan penjualan"], ["retur", "Retur"], ["pelanggan", "Pelanggan"]] },
    { g: "Akuntansi", items: [["jurnal", "Jurnal umum"], ["faktur", "Faktur & tagihan", 4], ["laporan", "Laporan keuangan"], ["periode", "Periode fiskal"]] },
    { g: "Sistem", items: [["audit", "Log audit"], ["pengguna", "Pengguna & peran"]] },
  ];
  const PAGES = NAV.flatMap((g) => g.items.map(([k, l]) => ({ kind: "Halaman", g: k, label: l })));
  const DOCS = [["pesanan-penjualan", "SO-2026-000024", "Toko Digital Makmur · Terfaktur"], ["pesanan-penjualan", "SO-2026-000022", "PT Mitra Elektrik · Terkonfirmasi"], ["pesanan-pembelian", "PO-2026-000011", "PT Komponen Utama · Perlu persetujuan"], ["faktur", "INV-2026-000019", "Toko Digital Makmur · lewat jatuh tempo"]].map(([g, label, sub]) => ({ kind: "Dokumen", g, label, sub }));
  const ACTIONS = [["retur", "Buat retur", "dari pesanan yang sudah difaktur"], ["buat", "Buat pesanan penjualan"], ["buat", "Buat pesanan pembelian"], ["jurnal", "Buat jurnal"], ["penerimaan-barang", "Catat penerimaan barang"]].map(([g, label, sub]) => ({ kind: "Aksi", g, label, sub }));
  let pScope = "all", pSel = 0, pList = [];
  function renderPalette() {
    const q = $("#pq").value.trim().toLowerCase();
    const pool = pScope === "pages" ? PAGES : [...PAGES, ...DOCS, ...ACTIONS];
    pList = pool.filter((x) => !q || (x.label + " " + (x.sub || "")).toLowerCase().includes(q)).slice(0, 14);
    pSel = Math.min(pSel, Math.max(0, pList.length - 1));
    let last = "";
    $("#pres").innerHTML = pList.length ? pList.map((x, i) => {
      const head = x.kind !== last ? `<li role="presentation" class="small muted" style="padding:8px 10px 4px;font-weight:600">${(last = x.kind)}</li>` : "";
      return `${head}<li role="option" id="po${i}" aria-selected="${i === pSel}" data-i="${i}" style="display:flex;align-items:center;gap:10px;min-height:40px;padding:0 10px;border-radius:3px;cursor:pointer;${i === pSel ? "background:var(--highlight);box-shadow:inset 2px 0 0 var(--accent)" : ""}">${glyph(x.g, 18)}<span style="font-weight:${x.kind === "Dokumen" ? 600 : 400}" class="tnum">${x.label}</span>${x.sub ? `<span class="small muted" style="margin-left:auto">${x.sub}</span>` : ""}</li>`;
    }).join("") : `<li class="muted" style="padding:20px;text-align:center">Tidak ada yang cocok. Coba nomor dokumen, misalnya SO-2026-000024.</li>`;
    $("#pq").setAttribute("aria-activedescendant", pList.length ? `po${pSel}` : "");
    $(`#po${pSel}`)?.scrollIntoView({ block: "nearest" });
  }
  function openPalette(scope = "all", from) {
    if (palette.open) return;
    pScope = scope; pSel = 0; $("#pq").value = "";
    $("#pq").placeholder = scope === "pages" ? "Cari halaman" : "Cari halaman, dokumen, aksi";
    renderPalette();
    openLayer(palette, [{ opacity: 0, transform: "translateY(-6px) scale(.98)" }, { opacity: 1, transform: "none" }], from);
    $("#pq").focus();
  }
  $("#pq").addEventListener("input", () => { pSel = 0; renderPalette(); });
  $("#pq").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); pSel = (pSel + 1) % Math.max(1, pList.length); renderPalette(); }
    if (e.key === "ArrowUp") { e.preventDefault(); pSel = (pSel - 1 + pList.length) % Math.max(1, pList.length); renderPalette(); }
    if (e.key === "Enter" && pList[pSel]) { e.preventDefault(); pick(pList[pSel]); }
  });
  $("#pres").addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) pick(pList[Number(li.dataset.i)]); });
  function pick(x) { closeLayer(palette, DLG_OUT); toast("good", x.kind === "Aksi" ? x.label : `Membuka ${x.label}`, x.kind === "Halaman" ? "Pindah halaman tanpa memuat ulang." : x.sub); }
  $("#openPalette").onclick = (e) => openPalette("all", e.currentTarget);
  document.addEventListener("keydown", (e) => {
    const t = e.target, typing = t.matches?.("input,textarea,select,[contenteditable]");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette("all"); }
    else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openPalette("pages"); }
  });

  /* ---------- Shell ---------- */
  function sideHtml(active) {
    return `<aside class="side"><div class="brand"><span class="mark">A</span><span class="txt">AetherERP</span></div>
      <nav aria-label="Menu utama" class="navwrap" style="position:relative;margin-top:6px"><span class="marker" aria-hidden="true"></span>
      ${NAV.map((g) => `${g.g ? `<h2>${g.g.toLowerCase()}</h2>` : ""}<ul>${g.items.map(([k, l, n]) => `<li><a href="#" data-k="${k}" data-tip="${l}${n ? ` · ${n} tertunda` : ""}" aria-label="${l}${n ? `, ${n} tertunda` : ""}" ${k === active ? 'aria-current="page"' : ""}>${glyph(k, 20)}<span class="txt">${l}</span>${n ? `<span class="pip tnum" aria-hidden="true">${n}</span><span class="dot" aria-hidden="true"></span>` : ""}</a></li>`).join("")}</ul>`).join("")}
      </nav>
      <button class="act" data-rail style="margin:14px 10px 0;color:var(--muted)">${glyph("rel", 20)}<span class="txt">Ciutkan menu</span></button></aside>`;
  }
  function topHtml(crumbs) {
    return `<header class="top"><nav class="crumbs" aria-label="Jejak halaman">${crumbs.map((c, i) => (i === crumbs.length - 1 ? `<b>${c}</b>` : `${c} / `)).join("")}</nav>
      <span><button class="pill-btn" data-branch aria-haspopup="menu" aria-expanded="false">${glyph("cabang", 16)}<span>Semua cabang</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></span>
      <span class="stamp sm good" title="Periode akuntansi berjalan">Periode Nov 2026 · Terbuka</span>
      <button class="searchbox" data-search>${glyph("cari", 16)}<span>Cari dokumen, halaman, aksi</span><kbd>Ctrl K</kbd></button>
      <span><button class="avatar" data-user aria-haspopup="menu" aria-expanded="false" aria-label="Menu pengguna: System Admin">SA</button></span></header>`;
  }
  function mountShell(root, { active, crumbs, content }) {
    let rail = false;
    try { rail = localStorage.getItem("aether.rail") === "1"; } catch { /* ignore */ }
    root.innerHTML = `<div class="app${rail ? " rail" : ""}">${sideHtml(active)}<div style="min-width:0">${topHtml(crumbs)}<div class="main">${content}</div></div></div>`;
    const app = $(".app", root), wrapN = $(".navwrap", root), marker = $(".marker", root);
    const place = (instant) => {
      const a = $('a[aria-current="page"]', wrapN);
      if (!a) return;
      const top = a.getBoundingClientRect().top - wrapN.getBoundingClientRect().top;
      if (instant) { marker.style.transition = "none"; requestAnimationFrame(() => { marker.style.transition = ""; }); }
      marker.style.transform = `translateY(${top}px)`;
    };
    place(true);
    wrapN.addEventListener("click", (e) => { const a = e.target.closest("a"); if (!a) return; e.preventDefault(); $$("a", wrapN).forEach((x) => x.removeAttribute("aria-current")); a.setAttribute("aria-current", "page"); place(); });
    wrapN.addEventListener("keydown", (e) => {
      const links = $$("a", wrapN), i = links.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === "ArrowDown") { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
    $("[data-rail]", root).onclick = (e) => {
      app.classList.toggle("rail");
      const on = app.classList.contains("rail");
      $(".txt", e.currentTarget).textContent = on ? "Lebarkan menu" : "Ciutkan menu";
      e.currentTarget.setAttribute("aria-label", on ? "Lebarkan menu" : "Ciutkan menu");
      try { localStorage.setItem("aether.rail", on ? "1" : "0"); } catch { /* ignore */ }
      requestAnimationFrame(() => place(true));
    };
    $("[data-search]", root).onclick = (e) => openPalette("all", e.currentTarget);
    let branch = "Semua cabang";
    menu($("[data-branch]", root), ["Semua cabang", "Gudang Surabaya", "Gudang Bandung"].map((l) => ({ label: l, radio: true, get checked() { return l === branch; } })), (it, b) => { branch = it.label; $("[data-branch] span", root).textContent = it.label; });
    menu($("[data-user]", root), [{ label: "Akun saya", g: "akun" }, { label: "Keluar", g: "keluar" }], (it) => toast("good", it.label, "Contoh."));
    return root;
  }
  mountShell($("#shellDemo"), { active: "faktur", crumbs: ["Akuntansi", "Faktur & tagihan"], content: `<div class="page"><div class="page-h"><div><h1>Faktur & tagihan</h1><p class="muted small" style="margin:4px 0 0">24 faktur · 4 lewat jatuh tempo</p></div><button class="key has-cap"><span class="cap">${glyph("buat", 16)}</span><span class="label">Buat faktur</span></button></div><div class="sheet" style="padding:16px" aria-hidden="true">${Array.from({ length: 6 }, () => '<div style="display:flex;gap:18px;padding:12px 0;border-bottom:1px solid var(--line)"><div class="sk" style="height:12px;width:120px"></div><div class="sk" style="height:12px;flex:1"></div><div class="sk" style="height:12px;width:80px"></div></div>').join("")}</div><p class="note">Isi halaman dikosongkan di contoh kerangka. Coba: klik item menu, panah atas/bawah, "Ciutkan menu", chip cabang, avatar.</p></div>` });

  /* ---------- Phone ---------- */
  const phone = $("#phone");
  phone.innerHTML = `<div class="scroll">
      <header class="top" style="height:48px;padding:0 12px;gap:8px"><span class="crumbs"><b>Pesanan penjualan</b></span><button class="act" aria-label="Cari" style="min-width:44px;min-height:44px;justify-content:center">${glyph("cari", 20)}</button><button class="avatar" aria-label="Menu pengguna">SS</button></header>
      <div style="padding:16px 16px 140px">
        <h1 style="font-size:26px">Pesanan penjualan</h1><p class="muted small" style="margin:2px 0 12px">24 pesanan · total Rp157,4 jt</p>
        <div class="chips" style="margin-bottom:10px"><span class="chip">Status: Terfaktur<button aria-label="Hapus filter Status">${glyph("tutup", 14)}</button></span></div>
        <div class="swipe-hint">${glyph("kirim", 16)}Geser ke kanan untuk kolom lain</div>
        <div class="tbl-wrap tbl-mobile"><table class="tbl" style="min-width:520px"><thead><tr><th>Nomor</th><th>Pelanggan</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>${ROWS.slice(0, 8).map((r) => `<tr><td class="tnum" style="font-weight:500">${r[0].replace("SO-2026-", "SO-…")}</td><td>${r[1]}</td><td>${badge(r[3], r[4])}</td><td class="num">${rupiah(r[5])}</td></tr>`).join("")}</tbody></table></div>
      </div></div>
    <div class="sticky-cta"><button class="key has-cap" style="width:100%;height:44px;justify-content:flex-start"><span class="cap" style="width:44px">${glyph("buat", 18)}</span><span class="label">Buat pesanan</span></button></div>
    <div class="sheet-up" id="moreSheet" aria-hidden="true"><div class="grab"></div><p class="small muted" style="margin:0 0 8px;font-weight:600">Lainnya</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${[["produk", "Produk"], ["level-stok", "Level stok"], ["faktur", "Faktur & tagihan"], ["laporan", "Laporan keuangan"], ["akun", "Akun saya"], ["keluar", "Keluar"]].map(([g, l]) => `<a href="#" class="act" style="min-height:44px;font-weight:400" tabindex="-1">${glyph(g, 20)}${l}</a>`).join("")}</div></div>
    <nav class="tabbar" aria-label="Menu utama">${[["dasbor", "Dasbor"], ["pesanan-penjualan", "Pesanan"], ["retur", "Retur"], ["pelanggan", "Pelanggan"]].map(([g, l], i) => `<a href="#" ${i === 1 ? 'aria-current="page"' : ""}>${glyph(g, 24)}${l}</a>`).join("")}<button aria-expanded="false" aria-controls="moreSheet" id="moreBtn">${glyph("lainnya", 24)}Lainnya</button></nav>`;
  $("#moreBtn").onclick = (e) => {
    const s = $("#moreSheet"), on = !s.classList.contains("on");
    s.classList.toggle("on", on); s.setAttribute("aria-hidden", String(!on)); e.currentTarget.setAttribute("aria-expanded", String(on));
    $$("a", s).forEach((a) => { a.tabIndex = on ? 0 : -1; });
  };
  $$(".tabbar a", phone).forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); $$(".tabbar a", phone).forEach((x) => x.removeAttribute("aria-current")); a.setAttribute("aria-current", "page"); }));

  /* ---------- Mini warehouse plan (same geometry as the app's WarehousePlan) ---------- */
  function miniPlan(racks, cols) {
    const SX = 16, SY = 8, SZ = 15, Wd = 2.2, G = 1.6, Hh = 2.4;
    const pt = (x, y, z = 0) => [(x - y) * SX, (x + y) * SY - z * SZ];
    const lines = Math.ceil(racks.length / cols), c = Math.min(cols, racks.length);
    const fw = 1.6 + c * Wd + (c - 1) * G, fd = 1.6 + lines * Wd + (lines - 1) * G;
    const cs = [pt(0, 0), pt(fw, 0), pt(fw, fd), pt(0, fd)];
    const minX = Math.min(...cs.map((p) => p[0])) - 8, maxX = Math.max(...cs.map((p) => p[0])) + 8, minY = Math.min(...cs.map((p) => p[1])) - 56, maxY = Math.max(...cs.map((p) => p[1])) + 30;
    const P = (a) => a.map((p) => p.join(",")).join(" ");
    const col = { aman: "#3F6B4E", menipis: "#B07A1E", habis: "#9E3B32" };
    const mix = (h, to, t) => { const n = parseInt(h.slice(1), 16); return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t)).join(",")})`; };
    const parts = racks.map((r, i) => ({ ...r, gx: .8 + (i % cols) * (Wd + G), gy: .8 + Math.floor(i / cols) * (Wd + G) })).sort((a, b) => a.gx + a.gy - (b.gx + b.gy)).map((r) => {
      const x0 = r.gx, y0 = r.gy, x1 = x0 + Wd, y1 = y0 + Wd, h = r.s === "habis" ? .14 : r.ratio * Hh, b = col[r.s];
      const [lx, ly] = pt(x0 + Wd / 2, y1, h + .1);
      return [`<g><polygon points="${P([pt(x0, y1, h), pt(x1, y1, h), pt(x1, y0, h), pt(x0, y0, h)])}" fill="${mix(b, 255, .38)}" stroke="#1E1B18" stroke-width=".75"/><polygon points="${P([pt(x0, y1, h), pt(x0, y1), pt(x1, y1), pt(x1, y1, h)])}" fill="${b}" stroke="#1E1B18" stroke-width=".75"/><polygon points="${P([pt(x1, y0, h), pt(x1, y0), pt(x1, y1), pt(x1, y1, h)])}" fill="${mix(b, 0, .28)}" stroke="#1E1B18" stroke-width=".75"/></g>`, `<g>
        <text x="${lx}" y="${ly + 13}" text-anchor="middle" font-size="12.5" font-weight="600" fill="#1E1B18" style="paint-order:stroke;stroke:#FBFAF6;stroke-width:3px">${r.sku}</text><text x="${lx}" y="${ly + 24}" text-anchor="middle" font-size="12" fill="#6B645A" style="paint-order:stroke;stroke:#FBFAF6;stroke-width:3px">${r.s[0].toUpperCase() + r.s.slice(1)}</text></g>`];
    });
    // Labels go in a second pass, above every rack body, so no rack hides another rack's name.
    const body = parts.map((p) => p[0]).join("") + parts.map((p) => p[1]).join("");
    return `<svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" style="width:100%;max-width:${Math.round(maxX - minX)}px;height:auto" role="img" aria-label="Denah gudang: ${racks.map((r) => `${r.sku} ${r.s}`).join(", ")}"><polygon points="${P(cs)}" fill="#EFEBE2" stroke="#6B645A" stroke-width="1"/>${body}</svg>`;
  }

  /* ---------- Mock: Dashboard ---------- */
  const dash = `<div class="page">
    <div class="page-h"><div><h1>Dasbor</h1><p class="muted small" style="margin:4px 0 0">Kamis, 19 November 2026 · semua cabang · tampilan Finance Manager</p></div></div>
    <div style="display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:28px">
      <div>
        <h2 style="font:600 13px var(--sans);margin:0 0 10px">Perlu tindakan</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 16px" data-stagger>${TASKS.map(taskCard).join("")}</div>
        <div class="sheet" style="padding:18px 20px;margin-top:22px">
          <div class="kpi" style="display:flex;flex-wrap:wrap;gap:8px 28px;align-items:end"><div><p class="small" style="margin:0;font-weight:600">Pendapatan bersih November</p><span class="fig">Rp40,5 jt</span></div><div style="padding-bottom:8px"><svg class="spark" viewBox="0 0 160 32" aria-hidden="true"><polyline fill="none" stroke="#7A2E2A" stroke-width="1.5" stroke-linejoin="round" points="2,26 32,22 62,14 92,12 122,7 156,4"/><circle cx="156" cy="4" r="2.5" fill="#7A2E2A"/></svg><span class="chg up">${glyph("naik", 16)}naik 11,5% dari Oktober</span></div></div>
          <div style="border-top:1px solid var(--line);margin-top:16px;padding-top:12px"><div class="legend"><span><svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke="#7A2E2A" stroke-width="2"/></svg>Pendapatan</span><span><svg width="22" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke="#6B645A" stroke-width="2" stroke-dasharray="5 3"/></svg>HPP</span><span class="muted">Jutaan rupiah per bulan</span></div>
          <div class="chart" id="dashChart" tabindex="0" role="img"></div><details style="font-size:13px"><summary style="color:var(--accent);cursor:pointer">Lihat sebagai tabel</summary><div id="dashChartTable"></div></details></div>
        </div>
      </div>
      <aside style="display:grid;gap:18px;align-content:start">
        <div class="sheet" style="padding:16px 18px"><h2 style="font:600 13px var(--sans);margin:0 0 8px">Angka lain</h2><dl class="facts" style="grid-template-columns:1fr auto;gap:6px 12px;font-size:13.5px"><dt>Margin kotor</dt><dd class="num">57,0%</dd><dt>Laba bersih</dt><dd class="num">Rp5,7 jt</dd><dt>Piutang berjalan</dt><dd class="num">Rp74,8 jt</dd><dt>Kas dan bank</dt><dd class="num">Rp1,8 M</dd><dt>Persediaan FIFO</dt><dd class="num">Rp207,6 jt</dd></dl></div>
        <div class="sheet" style="padding:16px 18px"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="font:600 13px var(--sans);margin:0">Denah gudang</h2><a class="act accent" href="#" style="font-size:12.5px">Level stok${glyph("kirim", 14)}</a></div>
          <p class="small" style="margin:8px 0 2px;font-weight:500">Gudang Surabaya <span class="muted" style="font-weight:400">5 rak</span></p>${miniPlan([{ sku: "RM-PCB-01", s: "aman", ratio: .9 }, { sku: "RM-BAT-01", s: "aman", ratio: .9 }, { sku: "RM-CAS-01", s: "aman", ratio: .9 }, { sku: "FG-CAB-01", s: "aman", ratio: 1 }, { sku: "FG-HUB-01", s: "aman", ratio: .5 }], 3)}
          <p class="small" style="margin:8px 0 2px;font-weight:500">Gudang Bandung <span class="muted" style="font-weight:400">1 perlu perhatian</span></p>${miniPlan([{ sku: "FG-CAB-01", s: "menipis", ratio: .17 }], 3)}</div>
        <div class="sheet" style="padding:16px 18px"><h2 style="font:600 13px var(--sans);margin:0 0 8px">Aktivitas terakhir</h2><ul style="list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:13px" data-stagger>${[["retur", "Retur penjualan dicatat", "System Admin · 19 Nov 2026"], ["faktur", "Faktur INV-2026-000019 dibuat", "System Admin · 18 Nov 2026"], ["pengiriman", "Pengiriman dikirim ke pelanggan", "Warehouse Staff · 15 Nov 2026"]].map(([g, t, s]) => `<li style="display:grid;grid-template-columns:auto 1fr;gap:0 10px"><span class="muted" style="grid-row:span 2">${glyph(g, 18)}</span><span>${t}</span><span class="muted">${s}</span></li>`).join("")}</ul></div>
      </aside>
    </div></div>`;
  mountShell($("#dashFrame"), { active: "dasbor", crumbs: ["Dasbor"], content: dash });
  const dc = $("#dashChart");
  let dcd = mountChart(dc, 6, { draw: false });
  $$(".ln", dc).forEach((l) => { l.style.opacity = 0; });
  onFirstView(dc, () => { dcd = mountChart(dc, 6, { draw: true }); });
  $("#dashChartTable").innerHTML = chartTable(dcd);

  /* ---------- Mock: Return form ---------- */
  const PRICE = 650000, LEFT = 4, OUT = 2600000, COGS_BACK = 272440.82;
  const retur = `<div class="page" style="padding-bottom:0">
    <div class="page-h"><div><h1>Retur dari SO-2026-000024</h1><p class="muted small" style="margin:4px 0 0;max-width:72ch">Toko Digital Makmur · faktur INV-2026-000019 · sisa tagihan Rp 2.600.000. Hanya pesanan yang sudah difaktur yang bisa diretur; kredit tidak boleh melebihi sisa tagihan.</p></div><span class="stamp info">Terfaktur</span></div>
    <div id="rForm" style="display:grid;gap:22px;max-width:860px">
      <section class="sheet lift" style="padding:18px 20px"><span class="stack-back b1"></span>
        <h2 style="font:600 13px var(--sans);margin:0">Item yang diretur</h2><p class="small muted" style="margin:2px 0 12px">Hanya jumlah yang belum diretur yang bisa dipilih.</p>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 80px 100px auto 130px;gap:12px;align-items:center;border-top:1px solid var(--ink);padding-top:12px">
          <div><b style="font-weight:600">FG-HUB-01</b> · Smart Hub Controller<div class="small muted">Rp 650.000 per unit</div></div>
          <div class="small muted num">Terjual <span class="tnum" style="color:var(--ink)">4</span></div>
          <div class="small muted num">Bisa diretur <span class="tnum" style="color:var(--ink)">${LEFT}</span></div>
          <div class="stepper" data-stepper data-max="${LEFT}" id="rStep"><button class="mini-key" data-d="-1" aria-label="Kurangi jumlah retur FG-HUB-01"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button><input class="input" inputmode="decimal" value="0" aria-label="Jumlah retur FG-HUB-01"><button class="mini-key" data-d="1" aria-label="Tambah jumlah retur FG-HUB-01"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>
          <div class="num tnum" id="rLine">–</div>
        </div>
      </section>
      <section class="sheet lift" style="padding:18px 20px"><span class="stack-back b1"></span>
        <h2 style="font:600 13px var(--sans);margin:0">Alasan dan tanggal</h2><p class="small muted" style="margin:2px 0 12px">Alasan tercatat di riwayat retur.</p>
        <div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:14px"><div class="fld"><label for="rD">Tanggal retur</label><input class="input" type="date" id="rD" value="2026-11-19"></div><div class="fld"><label for="rR">Alasan</label><input class="input" id="rR" placeholder="Rusak, barang salah…" maxlength="255"></div></div>
      </section>
    </div>
    <div id="rDone" hidden style="max-width:860px"></div>
    <div style="height:28px"></div>
    <div class="receipt" style="max-width:860px">
      <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:end">
        <dl><dt>Kredit ke pelanggan</dt><dd class="big" id="rCredit">Rp 0</dd><dt>Sisa tagihan setelah retur</dt><dd id="rOut">Rp 2.600.000</dd><span class="rule"></span><dt>Biaya stok kembali (FIFO)</dt><dd id="rCogs" class="muted">dihitung sistem saat dicatat</dd></dl>
        <div style="display:flex;gap:10px;align-items:center"><a href="#" class="act">Batal</a><button class="key has-cap" id="rSubmit" disabled><span class="cap">${glyph("retur", 16)}</span><span class="label">Catat retur</span><span class="bar"></span></button></div>
      </div>
    </div></div>`;
  mountShell($("#returFrame"), { active: "pesanan-penjualan", crumbs: ["Penjualan", "Pesanan penjualan", "SO-2026-000024", "Retur"], content: retur });
  let rQty = 0;
  wireStepper($("#rStep"), (v) => {
    rQty = v;
    swapText($("#rCredit"), rupiah(v * PRICE));
    swapText($("#rOut"), rupiah(OUT - v * PRICE));
    $("#rLine").textContent = v ? rupiah(v * PRICE) : "–";
    $("#rSubmit").disabled = v <= 0;
  });
  // Confirmation dialog explains the three consequences, then the key shows loading → success.
  const rd = document.createElement("dialog");
  rd.className = "dlg"; rd.setAttribute("aria-labelledby", "rdT");
  document.body.append(rd);
  rd.addEventListener("cancel", (e) => { e.preventDefault(); closeLayer(rd, DLG_OUT); });
  $("#rSubmit").onclick = (e) => {
    rd.innerHTML = `<div class="in"><h2 id="rdT">Catat retur untuk SO-2026-000024?</h2><p class="muted" style="margin:8px 0 0">Setelah dicatat, ini tidak bisa diubah:</p><ul style="margin:8px 0 0;padding-left:18px" class="lines"><li>Faktur INV-2026-000019 berkurang ${rupiah(rQty * PRICE)}.</li><li>Barang kembali ke Gudang Surabaya dengan biaya saat keluar dari gudang.</li><li>Jurnal diposting. Koreksi hanya lewat jurnal pembalik.</li></ul></div><div class="row"><button class="key sec" data-close>Kembali</button><button class="key has-cap" id="rGo"><span class="cap">${glyph("simpan", 16)}</span><span class="label">Ya, catat retur</span><span class="bar"></span></button></div>`;
    $("[data-close]", rd).onclick = () => closeLayer(rd, DLG_OUT);
    openLayer(rd, DLG_IN, e.currentTarget);
    $("#rGo").onclick = (ev) => runKey(ev.currentTarget, () => wait(1100)).then(async () => {
      await wait(500);
      closeLayer(rd, DLG_OUT);
      const sub = $("#rSubmit");
      sub.dataset.state = "success";
      const cap = $(".cap", sub); cap.innerHTML = tickSvg; requestAnimationFrame(() => { sub.dataset.state = ""; requestAnimationFrame(() => { sub.dataset.state = "success"; }); });
      sub.disabled = true;
      $("#rCogs").classList.remove("muted");
      swapText($("#rCogs"), rupiah2(COGS_BACK));
      const done = $("#rDone");
      done.innerHTML = `<div class="sheet" style="padding:18px 20px;display:grid;grid-template-columns:auto 1fr auto;gap:4px 14px;align-items:center"><span style="color:var(--good);grid-row:span 2">${glyph("berhasil", 28)}</span><b style="font-weight:600">Retur RET-2026-000004 dicatat</b><a class="key sec sm" href="#" style="grid-row:span 2">Kembali ke pesanan</a><span class="small muted">Faktur berkurang ${rupiah(rQty * PRICE)}, stok kembali dengan biaya ${rupiah2(COGS_BACK)}, jurnal diposting.</span></div>`;
      $("#rForm").hidden = true; done.hidden = false;
      anim(done, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: T.mid, easing: E.out });
      toast("good", "Retur dicatat", "RET-2026-000004 · kredit " + rupiah(rQty * PRICE));
    }).catch(() => {});
  };

  /* ---------- Staggered groups on first view, then glyph placeholders ---------- */
  $$("[data-stagger]").forEach((g) => onFirstView(g, () => stagger(g)));
  renderGlyphs();
})();
