import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { compactRupiah, date } from "../lib/format";
import { FLAT_NAV } from "../lib/nav";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";
import { play } from "../motion/animate";
import { exitMs } from "../motion/tokens";
import { Glyph, type GlyphName } from "./glyphs";
import { Status } from "./ui";

type Row = Record<string, any>;
type Kind = "Terakhir dibuka" | "Halaman" | "Dokumen" | "Aksi" | "Produk" | "Pihak";
interface Hit { key: string; kind: Kind; label: string; hint?: string; to: string; glyph: GlyphName; doc?: { kind: string; party?: string; date?: string; status?: string; total?: string } }

const SOURCES: { perm: string; path: string; paged: boolean; map: (r: Row) => Hit }[] = [
  { perm: "sales.read", path: "/sales/orders", paged: true, map: (r) => ({ key: `so${r.id}`, kind: "Dokumen", label: r.so_no, hint: r.customer_name, to: `/sales/orders/${r.id}`, glyph: "pesanan-penjualan", doc: { kind: "Pesanan penjualan", party: r.customer_name, date: r.order_date, status: r.status, total: r.total_amount } }) },
  { perm: "procurement.read", path: "/procurement/purchase-orders", paged: true, map: (r) => ({ key: `po${r.id}`, kind: "Dokumen", label: r.po_no, hint: r.supplier_name, to: `/procurement/orders/${r.id}`, glyph: "pesanan-pembelian", doc: { kind: "Pesanan pembelian", party: r.supplier_name, date: r.order_date, status: r.status, total: r.total_amount } }) },
  { perm: "accounting.read", path: "/invoices", paged: true, map: (r) => ({ key: `inv${r.id}`, kind: "Dokumen", label: r.invoice_no, hint: r.type === "AR" ? "Faktur piutang" : "Tagihan pemasok", to: `/accounting/invoices/${r.id}`, glyph: "faktur", doc: { kind: r.type === "AR" ? "Faktur piutang" : "Tagihan pemasok", date: r.invoice_date, status: r.status, total: r.total_amount } }) },
  { perm: "sales.read", path: "/sales/returns", paged: false, map: (r) => ({ key: `ret${r.id}`, kind: "Dokumen", label: r.return_no, hint: "Retur penjualan", to: `/sales/returns/${r.id}`, glyph: "retur", doc: { kind: "Retur penjualan", date: r.return_date, total: r.total_amount } }) },
  { perm: "master.read", path: "/master/products", paged: false, map: (r) => ({ key: `p${r.id}`, kind: "Produk", label: r.sku, hint: r.name, to: `/master/products?buka=${r.id}`, glyph: "produk" }) },
  { perm: "master.read", path: "/master/customers", paged: false, map: (r) => ({ key: `c${r.id}`, kind: "Pihak", label: r.name, hint: r.code, to: "/sales/customers", glyph: "pelanggan" }) },
  { perm: "master.read", path: "/master/suppliers", paged: false, map: (r) => ({ key: `s${r.id}`, kind: "Pihak", label: r.name, hint: r.code, to: "/master/suppliers", glyph: "pemasok" }) },
];

/** Aksi adalah pintasan ke halaman yang sudah ada; palet tidak pernah menjalankan mutasi. */
const ACTIONS: (Hit & { perm: string })[] = [
  { key: "a-so", kind: "Aksi", label: "Buat pesanan penjualan", to: "/sales/orders/new", glyph: "buat", perm: "sales.write" },
  { key: "a-ret", kind: "Aksi", label: "Buat retur", hint: "pilih pesanan yang sudah difaktur", to: "/sales/orders?status=INVOICED", glyph: "retur", perm: "sales.write" },
  { key: "a-po", kind: "Aksi", label: "Buat pesanan pembelian", to: "/procurement/orders/new", glyph: "buat", perm: "procurement.write" },
  { key: "a-je", kind: "Aksi", label: "Buat jurnal", to: "/accounting/journals/new", glyph: "jurnal", perm: "accounting.post" },
  { key: "a-pr", kind: "Aksi", label: "Tambah produk", to: "/master/products/new", glyph: "produk", perm: "master.write" },
  { key: "a-cu", kind: "Aksi", label: "Tambah pelanggan", to: "/sales/customers/new", glyph: "pelanggan", perm: "master.write" },
  { key: "a-us", kind: "Aksi", label: "Tambah pengguna", to: "/system/users/new", glyph: "pengguna", perm: "users.manage" },
];
const ORDER: Kind[] = ["Terakhir dibuka", "Halaman", "Dokumen", "Aksi", "Produk", "Pihak"];
const RECENT_KEY = "aether.palette.recent";

