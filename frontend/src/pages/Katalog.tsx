import { useEffect, useState, type ReactNode } from "react";
import { DocChain, type ChainStep } from "../components/signature/DocChain";
import { InkThreads, type InkJournal } from "../components/signature/InkThreads";
import { MechanicalNumber } from "../components/signature/MechanicalNumber";
import { TAccount, type GLData } from "../components/signature/TAccount";
import { WarehouseIso, type StockRow } from "../components/signature/WarehouseIso";
import { ActionBar, Field, Impact, MoneyInput } from "../components/Form";
import { GLYPHS, Glyph, type GlyphName } from "../components/glyphs";
import { Key } from "../components/Key";
import { ConfirmDialog, Drawer } from "../components/Layers";
import { Stepper } from "../components/Stepper";
import { FolderTabs } from "../components/Tabs";
import { receipt, toast } from "../components/Toaster";
import { Tip } from "../components/Tooltip";
import { TrendChart } from "../components/TrendChart";
import { Cap, EmptyState, Illustration, Pencil, Skeleton, Status, type Art } from "../components/ui";
import { contrast, tokenRgb } from "../design/contrast";
import { FEATURES } from "../config/features";
import { rupiah } from "../lib/format";
import { setPrefs, usePrefs, type MotionPref } from "../lib/preferences";
import { play } from "../motion/animate";
import "./Periods.css";
import "../styles/tables.css";
import "../styles/controls.css";

/**
 * Rute Katalog (brief 15), hanya saat pengembangan: semua token, glyph, komponen dalam semua keadaan, dan setiap momen
 * khas dengan data contoh berlabel "contoh" serta tombol "Putar ulang". Rute ini tidak ada di build produksi.
 */
const COLORS = ["canvas", "paper", "ink", "ink-muted", "rule", "rule-strong", "accent", "accent-deep", "highlight", "ok", "warn", "warn-ink", "bad", "info", "pencil", "age-1", "age-2", "age-3", "age-4", "age-5"];
const DURS = ["dur-press", "dur-fast", "dur-base", "dur-slow", "dur-draw", "dur-fade", "dur-roll", "dur-thread", "dur-level", "dur-print", "dur-room", "dur-open-book", "dur-t-draw", "receipt-life"];
const Z = ["z-base", "z-sticky", "z-rail", "z-topbar", "z-drawer", "z-dialog", "z-palette", "z-receipt"];
const ARTS: Art[] = ["rak-kosong", "map-kosong", "struk-kosong", "buku-tertutup", "kaca-pembesar", "kertas-sobek", "gembok"];

