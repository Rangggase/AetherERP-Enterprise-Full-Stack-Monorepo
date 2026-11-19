# Kemajuan: bahasa visual "meja kerja akuntan"

Cabang: `tactile-ui` (dibuat dari `ui-polish`, termasuk perubahan ui-polish yang belum di-commit). Belum ada commit.

| Tahap | Status |
|---|---|
| G1 Inventaris dan screenshot `pre-tactile-*` | Selesai (42 file, 1440 dan 390 px) |
| G2 Lemari contoh `docs/prototypes/tactile-kit.html` dan rekaman | Selesai, disetujui |
| G3 `docs/design-system.md` bagian B, C, D | Selesai (v3; v2 disimpan sebagai `design-system-v2.md`) |
| G4 Tahap 1: token, glyph, tombol, input, sidebar, bilah atas | Selesai, disetujui (screenshot `tactile-s1-*`) |
| G5 Tahap 2: tabel, laci, dialog, toast, skeleton, keadaan, tab, lencana, cap | Selesai, disetujui (screenshot `tactile-s2-*`) |
| G6 Tahap 3: halaman, palet, grafik, KPI, denah, cetak | Selesai, verifikasi H selesai; **menunggu persetujuan commit** (screenshot `tactile-*`, rekaman `tactile-app-*`) |

## Tahap 1: yang berubah

- `index.css`: token B1/B2 (`--elev-*`, `--inset`, `--stack-*`, durasi, easing), tuts (`.btn`, `.btn-primary`, `.btn-danger`, `.btn-text`, `.btn-sm`, `.cap`, status memuat/berhasil/gagal), bidang cekung (`.field`), `.stepper`/`.mini-key`, `.cb`/`.rd`/`.sw`, `.menu`, `.avatar`, `.stamp-sm`. Reduced motion kini hanya mematikan gerak posisi; warna dan opacity tetap.
- `tailwind.config.js`: warna `highlight`, `accent-deep`, `key-edge`; bayangan `elev-*`, `inset`; durasi dan easing B2.
- `components/glyphs/` (`paths.ts` dibangkitkan dari `docs/prototypes/glyphs.js`, `Glyph`, `Tick`).
- `components/Key.tsx` (`Key`, `KeyLink`): status mengikuti mutasi TanStack Query (`m={mutation}`) atau `pending`.
- `components/Menu.tsx`, `components/Stepper.tsx` (stepper dipakai di tahap 3).
- `components/Shell.tsx`: sidebar lebar/rel + penanda halaman + hitungan tertunda, bilah atas (chip cabang, cap periode, cari, avatar), bilah tab bawah + lembar "Lainnya" di mobile.
- `lib/nav.ts`: glyph dan label pendek per rute, `mobileTabs()`.
- `components/Form.tsx`: galat dengan glyph; bilah aksi mobile di atas bilah tab.
- 20 tombol utama diganti `Key`/`KeyLink` dengan glyph (Admin, Details, Forms, Lists, Login, MasterData, Returns, Layers). Label "Buka dokumen" di laci menjadi "Buka lengkap".

Ukuran build tahap 1: CSS 39.672 B (+42,0%), JS 807.626 B (+2,1%), gabungan +3,5%. CSS terpisah melewati batas 25% (lihat keputusan di laporan).

## Tahap 2: yang berubah

- `components/DataTable.tsx`: tabel di atas lembar buku besar; bayangan header hanya saat menempel; checkbox per baris + bilah massal (satu-satunya aksi: ekspor CSV baris terpilih); chip filter masuk/keluar; glyph urut, cari, filter, ekspor; kepadatan dalam kontrol tersegmen cekung. Di bawah 768 px: geser ke samping, kolom pertama menempel, petunjuk geser, bilah massal melayang di atas bilah tab. Baris bertumpuk (`.tbl.stack`) dihapus.
- `components/Layers.tsx`: laci level 3 (220 ms, tombol tutup glyph), dialog konfirmasi level 3 (skala 0,98 → 1, glyph peringatan untuk aksi berbahaya), keduanya dengan animasi keluar sebelum ditutup.
- `components/Toaster.tsx`: slip struk dari kanan atas, tepi bergerigi, 4 detik (berhenti saat disorot/fokus), tombol tutup, `aria-live`.
- `components/Tabs.tsx` (`FolderTabs`): tab map berkas, panah/Home/End, panel bergeser 8 px. Dipakai di detail pesanan penjualan dan pembelian.
- `components/ui.tsx`: `Status` jadi lencana glyph + kata; `Stamp` (cap tinta, dicapkan hanya saat status berubah di sesi) dan `InkFilter`; `Illustration` (rak, map, struk, kertas sobek, gembok, grafik); `EmptyState`, `ErrorNote`, `Skeleton`, `DetailSkeleton` baru. `lucide-react` tidak lagi diimpor di mana pun.
- `components/NoAccess.tsx`: gembok + izin yang dibutuhkan.
- `pages/Details.tsx`: cap status di kop dokumen; tab map berkas. `pages/Lists.tsx`, `MasterData.tsx`, `Returns.tsx`: daftar bisa dipilih banyak; ilustrasi kosong sesuai konteks.

