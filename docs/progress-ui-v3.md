# Catatan kemajuan UI v3 "Buku Besar Hidup"

Sumber kebenaran untuk melanjutkan pekerjaan. Brief: `docs/brief-ui-v3.md`.

## Status fase

| Fase | Status |
|---|---|
| 0. Persiapan dan peta data | Selesai (commit `c1fbc27`) |
| 1. Storyboard dan purwarupa | Purwarupa langsung menjadi komponen nyata di rute Katalog dan halaman; storyboard diambil dari Katalog (lihat catatan) |
| 2. Fondasi | Selesai: token, font sendiri, tekstur, gerak dan preferensi, saklar fitur, Katalog, skrip kontras |
| 3. Komponen dan kerangka | Selesai |
| 4. Gerak dan ruang (M2, M3, M4) | Selesai, diuji skrip e2e |
| 5. Logika akuntansi (M1, M5, M7) | Selesai (M1 dan M5 terbatas: relasi id) |
| 6. Persediaan dan aliran (M6, M8, M9) | M8 selesai; M6 dan M9 ditunda (tidak ada data API) |
| 7. Penyapuan halaman | Sebagian besar selesai: ponsel 390, tablet 768, zoom 200%, cetak faktur/laporan diperbaiki dan diperiksa; uji e2e M10, M11 lulus |
| 8. Opsional | O2 dan O3 dikerjakan (bawaan mati); O1 tidak |
| 9. Pengerasan | **Belum**: audit skill (web-design-guidelines, design-motion-principles, react-best-practices, composition, writing), ukur performa build produksi (LCP/CLS/INP), screenshot akhir `v3-*`, README storyboard, perbarui `docs/design-system.md`, laporan akhir |

### Lanjutkan dari sini (sesi berikutnya)

1. Jalankan lingkungan uji (bagian "Lingkungan uji"), buktikan binding lagi.
2. `node tests/e2e/run.cjs` (semua uji terakhir lulus: 45 + 7) dan `npm run contrast` (301/301).
3. Kerjakan Fase 9 di atas, lalu laporan akhir sesuai brief 19.
4. Storyboard ada di `docs/storyboard/` (bingkai + rekaman `.webm`, dibuat `tests/e2e/storyboard.cjs`); README-nya belum ditulis.
5. Ukuran terakhir (build produksi): CSS awal 12,36 kB gzip (anggaran ≤13,55), JS awal Dasbor ±101 kB gzip (vendor 65,8 + index 35,4; baseline 128,75). Total CSS semua potongan ±18,7 kB gzip (dipecah per rute).
6. Temuan terbuka: `view-transition-name` tujuan menunggu `React.lazy` lewat `waitForRoom` (maks --dur-room); faktur tidak bisa diprime dari daftar (bentuk data beda), jadi morph faktur pada kunjungan pertama hanya crossfade.

## Keputusan pengguna

