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
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { EmptyState, Skeleton } from "./ui";

type Meta = { right?: boolean; m?: "t" | "v" | "s" | "d" | "x" | "h" };
const metaOf = (c: { columnDef: { meta?: unknown } }): Meta => (c.columnDef.meta ?? {}) as Meta;

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  /** Empty state: one sentence and, optionally, one action. */
  empty?: string;
  emptyAction?: ReactNode;
  pageSize?: number;
  label: string;
  /** When set, a row opens (click, Enter) and the callback receives it; `selectedId` highlights the open row. */
  onOpen?: (row: T) => void;
  selectedId?: (row: T) => boolean;
  /** Extra toolbar content, left of the density toggle. */
  toolbar?: ReactNode;
}

const includes = (row: Row<any>, id: string, value: string) => String(row.getValue(id) ?? "").toLowerCase().includes(String(value).toLowerCase());
const readDensity = (): "comfortable" | "dense" => {
  try { return localStorage.getItem("aether.density") === "dense" ? "dense" : "comfortable"; } catch { return "comfortable"; }
};

export function DataTable<T>({ data, columns, loading, empty = "Belum ada data.", emptyAction, pageSize = 15, label, onOpen, selectedId, toolbar }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [global, setGlobal] = useState("");
  const [adding, setAdding] = useState(false);
  const [newCol, setNewCol] = useState("");
  const [newVal, setNewVal] = useState("");
  const [density, setDensityState] = useState(readDensity);
  const searchId = useId();

  const setDensity = (d: "comfortable" | "dense") => {
    setDensityState(d);
    try { localStorage.setItem("aether.density", d); } catch { /* ignore */ }
  };

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
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: size } = table.getState().pagination;
  const filterable = table.getAllLeafColumns().filter((c) => c.accessorFn && c.getCanFilter() && c.columnDef.enableColumnFilter !== false && typeof c.columnDef.header === "string");
  const firstCol = rows[0]?.getVisibleCells()[0]?.column.id;

  /** Exports every filtered and sorted row (not just the current page) using raw accessor values. */
  function exportCsv() {
    const cols = table.getAllLeafColumns().filter((c) => c.accessorFn && typeof c.columnDef.header === "string");
    const esc = (v: unknown) => {
      let s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map((c) => esc(c.columnDef.header)).join(",")];
    for (const r of table.getPrePaginationRowModel().rows) lines.push(cols.map((c) => esc(r.getValue(c.id))).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.toLowerCase().replace(/\W+/g, "-")}.csv`;
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
  const headerOf = (id: string) => String(table.getColumn(id)?.columnDef.header ?? id);
  const filtering = filters.length > 0 || global !== "";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label htmlFor={searchId} className="sr-only">Cari di {label}</label>
        <input id={searchId} className="field max-w-[260px]" name="search" type="search" placeholder="Cari di daftar ini" autoComplete="off" spellCheck={false} value={global} onChange={(e) => setGlobal(e.target.value)} />
        {filters.map((f) => (
          <span key={f.id} className="chip">
            {headerOf(f.id)}: {String(f.value)}
            <button aria-label={`Hapus filter ${headerOf(f.id)}`} onClick={() => setFilters((x) => x.filter((y) => y.id !== f.id))}>×</button>
          </span>
        ))}
        {filterable.length > 0 && !adding && <button className="btn btn-text btn-sm" onClick={() => { setAdding(true); setNewCol(filterable[0]!.id); }}>Tambah filter</button>}
        {adding && (
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); applyFilter(); }}>
            <select className="field w-auto" name="filter-column" aria-label="Kolom filter" value={newCol} onChange={(e) => setNewCol(e.target.value)}>
              {filterable.map((c) => <option key={c.id} value={c.id}>{String(c.columnDef.header)}</option>)}
            </select>
            <input className="field w-40" name="filter-value" aria-label="Nilai filter" placeholder="mengandung…" autoComplete="off" autoFocus value={newVal} onChange={(e) => setNewVal(e.target.value)} />
            <button className="btn btn-sm" disabled={!newVal.trim()}>Terapkan</button>
            <button type="button" className="btn btn-text btn-sm" onClick={() => setAdding(false)}>Batal</button>
          </form>
        )}
        {toolbar}
        <div className="ml-auto flex items-center gap-3">
          <button className="btn btn-text btn-sm" onClick={exportCsv} disabled={loading || total === 0}>Ekspor CSV</button>
          <div role="group" aria-label="Kepadatan baris" className="hidden overflow-hidden rounded border border-control md:inline-flex">
            {(["comfortable", "dense"] as const).map((d) => (
              <button key={d} aria-pressed={density === d} onClick={() => setDensity(d)} className={`px-2.5 py-0.5 text-table ${density === d ? "bg-ink text-canvas" : "hover:bg-ink/5"}`}>{d === "dense" ? "Rapat" : "Nyaman"}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyState action={!filtering ? emptyAction : <button className="btn btn-sm" onClick={() => { setFilters([]); setGlobal(""); }}>Hapus semua filter</button>}>
          {filtering ? "Tidak ada baris yang cocok. Hapus filter atau ubah kata kunci." : empty}
        </EmptyState>
      ) : (
        <div>
          <table className={`tbl stack ${density === "dense" ? "dense" : ""}`} aria-label={label}>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const dir = h.column.getIsSorted();
                    const right = metaOf(h.column).right;
                    return (
                      <th key={h.id} scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} className={right ? "text-right" : "text-left"}>
                        {h.column.getCanSort() ? (
                          <button className={`inline-flex items-center gap-1 hover:text-ink ${right ? "flex-row-reverse" : ""}`} onClick={h.column.getToggleSortingHandler()}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? <ArrowUp size={12} aria-hidden /> : dir === "desc" ? <ArrowDown size={12} aria-hidden /> : <ChevronsUpDown size={12} aria-hidden className="opacity-50" />}
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
                return (
                  <tr key={r.id} data-open={open ? "" : undefined} tabIndex={open ? 0 : undefined} aria-selected={selectedId?.(r.original) || undefined}
                    onClick={(e) => { if (open && !(e.target as HTMLElement).closest("a,button,input,select")) open(); }}
                    onKeyDown={(e) => { if (open && e.key === "Enter" && e.target === e.currentTarget) { e.preventDefault(); open(); } }}>
                    {r.getVisibleCells().map((c) => {
                      const meta = metaOf(c.column);
                      const m = meta.m ?? (c.column.id === firstCol ? "t" : "x");
                      return (
                        <td key={c.id} data-m={m} data-l={typeof c.column.columnDef.header === "string" ? c.column.columnDef.header : undefined} className={meta.right ? "num" : ""}>
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 py-3 text-table text-muted">
          <span>Menampilkan {pageIndex * size + 1}–{Math.min((pageIndex + 1) * size, total)} dari {total}</span>
          <span className="flex items-center gap-2">
            <button className="btn btn-text btn-sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Sebelumnya</button>
            Halaman {pageIndex + 1} dari {Math.max(table.getPageCount(), 1)}
            <button className="btn btn-text btn-sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Berikutnya</button>
          </span>
        </div>
      )}
    </div>
  );
}
