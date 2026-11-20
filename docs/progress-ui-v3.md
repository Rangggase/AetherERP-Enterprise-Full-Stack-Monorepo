# Catatan kemajuan UI v3 "Buku Besar Hidup"

Sumber kebenaran untuk melanjutkan pekerjaan. Brief: `docs/brief-ui-v3.md`. Sistem desain: `docs/design-system.md` (versi meja kerja v2 disimpan di `docs/design-system-meja-kerja.md`).

## Status fase

| Fase | Status |
|---|---|
| 0. Persiapan dan peta data | Selesai (commit `c1fbc27`) |
| 1. Storyboard dan purwarupa | Selesai dengan penyimpangan: purwarupa langsung menjadi komponen nyata di rute Katalog dan halaman, lalu storyboard diambil dari komponen jadi (commit `64a63f9`, README di `docs/storyboard/`) |
| 2. Fondasi | Selesai (commit `9add081`) |
| 3. Komponen dan kerangka | Selesai (commit `9add081`) |
| 4. Gerak dan ruang (M2, M3, M4) | Selesai (commit `9add081`) |
| 5. Logika akuntansi (M1, M5, M7) | Selesai; M1 dan M5 terbatas pada relasi id (commit `9add081`) |
| 6. Persediaan dan aliran (M6, M8, M9) | M8 selesai; M6 dan M9 ditunda karena API tidak menyediakan datanya (commit `9add081`) |
| 7. Penyapuan halaman | Selesai (commit `64a63f9`) |
| 8. Opsional | O2 dan O3 selesai, bawaan mati (commit `9add081`); O1 tidak dikerjakan |
| 9. Pengerasan | Selesai (commit fase 9, lihat `git log`) |

**Fase aktif: Gerbang 5.** Semua pekerjaan brief selesai; keputusan merge menunggu pengguna.

### Lanjutkan dari sini

1. Keputusan pengguna di Gerbang 5 (lihat "Keputusan terbuka").
2. Untuk mengulang verifikasi: jalankan lingkungan uji (bagian "Lingkungan uji"), buktikan binding, lalu `npm run typecheck`, `npm run build`, `npm run contrast`, `pytest` di backend, dan `node tests/e2e/run.cjs`.
3. Pekerjaan lanjutan yang mungkin: peluang dari audit gerak (bagian Fase 9), M6 dan M9 bila backend kelak menyediakan lapisan FIFO dan laporan aliran.

## Keputusan pengguna

| Tanggal | Keputusan |
|---|---|
| 20 Nov 2026 | D1: relasi dokumen hanya dari id eksplisit API. Nomor dokumen di deskripsi jurnal **tidak** dipakai sebagai relasi. Akibat: M1 hanya untuk retur (`journal_entry_id` di daftar retur) dan laci dari struk M2 (`journal_entry_id` di respons POST); M5 tanpa langkah pengiriman. |
| 20 Nov 2026 | Pengguna: "kerjakan sesuai yang tertera, tidak usah bertanya, semua izin diperbolehkan". Gerbang 1–4 tidak lagi menunggu jawaban; keputusan di bawah diambil Claude atas izin itu dan bisa dibatalkan pengguna. |
| 20 Nov 2026 | D2 (Claude): M6 dan M9 ditunda, saklar `fifoStack` dan `goodsFlow` mati. Laci produk dan dasbor menyebut alasannya. |
| 20 Nov 2026 | D3 (Claude): tebakan faktur dari pesanan (v2 `Details.tsx` dan form retur) dihapus. Detail pesanan menampilkan "Faktur pelanggan" (relasi `customer_id`) dengan Bayar penuh; form retur hanya menyebut faktur bila retur sebelumnya menautkannya lewat `invoice_id`. |
| 20 Nov 2026 | D4 (Claude): arketipe dasbor dari izin: pimpinan (`users.manage`), keuangan, pengadaan, gudang, penjualan, auditor. |
| 20 Nov 2026 | D5 (Claude): commit lokal per fase di `ui-v3`, author Rangggase, tanpa atribusi AI. Tidak push, tidak merge ke `main`. |
| 20 Nov 2026 | Dependensi (Claude): `motion` tidak dipakai (WAAPI + CSS, pegas lewat easing `linear()` di `motion/spring.ts`); `three`/`@react-three/fiber` tidak dipakai (O1 tidak dikerjakan); `recharts` dan `lucide-react` yang tidak terpakai dihapus. `@playwright/test` gagal dipasang (ditolak pengaman mode otomatis lingkungan), jadi uji e2e memakai skrip Playwright dari cache npx (`frontend/tests/e2e/run.cjs`). |
| 20 Nov 2026 | Gerbang 4 (Claude): O2 Cahaya meja dan O3 Suara dikerjakan, bawaan mati di Akun saya. O1 Gudang 3D tidak dikerjakan: data hanya 6 produk, tidak lolos uji akal sehat no. 2 (tidak membuat lebih cepat paham dibanding SVG M8) dan menambah ±150 kB gzip. |
| 20 Nov 2026 | Pengguna: "okey kita mulai langkah selanjutnya". Fase 9 dikerjakan sampai laporan akhir. |
| 20 Nov 2026 | Gerbang 5 (Claude): **tidak** diputuskan Claude. Merge ke `main` mengubah cabang utama dan brief 20 melarang merge tanpa izin, jadi keputusannya dikembalikan ke pengguna. |

