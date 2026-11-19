import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { RoomLink } from "../components/RoomLink";
import { Status } from "../components/ui";
import { date, qty, rupiah } from "./format";

/**
 * Pembuat kolom tabel bersama untuk semua halaman daftar (merapikan duplikasi Lists dan MasterData dari v2).
 * meta.m adalah prioritas kolom di ponsel (t judul, s sekunder, d tanggal, v nilai, x tambahan, h tersembunyi).
 */
export type Row = Record<string, any>;
export type Prio = "t" | "v" | "s" | "d" | "x" | "h";
type Extra = Partial<ColumnDef<Row, any>> & { m?: Prio; right?: boolean; code?: boolean };

export function col(header: string, accessorKey: string, extra: Extra = {}): ColumnDef<Row, any> {
  const { m, right, code, ...rest } = extra;
  return { header, accessorKey, ...rest, meta: { ...((rest.meta as object) ?? {}), ...(m ? { m } : {}), ...(right ? { right: true } : {}), ...(code ? { code: true } : {}) } } as ColumnDef<Row, any>;
}
export const money = (header: string, key: string, m?: Prio, cents = false) =>
  col(header, key, { cell: (c) => rupiah(c.getValue(), cents), right: true, m, sortingFn: (a, b, id) => Number(a.getValue(id)) - Number(b.getValue(id)) });
export const quantity = (header: string, key: string, m?: Prio) =>
  col(header, key, { cell: (c) => qty(c.getValue()), right: true, m, sortingFn: (a, b, id) => Number(a.getValue(id)) - Number(b.getValue(id)) });
export const day = (header: string, key: string, m: Prio = "d") => col(header, key, { cell: (c) => date(c.getValue()), m });
export const status = (key = "status") => col("Status", key, { cell: (c) => <Status value={c.getValue()} />, m: "x" });
export const code = (header: string, key: string, m: Prio = "t") => col(header, key, { code: true, m });
/**
 * Nomor dokumen yang membuka halaman detail dengan Transisi Ruang (M4 pasangan a). `prime` mengisi cache detail dari baris
 * daftar bila bentuk datanya sama, agar kepala dokumen tujuan langsung ada untuk perubahan bentuk.
 */
export const docNo = (header: string, key: string, to: (r: Row) => string, room: (r: Row) => string, prime?: (r: Row) => void) =>
  col(header, key, { code: true, m: "t", cell: (c) => <RoomLink to={to(c.row.original)} room={room(c.row.original)} onClick={() => prime?.(c.row.original)} className="font-medium hover:underline">{c.getValue()}</RoomLink> });
export const actionCol = (render: (row: Row) => ReactNode): ColumnDef<Row, any> =>
  ({ id: "aksi", header: "", enableSorting: false, enableColumnFilter: false, cell: (c) => <div className="flex justify-end gap-1.5">{render(c.row.original)}</div>, meta: { m: "x" } }) as ColumnDef<Row, any>;