const SAMPLE_JOURNAL: InkJournal = {
  entry_no: "JE-CONTOH-0001", entry_date: "2026-11-20", description: "Contoh: retur 2 unit barang (data contoh, bukan dari API)", source_type: "SALES_RETURN",
  lines: [
    { account_code: "4150", account_name: "Retur Penjualan", debit: "1525000.00", credit: "0.00", memo: null },
    { account_code: "1200", account_name: "Piutang Usaha", debit: "0.00", credit: "1525000.00", memo: null },
    { account_code: "1300", account_name: "Persediaan Barang Dagang", debit: "629961.54", credit: "0.00", memo: null },
    { account_code: "5100", account_name: "Harga Pokok Penjualan", debit: "0.00", credit: "629961.54", memo: null },
  ],
};
const UNBALANCED: InkJournal = { ...SAMPLE_JOURNAL, entry_no: "JE-CONTOH-0002", lines: SAMPLE_JOURNAL.lines.slice(0, 3) };
const SAMPLE_GL: GLData = {
  account: { code: "1200", name: "Piutang Usaha", normal_balance: "DEBIT" }, opening_balance: "42000000.00", closing_balance: "53475000.00",
  lines: [
    { date: "2026-11-15", entry_no: "JE-C-01", description: "Contoh faktur", memo: null, debit: "21450000.00", credit: "0.00", balance: "63450000.00" },
    { date: "2026-11-20", entry_no: "JE-C-02", description: "Contoh pembayaran", memo: null, debit: "0.00", credit: "7000000.00", balance: "56450000.00" },
    { date: "2026-11-20", entry_no: "JE-C-03", description: "Contoh retur", memo: null, debit: "0.00", credit: "2975000.00", balance: "53475000.00" },
  ],
};
const SAMPLE_STOCK: StockRow[] = [
  { branch_id: 1, product_id: 1, sku: "CTH-PCB", name: "Contoh komponen", on_hand: 300, reserved: 0, available: 300, reorder_point: 100, is_low: false },
  { branch_id: 1, product_id: 2, sku: "CTH-BAT", name: "Contoh baterai", on_hand: 120, reserved: 20, available: 100, reorder_point: 100, is_low: true },
  { branch_id: 1, product_id: 3, sku: "CTH-HUB", name: "Contoh barang jadi", on_hand: 40, reserved: 0, available: 40, reorder_point: 30, is_low: false },
  { branch_id: 1, product_id: 4, sku: "CTH-KBL", name: "Contoh kabel", on_hand: 0, reserved: 0, available: 0, reorder_point: 200, is_low: true },
  { branch_id: 1, product_id: 5, sku: "CTH-JSA", name: "Contoh tanpa titik pesan", on_hand: 15, reserved: 0, available: 15, reorder_point: 0, is_low: false },
];
const CATS: Record<number, string> = { 1: "Komponen", 2: "Komponen", 3: "Barang jadi", 4: "Aksesori", 5: "Aksesori" };
const SAMPLE_CHAIN: ChainStep[] = [
  { key: "so", label: "Pesanan", glyph: "pesanan-penjualan", state: "done", docs: [{ id: 1, number: "SO-CONTOH-01", date: "2026-11-12", status: "PARTIALLY_PAID", to: "#" }] },
  { key: "do", label: "Pengiriman", glyph: "pengiriman", state: "unlinked", docs: [] },
  { key: "inv", label: "Faktur", glyph: "faktur", state: "current", docs: [{ id: 2, number: "INV-CONTOH-01", date: "2026-11-15", status: "PARTIALLY_PAID" }] },
  { key: "ret", label: "Retur", glyph: "retur", state: "done", docs: [{ id: 3, number: "RET-CONTOH-01", date: "2026-11-20", to: "#" }, { id: 4, number: "RET-CONTOH-02", date: "2026-11-20", to: "#" }] },
  { key: "pay", label: "Pembayaran", glyph: "simpan", state: "missing", docs: [], action: { label: "Catat pembayaran", to: "#" } },
];

function Section({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: string }) {
  return (
    <section id={id} className="mb-12 scroll-mt-6">
      <h2 className="mb-1 font-serif text-h2 font-medium">{title}</h2>
      {note && <p className="mb-4 max-w-prose text-table text-muted">{note}</p>}
      {children}
    </section>
  );
}
function Moment({ id, title, children, replay = true, status }: { id: string; title: string; children: (k: number) => ReactNode; replay?: boolean; status: string }) {
  const [k, setK] = useState(0);
  return (
    <section id={id} className="sheet mb-8 scroll-mt-6 px-5 py-5 md:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-medium">{title} <span className="ml-2 align-middle text-xs font-sans font-semibold uppercase tracking-[0.06em] text-warn-ink">contoh</span></h3>
        <span className="flex items-center gap-3"><span className="text-xs text-muted">{status}</span>{replay && <button type="button" className="btn btn-sm" onClick={() => setK((x) => x + 1)}><Glyph name="putar-ulang" size={16} />Putar ulang</button>}</span>
      </div>
      <div key={k}>{children(k)}</div>
    </section>
  );
}