## Git

- Sebelum mulai: cabang `tactile-ui` di `2854dc9`, bersih kecuali `docs/brief-ui-v3.md` (untracked). Pekerjaan v2 sudah di-commit di `tactile-ui`, belum di-merge ke `main`, belum di-push.
- Titik pemulihan: tag `pre-ui-v3` → `2854dc9`. Cabang kerja `ui-v3` dibuat dari `2854dc9`.
- Commit di `ui-v3`: `c1fbc27` (fase 0), `9add081` (fase 2–6 dan 8), `64a63f9` (fase 1 dan 7), lalu commit fase 9. Author Rangggase, tanpa atribusi AI.
- Tidak ada push. Tidak ada merge ke `main` atau `tactile-ui`.

## Lingkungan uji

Folder kerja (di luar repo): `C:\Users\Rangga\AppData\Local\Temp\claude\8f3c383bac6030e1\50ba53db-a021-4207-8211-38005af2626f\scratchpad\uiv3\`

| File | Isi |
|---|---|
| `ui-v3.db` | Database uji (seed + tambahan lewat API + data buatan uji e2e) |
| `ui-v3.base.db` | Salinan database uji setelah tambahan data demo (102 baris audit), untuk mengembalikan keadaan awal |
| `serve.py` | Peluncur uvicorn port 8010; mencetak PID dan `DATABASE_URL` yang dipakai proses |
| `count.py` | Hitung baris `audit_logs` LIVE dan COPY dengan `mode=ro`: `python -I count.py <live.db> <copy.db>` |
| `api.py`, `augment_demo.py`, `inspect_demo.py`, `probe.py` | Klien API uji dan skrip data demo |
| `baseline.cjs`, `perf.cjs`, `perf2.cjs` | Screenshot baseline, performa sebelum, performa sesudah (LCP, CLS, INP, tugas panjang selama M4 dan M1) |
| `final-shots.cjs` | Screenshot semua halaman (`PREFIX=v3-`, `NO_WAIT=1` bila batas login dinaikkan) |
| `modes.cjs` | Screenshot tablet 768, zoom 200%, forced-colors, prefers-contrast more, gerak dikurangi, cetak |
| `verify18.cjs` (salinannya di repo: `frontend/tests/e2e/verify18.cjs`) | Uji tambahan brief 18: alur hanya keyboard, angka sesudah retur, akun persediaan = lapisan FIFO + barang dalam perjalanan, debit = kredit |
| `modes-check.cjs` (salinannya di repo: `frontend/tests/e2e/modes-check.cjs`), `m1-probe.cjs` | Mode gerak (sistem, Dikurangi, Penuh, Minimal) pada laci dan M1 |
| `reshoot-finance.cjs`, `reshoot-roles.cjs` | Ambil ulang screenshot dasbor per peran |
| `cls.cjs`, `cls-orders.cjs`, `chips-check.cjs`, `hint-check.cjs`, `css-clash.cjs` | Pelacak pergeseran tata letak, pemeriksaan kerangka chip dan petunjuk geser, analisis bentrok CSS tanpa `@layer` dengan utilitas Tailwind |

Variabel dan perintah (bash, dari `backend/`):

```
DB=sqlite:///C:/Users/Rangga/AppData/Local/Temp/claude/8f3c383bac6030e1/50ba53db-a021-4207-8211-38005af2626f/scratchpad/uiv3/ui-v3.db
# isi ulang database uji (hanya jika file dihapus dulu)
DATABASE_URL=$DB .venv/Scripts/python.exe -m app.cli seed
# backend uji 8010 (batas login dinaikkan hanya untuk proses uji ini)
DATABASE_URL=$DB CORS_ORIGINS=http://localhost:5180,http://127.0.0.1:5180 LOGIN_RATE_LIMIT_PER_MINUTE=1000 RATE_LIMIT_PER_MINUTE=100000 .venv/Scripts/python.exe <uiv3>/serve.py
# frontend uji 5180 (build produksi)
cd ../frontend && npm run build && VITE_API_TARGET=http://127.0.0.1:8010 node node_modules/vite/bin/vite.js preview --port 5180 --strictPort --host 127.0.0.1
# frontend uji 5180 (dev, perlu untuk rute Katalog dan storyboard)
VITE_API_TARGET=http://127.0.0.1:8010 node node_modules/vite/bin/vite.js --port 5180 --strictPort --host 127.0.0.1
# uji e2e (dari frontend/)
PW_PATH=C:/Users/Rangga/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright BASE=http://127.0.0.1:5180 node tests/e2e/run.cjs
# uji tambahan brief 18 (membuat data di database uji; BASE tetap 127.0.0.1:5180)
PW_PATH=<sama> node tests/e2e/verify18.cjs
PW_PATH=<sama> node tests/e2e/modes-check.cjs
```

- `vite.config.ts` sudah mendukung `VITE_API_TARGET` sejak v2 (bawaan `127.0.0.1:8000`). `vite preview` mewarisi `server.proxy`. Tidak ada perubahan konfigurasi.
- `.env` backend berisi `DATABASE_URL`; variabel lingkungan proses menimpanya (pydantic-settings). `.env` tidak diubah.
- Batas login backend bawaan 10/menit. Proses uji 8010 menaikkannya lewat env proses saja; backend tidak diubah.
- Playwright: dipakai dari cache npx (v1.65.0) lewat `PW_PATH`. Tidak ada dependensi yang ditambahkan ke repo. `playwright-cli` global tidak terpasang.
- Pytest memakai `sqlite://` di memori (`backend/tests/conftest.py` memasang `DATABASE_URL` sebelum impor), jadi tidak menyentuh database mana pun.