| Tanggal | Keputusan |
|---|---|
| 20 Nov 2026 | D1: relasi dokumen hanya dari id eksplisit API. Nomor dokumen di deskripsi jurnal **tidak** dipakai sebagai relasi. Akibat: M1 hanya untuk retur (`journal_entry_id` di daftar retur) dan laci dari struk M2 (`journal_entry_id` di respons POST); M5 tanpa langkah pengiriman. |
| 20 Nov 2026 | Pengguna: "kerjakan sesuai yang tertera, tidak usah bertanya, semua izin diperbolehkan". Gerbang 1–5 tidak lagi menunggu jawaban; keputusan di bawah diambil Claude atas izin itu dan bisa dibatalkan pengguna. |
| 20 Nov 2026 | D2 (Claude): M6 dan M9 ditunda, saklar `fifoStack` dan `goodsFlow` mati. Laci produk dan dasbor menyebut alasannya. |
| 20 Nov 2026 | D3 (Claude): tebakan faktur dari pesanan (v2 `Details.tsx` dan form retur) dihapus. Detail pesanan menampilkan "Faktur pelanggan" (relasi `customer_id`) dengan Bayar penuh; form retur hanya menyebut faktur bila retur sebelumnya menautkannya lewat `invoice_id`. |
| 20 Nov 2026 | D4 (Claude): arketipe dasbor dari izin: pimpinan (`users.manage`), keuangan, pengadaan, gudang, penjualan, auditor. |
| 20 Nov 2026 | D5 (Claude): commit lokal per fase di `ui-v3`, author Rangggase, tanpa atribusi AI. Tidak push, tidak merge ke `main`. |
| 20 Nov 2026 | Dependensi (Claude): `motion` tidak dipakai (WAAPI + CSS, pegas lewat easing `linear()` di `motion/spring.ts`); `three`/`@react-three/fiber` tidak dipakai (O1 tidak dikerjakan); `recharts` dan `lucide-react` yang tidak terpakai dihapus. `@playwright/test` gagal dipasang (ditolak pengaman mode otomatis lingkungan), jadi uji e2e memakai skrip Playwright dari cache npx (`frontend/tests/e2e/run.cjs`). |
| 20 Nov 2026 | Gerbang 4 (Claude): O2 Cahaya meja dan O3 Suara dikerjakan, bawaan mati di Akun saya. O1 Gudang 3D tidak dikerjakan: data hanya 6 produk, tidak lolos uji akal sehat no. 2 (tidak membuat lebih cepat paham dibanding SVG M8) dan menambah ±150 kB gzip. |

## Git (20 Nov 2026)

- Sebelum mulai: cabang `tactile-ui` di `2854dc9`, bersih kecuali `docs/brief-ui-v3.md` (untracked). Pekerjaan v2 sudah di-commit di `tactile-ui`, belum di-merge ke `main`, belum di-push.
- Dibuat tag `pre-ui-v3` → `2854dc9` dan cabang `ui-v3` dari `2854dc9`.
- Fase 0 tidak mengubah kode. Belum ada commit v3.

## Lingkungan uji

Folder kerja (di luar repo): `C:\Users\Rangga\AppData\Local\Temp\claude\8f3c383bac6030e1\50ba53db-a021-4207-8211-38005af2626f\scratchpad\uiv3\`

| File | Isi |
|---|---|
| `ui-v3.db` | Database uji (seed + tambahan lewat API) |
| `serve.py` | Peluncur uvicorn port 8010; mencetak PID dan `DATABASE_URL` yang dipakai proses |
| `count.py` | Hitung baris `audit_logs` LIVE dan COPY dengan `mode=ro` |
| `api.py`, `augment_demo.py`, `inspect_demo.py`, `probe.py` | Klien API uji dan skrip data demo |
| `baseline.cjs`, `perf.cjs` | Screenshot baseline dan pengukuran performa (Playwright) |

Variabel dan perintah (bash, dari `backend/`):

```
DB=sqlite:///C:/Users/Rangga/AppData/Local/Temp/claude/8f3c383bac6030e1/50ba53db-a021-4207-8211-38005af2626f/scratchpad/uiv3/ui-v3.db
# isi ulang database uji (hanya jika file dihapus dulu)
DATABASE_URL=$DB .venv/Scripts/python.exe -m app.cli seed
# backend uji 8010
DATABASE_URL=$DB CORS_ORIGINS=http://localhost:5180,http://127.0.0.1:5180 .venv/Scripts/python.exe <uiv3>/serve.py
# frontend uji 5180 (build produksi)
cd ../frontend && npm run build && VITE_API_TARGET=http://127.0.0.1:8010 node node_modules/vite/bin/vite.js preview --port 5180 --strictPort --host 127.0.0.1
# frontend uji 5180 (dev)
VITE_API_TARGET=http://127.0.0.1:8010 node node_modules/vite/bin/vite.js --port 5180 --strictPort --host 127.0.0.1
```

- `vite.config.ts` sudah mendukung `VITE_API_TARGET` sejak v2 (bawaan `127.0.0.1:8000`). `vite preview` mewarisi `server.proxy`. Tidak ada perubahan konfigurasi.
- `.env` backend berisi `DATABASE_URL`; variabel lingkungan proses menimpanya (pydantic-settings). `.env` tidak diubah.
- Batas login backend 10/menit. Skrip yang login banyak peran memberi jeda 6,5 detik per login. Alternatif tanpa mengubah backend: `LOGIN_RATE_LIMIT_PER_MINUTE` di env proses uji saja.
- Playwright: dipakai dari cache npx (`C:/Users/Rangga/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright`, v1.65.0) lewat `PW_PATH`. Tidak ada dependensi yang ditambahkan ke repo. `playwright-cli` global tidak terpasang.

## Bukti database uji (20 Nov 2026)

| Langkah | LIVE `aether_erp.db` (ro) | COPY `ui-v3.db` (ro) |
|---|---|---|
| Sebelum seed | 79 baris (max id 79) | belum ada |
| Setelah `app.cli seed` | 79 | 66 |
| Proses server 8010 mencetak `DATABASE_URL=sqlite:///C:/Users/.../uiv3/ui-v3.db`, PID 13952 | | |
| Login percobaan langsung ke 8010 (HTTP 200) | 79 | 67 |
| Tambahan data demo lewat API | 79 | 85 |
| Login percobaan lewat proxy `vite preview` 5180 (HTTP 200) | 79 | 86 |
| Akhir sesi (setelah screenshot dan pengukuran) | 79 | 102 |

