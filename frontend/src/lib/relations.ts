import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "./session";
import type { Page } from "./types";

type Row = Record<string, any>;

/**
 * Relasi antar-dokumen hanya dari id yang dikembalikan API (keputusan D1, 20 Nov 2026):
 * - retur → so_id, invoice_id, journal_entry_id
 * - penerimaan barang → po_id
 * - faktur → daftar pembayaran (bagian dari detail faktur)
 * Tidak ada relasi dari nomor dokumen, tanggal, jumlah, atau teks keterangan jurnal.
 */
export function useReturns(enabled = true) {
  const { can } = useSession();
  return useQuery({ queryKey: ["returns"], enabled: enabled && can("sales.read"), queryFn: () => api<Row[]>("/sales/returns") });
}

export function useReceipts(poId: number | undefined) {
  const { can } = useSession();
  return useQuery({ queryKey: ["grn", { po_id: poId }], enabled: !!poId && can("procurement.read"), queryFn: () => api<Row[]>("/procurement/goods-receipts", { params: { po_id: poId } }) });
}

/** Indeks faktur per id (200 terbaru), untuk menampilkan nomor faktur yang id-nya dikembalikan retur. */
export function useInvoiceIndex(enabled = true) {
  const { can } = useSession();
  return useQuery({
    queryKey: ["invoices", { index: true }],
    enabled: enabled && can("accounting.read"),
    staleTime: 60_000,
    queryFn: async () => new Map((await api<Page<Row>>("/invoices", { params: { page_size: 200 } })).items.map((i) => [i.id as number, i])),
  });
}

export function useSalesOrder(id: number | undefined) {
  const { can } = useSession();
  return useQuery({ queryKey: ["so", String(id)], enabled: !!id && can("sales.read"), queryFn: () => api<Row>(`/sales/orders/${id}`) });
}
