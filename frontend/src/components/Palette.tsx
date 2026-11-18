import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { FLAT_NAV } from "../lib/nav";
import { useSession } from "../lib/session";
import type { Page } from "../lib/types";

type Row = Record<string, any>;
interface Hit { key: string; kind: string; label: string; hint?: string; to: string }

const SOURCES: { kind: string; perm: string; path: string; paged: boolean; map: (r: Row) => Hit }[] = [
  { kind: "Pesanan penjualan", perm: "sales.read", path: "/sales/orders", paged: true, map: (r) => ({ key: `so${r.id}`, kind: "Pesanan penjualan", label: r.so_no, hint: r.customer_name, to: `/sales/orders/${r.id}` }) },
  { kind: "Pesanan pembelian", perm: "procurement.read", path: "/procurement/purchase-orders", paged: true, map: (r) => ({ key: `po${r.id}`, kind: "Pesanan pembelian", label: r.po_no, hint: r.supplier_name, to: `/procurement/orders/${r.id}` }) },
  { kind: "Faktur", perm: "accounting.read", path: "/invoices", paged: true, map: (r) => ({ key: `inv${r.id}`, kind: "Faktur", label: r.invoice_no, hint: r.type === "AR" ? "Piutang" : "Utang", to: `/accounting/invoices/${r.id}` }) },
  { kind: "Produk", perm: "master.read", path: "/master/products", paged: false, map: (r) => ({ key: `p${r.id}`, kind: "Produk", label: r.sku, hint: r.name, to: "/master/products" }) },
  { kind: "Pelanggan", perm: "master.read", path: "/master/customers", paged: false, map: (r) => ({ key: `c${r.id}`, kind: "Pelanggan", label: r.name, hint: r.code, to: "/sales/customers" }) },
  { kind: "Pemasok", perm: "master.read", path: "/master/suppliers", paged: false, map: (r) => ({ key: `s${r.id}`, kind: "Pemasok", label: r.name, hint: r.code, to: "/master/suppliers" }) },
];

/** Command palette (Ctrl+K, "/"): pages plus a search over the lists already available to the user (up to 200 rows each). */
export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { can } = useSession();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const opener = useRef<Element | null>(null);

  const lists = useQuery({
    queryKey: ["palette"],
    enabled: open,
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
      d.close();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  const results = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Hit[] = FLAT_NAV.filter((i) => can(i.perm)).map((i) => ({ key: i.to, kind: "Halaman", label: i.label, to: i.to }));
    if (!term) return pages.slice(0, 10);
    const match = (h: Hit) => `${h.label} ${h.hint ?? ""}`.toLowerCase().includes(term);
    return [...pages.filter(match), ...(lists.data ?? []).filter(match)].slice(0, 12);
  }, [q, lists.data, can]);

  useEffect(() => setActive(0), [q]);

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
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-label="Pencarian dan perintah" className="m-0 mx-auto mt-[12vh] w-[min(560px,calc(100vw-2rem))] rounded border border-ink bg-surface p-0">
      <div className="border-b border-line p-3">
        <input
          ref={input}
          className="field"
          name="palette"
          placeholder="Cari halaman, pesanan, faktur, produk, pelanggan"
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
      </div>
      <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-auto py-1">
        {results.map((h, i) => (
          <li key={h.key} id={`pal-${h.key}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(h)}
            className={`flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2 ${i === active ? "bg-brand/10 shadow-[inset_2px_0_0_rgb(var(--accent))]" : ""}`}>
            <span className="min-w-0 truncate"><span className="font-medium">{h.label}</span>{h.hint && <span className="ml-2 text-muted">{h.hint}</span>}</span>
            <span className="shrink-0 text-xs text-muted">{h.kind}</span>
          </li>
        ))}
        {results.length === 0 && <li className="px-4 py-6 text-center text-muted">{lists.isLoading ? "Memuat daftar…" : "Tidak ada yang cocok. Coba nomor dokumen, nama, atau SKU."}</li>}
      </ul>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Panah untuk memilih, Enter untuk membuka, Esc untuk menutup. Pencarian mencakup hingga 200 baris terbaru per jenis.</p>
    </dialog>
  );
}