## Bukti database uji

Sesi 1 (20 Nov 2026):

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

Sesi lanjutan (fase 1–9, backend uji PID 17328, preview PID 7220):

| Langkah | LIVE (ro) | COPY (ro) |
|---|---|---|
| Awal verifikasi akhir fase 9 | 79 | 121 |
| Akhir (setelah e2e, screenshot, uji tambahan, pengukuran) | 79 (max id 79) | 341 |

Waktu ubah `aether_erp.db` di akhir: 20 Nov 2026 01:18:19 (sama dengan catatan sesi 1), ukuran 520.192 byte, `-wal` 0 byte. Hanya COPY yang bertambah.

## Fase 9: hasil

### Audit

| Skill | Hasil |
|---|---|
| web-design-guidelines | Diperbaiki: tombol kirim tidak lagi nonaktif sebelum isian valid (Masuk, Posting jurnal, Simpan retur, Ganti kata sandi, Terapkan filter); galat tampil saat kirim dan fokus pindah ke isian galat pertama (`lib/useUnsaved.ts`); peringatan sebelum meninggalkan form yang belum disimpan (pesanan, jurnal, retur, data master); status Laporan (`laporan`, `dari`, `sampai`, `akun`, `tampilan`) dan Level stok (`tampilan`, `status`) di URL; placeholder berakhir "…"; `aria-keyshortcuts="/"` di pencarian tabel; `translate="no"` di sel kode; `Ctrl&nbsp;K`; `overscroll-behavior: contain` di dialog, laci, palet; warna sorot ketuk bertoken; `aria-invalid` di ulangi kata sandi; penanda fokus isian palet; `content-visibility: auto` di butir linimasa. |
| design-motion-principles (audit, lensa Emil utama) | Laporan: `motion-audits/aethererp-2026-11-20.html`. 2 Kritis dan 4 Penting diperbaiki: pindah tab dengan panah tanpa animasi; Escape menutup laci, dialog, dan palet tanpa animasi keluar; knob sakelar tanpa pegas; titik radio dari skala 0,6 dengan ease-out; centang sukses 220 ms; keluar laci 12 px (masuk 24 px). 4 Peluang tidak dikerjakan (lihat di bawah). |
| vercel-react-best-practices | Diperbaiki: komponen yang didefinisikan di dalam komponen dipindah ke tingkat modul (`ActiveSwitch` di Admin, `Entry` dan `Opening` di TAccount). Tidak perlu tindakan: tidak ada waterfall (query TanStack berjalan paralel), rute sudah dimuat malas dan dimuat lebih dulu saat hover atau fokus, preferensi `localStorage` divalidasi saat dibaca. |
| vercel-composition-patterns | Tidak ada perubahan: komponen bersama (Key, Field, Drawer, DataTable) memakai `children` dan varian eksplisit; tidak ada tumpukan prop boolean yang perlu dipecah menjadi compound component. |
| writing-guidelines | Diperbaiki: petunjuk Cahaya meja tanpa "sangat"; tanda kutip lengkung di Katalog. Dokumen baru (`design-system.md`, README storyboard, catatan ini) mengikuti aturan: kalimat aktif, judul huruf kalimat, titik dua sebelum daftar, satuan dengan spasi ("220 ms"). |

