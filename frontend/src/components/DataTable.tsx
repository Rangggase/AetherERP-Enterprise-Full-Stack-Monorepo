import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Download, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  empty?: string;
  pageSize?: number;
  label: string;
}

const includes = (row: any, id: string, value: string) =>
  String(row.getValue(id) ?? "").toLowerCase().includes(String(value).toLowerCase());

export function DataTable<T>({ data, columns, loading, empty = "Nothing here yet.", pageSize = 15, label }: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters: filters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    defaultColumn: { filterFn: includes },
    initialState: { pagination: { pageSize } },
  });
  const rows = table.getRowModel().rows;
  const { pageIndex } = table.getState().pagination;

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

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm" aria-label={label}>
          <thead className="bg-sunken">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  const right = (h.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                      className={`whitespace-nowrap border-b border-line px-3 py-2 font-medium text-muted ${right ? "text-right" : "text-left"}`}
                    >
                      {h.column.getCanSort() ? (
                        <button className={`inline-flex items-center gap-1 hover:text-ink ${right ? "flex-row-reverse" : ""}`} onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === "asc" ? <ArrowUp size={13} aria-hidden /> : dir === "desc" ? <ArrowDown size={13} aria-hidden /> : <ChevronsUpDown size={13} aria-hidden className="opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
            <tr>
              {table.getHeaderGroups()[0]?.headers.map((h) => (
                <th key={h.id} className="border-b border-line px-2 py-1.5 font-normal">
                  {h.column.getCanFilter() && h.column.columnDef.enableColumnFilter !== false ? (
                    <input
                      className="field h-7 text-xs"
                      placeholder="Filter"
                      aria-label={`Filter ${String(h.column.columnDef.header)}`}
                      value={(h.column.getFilterValue() as string) ?? ""}
                      onChange={(e) => h.column.setFilterValue(e.target.value)}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="border-b border-line px-3 py-3">
                      <div className="h-4 animate-pulse rounded bg-sunken" />
                    </td>
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-sunken/70">
                    {r.getVisibleCells().map((c) => {
                      const right = (c.column.columnDef.meta as { right?: boolean } | undefined)?.right;
                      return (
                        <td key={c.id} className={`border-b border-line px-3 py-2 ${right ? "text-right tabular-nums" : ""}`}>
                          {flexRender(c.column.columnDef.cell, c.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                  {filters.length ? "No rows match these filters. Clear a filter to see more." : empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-muted">
        <span className="flex items-center gap-3">
          {table.getFilteredRowModel().rows.length} rows
          <button className="btn h-7 px-2 text-xs" onClick={exportCsv} disabled={loading || rows.length === 0}>
            <Download size={13} aria-hidden /> Export CSV
          </button>
        </span>
        <div className="flex items-center gap-2">
          <button className="btn h-7 px-2" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            <ChevronLeft size={14} aria-hidden />
          </button>
          <span>
            Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <button className="btn h-7 px-2" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
