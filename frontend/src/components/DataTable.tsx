import {
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { setPrefs, usePrefs } from "../lib/preferences";
import { play } from "../motion/animate";
import { exitMs } from "../motion/tokens";
import { Glyph } from "./glyphs";
import { EmptyState, Skeleton, statusText, type Art } from "./ui";
import "../styles/tables.css";
import "../styles/controls.css";

type Meta = { right?: boolean; code?: boolean; m?: "t" | "v" | "s" | "d" | "x" | "h" };
const metaOf = (c: { columnDef: { meta?: unknown } }): Meta => (c.columnDef.meta ?? {}) as Meta;

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  /** Empty state: one sentence and, optionally, one action. */
  empty?: string;
  emptyAction?: ReactNode;
  emptyArt?: Art;
  pageSize?: number;
  label: string;
  /** When set, a row opens (click, Enter) and the callback receives it; `selectedId` highlights the open row. */
  onOpen?: (row: T) => void;
  selectedId?: (row: T) => boolean;
  /** Extra toolbar content, left of the density toggle. */
  toolbar?: ReactNode;
  /** Row checkboxes with a bulk bar. The only bulk action is exporting the chosen rows, which the list already offers for all rows. */
  selectable?: boolean;
  /** Filters to start with, e.g. from the URL; shown as removable chips. */
  initialFilters?: ColumnFiltersState;
  /** Baris total di kaki tabel (garis ganda). */
  foot?: ReactNode;
}

/** Column filter: "contains", or an exact match when the value starts with "=" (used by links that open a list on one status). */
const includes = (row: Row<any>, id: string, value: string) => {
  const v = String(value);
  if (v.startsWith("=")) return String(row.getValue(id) ?? "") === v.slice(1);
  return String(row.getValue(id) ?? "").toLowerCase().includes(v.toLowerCase());
};

function Check({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <label className="cb min-h-0" onClick={(e) => e.stopPropagation()}>
      <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path pathLength={1} d="M5 12.5 9.5 17 19 7.5" /></svg>
    </label>
  );
}