Catatan jujur: waktu ubah `aether_erp.db` berubah dari 19 Nov 23:14 menjadi 20 Nov 01:18, dan `-wal` menjadi 0 byte pada 01:18:26. Jumlah baris audit tetap 79. Server milik pengguna di port 8000 (PID 6072) dan Vite 5173 (PID 18076) yang berjalan saat sesi dimulai sudah tidak ada di akhir sesi. Sesi ini hanya mematikan PID 13952 dan 6532. Perubahan waktu itu cocok dengan checkpoint WAL saat server 8000 berhenti, tetapi penyebabnya tidak bisa dibuktikan dari sini.

## Data demo

Seed (`app.cli seed`) sudah mencakup: transaksi Jun–Nov 2026 (6 bulan) untuk pembelian, penerimaan, tagihan pemasok, perakitan, penjualan, pengiriman, faktur, pembayaran penuh; 3 cabang (HQ, WH-SBY, WH-BDG); 1 transfer selesai; stok kritis (FG-CAB-01 di Bandung, 100 dari titik 200); piutang jatuh tempo (Toko Digital Makmur).

Kurang, lalu ditambah lewat API (`augment_demo.py`, semua aturan bisnis berlaku):

| Tambahan | Hasil |
|---|---|
| Pembayaran sebagian INV-2026-000014 Rp7.000.000 (finance) | PAY-IN-2026-000014, JE 87, status PARTIALLY_PAID |
| Retur SO-2026-000014: 2 FG-HUB-01 + 5 FG-CAB-01 | RET-2026-000001, kredit Rp1.525.000, biaya kembali Rp629.961,54, JE 88 |
| Retur SO-2026-000017: 10 FG-CAB-01 | RET-2026-000002, kredit Rp450.000, biaya kembali Rp183.000, JE 89 |
| Tutup periode 2026-01 s.d. 2026-06 berurutan (finance) | 6 CLOSED, 6 OPEN |
| PO di atas ambang 50 jt, diajukan (buyer) | PO-2026-000013 PENDING_APPROVAL |
| Transfer SBY → BDG 5 FG-HUB-01, dikirim | TR-2026-000002 IN_TRANSIT |

Tanggal retur 20 Nov 2026 (hari ini, periode terbuka). Jurnal retur sesuai aturan Sprint 9: JE 88 = D 4150 1.525.000 / K 1200 1.525.000; D 1300 629.961,54 / K 5100 629.961,54.

Keterbatasan data: hanya 6 produk dan 3 kategori; gerakan stok tidak punya tanggal bisnis (hanya `created_at` = waktu input, semua data seed tercatat pada waktu seed).

## Baseline (Fase 0)

### Ukuran bundle (`npm run build`, gzip)