Peluang audit gerak yang masih terbuka:

| Peluang | Berkas | Status |
|---|---|---|
| Laci dari Enter tanpa animasi | `DataTable.tsx` | Terbuka |
| Pita sidebar tanpa tarikan untuk navigasi keyboard | `Shell.tsx` | Terbuka |
| Angkat baris hover pada kepadatan Rapat | `tables.css` | Dipertahankan (brief meminta angkat baris) |
| Crossfade kerangka ke konten | `ui.tsx` | Terbuka |

### Temuan saat verifikasi akhir (diperbaiki)

- CLS Dasbor 0,13 menjadi 0,001: ruang tetap untuk baris keterangan dan kartu tugas, kerangka setinggi isi, baris ketiga dan catatan kaki hanya setelah data datang.
- Kolom jumlah umur piutang di dasbor keuangan lebar tetap 88 px dan rata kanan (`v3-dasbor-finance-*` diambil ulang).
- z-index lokal literal (−3 sampai 1) di `index.css`, `DocChain.css`, `InkThreads.css`, `tabs.css` diganti token `--z-local-raise`, `--z-local-sheet`, `--z-local-shadow`, `--z-local-stack`.
- CLS daftar ber-chip status 0,0197 menjadi 0,001: baris chip baru dirender setelah data datang sehingga tabel turun 44 px. Sekarang kerangka chip setinggi chip asli tampil selama memuat, dan chip tetap tampil walau hanya ada satu status.
- **Izin aksi tidak cocok dengan backend** (ditemukan oleh uji hanya-keyboard sebagai Sales Staff: HTTP 403 "Missing permission: inventory.write"). Backend meminta *semua* izin yang didaftar: kirim pesanan dan retur penjualan butuh `sales.write` + `inventory.write`, tutup tahun butuh `accounting.close` + `accounting.post`. UI hanya memeriksa satu izin, sehingga Sales Staff melihat "Buat retur" (di detail pesanan, rantai dokumen, palet, dan form retur) dan Warehouse Staff serta Procurement Manager melihat "Kirim barang" serta tugas dasbor "Kirim", yang semuanya pasti ditolak. Diperbaiki tanpa mengubah backend atau 16 izin: `DELIVER_PERMS` dan `RETURN_PERMS` di `lib/nav.ts`, `Step.perm` boleh berupa daftar (`hasAll`), penjaga rute memeriksa semua izin, tombol tutup tahun memeriksa kedua izin. Di data demo hanya Admin yang punya kedua izin kirim dan retur. Uji regresi ditambahkan ke `run.cjs peran`. Bug ini sudah ada sejak v2.
- Tombol "Putar ulang" M1 tampil nonaktif tanpa penjelasan di mode Dikurangi dan Minimal. Di mode itu M1 langsung di keadaan akhir, jadi tombol kini disembunyikan.
- Petunjuk "Geser ke kanan untuk kolom lain" tampil di desktop. Penyebab: regresi saat CSS dipecah per rute di fase 9; `styles/*.css` tidak berada di `@layer` Tailwind sehingga `.swipe-hint { display: flex }` mengalahkan `md:hidden`. Diperbaiki dengan media query di `tables.css`. Analisis `css-clash.cjs` atas semua file CSS tanpa `@layer` tidak menemukan bentrok lain (`.receipt`, `.tabs`, `.tip` hanya disembunyikan oleh aturan cetak `!important` yang memang dimaksud; `.cb min-h-0` tidak berpengaruh karena tinggi sel kotak centang 40 px).

