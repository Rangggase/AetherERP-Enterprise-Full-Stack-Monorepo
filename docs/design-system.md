# Sistem desain UI v3: "Buku Besar Hidup"

Dokumen ini adalah aturan tampilan dan interaksi `frontend/` setelah UI v3. Sistem ini melanjutkan "meja kerja akuntan" (`design-system-meja-kerja.md`) dan menambahkan bahasa visual yang memperlihatkan aturan aplikasi sendiri: pencatatan berpasangan, rantai dokumen, stok per gudang, dan siklus periode. Brief lengkapnya ada di `docs/brief-ui-v3.md`; keputusan dan kemajuan ada di `docs/progress-ui-v3.md`.

Ruang lingkup: hanya lapisan tampilan. Backend, kontrak API, logika bisnis, 16 izin, dan aturan validasi tidak berubah.

## Sumber kebenaran

Setiap nilai punya satu tempat:

- **Token**: `frontend/src/design/tokens.css` untuk warna, kedalaman, gerak, lapisan, dan tipografi
- **Font**: `frontend/src/design/fonts.css` dan berkas woff2 di `frontend/public/fonts/`
- **Katalog**: rute `/__katalog` (hanya mode pengembangan) menampilkan semua token, glyph, komponen, dan momen khas dengan data contoh
- **Kontras**: `npm run contrast` (`frontend/scripts/contrast-check.mjs`) membaca token dan gagal bila ada pasangan di bawah batas

Komponen tidak boleh memuat warna, durasi, atau z-index literal. JS membaca token gerak saat dipakai lewat `motion/tokens.ts`, jadi mode Dikurangi dan Minimal langsung berlaku.

## Prinsip

1. **Data adalah bahan visual.** Tidak ada visual tanpa data API. Ukuran, jumlah, dan warna selalu berarti sesuatu.
2. **Gerak menjelaskan sebab dan akibat.** Gerak yang tidak menjawab "apa yang baru saja terjadi" dihapus.
3. **Diam saat bekerja.** Saat pengguna tidak berinteraksi, `document.getAnimations()` kosong.
4. **Satu momen dalam satu waktu** di satu layar.
5. **Benda nyata, perilaku nyata.** Kertas tidak memantul, cap tidak berputar, tinta tidak bersinar.
6. **Selalu bisa dilewati.** Animasi tidak menahan input atau navigasi; interaksi baru menyelesaikan animasi yang berjalan.
7. **Setara tanpa gerak.** Dengan gerak dikurangi, informasinya tetap utuh.
8. **Ketidaksempurnaan yang konsisten.** Kemiringan cap berasal dari hash nomor dokumen: berbeda antar-dokumen, tetap untuk dokumen yang sama.

Setiap visual lolos uji akal sehat: membawa data nyata, mempercepat pemahaman, nyaman dilihat seratus kali, punya versi teks atau tabel, dan lancar di laptop kantor biasa.

## Warna

| Token | Nilai | Pemakaian |
|---|---|---|
| `--canvas` | #F4F1EA | Latar aplikasi |
| `--paper` | #FBFAF6 | Lembar, panel |
| `--ink` | #1E1B18 | Teks utama |
| `--ink-muted` | #6B645A | Teks sekunder |
| `--rule` | #DCD6CA | Garis pemisah (dekoratif) |
| `--rule-strong` | #867E71 | Batas kontrol isian |
| `--accent` | #7A2E2A | Aksi utama, penanda, cincin fokus |
| `--accent-deep` | #5A201D | Tepi bawah tombol utama |
| `--highlight` | #EFEBE2 | Sorot hover dan aktif, latar isian |
| `--ok` | #3F6B4E | Sukses |
| `--warn` | #B07A1E | Peringatan: hanya isian, garis, dan ikon |
| `--warn-ink` | #8A5D12 | Teks peringatan |
| `--bad` | #9E3B32 | Galat |
| `--info` | #3D5A73 | Informasi |
| `--pencil` | #CFC8BB | Kerangka garis pensil (dekoratif) |

