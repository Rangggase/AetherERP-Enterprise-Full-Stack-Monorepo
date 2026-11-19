import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { FLAT_NAV } from "../lib/nav";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";
import { Glyph, type GlyphName } from "./glyphs";

type Row = Record<string, any>;
type Kind = "Halaman" | "Aksi" | "Dokumen" | "Data master";
interface Hit { key: string; kind: Kind; label: string; hint?: string; to: string; glyph: GlyphName }

const SOURCES: { perm: string; path: string; paged: boolean; map: (r: Row) => Hit }[] = [
  { perm: "sales.read", path: "/sales/orders", paged: true, map: (r) => ({ key: `so${r.id}`, kind: "Dokumen", label: r.so_no, hint: r.customer_name, to: `/sales/orders/${r.id}`, glyph: "pesanan-penjualan" }) },
  { perm: "procurement.read", path: "/procurement/purchase-orders", paged: true, map: (r) => ({ key: `po${r.id}`, kind: "Dokumen", label: r.po_no, hint: r.supplier_name, to: `/procurement/orders/${r.id}`, glyph: "pesanan-pembelian" }) },
  { perm: "accounting.read", path: "/invoices", paged: true, map: (r) => ({ key: `inv${r.id}`, kind: "Dokumen", label: r.invoice_no, hint: r.type === "AR" ? "Faktur piutang" : "Tagihan pemasok", to: `/accounting/invoices/${r.id}`, glyph: "faktur" }) },
  { perm: "master.read", path: "/master/products", paged: false, map: (r) => ({ key: `p${r.id}`, kind: "Data master", label: r.sku, hint: r.name, to: "/master/products", glyph: "produk" }) },
  { perm: "master.read", path: "/master/customers", paged: false, map: (r) => ({ key: `c${r.id}`, kind: "Data master", label: r.name, hint: r.code, to: "/sales/customers", glyph: "pelanggan" }) },
  { perm: "master.read", path: "/master/suppliers", paged: false, map: (r) => ({ key: `s${r.id}`, kind: "Data master", label: r.name, hint: r.code, to: "/master/suppliers", glyph: "pemasok" }) },
];