### Ukuran bundle (`npm run build`, gzip)

| Ukuran | Baseline v2 | Anggaran | Sesudah v3 |
|---|---|---|---|
| JS awal rute Dasbor | 128,75 kB | ≤148,06 kB (v2 + 15%) | 101,56 kB (index 35,73 + vendor 65,83) |
| CSS awal | 11,29 kB | ≤13,55 kB (v2 + 20%) | 12,59 kB |
| CSS semua potongan (dimuat per rute) | 11,29 kB | – | 19,04 kB |

### Performa (`vite preview`, Chromium headless 1440×900, tanpa throttling, median 3 putaran)

| Halaman | Ukuran | Sebelum (v2) | Sesudah (v3) | Anggaran |
|---|---|---|---|---|
| Dasbor | LCP | 272 ms | 116 ms | ≤2,0 s |
| Dasbor | CLS | 0,001 | 0,001 | ≤0,05 |
| Dasbor | INP (buka menu cabang) | 16 ms | 16 ms | ≤200 ms |
| Pesanan penjualan | LCP | 80 ms | 132 ms | ≤2,0 s |
| Pesanan penjualan | CLS | 0,001 | 0,001 | ≤0,05 |
| Pesanan penjualan | INP (klik baris, laci) | 32 ms | 40 ms | ≤200 ms |
| M4 transisi ruang | Tugas panjang terlama | – | 0 ms | tidak ada >50 ms |
| M1 jejak tinta | Tugas panjang terlama | – | 0 ms | tidak ada >50 ms |
| Semua 31 halaman admin | Animasi saat diam | 0 | 0 | 0 |

Catatan: LCP v2 memakai font dari Google Fonts CDN, v3 memakai font sendiri. LCP daftar bisa tertangkap sebelum baris tabel tampil. Diukur di mesin pengembang, bukan laptop kantor biasa.

### Kontras

`npm run contrast`: 301 dari 301 pasangan lolos (4 nada cahaya meja × polos dan bertekstur, ditambah skala umur). Pasangan terlemah relatif terhadap batas: teks peringatan di kanvas bertekstur, 4,54:1 pada nada malam (batas 4,5:1). Tabel lengkap: `node scripts/contrast-check.mjs --md`.

### Screenshot dan rekaman

- `docs/screenshots/v3-*.png`: login, 31 halaman sebagai admin, dasbor 6 peran lain, masing-masing 1440 dan 390 px (76 file, diambil ulang dari build final).
- `docs/screenshots/v3-{tablet,zoom200,forced,kontras}-{dasbor,retur,stok,laporan}.png`: tablet 768, zoom 200% (720 px CSS pada 1440 fisik), forced-colors, prefers-contrast more.
- `docs/screenshots/v3-cetak-faktur.png`, `v3-cetak-faktur.pdf`, `v3-cetak-laporan.png`: pratinjau cetak.
- `docs/storyboard/`: bingkai dan 7 rekaman `.webm` momen khas, dengan README.

### Verifikasi akhir (brief 18)