Tinta data: marun, biru tinta, hijau lumut, oker, grafit (`--data-1` sampai `--data-5`), paling banyak empat dalam satu visual. Validator skill dataviz menandai palet ini terlalu redup untuk pita kecerahannya; karena itu setiap grafik wajib punya penanda kedua (garis putus untuk seri pembanding, label langsung, legenda, tabel).

Skala umur (`--age-1` sampai `--age-5`) disiapkan untuk lapisan FIFO; label di atasnya memakai `pickInk()` (`design/contrast.ts`). Lencana status memakai tint 7–8% agar teks tetap ≥4,5:1 di atas latar bertekstur.

## Material, kedalaman, tekstur

- **Lembar**: `--paper`, garis 1 px `--rule`, sudut 8 px (panel) atau 4 px (kontrol), serat kertas 2%
- **Kedalaman**: `--elev-1` lembar, `--elev-2` terangkat, `--elev-3` laci, dialog, menu; bayangan tidak dianimasikan, efek terangkat memudarkan pseudo-elemen pembawa bayangan
- **Cap**: garis ganda, huruf kapital 600 dengan jarak 0,08em, rotasi −5° sampai −2° dari hash, tekstur tinta lewat masker SVG statis (`--ink-mask`)
- **Struk**: lebar 320 px, tepi bawah bergerigi, angka dalam Plex Mono, pemisah putus-putus
- **Kartu indeks**: garis atas 2 px `--accent` dan garis samar tiap 24 px (palet perintah)
- **Kertas buku besar**: garis margin 1 px `--accent` 25% (`.ledger-paper`), subtotal satu garis di atas, total garis ganda di bawah
- **Tekstur**: SVG `feTurbulence` statis sebagai data-URI, 3,5% di kanvas dan 2% di lembar, campuran `multiply`; mati saat cetak, `forced-colors`, `prefers-contrast: more`, dan bila preferensi Tekstur dimatikan

## Tipografi

- **Source Serif 4** (variabel, `opsz` dan `wght`): judul halaman, nomor dokumen di kepala, angka utama
- **IBM Plex Sans** (variabel): antarmuka, label, tabel
- **IBM Plex Mono** 400 dan 500: nomor dokumen, SKU, kode akun, angka di struk

Font di-host sendiri (subset Latin), dua berkas terpenting di-`preload`, `font-display: swap`, dan font cadangan memakai `size-adjust` serta `ascent-override` dari metrik asli. Skala: 40 (angka utama), 30, 26 (KPI), 24, 18, 15, 14, 13, 12. Angka data memakai `tabular-nums lining-nums` dan rata kanan. Uang, tanggal, dan angka memakai `Intl` dengan lokal `id-ID`. Kode memakai `translate="no"`.

## Lapisan

Dasar 0, menempel 10, rel 20, bilah atas 30, laci 40, dialog 50, palet dan tooltip 60, struk 70. Tailwind hanya mengenal nama token ini (`z-topbar`, `z-receipt`, dan seterusnya).

Urutan di dalam satu komponen yang punya konteks tumpuk sendiri juga memakai token: `--z-local-raise` (1), `--z-local-sheet` (−1), `--z-local-shadow` (−2), `--z-local-stack` (−3). Token lokal ini tidak pernah dipakai untuk menaikkan elemen di atas kerangka aplikasi.

## Gerak

| Token | Nilai | Pemakaian |
|---|---|---|
| `--dur-press` | 90 ms | Tekan tombol |
| `--dur-fast` | 140 ms | Hover, fokus, chip |
| `--dur-base` | 220 ms | Laci, dialog, tab, centang sukses |
| `--dur-roll` | 260 ms | Angka mekanis per digit |
| `--dur-print` | 260 ms | Struk keluar |
| `--dur-room` | 300 ms (ponsel 220 ms) | Transisi ruang |
| `--dur-draw` | 600 ms | Grafik tergambar, tutup buku |
| `--dur-open-book` | 700 ms | Membuka buku setelah masuk |
| `--budget-ink` | 1.200 ms | Batas total jejak tinta |