Ukuran build tahap 2: CSS 45.882 B (+64,3%; gzip 9.918 B), JS 810.115 B (+2,5%), gabungan +4,6%.

## Tahap 3: yang berubah

- `components/TrendChart.tsx`: grafik SVG sendiri menggantikan Recharts (garis tergambar sekali per sesi, garis bidik + slip, panah kiri/kanan, legenda, "Lihat sebagai tabel"); `Sparkline`.
- `pages/Dashboard.tsx`: kartu tugas bertumpuk yang membuka daftar terfilter (`?status=`), KPI besar + sparkline + "naik/turun x% dari <bulan>", grafik, denah gudang mini, skeleton berbentuk kartu (CLS 0,124 → 0,001).
- `components/Palette.tsx`: grup Halaman/Aksi/Dokumen/Data master dengan glyph; Ctrl+K semua, "/" halaman saja; dibuka dari keyboard tanpa animasi masuk.
- `pages/Login.tsx`: dua kolom, formulir di atas lembar, ilustrasi buku besar + rak dengan paralaks ≤ 6 px (mati untuk reduced motion dan sentuhan).
- `pages/Details.tsx`: dokumen sebagai kertas dengan kop, rel tahap fisik, cap; faktur tetap satu lembar utuh agar cetak lengkap.
- `components/Form.tsx`: bagian form jadi lembar bertumpuk; bilah ringkasan berbentuk struk, angka crossfade. `pages/Returns.tsx`: stepper jumlah retur.
- `pages/Reports.tsx`: tab map berkas, kertas buku besar, satu garis di atas subtotal, garis ganda di bawah total, kolom akun menempel di mobile.
- `pages/Admin.tsx`: sakelar fisik aktif/nonaktif (permintaan yang sama dengan tombol lama), avatar inisial di Akun saya.
- Daftar: tombol utama menempel di atas bilah tab di mobile (`PageHeader cta`), filter status dari URL.
- `index.css`: rel tahap, struk, ledger, `.lift`/`.stack-back`/`.task`, stagger, cetak hitam-putih.

Ukuran build akhir: CSS 52.349 B (+87,4%), JS 428.121 B (−45,9%, Recharts tidak lagi dibundel), gabungan −41,3%.

## Cara menjalankan uji dengan aman

- Backend uji: port 8010, `DATABASE_URL` menunjuk salinan di scratchpad (`v2test.db`). Batas laju dinaikkan hanya lewat env proses uji.
- Frontend uji: Vite milik sesi ini dengan `VITE_API_TARGET=http://127.0.0.1:8010` dan `--port 5180 --strictPort` (gagal alih-alih pindah port diam-diam). **Jangan anggap port 5173 milik sesi ini**: pada 19 Nov 2026 ada Vite lain di 5173 dan 5174 yang terhubung ke backend live (port 8000). Pakai port yang dilaporkan Vite sendiri (sesi ini: 5175) dan buktikan lewat tulis percobaan melalui port Vite itu.
- Bukti pengikatan: hitung baris LOGIN dan audit di live (mode baca saja) dan di salinan, lakukan satu login lewat port uji, hitung lagi. Hanya salinan yang boleh bertambah.

## Ukuran build sebelum perubahan (baseline untuk batas +25%)

| Berkas | Byte |
|---|---|
| CSS `index-*.css` | 27.929 |
| JS `index-*.js` | 133.536 |
| JS `vendor-*.js` | 260.535 |
| JS `charts-*.js` | 396.562 |
| Total JS | 790.633 |

Batas: CSS ≤ 34.911 byte, JS ≤ 988.291 byte.

## Inventaris rute

