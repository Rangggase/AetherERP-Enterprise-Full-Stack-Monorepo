/** Indonesian display labels for audit actions and entity types. Unknown values fall back to the raw text. */
const ACTION: Record<string, string> = {
  CREATE: "dibuat", UPDATE: "diubah", POST: "diposting", REVERSE: "dibalik", SUBMIT: "diajukan", APPROVE: "disetujui",
  RECEIVE: "diterima", BILL: "ditagih", DISPATCH: "dikirim", COMPLETE: "diselesaikan", CONFIRM: "dikonfirmasi",
  CANCEL: "dibatalkan", DELIVER: "dikirim ke pelanggan", INVOICE: "difakturkan", PAYMENT: "dibayar", RETURN: "dicatat",
  PERIOD_CLOSED: "ditutup", PERIOD_OPENED: "dibuka kembali", YEAR_CLOSED: "ditutup", PASSWORD_RESET: "direset kata sandinya",
  PASSWORD_CHANGED: "diganti kata sandinya", PASSWORD_CHANGE_FAILED: "gagal ganti kata sandi", LOGIN: "masuk", LOGIN_FAILED: "gagal masuk",
};
const ENTITY: Record<string, string> = {
  purchase_order: "Pesanan pembelian", goods_receipt: "Penerimaan barang", invoice: "Faktur", payment: "Pembayaran",
  sales_order: "Pesanan penjualan", delivery_order: "Pengiriman", work_order: "Perintah perakitan", stock_transfer: "Transfer stok",
  stock_count: "Stock opname", journal_entry: "Jurnal", sales_return: "Retur penjualan", product: "Produk", customer: "Pelanggan",
  supplier: "Pemasok", user: "Pengguna", bom: "BOM", fiscal_period: "Periode fiskal", fiscal_year: "Tahun fiskal",
};

export const actionLabel = (a: string): string => ACTION[a] ?? a.toLowerCase().replace(/_/g, " ");
export const entityLabel = (e: string): string => ENTITY[e] ?? e.replace(/_/g, " ");
/** "Pesanan penjualan dibuat" */
export const activityPhrase = (action: string, entity: string): string => `${entityLabel(entity)} ${actionLabel(action)}`;