function readRecent(): Hit[] {
  try { return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as Hit[]).slice(0, 5); } catch { return []; }
}
function remember(h: Hit) {
  try {
    const list = [{ ...h, kind: "Terakhir dibuka" as Kind }, ...readRecent().filter((x) => x.to !== h.to)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* abaikan */ }
}

/**
 * Palet perintah (8): kartu indeks. Ctrl+K membuka halaman, dokumen, aksi, dan produk; "/" tanpa pencarian halaman membuka halaman saja.
 * Mencari di daftar yang sudah boleh dibaca pengguna (hingga 200 baris per jenis). Pratinjau dokumen di kanan pada desktop.
 */
export function Palette({ open, scope = "all", instant, onClose }: { open: boolean; scope?: "all" | "pages"; instant?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { can } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Hit[]>([]);
  const opener = useRef<Element | null>(null);

  const lists = useQuery({
    queryKey: ["palette"],
    enabled: open && scope === "all",
    staleTime: 60_000,
    queryFn: async () => {
      const out: Hit[] = [];
      await Promise.all(SOURCES.filter((s) => can(s.perm)).map(async (s) => {
        try {
          const r = await api<Page<Row> | Row[]>(s.path, { params: s.paged ? { page_size: 200 } : {} });
          (Array.isArray(r) ? r : r.items).forEach((row) => out.push(s.map(row)));
        } catch { /* daftar yang tidak boleh dibaca tidak tampil */ }
      }));
      return out;
    },
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
      setQ("");
      setActive(0);
      setRecent(readRecent());
      requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && d.open) {
      const done = () => { d.close(); (opener.current as HTMLElement | null)?.focus?.(); };
      const a = play(d, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.98)" }], { duration: exitMs("dur-base"), easing: "in", reduced: [{ opacity: 1 }, { opacity: 0 }] });
      if (a) a.onfinish = done; else done();
    }
  }, [open]);

  const results = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Hit[] = FLAT_NAV.filter((i) => can(i.perm)).map((i) => ({ key: i.to, kind: "Halaman", label: i.label, to: i.to, glyph: i.glyph }));
    const actions = scope === "all" ? ACTIONS.filter((a) => can(a.perm)) : [];
    const match = (h: Hit) => `${h.label} ${h.hint ?? ""}`.toLowerCase().includes(term);
    const pool = term
      ? [...pages, ...actions, ...(scope === "all" ? lists.data ?? [] : [])].filter(match)
      : [...(scope === "all" ? recent : []), ...pages.slice(0, 6), ...actions.slice(0, 4)];
    return ORDER.flatMap((k) => pool.filter((h) => h.kind === k)).slice(0, 16);
  }, [q, lists.data, can, scope, recent]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => { document.getElementById(`pal-${results[active]?.key}`)?.scrollIntoView({ block: "nearest" }); }, [active, results]);

  function go(h: Hit | undefined) {
    if (!h) return;
    if (h.kind !== "Halaman" && h.kind !== "Aksi") remember(h);
    onClose();
    nav(h.to);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  }
  const cur = results[active];

  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={scope === "pages" ? "Pindah halaman" : "Pencarian dan perintah"}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={clsx("index-card m-0 mx-auto mt-[12vh] w-[min(820px,calc(100vw-2rem))]", instant && "instant")}>
      <div className="flex items-center gap-2.5 border-b border-line bg-paper px-4 py-2.5">
        <Glyph name="cari" size={20} className="text-muted" />
        <input ref={input} className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted" name="palette"
          placeholder={scope === "pages" ? "Cari halaman" : "Cari halaman, dokumen, aksi, produk"} autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={cur ? `pal-${cur.key}` : undefined}
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        <button type="button" className="rounded-sm border border-b-2 border-line bg-paper px-1.5 font-sans text-[11px] text-ink md:pointer-events-none" onClick={onClose}>Esc</button>
      </div>
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_260px]">
        <ul id="palette-list" role="listbox" className="max-h-[54vh] overflow-auto p-1.5 max-sm:max-h-[calc(100dvh-104px)]">
          {results.map((h, i) => (
            <li key={`${h.kind}-${h.key}`} role="presentation">
              {(i === 0 || results[i - 1]!.kind !== h.kind) && <div role="presentation" className="px-2.5 pb-1 pt-2.5 text-xs font-semibold text-muted">{h.kind}</div>}
              <div id={`pal-${h.key}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                className={clsx("flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5", i === active && "bg-highlight shadow-[inset_2px_0_0_rgb(var(--accent))]")}>
                <Glyph name={h.glyph} size={18} className="text-muted" />
                <span className={clsx("min-w-0 truncate", (h.doc || h.kind === "Produk") && "code font-medium")}>{h.label}</span>
                {h.hint && <span className="ml-auto shrink-0 truncate pl-3 text-table text-muted">{h.hint}</span>}
              </div>
            </li>
          ))}
          {results.length === 0 && <li className="px-4 py-6 text-center text-muted">{lists.isLoading ? "Memuat daftar…" : "Tidak ada yang cocok. Coba nomor dokumen, nama, atau SKU."}</li>}
        </ul>
        <aside aria-label="Pratinjau" className="hidden border-l border-line bg-paper/70 p-4 md:block">
          {cur?.doc ? (
            <div className="grid gap-2 text-table">
              <p className="text-muted">{cur.doc.kind}</p>
              <p className="code text-md font-medium">{cur.label}</p>
              {cur.doc.status && <div><Status value={cur.doc.status} /></div>}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {cur.doc.party && <><dt className="text-muted">Pihak</dt><dd>{cur.doc.party}</dd></>}
                {cur.doc.date && <><dt className="text-muted">Tanggal</dt><dd>{date(cur.doc.date)}</dd></>}
                {cur.doc.total && <><dt className="text-muted">Total</dt><dd className="font-num">{compactRupiah(cur.doc.total)}</dd></>}
              </dl>
            </div>
          ) : <p className="text-table text-muted">{cur ? `${cur.kind}: ${cur.label}` : "Pilih hasil untuk melihat pratinjau dokumen."}</p>}
        </aside>
      </div>
      <p className="border-t border-line bg-paper px-4 py-2 text-xs text-muted">Panah untuk memilih, Enter untuk membuka, Esc untuk menutup. Dokumen dicari dari 200 baris terbaru per jenis.</p>
    </dialog>
  );
}