| Rute | Halaman (berkas) | Izin |
|---|---|---|
| `/login` | Login (`pages/Login.tsx`) | publik |
| `/` | Dasbor per peran (`pages/Dashboard.tsx`) | dashboard.read |
| `/procurement/orders`, `/new`, `/:id` | Pesanan pembelian: daftar, form, detail (`Lists`, `Forms`, `Details`) | procurement.read / .write |
| `/procurement/receipts` | Penerimaan barang (`Lists`) | procurement.read |
| `/master/suppliers`, `/new` | Pemasok (`MasterData`) | master.read / .write |
| `/master/products`, `/new` | Produk (`MasterData`) | master.read / .write |
| `/inventory/stock` | Level stok + denah gudang (`Lists`, `WarehousePlan`) | inventory.read |
| `/inventory/movements` | Kartu stok (`Lists`) | inventory.read |
| `/inventory/transfers` | Transfer antar gudang (`Lists`) | inventory.read |
| `/inventory/work-orders` | Perakitan (`Lists`) | inventory.read |
| `/inventory/reorder` | Saran pesan ulang (`Lists`) | inventory.read |
| `/sales/orders`, `/new`, `/:id`, `/:id/return` | Pesanan penjualan: daftar, form, detail, form retur (`Lists`, `Forms`, `Details`, `Returns`) | sales.read / .write |
| `/sales/returns` | Retur (`Returns`) | sales.read |
| `/sales/customers`, `/new` | Pelanggan (`MasterData`) | master.read / .write |
| `/accounting/journals`, `/new` | Jurnal umum (`Lists`, `Forms`) | accounting.read / .post |
| `/accounting/invoices`, `/:id` | Faktur & tagihan (`Lists`, `Details`) | accounting.read |
| `/accounting/reports` | Laporan keuangan (`Reports`) | accounting.read |
| `/accounting/periods` | Periode fiskal (`Periods`) | accounting.read |
| `/system/audit` | Log audit (`Lists`) | audit.read |
| `/system/users`, `/new` | Pengguna & peran (`Admin`) | users.manage |
| `/account` | Akun saya (`Admin`) | semua pengguna masuk |

Tidak ada rute sendiri untuk Pengiriman, Buku besar, dan Pengaturan. Glyph-nya tetap dibuat; halaman baru tidak ditambahkan karena di luar batasan.

## Inventaris komponen dan rencana penggantian

| Komponen sekarang | Berkas | Rencana |
|---|---|---|
| `.btn`, `.btn-primary`, `.btn-danger`, `.btn-text`, `.btn-sm` | `index.css` | Diganti tuts (`.key`, `.key.sec`, `.key.danger`, `.act`) + komponen `Key` dengan status memuat/berhasil/gagal dari status mutasi |
| `.field`, `<select>`, input tanggal | `index.css`, `components/Form.tsx` | Bidang cekung, label/bantu/galat; `Stepper` baru untuk jumlah |
| `.chip` | `index.css`, `DataTable.tsx` | Chip filter dengan animasi masuk/keluar |
| `DataTable` (TanStack Table) | `components/DataTable.tsx` | Gaya buku besar, bayangan header saat gulir, hover sorot + garis aksen, checkbox + bilah aksi massal, kolom pertama menempel di mobile (menggantikan baris bertumpuk) |
| `Drawer`, `ConfirmDialog` | `components/Layers.tsx` | Laci level 3 220 ms, dialog skala 0,98 → 1 |
| `Toaster` | `components/Toaster.tsx` | Slip struk dengan tepi bergerigi, 4 detik, `aria-live` |
| `Palette` | `components/Palette.tsx` | Kertas level 3, hasil berkelompok + glyph, aksi |
| `Shell` (sidebar, bilah atas, drawer menu mobile) | `components/Shell.tsx` | Sidebar lebar/rel + penanda halaman; chip cabang, cap periode, avatar; bilah tab bawah di mobile |
| `Status`, `PageHeader`, `SectionTitle`, `EmptyState`, `ErrorNote`, `Skeleton`, `DetailSkeleton` | `components/ui.tsx` | Lencana glyph + kata; cap tinta di detail; ilustrasi keadaan kosong/galat/tanpa izin; skeleton berkilau |
| `NoAccess` | `components/NoAccess.tsx` | Ilustrasi gembok |
| `WarehousePlan` | `components/WarehousePlan.tsx` | Tetap; label pass kedua seperti di lemari contoh; versi mini di dasbor |
| Ikon `lucide-react` (panah urut, peringatan) | `DataTable.tsx`, `ui.tsx` | Diganti glyph sendiri; `lucide-react` bisa dihapus dari dependensi setelahnya (menunggu keputusan) |
| `Trend` (Recharts) | `pages/Dashboard.tsx` | Garis tergambar sekali, slip tooltip; tetap Recharts atau SVG sendiri (keputusan) |

## Catatan untuk sesi berikutnya

- Lemari contoh: `docs/prototypes/tactile-kit.html` (+ `.css`, `.js`, `glyphs.js`), katalog `docs/prototypes/glyphs.html`.
- Rekaman: `docs/recordings/tactile-*.webm`.
- Screenshot: `docs/screenshots/pre-tactile-*`, `docs/screenshots/tactile-kit-*`.
- Insiden 19 Nov 2026: sebagian audit ui-polish berjalan lewat Vite asing di port 5173 ke backend live. Yang tertulis ke DB live hanya 4 baris audit LOGIN dan 5 refresh token hari itu (sebagian mungkin dari pengguna sendiri). Tidak ada data bisnis yang berubah; tidak ada pemulihan yang dilakukan (DB live tidak disentuh).