Easing: `--ease-out` untuk masuk, `--ease-in` untuk keluar, `--ease-inout` untuk garis yang tergambar. Pegas (`--spring-stamp`) hanya untuk cap yang mendarat; `motion/spring.ts` mengubahnya menjadi easing `linear()`. Kontrol utilitas (sakelar, radio) tidak memantul.

Aturan:

- Keluar sekitar 70% durasi masuk dan lebih halus (laci masuk 24 px, keluar 12 px)
- Aksi papan ketik tidak dianimasikan: tab dengan panah, palet dari Ctrl+K, menutup lapisan dengan Escape
- Hanya `transform`, `opacity`, `stroke-dashoffset`, warna, dan `clip-path` elemen kecil yang dianimasikan
- Keadaan akhir selalu gaya statis elemen; animasi tidak memakai `fill: forwards`, jadi tidak tertinggal di `getAnimations()`
- Tidak ada animasi berulang selain indikator memuat (garis tinta, kerangka pensil, bilah di tombol)

Preferensi Gerak di Akun saya: Ikuti sistem operasi (bawaan), Penuh, Dikurangi, Minimal. Atribut `data-motion` di `<html>` dipasang sebelum render pertama oleh skrip kecil di `index.html`.

## Momen khas

| Momen | Status | Tempat | Data |
|---|---|---|---|
| M1 Jejak Tinta | Jalan terbatas | Detail jurnal, detail retur, laci dari struk, tab Jurnal | Baris jurnal; tautan hanya lewat `journal_entry_id` |
| M2 Upacara Posting | Jalan | Semua aksi posting yang sudah ada | Respons API aksi |
| M3 Angka Mekanis | Jalan | Bilah ringkasan form, KPI, kartu tugas | Nilai yang sudah tampil |
| M4 Transisi Ruang | Jalan | Daftar ke detail, kartu tugas, laci, rantai, kembali | View Transition API, cadangan crossfade |
| M5 Rantai Dokumen | Jalan terbatas | Kepala detail, laci | Hanya relasi id (`so_id`, `invoice_id`, `po_id`) |
| M6 Lapisan FIFO | Ditunda | Laci produk menjelaskan alasannya | API tidak mengekspos lapisan |
| M7 Akun T | Jalan | Laporan, tab Buku besar | Buku besar per akun |
| M8 Gudang Hidup | Jalan | Level stok, dasbor gudang | Saldo stok dan kategori produk |
| M9 Peta Aliran | Ditunda | Dasbor menjelaskan alasannya | Tidak ada laporan aliran per tahap |
| M10 Tutup Buku | Jalan | Periode fiskal | Periode, jumlah jurnal, laba periode |
| M11 Membuka Buku | Jalan | Setelah masuk, sekali per sesi | Tanpa data |
| O2 Cahaya meja | Tersedia, bawaan mati | Akun saya | Jam perangkat |
| O3 Suara dan getar | Tersedia, bawaan mati | Akun saya | Tanpa data |

Saklar per momen ada di `config/features.ts`. Relasi dokumen tidak pernah ditebak dari nomor, tanggal, jumlah, atau teks keterangan jurnal (keputusan D1).

## Komponen

- **Tombol** (`components/Key.tsx`): tuts mesin kasir; keadaan memuat, centang sukses, dan galat mengikuti status permintaan
- **Isian** (`Field.tsx`, `Form.tsx`): batas `--rule-strong`, isian uang dengan awalan "Rp", stepper fisik, galat di tempat, bilah ringkasan berbentuk struk dengan M3
- **Tabel** (`DataTable.tsx`, `styles/tables.css`): kepala menempel dengan bayangan saat digulir, kode dalam Plex Mono, hover lewat CSS, kepadatan dari preferensi, nomor dokumen dengan M4
- **Laci dan dialog** (`Layers.tsx`): `<dialog>` modal, latar inert, rantai mini di kepala, "Buka lengkap" dengan M4; di ponsel menjadi lembar bawah
- **Struk** (`Toaster.tsx`): paling banyak tiga, bertahan saat navigasi, hilang setelah 6 detik kecuali di-hover atau difokus
- **Cap dan lencana** (`ui.tsx`): cap untuk dokumen, lencana glyph dan kata untuk tabel
- **Palet perintah** (`Palette.tsx`): Ctrl+K, kelompok Halaman, Dokumen, Aksi, Produk, Pihak, pratinjau dokumen, riwayat terakhir
- **Keadaan kosong, galat, tanpa izin, 404**: ilustrasi isometrik satu warna (`Illustration` di `ui.tsx`)
- **Grafik tinta** (`TrendChart.tsx`): garis 2 px, ujung pena, garis bantu titik, label langsung, tabel alternatif