| Butir | Status | Bukti |
|---|---|---|
| Typecheck, build, pytest | Lulus | `npm run typecheck`, `npm run build`, `pytest -q`: 44 passed |
| Kontras semua token dan keadaan | Lulus | 301/301 |
| Alur retur: kredit, biaya kembali, stok, total faktur, jurnal = API; M1 sesuai aturan Sprint 9 | Lulus | `run.cjs retur`; `verify18.cjs`: struk = API (kredit Rp90.000, biaya kembali Rp36.600), stok FG-CAB-01 cabang 2 naik 2, total faktur API turun sebesar kredit dan halaman faktur menampilkan angka API, jurnal 4150/1200/1300/5100 seimbang |
| Saldo persediaan = nilai lapisan FIFO; debit = kredit | Lulus, dengan catatan | `verify18.cjs`: akun 1300 + 1310 = lapisan FIFO + barang dalam perjalanan, tepat sampai sen (Rp203.739.626,00 = Rp202.384.538,24 + Rp1.355.087,76). Lapisan FIFO saja tidak sama dengan akun persediaan selama TR-2026-000002 masih dalam perjalanan: backend mengeluarkan stok dari lapisan cabang asal saat dikirim tetapi tetap membukukannya di akun persediaan. Neraca saldo debit = kredit (Rp2.265.065.000,00) dan halaman Laporan menampilkan angka API |
| Setiap peran: menu, dasbor, aksi; API tanpa izin ditolak | Lulus | `run.cjs peran`: 7 peran; HTTP 403 untuk gudang membuat pesanan penjualan dan penjualan menutup periode |
| Diam di 5 halaman utama | Lulus | `run.cjs diam`: 0 animasi; `final-shots.cjs`: 0 animasi di 31 halaman admin |
| Mode Dikurangi, Minimal, `prefers-reduced-motion` | Lulus | `run.cjs minimal`; `modes-check.cjs` (14/14): `prefers-reduced-motion` sistem memasang `data-motion=reduced`; laci di mode Dikurangi hanya opacity ≤220 ms, di mode Penuh memakai transform; Minimal tanpa animasi; M1 di mode Dikurangi tanpa animasi dan langsung "Seimbang" (pembanding Penuh: 4 benang `stroke-dashoffset` 280 ms); semua mode diam setelah 1,2 detik |
| Hanya keyboard: masuk, buat retur, jejak tinta, tutup laci | Lulus | `verify18.cjs` sebagai Admin, hanya Tab, Enter, Ctrl+K, dan Escape: masuk, palet membuka pesanan, Buat retur, isi jumlah, Enter, dialog memfokuskan "Kembali" lebih dulu, "Ya, simpan retur", "Lihat jejak tinta" di struk, laci M1, Escape, fokus kembali ke tombol pemicu; `run.cjs papan` |
| Zoom 200%, forced-colors, prefers-contrast more | Lulus, dengan catatan | Screenshot `v3-zoom200-*`, `v3-forced-*`, `v3-kontras-*`; tanpa luberan horizontal. Forced-colors diuji lewat emulasi media Chromium; palet Kontras Tinggi Windows yang sebenarnya belum diuji |
| Anggaran performa | Lulus | Tabel di atas |
| Katalog tidak ada di build produksi | Lulus | `grep Katalog dist/assets/*.js`: tidak ada |
| Pratinjau cetak faktur dan laporan bersih | Lulus | `v3-cetak-*` |
| Tidak ada warna, durasi, atau z-index literal di luar token | Lulus, dengan pengecualian | Pencarian kode: tidak ada hex, `rgb(` angka, durasi, atau z-index literal di `src` selain `tokens.css` dan Katalog. Pengecualian: `<meta name="theme-color">` di `index.html` (HTML tidak bisa membaca variabel CSS; nilainya sama dengan `--canvas`) dan jeda 10 menit pemeriksa jam Cahaya meja di `lib/preferences.ts` (penjadwalan, bukan gerak) |
| Database live tidak tersentuh | Lulus | Bagian "Bukti database uji" |
| Semua server dimatikan | Lulus | Bagian "PID proses" |

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

Uji e2e dan `verify18.cjs` menambah pesanan dan retur baru di database uji setiap kali dijalankan. Uji tutup buku membuka kembali periode yang ditutupnya.

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

Tidak ada rute detail untuk: jurnal, produk, pengiriman, penerimaan barang, retur, transfer, perakitan. (v3 menambah rute frontend detail retur `/sales/returns/:id` dan detail jurnal `/accounting/journals/:id` dari data daftar yang sudah ada, plus `/__katalog` hanya di mode pengembangan.)

### Peran × permission (`backend/app/seed.py`)

READ = dashboard.read, master.read, accounting.read, procurement.read, inventory.read, sales.read.

| Peran | Permission | Arketipe dasbor v3 |
|---|---|---|
| Admin | semua 16 | pimpinan (karena users.manage) |
| Finance Manager | READ + accounting.post, accounting.close, payments.write, master.write | keuangan |
| Procurement Manager | READ + procurement.write, procurement.approve, inventory.write | pengadaan |
| Procurement Staff | READ + procurement.write | pengadaan |
| Warehouse Staff | READ + inventory.write | gudang |
| Sales Staff | READ + sales.write | penjualan |
| Auditor | READ + audit.read | auditor |

16 permission: dashboard.read, master.read, master.write, accounting.read, accounting.post, accounting.close, procurement.read, procurement.write, procurement.approve, inventory.read, inventory.write, sales.read, sales.write, payments.write, users.manage, audit.read.

### Komponen v2 (`frontend/src`, sebelum v3)

