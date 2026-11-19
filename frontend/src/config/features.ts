/**
 * Saklar fitur per momen khas (brief 7, 15). Mematikan saklar menyembunyikan momen tanpa menghapus kodenya;
 * halaman memakai versi statis atau tabelnya. Status dan alasan ada di docs/progress-ui-v3.md (peta data).
 */
export const FEATURES = {
  /** M1 Jejak Tinta: jalan terbatas (relasi jurnal hanya lewat id). */
  inkThreads: true,
  /** M2 Upacara Posting. */
  postingCeremony: true,
  /** M3 Angka Mekanis. */
  mechanicalNumber: true,
  /** M4 Transisi Ruang. */
  roomTransition: true,
  /** M5 Rantai Dokumen: jalan terbatas (hanya relasi id dari API). */
  docChain: true,
  /** M6 Lapisan FIFO: ditunda, API tidak mengekspos lapisan (stock_batches). */
  fifoStack: false,
  /** M7 Akun T. */
  tAccount: true,
  /** M8 Gudang Hidup. */
  warehouseIso: true,
  /** M9 Peta Aliran Barang: ditunda, tidak ada endpoint laporan aliran. */
  goodsFlow: false,
  /** M10 Tutup Buku. */
  closeBook: true,
  /** M11 Membuka Buku. */
  openBook: true,
  /** O1 Gudang 3D: tidak dikerjakan (lihat keputusan Gerbang 4). */
  warehouse3d: false,
  /** O2 Cahaya Meja: tersedia di Akun saya, bawaan mati. */
  deskLight: true,
  /** O3 Suara dan getar: tersedia di Akun saya, bawaan mati. */
  sound: true,
} as const;

export type Feature = keyof typeof FEATURES;
export const feature = (f: Feature): boolean => FEATURES[f];