| Berkas | Mentah | gzip |
|---|---|---|
| `index-*.css` | 52,35 kB | **11,29 kB** |
| `index-*.js` | 166,64 kB | 48,67 kB |
| `vendor-*.js` | 260,99 kB | 79,81 kB |
| `charts-*.js` (kosong) | 0,40 kB | 0,27 kB |
| JS awal rute Dasbor (tanpa pemecahan per rute) | 428,03 kB | **128,75 kB** |

Anggaran v3: JS awal Dasbor ≤ 148,06 kB gzip (+15%); CSS ≤ 13,55 kB gzip (+20%).

### Performa (`vite preview`, Chromium headless 1440×900, tanpa throttling, median 3 putaran)

| Halaman | LCP | CLS | INP (interaksi) | Tugas panjang |
|---|---|---|---|---|
| Dasbor | 272 ms | 0,001 | 16 ms (buka menu cabang) | 0 |
| Pesanan penjualan | 80 ms | 0,001 | 32 ms (klik baris → laci) | 0 |

Catatan: LCP daftar mungkin tertangkap sebelum data tabel tampil. Font dimuat dari Google Fonts CDN. Mesin pengembang, bukan laptop kantor biasa.

### Animasi saat diam

`document.getAnimations()` setelah halaman tenang 2 detik: **0** di semua 31 halaman admin (1440 px).

### Screenshot

`docs/screenshots/v3-pre-*` (76 file): login, 31 halaman sebagai admin, dan dasbor 6 peran lain (finance, procurement, buyer, warehouse, sales, auditor), masing-masing 1440 dan 390 px. Screenshot halaman penuh di 390 px menampilkan bilah menempel (ringkasan form, tab bawah) di tengah gambar; itu efek tangkapan halaman penuh.

## Inventaris

### Rute (31, di `App.tsx`)

`/login`, `/`, `/procurement/orders` (+`/new`, `/:id`), `/procurement/receipts`, `/inventory/stock`, `/inventory/movements`, `/inventory/transfers`, `/inventory/work-orders`, `/inventory/reorder`, `/sales/orders` (+`/new`, `/:id`, `/:id/return`), `/sales/customers` (+`/new`), `/sales/returns`, `/master/products` (+`/new`), `/master/suppliers` (+`/new`), `/accounting/journals` (+`/new`), `/accounting/invoices` (+`/:id`), `/accounting/reports`, `/accounting/periods`, `/system/audit`, `/system/users` (+`/new`), `/account`.

Tidak ada rute detail untuk: jurnal, produk, pengiriman, penerimaan barang, retur, transfer, perakitan.

### Peran × permission (`backend/app/seed.py`)

READ = dashboard.read, master.read, accounting.read, procurement.read, inventory.read, sales.read.

| Peran | Permission | Arketipe dasbor v2 |
|---|---|---|
| Admin | semua 16 | keuangan (karena users.manage) |
| Finance Manager | READ + accounting.post, accounting.close, payments.write, master.write | keuangan |
| Procurement Manager | READ + procurement.write, procurement.approve, inventory.write | pengadaan |
| Procurement Staff | READ + procurement.write | pengadaan |
| Warehouse Staff | READ + inventory.write | gudang |
| Sales Staff | READ + sales.write | penjualan |
| Auditor | READ + audit.read | auditor |

16 permission: dashboard.read, master.read, master.write, accounting.read, accounting.post, accounting.close, procurement.read, procurement.write, procurement.approve, inventory.read, inventory.write, sales.read, sales.write, payments.write, users.manage, audit.read.

Brief bagian 11 menyebut arketipe Pimpinan; peran itu tidak ada. Peran nyata yang tidak ada di brief: Procurement Manager/Staff dan Auditor.

### Komponen v2 (`frontend/src`)