export function DataTable<T>({ data, columns, loading, empty = "Belum ada data.", emptyAction, emptyArt, pageSize = 15, label, onOpen, selectedId, toolbar, selectable, initialFilters, foot }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>(initialFilters ?? []);
  const [global, setGlobal] = useState("");
  const [adding, setAdding] = useState(false);
  const [newCol, setNewCol] = useState("");
  const [newVal, setNewVal] = useState("");
  const { density } = usePrefs();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const searchId = useId();
  /** Kepadatan adalah preferensi tampilan per perangkat (juga di Akun saya). */
  const setDensity = (d: "comfortable" | "compact") => setPrefs({ density: d });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters: filters, globalFilter: global },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    onGlobalFilterChange: setGlobal,
    globalFilterFn: (row, _id, value) => row.getAllCells().some((c) => String(c.getValue() ?? "").toLowerCase().includes(String(value).toLowerCase())),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    defaultColumn: { filterFn: includes },
    initialState: { pagination: { pageSize } },
  });
  const rows = table.getRowModel().rows;
  const all = table.getPrePaginationRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: size } = table.getState().pagination;
  const filterable = table.getAllLeafColumns().filter((c) => c.accessorFn && c.getCanFilter() && c.columnDef.enableColumnFilter !== false && typeof c.columnDef.header === "string");

  // Keep only selections that still exist after data or filters change.
  const live = all.filter((r) => picked.has(r.id));
  const pageIds = rows.map((r) => r.id);
  const pagePicked = pageIds.filter((id) => picked.has(id)).length;

  // The header gets its shadow only once it sticks under the top bar.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!!e && !e.isIntersecting && e.boundingClientRect.top < 60), { rootMargin: "-52px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, total > 0]);

  /** Exports filtered and sorted rows (all of them, or the chosen ones) using raw accessor values. */
  function exportCsv(only?: Row<T>[]) {
    const cols = table.getAllLeafColumns().filter((c) => c.accessorFn && typeof c.columnDef.header === "string");
    const esc = (v: unknown) => {
      let s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map((c) => esc(c.columnDef.header)).join(",")];
    for (const r of only ?? all) lines.push(cols.map((c) => esc(r.getValue(c.id))).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.toLowerCase().replace(/\W+/g, "-")}${only ? "-terpilih" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function applyFilter() {
    if (!newCol || !newVal.trim()) return;
    setFilters((f) => [...f.filter((x) => x.id !== newCol), { id: newCol, value: newVal.trim() }]);
    setAdding(false);
    setNewCol("");
    setNewVal("");
  }
  /** Chips leave with a short scale and fade before the filter goes. */
  function removeChip(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    const chip = e.currentTarget.closest(".chip") as HTMLElement | null;
    const go = () => setFilters((x) => x.filter((y) => y.id !== id));
    const a = play(chip, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.92)" }], { duration: exitMs("dur-fast"), easing: "in", reduced: [{ opacity: 1 }, { opacity: 0 }] });
    if (a) a.onfinish = go; else go();
  }
  const shown = (id: string, v: unknown) => { const t = String(v).replace(/^=/, ""); return id === "status" ? statusText(t) : t; };
  const headerOf = (id: string) => String(table.getColumn(id)?.columnDef.header ?? id);
  const filtering = filters.length > 0 || global !== "";
  const toggle = (id: string, on: boolean) => setPicked((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor={searchId} className="sr-only">Cari di {label}</label>
        <span className="relative w-full max-w-[280px] max-md:max-w-none">
          <Glyph name="cari" size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input id={searchId} data-page-search="" className="field pl-8" name="search" type="search" placeholder="Cari di daftar ini (/)" autoComplete="off" spellCheck={false} value={global} onChange={(e) => setGlobal(e.target.value)} />
        </span>
        {filters.map((f) => (
          <span key={f.id} className="chip pop-in">
            {headerOf(f.id)}: {shown(f.id, f.value)}
            <button type="button" aria-label={`Hapus filter ${headerOf(f.id)}`} onClick={(e) => removeChip(e, f.id)}><Glyph name="tutup" size={14} /></button>
          </span>
        ))}
        {filterable.length > 0 && !adding && <button type="button" className="btn btn-text btn-sm" onClick={() => { setAdding(true); setNewCol(filterable[0]!.id); }}><Glyph name="filter" size={16} />Tambah filter</button>}
        {adding && (
          <form className="pop-in flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); applyFilter(); }}>
            <select className="field w-auto" name="filter-column" aria-label="Kolom filter" value={newCol} onChange={(e) => setNewCol(e.target.value)}>
              {filterable.map((c) => <option key={c.id} value={c.id}>{String(c.columnDef.header)}</option>)}
            </select>
            <input className="field w-40" name="filter-value" aria-label="Nilai filter" placeholder="mengandung…" autoComplete="off" autoFocus value={newVal} onChange={(e) => setNewVal(e.target.value)} />
            <button type="submit" className="btn btn-sm" disabled={!newVal.trim()}>Terapkan</button>
            <button type="button" className="btn btn-text btn-sm" onClick={() => setAdding(false)}>Batal</button>
          </form>
        )}
        {toolbar}
        <div className="ml-auto flex items-center gap-3">
          <button type="button" className="btn btn-text btn-sm" onClick={() => exportCsv()} disabled={loading || total === 0}><Glyph name="ekspor" size={16} />Ekspor CSV</button>
          <div role="group" aria-label="Kepadatan baris" className="seg hidden md:inline-flex">
            {(["comfortable", "compact"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={density === d} onClick={() => setDensity(d)}>{d === "compact" ? "Rapat" : "Nyaman"}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState art={filtering ? "map" : emptyArt} action={!filtering ? emptyAction : <button type="button" className="btn btn-sm" onClick={() => { setFilters([]); setGlobal(""); }}>Hapus semua filter</button>}>
          {filtering ? "Tidak ada baris yang cocok. Hapus filter atau ubah kata kunci." : empty}
        </EmptyState>
      ) : (
        <>
          <div ref={sentinel} aria-hidden="true" />
          <p className="swipe-hint md:hidden"><Glyph name="kirim" size={16} />Geser ke kanan untuk kolom lain</p>
          <div className="tbl-sheet">
            <table className={clsx("tbl", stuck && "is-stuck")} aria-label={label}>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {selectable && <th scope="col" className="ck"><Check label="Pilih semua di halaman ini" checked={pagePicked > 0 && pagePicked === pageIds.length} indeterminate={pagePicked > 0 && pagePicked < pageIds.length} onChange={(v) => setPicked((p) => { const n = new Set(p); pageIds.forEach((id) => (v ? n.add(id) : n.delete(id))); return n; })} /></th>}
                    {hg.headers.map((h) => {
                      const dir = h.column.getIsSorted();
                      const right = metaOf(h.column).right;
                      return (
                        <th key={h.id} scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} className={right ? "text-right" : "text-left"}>
                          {h.column.getCanSort() ? (
                            <button type="button" className={`-my-3 inline-flex min-h-11 items-center gap-1 hover:text-ink md:-my-1.5 md:min-h-8 ${right ? "flex-row-reverse" : ""}`} onClick={h.column.getToggleSortingHandler()}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              <Glyph name={dir === "asc" ? "naik" : dir === "desc" ? "turun" : "urutkan"} size={13} className={dir ? "" : "opacity-50"} />
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = onOpen ? () => onOpen(r.original) : undefined;
                  const on = picked.has(r.id);
                  return (
                    <tr key={r.id} data-open={open ? "" : undefined} tabIndex={open ? 0 : undefined} aria-selected={selectedId?.(r.original) || on || undefined}
                      onClick={(e) => { if (open && !(e.target as HTMLElement).closest("a,button,input,select,label")) open(); }}
                      onKeyDown={(e) => { if (open && e.key === "Enter" && e.target === e.currentTarget) { e.preventDefault(); open(); } }}>
                      {selectable && <td className="ck"><Check label={`Pilih baris ${String(r.getVisibleCells()[0]?.getValue() ?? r.id)}`} checked={on} onChange={(v) => toggle(r.id, v)} /></td>}
                      {r.getVisibleCells().map((c) => (
                        <td key={c.id} className={clsx(metaOf(c.column).right && "num", metaOf(c.column).code && "code")}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              {foot && <tfoot>{foot}</tfoot>}
            </table>
            {selectable && (
              <div className={clsx("bulk", live.length > 0 && "on")} aria-hidden={live.length === 0}>
                <span role="status" className="whitespace-nowrap font-medium">{live.length} dipilih</span>
                <button type="button" className="btn btn-text btn-sm text-surface" tabIndex={live.length ? 0 : -1} onClick={() => exportCsv(live)}><Glyph name="ekspor" size={16} />Ekspor CSV terpilih</button>
                <button type="button" className="btn btn-text btn-sm ml-auto text-surface" tabIndex={live.length ? 0 : -1} onClick={() => setPicked(new Set())}><Glyph name="tutup" size={16} />Batalkan pilihan</button>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-table text-muted">
          <span>Menampilkan {pageIndex * size + 1}–{Math.min((pageIndex + 1) * size, total)} dari {total}</span>
          <span className="flex items-center gap-2">
            <button type="button" className="btn btn-text btn-sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Sebelumnya</button>
            Halaman {pageIndex + 1} dari {Math.max(table.getPageCount(), 1)}
            <button type="button" className="btn btn-text btn-sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Berikutnya</button>
          </span>
        </div>
      )}
    </div>
  );
}