export default function Katalog() {
  const prefs = usePrefs();
  const [n, setN] = useState(1250000);
  const [capValue, setCapValue] = useState("INVOICED");
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  const [qtyV, setQty] = useState("2");
  const [money, setMoney] = useState("1525000");
  const [closed, setClosed] = useState(false);
  const [fonts, setFonts] = useState<string>("…");
  useEffect(() => {
    void document.fonts.ready.then(() => setFonts(["IBM Plex Sans", "Source Serif 4", "IBM Plex Mono"].map((f) => `${f}: ${document.fonts.check(`16px "${f}"`) ? "termuat" : "belum"}`).join(" · ")));
  }, []);
  const paper = tokenRgb("paper");

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-10">
      <header className="mb-10 border-b border-ink pb-4">
        <p className="text-table text-muted">Rute pengembangan · tidak ada di build produksi</p>
        <h1 className="font-serif text-xl font-medium">Katalog Buku Besar Hidup</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-table">
          <label className="flex items-center gap-2">Gerak
            <select className="field w-44" value={prefs.motion} onChange={(e) => setPrefs({ motion: e.target.value as MotionPref })}>
              <option value="auto">Ikuti sistem</option><option value="full">Penuh</option><option value="reduced">Dikurangi</option><option value="minimal">Minimal</option>
            </select>
          </label>
          <button type="button" className="btn btn-sm" onClick={() => setPrefs({ texture: !prefs.texture })}>Tekstur: {prefs.texture ? "nyala" : "mati"}</button>
          <span className="text-muted">{fonts}</span>
        </div>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-table">{["token", "glyph", "komponen", "m1", "m2", "m3", "m5", "m7", "m8", "m10", "tunda"].map((a) => <a key={a} href={`#${a}`} className="text-brand hover:underline">{a.toUpperCase()}</a>)}</nav>
      </header>

      <Section id="token" title="Token" note="Nilai dibaca langsung dari design/tokens.css. Rasio kontras dihitung terhadap --paper.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {COLORS.map((c) => (
            <li key={c} className="sheet overflow-hidden text-table">
              <span className="block h-12 border-b border-line" style={{ background: `rgb(var(--${c}))` }} />
              <span className="block px-2 py-1.5"><span className="code">--{c}</span><span className="block text-xs text-muted">{contrast(tokenRgb(c), paper).toFixed(2)}:1 di paper</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="grid gap-3">{["elev-1", "elev-2", "elev-3", "inset"].map((e) => <div key={e} className="rounded-panel bg-paper px-3 py-4 text-table" style={{ boxShadow: `var(--${e})` }}><span className="code">--{e}</span></div>)}</div>
          <table className="tbl dense"><tbody>{DURS.map((d) => <tr key={d}><td className="code">--{d}</td><td className="num">{getComputedStyle(document.documentElement).getPropertyValue(`--${d}`)}</td></tr>)}</tbody></table>
          <div>
            <table className="tbl dense"><tbody>{Z.map((d) => <tr key={d}><td className="code">--{d}</td><td className="num">{getComputedStyle(document.documentElement).getPropertyValue(`--${d}`)}</td></tr>)}</tbody></table>
            <div className="mt-4 grid gap-1">
              <p className="font-serif text-display">Rp39,5 jt</p><p className="font-serif text-xl">Judul halaman 30</p><p className="font-serif text-h2">Subjudul 24</p><p className="text-lg">Teks 18</p>
              <p className="text-md">Teks 15</p><p className="text-sm">Teks UI 14</p><p className="text-table">Tabel 13</p><p className="text-xs">Keterangan 12</p><p className="code">RET-2026-000001 · 4150 · FG-HUB-01</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="glyph" title="Glyph" note="Grid 24, garis 1,5 px, ujung membulat.">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {(Object.keys(GLYPHS) as GlyphName[]).map((g) => <li key={g} className="sheet grid justify-items-center gap-1 px-2 py-3 text-center text-xs"><Glyph name={g} size={24} /><span className="code">{g}</span></li>)}
        </ul>
      </Section>

      <Section id="komponen" title="Komponen">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="sheet grid gap-3 px-5 py-5">
            <p className="text-table font-semibold">Tombol (tuts mesin kasir)</p>
            <div className="flex flex-wrap gap-2"><Key tone="primary" glyph="simpan">Simpan retur</Key><Key glyph="cetak">Cetak faktur</Key><Key tone="danger" glyph="tutup">Batalkan pesanan</Key><Key tone="text">Kembali</Key></div>
            <div className="flex flex-wrap gap-2"><Key size="sm" tone="primary">Kecil</Key><Key disabled>Nonaktif</Key><Key pending tone="primary" glyph="simpan">Memuat</Key><Key m={{ status: "error", submittedAt: 1 }} glyph="simpan">Galat</Key></div>
            <p className="mt-2 text-table font-semibold">Isian</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Biasa"><input className="field" defaultValue="Toko Digital Makmur" /></Field>
              <Field label="Galat" error="Jumlah melebihi sisa yang bisa diretur. Kurangi jumlahnya."><input className="field field-error" defaultValue="99" /></Field>
              <Field label="Nonaktif"><input className="field" disabled defaultValue="Terkunci" /></Field>
              <Field label="Pilihan"><select className="field"><option>Gudang Surabaya</option></select></Field>
              <Field label="Uang"><MoneyInput value={money} onChange={setMoney} label="Uang" /></Field>
              <Field label="Kode"><input className="field code" defaultValue="FG-HUB-01" /></Field>
              <Field label="Kuantitas (stepper)"><Stepper label="kuantitas contoh" value={qtyV} onChange={setQty} max={10} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="cb"><input type="checkbox" defaultChecked /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path pathLength={1} d="M5 12.5 9.5 17 19 7.5" /></svg>Centang</label>
              <label className="rd"><input type="radio" name="r" defaultChecked />Radio</label>
              <button type="button" role="switch" aria-checked="true" className="sw"><span className="rail"><span className="knob" /></span>Sakelar</button>
              <span className="chip">Status: Lunas<button type="button" aria-label="Hapus"><Glyph name="tutup" size={14} /></button></span>
              <button type="button" className="chip-toggle" aria-pressed="true">Terfaktur 4</button>
            </div>
          </div>
          <div className="sheet grid content-start gap-3 px-5 py-5">
            <p className="text-table font-semibold">Status, cap, tooltip</p>
            <div className="flex flex-wrap gap-2">{["QUOTATION", "PENDING_APPROVAL", "APPROVED", "INVOICED", "PARTIALLY_PAID", "PAID", "CANCELLED", "CLOSED"].map((s) => <Status key={s} value={s} />)}</div>
            <div className="flex flex-wrap items-center gap-4 py-2">
              <Cap value={capValue} seed="SO-CONTOH-01" /><Cap value="PAID" seed="INV-CONTOH-77" /><Cap value="CLOSED" seed="2026-06" label="Ditutup" glyph="gembok" /><Cap small value="PAID" seed="x" label="Periode Nov 2026 · Terbuka" />
              <button type="button" className="btn btn-sm" onClick={() => setCapValue((v) => (v === "INVOICED" ? "PAID" : "INVOICED"))}>Ganti status (cap mendarat)</button>
            </div>
            <p className="text-table">Tooltip: <Tip label="Slip kertas kecil: muncul setelah 400 ms atau saat fokus."><button type="button" className="btn btn-sm">Arahkan ke sini</button></Tip></p>
            <p className="mt-2 text-table font-semibold">Lapisan</p>
            <div className="flex flex-wrap gap-2"><button type="button" className="btn" onClick={() => setDrawer(true)}>Buka laci</button><button type="button" className="btn btn-danger" onClick={() => setDialog(true)}>Buka dialog berbahaya</button>
              <button type="button" className="btn" onClick={() => toast("Contoh pemberitahuan singkat.")}>Struk singkat</button><button type="button" className="btn" onClick={() => toast("Contoh galat: data tidak tersimpan.", "error")}>Galat</button></div>
            <p className="mt-2 text-table font-semibold">Tab map berkas</p>
            <FolderTabs className="" tabs={[{ key: "a", label: "Item", glyph: "produk" }, { key: "b", label: "Jurnal", glyph: "tinta", count: 4 }, { key: "c", label: "Riwayat", glyph: "audit" }]} active={tab} onChange={setTab} label="Contoh tab">
              <p className="text-table text-muted">Isi tab {tab.toUpperCase()}.</p>
            </FolderTabs>
          </div>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div><p className="mb-2 text-table font-semibold">Kerangka garis pensil</p><Skeleton rows={3} /><div className="sheet mt-3 grid gap-2 p-4"><Pencil i={0} /><Pencil i={1} /><Pencil i={2} /></div></div>
          <div>
            <p className="mb-2 text-table font-semibold">Tabel lembar buku besar</p>
            <div className="tbl-sheet ledger-paper"><table className="tbl ledger"><thead><tr><th>Kode</th><th>Akun</th><th className="text-right">Saldo</th></tr></thead>
              <tbody><tr data-open=""><td className="code">1100</td><td>Kas dan Bank</td><td className="num">{rupiah(1842151860)}</td></tr><tr data-open="" aria-selected="true"><td className="code">1200</td><td>Piutang Usaha</td><td className="num">{rupiah(64210000)}</td></tr>
                <tr className="sub"><td colSpan={2}>Subtotal</td><td className="num">{rupiah(1906361860)}</td></tr><tr className="total"><td colSpan={2}>Total</td><td className="num font-semibold">{rupiah(1906361860)}</td></tr></tbody></table></div>
          </div>
        </div>
        <p className="mb-2 mt-8 text-table font-semibold">Keadaan kosong, galat, tanpa izin, 404</p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{ARTS.map((a) => <li key={a} className="sheet grid justify-items-center gap-1 px-2 py-3 text-xs"><Illustration art={a} className="h-[96px] w-auto" /><span className="code">{a}</span></li>)}</ul>
        <div className="mt-4"><EmptyState art="struk-kosong" action={<button type="button" className="btn btn-sm">Buat retur</button>}>Belum ada retur. Catat retur dari pesanan yang sudah difaktur.</EmptyState></div>
        <div className="mt-6"><p className="mb-2 text-table font-semibold">Grafik tinta</p><div className="sheet px-5 py-4"><TrendChart data={[{ month: "Jun", a: 17.2, b: 6.1 }, { month: "Jul", a: 22.5, b: 8.4 }, { month: "Agu", a: 27.4, b: 10.6 }, { month: "Sep", a: 31.9, b: 12.3 }, { month: "Okt", a: 36.3, b: 14.8 }, { month: "Nov", a: 39.5, b: 16.2 }]} aLabel="Pendapatan" bLabel="HPP" label="Contoh grafik" /></div></div>
      </Section>

      <h2 className="mb-6 font-serif text-h2 font-medium">Momen khas</h2>
      <Moment id="m1" title="M1 Jejak Tinta" status={FEATURES.inkThreads ? "jalan terbatas" : "mati"}>{() => <><InkThreads journal={SAMPLE_JOURNAL} /><div className="mt-8 border-t border-line pt-6"><p className="mb-2 text-table font-semibold">Tidak seimbang (contoh galat)</p><InkThreads journal={UNBALANCED} /></div></>}</Moment>
      <Moment id="m2" title="M2 Upacara Posting" status="jalan" replay={false}>{() => (
        <div className="flex flex-wrap items-center gap-4">
          <Key tone="primary" glyph="retur" onClick={() => { setCapValue("PAID"); receipt({ title: "Retur dicatat (contoh)", number: "RET-CONTOH-01", lines: [{ label: "Kredit ke pelanggan", value: rupiah(1525000, true) }, { label: "Biaya kembali ke stok", value: rupiah(629961.54, true) }], stock: [{ sku: "FG-HUB-01", change: "+2" }, { sku: "FG-CAB-01", change: "+5" }], note: "Data contoh, bukan dari API." }); }}>Simpan retur contoh</Key>
          <Cap value={capValue} seed="SO-CONTOH-01" />
          <p className="max-w-sm text-table text-muted">Struk keluar dari kanan atas, cap di halaman mendarat. "Lihat jejak tinta" hanya muncul untuk struk yang membawa id jurnal dari API.</p>
        </div>
      )}</Moment>
      <Moment id="m3" title="M3 Angka Mekanis" status="jalan" replay={false}>{() => (
        <div className="flex flex-wrap items-end gap-6">
          <p className="font-serif text-display font-medium"><MechanicalNumber value={n} format={(v) => rupiah(v)} srLabel="Contoh" /></p>
          <div className="flex gap-2"><button type="button" className="btn btn-sm" onClick={() => setN((v) => v + 275000)}>Tambah</button><button type="button" className="btn btn-sm" onClick={() => setN((v) => Math.max(0, v - 1175000))}>Kurangi</button><button type="button" className="btn btn-sm" onClick={() => { for (let i = 1; i <= 5; i++) window.setTimeout(() => setN((v) => v + 9000 * i), i * 40); }}>Ubah cepat 5×</button></div>
          <div className="w-full"><ActionBar summary={<><Impact label="Kredit ke pelanggan (contoh)" value={n} /><Impact small label="Biaya stok kembali" value="dihitung sistem saat dicatat" /></>}><span /></ActionBar></div>
        </div>
      )}</Moment>
      <Moment id="m5" title="M5 Rantai Dokumen" status="jalan terbatas (hanya relasi id)">{() => <DocChain steps={SAMPLE_CHAIN} />}</Moment>
      <Moment id="m7" title="M7 Akun T" status="jalan">{() => <TAccount gl={SAMPLE_GL} />}</Moment>
      <Moment id="m8" title="M8 Gudang Hidup" status="jalan" replay={false}>{() => <div className="max-w-2xl"><WarehouseIso rows={SAMPLE_STOCK} categoryOf={(id) => CATS[id] ?? "Lain"} title="Gudang contoh" onOpen={(r) => toast(`Laci produk ${r.sku} (contoh)`)} /></div>}</Moment>
      <Moment id="m10" title="M10 Tutup Buku" status="jalan" replay={false}>{() => (
        <div className="flex flex-wrap items-end gap-6">
          <div className="books w-[140px]"><div className="book" data-state={closed ? "closed" : "open"} id="buku-contoh">
            <div className="book-pages" /><div className="book-cover"><div><p className="month">November</p><p className="text-xs text-muted">2026</p></div>
              {closed ? <Cap small value="CLOSED" seed="contoh" label="Ditutup" glyph="gembok" land /> : <p className="text-xs font-medium text-good">Terbuka</p>}</div></div></div>
          <button type="button" className="btn btn-danger" onClick={() => { if (!closed) play(document.querySelector("#buku-contoh .book-cover"), [{ transform: "rotateY(-28deg)" }, { transform: "rotateY(0deg)" }], { duration: "dur-draw", easing: "inout", reduced: null }); setClosed((c) => !c); }}>{closed ? "Buka lagi (contoh)" : "Tutup buku (contoh)"}</button>
        </div>
      )}</Moment>
      <Section id="tunda" title="Ditunda dan bergantung rute" note="M4 Transisi Ruang dan M11 Membuka Buku butuh navigasi aplikasi; lihat di aplikasi. M6 Lapisan FIFO dan M9 Peta Aliran Barang ditunda karena API belum menyediakan datanya (peta data Fase 0).">
        <ul className="grid gap-2 text-table">
          <li><span className="font-medium">M4 Transisi Ruang</span> · {FEATURES.roomTransition ? "jalan" : "mati"} · nomor dokumen di daftar, kartu "Perlu tindakan", laci "Buka lengkap", lembar mini rantai, dan Kembali.</li>
          <li><span className="font-medium">M6 Lapisan FIFO</span> · {FEATURES.fifoStack ? "jalan" : "ditunda"} · API tidak mengekspos sisa per lapisan (stock_batches).</li>
          <li><span className="font-medium">M9 Peta Aliran Barang</span> · {FEATURES.goodsFlow ? "jalan" : "ditunda"} · tidak ada endpoint laporan aliran per tahap.</li>
          <li><span className="font-medium">M11 Membuka Buku</span> · {FEATURES.openBook ? "jalan" : "mati"} · setelah masuk, sekali per sesi browser.</li>
        </ul>
      </Section>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title={<span className="code">SO-CONTOH-01</span>} subtitle="Laci contoh" chain={<DocChain steps={SAMPLE_CHAIN} mini />}>
        <p className="text-table text-muted">Latar inert, Escape menutup, fokus kembali ke pemicu. Di ponsel menjadi lembar bawah.</p>
      </Drawer>
      <ConfirmDialog open={dialog} onClose={() => setDialog(false)} onConfirm={() => setDialog(false)} danger title="Tutup buku November 2026?" confirmLabel="Ya, tutup buku" impact={[["Jurnal di periode ini", "24"], ["Laba bersih periode", rupiah(5945061.54, true)]]}>
        <p>Dialog berbahaya menjelaskan akibat dengan angka (contoh).</p>
      </ConfirmDialog>
    </div>
  );
}