- `components/`: DataTable, Form (FormGroup, Field, ActionBar, Impact), Key/KeyLink (tuts), Layers (Drawer, ConfirmDialog), Menu, NoAccess, Palette, ScrollX, Shell (sidebar, bilah atas, tab bawah), Stepper, Tabs (FolderTabs), Toaster, TrendChart + Sparkline (SVG sendiri), WarehousePlan (isometrik), `ui.tsx` (Status, InkFilter, Stamp, PageHeader, SectionTitle, Illustration, ErrorNote, EmptyState, Skeleton, DetailSkeleton), glyphs (45 glyph).
- `pages/`: Admin, Dashboard, Details, Forms, Lists, Login, MasterData, Periods, Reports, Returns.
- `lib/`: actions, api (token di sessionStorage), format, labels, nav (NAV, permFor, mobileTabs), session, types.

Struktur v3 ada di `docs/design-system.md` bagian Komponen.

## Peta data momen khas

Endpoint diperiksa dari kode router dan respons nyata API uji.

| Momen | Endpoint | Field tersedia | Status | Hasil v3 |
|---|---|---|---|---|
| M1 Jejak Tinta | `GET /accounting/journals` (paged ≤200; filter cabang, tanggal, source_type) | id, entry_no, entry_date, description, source_type, status, reverses_id, total, lines[account_code, account_name, debit, credit, memo]. **Tidak ada** `source_id`, tidak ada GET per id/nomor. Kaitan dokumen→jurnal eksplisit hanya: `journal_entry_id` di daftar retur dan di respons POST (kirim, retur, terima, bayar, opname). Faktur tidak membawa id jurnal. | Sebagian | Jalan terbatas: detail retur, laci dari struk M2, detail jurnal, tab Jurnal. Tanpa tebakan dari deskripsi (D1). |
| M2 Upacara Posting | Respons POST | Kirim: do_no, cogs_total, journal_entry_id. Retur: return_no, total_amount, cogs_reversed, journal_entry_id, items. Terima: grn_no, total_value, journal_entry_id. Tagih pemasok: invoice_no, total_amount, due_date. Faktur: data faktur (tanpa jurnal). Bayar: payment_no, journal_entry_id, invoice (paid, outstanding). Transfer: transfer_no, status, items. Perakitan: wo_no, total_cost, unit_cost. Konfirmasi/ajukan/setujui: status. | Tersedia (isi bervariasi per aksi) | Jalan. Struk hanya memuat field di atas. |
| M3 Angka Mekanis | Data yang sudah tampil | Total form dari pratinjau frontend yang sudah ada; KPI dari `/dashboard/overview`. Biaya stok kembali retur **tidak** tersedia sebelum diposting. | Tersedia | Jalan. |
| M4 Transisi Ruang | – (frontend) | – | Tersedia | Jalan, dengan cadangan crossfade. |
| M5 Rantai Dokumen | `/sales/returns`, `/procurement/goods-receipts`, `/invoices/{id}`, `/sales/orders/{id}` | Retur → so_id, invoice_id. GRN → po_id. Detail faktur → `reference` (nomor SO/PO, tanpa id) + daftar pembayaran. **Tidak ada** endpoint pengiriman (DO). | Sebagian | Jalan terbatas: hanya relasi id; langkah tanpa id tampil putus-putus. |
| M6 Lapisan FIFO | `/inventory/balances`, `/inventory/movements`, `/inventory/valuation` | Hanya nilai total. Lapisan (`stock_batches`) **tidak diekspos**. | Tidak ada | **Ditunda** (D2). |
| M7 Akun T | `GET /accounting/reports/general-ledger` | account, opening_balance, closing_balance, lines[date, entry_no, description, memo, debit, credit, balance] | Tersedia | Jalan. |
| M8 Gudang Hidup | `/inventory/balances`, `/master/products`, `/master/branches` | on_hand, reserved, available, reorder_point, is_low, value; kategori produk. Tidak ada rak/bin. | Tersedia | Jalan, per kategori dengan keterangan "bukan denah fisik". |
| M9 Peta Aliran Barang | – | Tidak ada endpoint laporan aliran per tahap. | Tidak ada | **Ditunda** (D2). |
| M10 Tutup Buku | `/accounting/periods`, `POST …/close`, `…/reopen`, `/accounting/journals?start&end`, `/accounting/reports/income-statement` | Status periode; jumlah jurnal periode; laba periode. | Tersedia | Jalan (hanya diuji di DB uji). |
| M11 Membuka Buku | – (frontend) | – | Tersedia | Jalan, sekali per sesi browser. |