- `components/`: DataTable, Form (FormGroup, Field, ActionBar, Impact), Key/KeyLink (tuts), Layers (Drawer, ConfirmDialog), Menu, NoAccess, Palette, ScrollX, Shell (sidebar, bilah atas, tab bawah), Stepper, Tabs (FolderTabs), Toaster, TrendChart + Sparkline (SVG sendiri), WarehousePlan (isometrik), `ui.tsx` (Status, InkFilter, Stamp, PageHeader, SectionTitle, Illustration, ErrorNote, EmptyState, Skeleton, DetailSkeleton), glyphs (45 glyph).
- `pages/`: Admin, Dashboard, Details, Forms, Lists, Login, MasterData, Periods, Reports, Returns.
- `lib/`: actions, api (token di sessionStorage), format, labels, nav (NAV, permFor, mobileTabs), session, types.
- `index.css` 379 baris; keyframes: key-progress (berulang, indikator memuat), drawer-in, sheet-in, fade-in, slip-in, dlg-in, sheen, pop-in.
- Font: Google Fonts (Plex Sans, Source Serif 4). Plex Mono belum ada. `public/` hanya `favicon.svg`.
- `package.json` masih memuat `recharts` dan `lucide-react` yang tidak dipakai (keputusan terbuka dari v2).

## Peta data momen khas

Endpoint diperiksa dari kode router dan respons nyata API uji.

| Momen | Endpoint | Field tersedia | Status | Usulan |
|---|---|---|---|---|
| M1 Jejak Tinta | `GET /accounting/journals` (paged ≤200; filter cabang, tanggal, source_type) | id, entry_no, entry_date, description, source_type, status, reverses_id, total, lines[account_code, account_name, debit, credit, memo]. **Tidak ada** `source_id`, tidak ada GET per id/nomor. Kaitan dokumen→jurnal eksplisit hanya: `journal_entry_id` di daftar retur dan di respons POST (kirim, retur, terima, bayar, opname). Faktur tidak membawa id jurnal. Deskripsi jurnal buatan server memuat nomor dokumen ("Sales return RET-… (SO-…)"). | Sebagian | Jalan terbatas: laci dari struk M2 dan detail retur (id eksplisit). Tab Jurnal di dokumen lain bergantung keputusan D1. Halaman detail jurnal belum ada (perlu rute baru di frontend). |
| M2 Upacara Posting | Respons POST | Kirim: do_no, cogs_total, journal_entry_id. Retur: return_no, total_amount, cogs_reversed, journal_entry_id, items. Terima: grn_no, total_value, journal_entry_id. Tagih pemasok: invoice_no, total_amount, due_date. Faktur: data faktur (tanpa jurnal). Bayar: payment_no, journal_entry_id, invoice (paid, outstanding). Transfer: transfer_no, status, items. Perakitan: wo_no, total_cost, unit_cost. Konfirmasi/ajukan/setujui: status. | Tersedia (isi bervariasi per aksi) | Jalan. Struk hanya memuat field di atas; "perubahan stok" hanya dari kuantitas yang dikembalikan respons. |
| M3 Angka Mekanis | Data yang sudah tampil | Total form dari pratinjau frontend yang sudah ada (kredit retur = kuantitas × harga); KPI dari `/dashboard/overview`. Biaya stok kembali retur **tidak** tersedia sebelum diposting. | Tersedia | Jalan. Bilah retur menampilkan biaya kembali hanya sesudah respons. |
| M4 Transisi Ruang | – (frontend) | Pasangan (a), (b) memakai filter status di daftar, (c), (e). (d) bergantung M5. | Tersedia | Jalan. |
| M5 Rantai Dokumen | `/sales/returns`, `/procurement/goods-receipts`, `/invoices/{id}`, `/sales/orders/{id}` | Retur → so_id, invoice_id. GRN → po_id. Detail faktur → `reference` (nomor SO/PO, tanpa id) + daftar pembayaran. **Tidak ada** endpoint pengiriman (DO). Detail SO/PO tidak mendaftar dokumen turunannya. Daftar faktur tidak membawa so_id/po_id. v2 menebak faktur dari SO (pelanggan, tanggal, jumlah) di `Details.tsx` — dilarang di v3. | Sebagian | Versi terbatas: faktur ↔ SO/PO (lewat nomor referensi eksplisit), pembayaran, retur ↔ SO/faktur, GRN ↔ PO. Langkah pengiriman tidak bisa tampil kecuali D1 disetujui. |
| M6 Lapisan FIFO | `/inventory/balances`, `/inventory/movements`, `/inventory/valuation` | Hanya nilai total per produk per cabang (jumlah lapisan) dan unit_cost per gerakan. Lapisan (`stock_batches`: tanggal masuk, sisa, biaya) **tidak diekspos**. Gerakan tanpa tanggal bisnis. | Tidak ada | **Tunda.** |
| M7 Akun T | `GET /accounting/reports/general-ledger` | account, opening_balance, closing_balance, lines[date, entry_no, description, memo, debit, credit, balance] | Tersedia | Jalan. Klik entri → laci jurnal perlu mencari entry_no di daftar jurnal (tanpa GET per nomor). |
| M8 Gudang Hidup | `/inventory/balances`, `/master/products`, `/master/branches` | on_hand, reserved, available, reorder_point, is_low, value; kategori produk. Tidak ada rak/bin. | Tersedia | Jalan, dikelompokkan per kategori dengan keterangan "bukan denah fisik". Data demo hanya 6 produk. |
| M9 Peta Aliran Barang | – | Tidak ada endpoint laporan aliran. `/inventory/movements` punya jenis dan kuantitas, tetapi tanpa tanggal bisnis, maksimal 200 per halaman, dan harus dihitung ulang di frontend. Tidak ada endpoint pengiriman. | Tidak ada | **Tunda.** |
| M10 Tutup Buku | `/accounting/periods`, `POST …/close`, `…/reopen`, `/accounting/journals?start&end`, `/accounting/reports/income-statement` | Status periode; jumlah jurnal periode (`total`); laba periode (`net_income`). Urutan tutup ditegakkan backend. | Tersedia | Jalan (hanya diuji di DB uji). |
| M11 Membuka Buku | – (frontend) | – | Tersedia | Jalan. |