## Kerangka dan halaman

Sidebar dengan pita penanda yang sedikit memanjang saat berpindah, grup bisa dilipat, dan titik tugas. Bilah atas memuat remah (nomor dokumen dalam Plex Mono), cabang, cap periode hari ini, pencarian, dan menu pengguna. Halaman daftar memakai satu pola: kepala dengan jumlah data, chip status, tabel, laci pratinjau. Detail dokumen tampil sebagai kertas dengan kop, cap, rantai, dan kolom fakta di kanan. Dasbor memilih arketipe dari izin: pimpinan, keuangan, pengadaan, gudang, penjualan, auditor.

Aksi hanya tampil bila pengguna punya semua izin yang diminta backend untuk aksi itu. Kirim pesanan dan retur penjualan butuh `sales.write` dan `inventory.write` (`DELIVER_PERMS`, `RETURN_PERMS` di `lib/nav.ts`); tutup tahun butuh `accounting.close` dan `accounting.post`. Daftar "Perlu tindakan" di dasbor mengikuti aturan yang sama.

Ponsel di bawah 640 px memakai bilah tab bawah, tombol utama menempel di bawah, laci sebagai lembar bawah, palet layar penuh, dan target sentuh minimal 44 px.

## Aksesibilitas

- Kontras: 301 pasangan lolos di empat nada (siang, pagi, sore, malam) dan di atas latar bertekstur
- Fokus pindah ke h1 halaman baru; posisi gulir kembali saat navigasi mundur
- Setiap visual punya teks atau tabel setara; SVG momen memakai `aria-hidden` dengan ringkasan yang dibacakan
- `forced-colors`: batas bayangan menjadi garis, masker cap mati; `prefers-contrast: more`: garis lebih tegas, tekstur mati
- Cetak: tanpa bayangan, tekstur, dan animasi; faktur dan laporan terbaca hitam-putih

## Performa

| Ukuran | Batas | Hasil (build produksi) |
|---|---|---|
| JS awal rute Dasbor (gzip) | ≤148,06 kB (v2 + 15%) | 101,56 kB |
| CSS awal (gzip) | ≤13,55 kB (v2 + 20%) | 12,59 kB |
| LCP Dasbor / daftar | ≤2,0 s | 116 ms / 132 ms |
| CLS Dasbor / daftar | ≤0,05 | 0,001 / 0,001 |
| INP | ≤200 ms | 16 ms / 40 ms |
| Tugas panjang selama M1 dan M4 | 0 di atas 50 ms | 0 |
| Animasi saat diam | 0 | 0 |

Halaman selain Dasbor dan Masuk dimuat per rute, dan dimuat lebih dulu saat tautannya disorot atau difokus (`lib/routes.ts`).

## Pengujian

- `npm run typecheck`, `npm run build`, `npm run contrast`
- `node tests/e2e/run.cjs`: peran dan izin, alur retur dengan angka API, upacara posting, mode Minimal, transisi ruang dan cadangannya, papan ketik, diam, tutup buku, membuka buku
- `node tests/e2e/storyboard.cjs`: bingkai dan rekaman momen khas (`docs/storyboard/`)

## Bahasa

Teks antarmuka dalam bahasa Indonesia. Tombol memakai kata kerja dan objek ("Simpan retur", "Posting jurnal"). Kepala halaman berisi fakta, bukan sapaan. Pesan galat menyebut apa yang terjadi dan apa yang bisa dilakukan. Pesan dari server tampil apa adanya.