Dasbor (bagian 11):

| Widget | Sumber | Status |
|---|---|---|
| Persetujuan tertunda | `/procurement/purchase-orders?status=PENDING_APPROVAL` | Tersedia |
| KPI pendapatan, margin, laba, kas, persediaan, piutang | `/dashboard/overview` kpis | Tersedia |
| Grafik 6 bulan (pendapatan, HPP, laba kotor, kas) | `/dashboard/overview` trend | Tersedia |
| Piutang menurut umur | `/accounting/reports/aging/AR` | Tersedia |
| Produk teratas | Hanya `sales_by_category` | Tidak ada per produk |
| Penerimaan dan pengiriman hari ini | GRN tersedia; pengiriman tidak punya endpoint | Sebagian |
| Transfer menunggu, stok kritis | `/inventory/transfers`, `/inventory/balances?low_only=true` | Tersedia |
| Ringkasan pengguna dan aktivitas | `/system/users`, `/audit-logs`, `recent_activity` | Tersedia |
| Titik tugas sidebar | Hitungan dari daftar | Tersedia |

## Keputusan terbuka (Gerbang 5, untuk pengguna)

1. Merge `ui-v3` ke `main`? `ui-v3` bercabang dari `tactile-ui` (v2) yang juga belum di-merge, jadi merge `ui-v3` sekaligus membawa v2. Pilihan: (a) merge `ui-v3` ke `main`; (b) tinjau dulu di aplikasi dari cabang `ui-v3`; (c) tetap terpisah.
2. Izinkan devDependency `@playwright/test@1.65.0`? Jika ya, `tests/e2e/run.cjs` bisa dipindah ke runner resmi dengan laporan dan snapshot visual.
3. Peluang audit gerak yang terbuka: kerjakan atau biarkan.
4. M6 dan M9 butuh endpoint backend baru (lapisan FIFO, laporan aliran per tahap), di luar lingkup brief UI.
5. Aturan izin backend: kirim dan retur hanya bisa dilakukan peran yang punya `sales.write` dan `inventory.write`; di data demo hanya Admin. Bila Sales atau Gudang memang harus bisa, itu perubahan peran atau backend, bukan UI.
6. "Nilai persediaan FIFO" di dasbor (lapisan di gudang) berbeda dari saldo akun persediaan di Neraca selama ada transfer dalam perjalanan. Angka keduanya benar menurut API; bila membingungkan pengguna, bisa ditambah keterangan "tidak termasuk barang dalam perjalanan" (perubahan teks UI) atau akun barang dalam perjalanan (perubahan backend).

## PID proses

| Proses | PID | Status |
|---|---|---|
| Backend uji 8010 (sesi 1) | 13952 | Dimatikan |
| `vite preview` 5180 (sesi 1) | 6532 | Dimatikan |
| Backend uji 8010 (sesi lanjutan) | 17328 | Dimatikan |
| `vite preview` 5180 (sesi lanjutan) | 7220 | Dimatikan |

Tidak ada proses sesi ini yang masih berjalan. Setelah dimatikan, tidak ada yang mendengarkan di port 8010, 5180, 8000, atau 5173 (server milik pengguna di 8000 dan 5173 memang tidak berjalan dan tidak disentuh).

## Catatan teknis untuk sesi berikutnya

- Cabang kerja `ui-v3`; titik pemulihan tag `pre-ui-v3`.
- Pakai alat edit file, jangan penggantian teks massal (brief 2).
- File CSS per rute (`styles/*.css`, `components/signature/*.css`, `pages/Periods.css`) tidak berada di `@layer` Tailwind, jadi aturannya mengalahkan utilitas Tailwind dengan spesifisitas sama. Jangan gabungkan kelas dari file itu dengan utilitas yang mengatur properti yang sama (misalnya `display` dan `md:hidden`); atur variannya di file CSS itu sendiri. Periksa dengan `css-clash.cjs`.
- Daftar yang memuat data asinkron harus menyediakan ruang selama memuat (kerangka setinggi isi), kalau tidak CLS naik.
- `DataTable` dipakai `Lists` dan `MasterData`.
- Kartu stok tidak punya tanggal bisnis; jangan menampilkan `created_at` sebagai tanggal transaksi tanpa label.
- Rute Katalog dan storyboard hanya jalan di dev server (`/__katalog` dikeluarkan dari build produksi).