/** Actions are shortcuts to pages that already exist; nothing here runs a mutation. */
const ACTIONS: (Hit & { perm: string })[] = [
  { key: "a-so", kind: "Aksi", label: "Buat pesanan penjualan", to: "/sales/orders/new", glyph: "buat", perm: "sales.write" },
  { key: "a-ret", kind: "Aksi", label: "Buat retur", hint: "pilih pesanan yang sudah difaktur", to: "/sales/orders?status=INVOICED", glyph: "retur", perm: "sales.write" },
  { key: "a-po", kind: "Aksi", label: "Buat pesanan pembelian", to: "/procurement/orders/new", glyph: "buat", perm: "procurement.write" },
  { key: "a-je", kind: "Aksi", label: "Buat jurnal", to: "/accounting/journals/new", glyph: "jurnal", perm: "accounting.post" },
  { key: "a-pr", kind: "Aksi", label: "Tambah produk", to: "/master/products/new", glyph: "produk", perm: "master.write" },
  { key: "a-cu", kind: "Aksi", label: "Tambah pelanggan", to: "/sales/customers/new", glyph: "pelanggan", perm: "master.write" },
  { key: "a-us", kind: "Aksi", label: "Tambah pengguna", to: "/system/users/new", glyph: "pengguna", perm: "users.manage" },
];
const ORDER: Kind[] = ["Halaman", "Aksi", "Dokumen", "Data master"];
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Command palette (C12). Ctrl+K: pages, actions and documents. "/": pages only. Searches lists already available to the user (up to 200 rows each). */
/** `instant`: opened from the keyboard (Ctrl+K, "/"), so it appears without an entrance; keyboard actions never wait on motion. */
export function Palette({ open, scope = "all", instant, onClose }: { open: boolean; scope?: "all" | "pages"; instant?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { can } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const opener = useRef<Element | null>(null);

  const lists = useQuery({
    queryKey: ["palette"],
    enabled: open && scope === "all",
    staleTime: 60_000,
    queryFn: async () => {
      const out: Hit[] = [];
      await Promise.all(
        SOURCES.filter((s) => can(s.perm)).map(async (s) => {
          try {
            const r = await api<Page<Row> | Row[]>(s.path, { params: s.paged ? { page_size: 200 } : {} });
            (Array.isArray(r) ? r : r.items).forEach((row) => out.push(s.map(row)));
          } catch {
            /* a list the user cannot read is simply absent */
          }
        }),
      );
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
      requestAnimationFrame(() => input.current?.focus());
    }
    if (!open && d.open) {
      const done = () => { d.close(); (opener.current as HTMLElement | null)?.focus?.(); };
      const a = d.animate?.(reduced() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.98)" }], { duration: 120, easing: "cubic-bezier(0.4, 0, 1, 1)" });
      if (a) a.onfinish = done; else done();
    }
  }, [open]);

  const results = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Hit[] = FLAT_NAV.filter((i) => can(i.perm)).map((i) => ({ key: i.to, kind: "Halaman", label: i.label, to: i.to, glyph: i.glyph }));
    const actions = scope === "all" ? ACTIONS.filter((a) => can(a.perm)) : [];
    const match = (h: Hit) => `${h.label} ${h.hint ?? ""}`.toLowerCase().includes(term);
    const pool = term ? [...pages, ...actions, ...(scope === "all" ? lists.data ?? [] : [])].filter(match) : [...pages.slice(0, 8), ...actions.slice(0, 4)];
    // Group in a fixed order, at most 14 rows.
    return ORDER.flatMap((k) => pool.filter((h) => h.kind === k)).slice(0, 14);
  }, [q, lists.data, can, scope]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => { document.getElementById(`pal-${results[active]?.key}`)?.scrollIntoView({ block: "nearest" }); }, [active, results]);

  function go(h: Hit | undefined) {
    if (!h) return;
    onClose();
    nav(h.to);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  }

  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={scope === "pages" ? "Pindah halaman" : "Pencarian dan perintah"}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`${instant ? "" : "dlg-in "}m-0 mx-auto mt-[12vh] w-[min(600px,calc(100vw-2rem))] rounded border border-line bg-surface p-0 shadow-elev-3`}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5">
        <Glyph name="cari" size={20} className="text-muted" />
        <input
          ref={input}
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          name="palette"
          placeholder={scope === "pages" ? "Cari halaman" : "Cari halaman, dokumen, aksi"}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `pal-${results[active]!.key}` : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <kbd className="rounded-sm border border-b-2 border-line bg-surface px-1.5 font-sans text-[11px] text-ink">Esc</kbd>
      </div>
      <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-auto p-1.5">
        {results.map((h, i) => (
          <li key={h.key} role="presentation">
            {(i === 0 || results[i - 1]!.kind !== h.kind) && <div role="presentation" className="px-2.5 pb-1 pt-2.5 text-xs font-semibold text-muted">{h.kind}</div>}
            <div id={`pal-${h.key}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(h)}
              className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 ${i === active ? "bg-highlight shadow-[inset_2px_0_0_rgb(var(--accent))]" : ""}`}>
              <Glyph name={h.glyph} size={18} className="text-muted" />
              <span className={`min-w-0 truncate ${h.kind === "Dokumen" ? "font-medium font-num" : ""}`}>{h.label}</span>
              {h.hint && <span className="ml-auto shrink-0 truncate pl-3 text-table text-muted">{h.hint}</span>}
            </div>
          </li>
        ))}
        {results.length === 0 && <li className="px-4 py-6 text-center text-muted">{lists.isLoading ? "Memuat daftar…" : "Tidak ada yang cocok. Coba nomor dokumen, nama, atau SKU."}</li>}
      </ul>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Panah untuk memilih, Enter untuk membuka, Esc untuk menutup. Pencarian dokumen mencakup hingga 200 baris terbaru per jenis.</p>
    </dialog>
  );
}