Dasbor (bagian 11):

| Widget | Sumber | Status |
|---|---|---|
| Persetujuan tertunda | `/procurement/purchase-orders?status=PENDING_APPROVAL` | Tersedia |
| KPI pendapatan, margin, laba, kas, persediaan, piutang | `/dashboard/overview` kpis | Tersedia |
| Grafik 6 bulan (pendapatan, HPP, laba kotor, kas) | `/dashboard/overview` trend | Tersedia |
| Piutang menurut umur | `/accounting/reports/aging/AR` (belum jatuh tempo, 0–30, 31–60, 61–90, >90) | Tersedia |
| Produk teratas | Hanya `sales_by_category` | Tidak ada per produk |
| Penerimaan dan pengiriman hari ini | GRN tersedia; pengiriman tidak punya endpoint | Sebagian |
| Transfer menunggu, stok kritis | `/inventory/transfers`, `/inventory/balances?low_only=true` | Tersedia |
| Ringkasan pengguna dan aktivitas | `/system/users`, `/audit-logs`, `recent_activity` | Tersedia |
| Titik tugas sidebar | Hitungan dari daftar (v2 sudah) | Tersedia |

## Keputusan terbuka (Gerbang 1)

1. ~~D1~~: diputuskan 20 Nov 2026, hanya id (lihat tabel keputusan).
2. D2: setuju M6 dan M9 ditunda?
3. D3: hapus tebakan SO → faktur dari `Details.tsx` v2?
4. D4: arketipe dasbor untuk peran nyata (tidak ada Pimpinan; ada Pengadaan dan Auditor).
5. D5: commit Fase 0 (screenshot + catatan ini) ke `ui-v3`?
6. Dari v2 (masih terbuka): `recharts`/`lucide-react` tak terpakai, merge `tactile-ui`.

## PID proses

| Proses | PID | Status |
|---|---|---|
| Backend uji 8010 | 13952 | Dimatikan |
| `vite preview` 5180 | 6532 | Dimatikan |

Tidak ada proses sesi ini yang masih berjalan.

## Catatan teknis untuk sesi berikutnya

- Cabang kerja `ui-v3`; titik pemulihan tag `pre-ui-v3`.
- Pakai alat edit file, jangan penggantian teks massal (brief 2).
- `DataTable` dipakai `Lists` dan `MasterData`; duplikasi pembuat kolom dirapikan di Fase 3.
- Kartu stok tidak punya tanggal bisnis; jangan menampilkan `created_at` sebagai tanggal transaksi tanpa label.
