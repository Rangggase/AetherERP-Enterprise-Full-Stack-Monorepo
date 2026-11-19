# Brief UI v3 AetherERP: "Buku Besar Hidup"

- **Untuk**: Claude Code
- **Simpan di**: `docs/brief-ui-v3.md`
- **Dasar**: UI v2 "meja kerja akuntan" (cabang `tactile-ui`), palet "kertas dan tinta", `docs/design-system.md`
- **Bahasa kerja dan laporan**: Bahasa Indonesia

## Daftar isi

0. Cara memakai brief ini
1. Tujuan dan ukuran keberhasilan
2. Batasan mutlak
3. Protokol lingkungan dan data
4. Konsep dan prinsip
5. Fondasi visual
6. Sistem gerak
7. Momen khas
8. Komponen
9. Kerangka aplikasi
10. Halaman
11. Dasbor per peran
12. Ponsel dan tablet
13. Aksesibilitas
14. Performa
15. Arsitektur kode
16. Pengujian
17. Fase dan gerbang persetujuan
18. Verifikasi akhir
19. Format laporan dan catatan kemajuan
20. Larangan

---

## 0. Cara memakai brief ini

1. Baca seluruh brief sebelum mengubah apa pun.
2. Kerjakan fase di bagian 17 secara berurutan. Di setiap **GERBANG**, berhenti, laporkan sesuai bagian 19, lalu tunggu persetujuan saya.
3. Di awal setiap fase, baca ulang bagian brief yang dirujuk fase itu. Di akhir fase, perbarui `docs/progress-ui-v3.md`.
4. Jika sesi terputus, lanjutkan dari `docs/progress-ui-v3.md`, bukan dari ingatan.
5. Urutan prioritas jika ada pertentangan: (1) batasan di bagian 2 dan 3, (2) brief ini, (3) `docs/design-system.md`, (4) saran skill. Setelah Gerbang 2 disetujui, perbarui `docs/design-system.md` agar sesuai brief ini.
6. Jika ada yang tidak jelas, atau tidak bisa dikerjakan tanpa melanggar batasan, tanyakan. Jangan menebak untuk hal yang menyentuh data, logika bisnis, keamanan, atau dependensi.
7. Gunakan daftar tugas (todo) untuk melacak pekerjaan dalam satu fase.

Skill yang dipakai dan perannya:

| Skill | Peran di v3 |
|---|---|
| frontend-design, design-taste-frontend, ui-ux-pro-max, design-system | Keputusan visual, komposisi, sistem desain. design-taste-frontend condong ke situs pemasaran: ambil prinsip kualitasnya, bukan gaya pemasarannya. |
| design-motion-principles | Merancang gerak (mode create) dan mengaudit gerak (mode audit) |
| vercel-react-view-transitions | Transisi ruang (M4) |
| vercel-composition-patterns, vercel-react-best-practices | Struktur komponen dan performa React |
| dataviz | Semua grafik, palet tinta data, validasi warna |
| web-design-guidelines | Audit aksesibilitas dan UX |
| writing-guidelines | Teks UI dan laporan |
| playwright-cli | Screenshot, rekaman interaksi, pemeriksaan di browser |
| awesome-design-md | Rujukan pola tata letak saja, bukan identitas merek |

---

## 1. Tujuan dan ukuran keberhasilan

v3 membawa v2 ke bahasa visual khas bernama **Buku Besar Hidup**. Keunikannya tidak datang dari efek dekoratif, tetapi dari memvisualkan aturan aplikasi ini sendiri: pencatatan berpasangan (double-entry), lapisan FIFO, rantai dokumen, dan siklus periode akuntansi. Visual seperti ini tidak bisa diambil dari template, karena bahannya adalah data dan logika AetherERP.

Semua yang sudah disetujui di v2 tetap berlaku, kecuali diubah secara tegas di brief ini.

Ukuran keberhasilan:

1. Orang yang baru pertama memakai aplikasi bisa menjelaskan apa yang terjadi ketika retur diposting (kredit mengurangi piutang, barang kembali ke stok dengan biaya asalnya, jurnal yang terbentuk) hanya dengan melihat layar.
2. Setiap visual dibangun dari data nyata API dan punya versi teks atau tabel yang setara.
3. Tidak ada regresi fungsi, angka, permission, atau alur (bagian 18).
4. Anggaran aksesibilitas dan performa terpenuhi (bagian 13 dan 14).
5. Nyaman dipakai 8 jam sehari: saat pengguna tidak berinteraksi, tidak ada yang bergerak.

---

## 2. Batasan mutlak

**Boleh diubah**

- Seluruh lapisan tampilan di `frontend/`: tata letak, komponen, interaksi, animasi, gaya, aset font dan SVG.
- `docs/`: sistem desain, storyboard, screenshot, catatan kemajuan.
- Konfigurasi pengembangan frontend yang diperlukan untuk lingkungan uji (3.3), dengan perilaku bawaan tetap sama.

**Tidak boleh diubah**

- Backend, endpoint, kontrak API, skema, migrasi.
- Logika bisnis: retur, FIFO, jurnal, klasifikasi akun, periode.
- Daftar 16 permission dan pemetaan peran.
- Aturan validasi dan arti data.
- Fungsi setiap tombol dan aksi. Semua yang bisa dilakukan pengguna sekarang harus tetap bisa, boleh dengan cara yang lebih baik.

**Aturan kerja**

- Jika sebuah visual butuh data yang tidak disediakan API, jangan membuat data itu dan jangan menambah endpoint. Laporkan dan tunda visual itu.
- Dependensi baru hanya dengan persetujuan. Kandidat yang boleh diusulkan, dengan ukuran (gzip) dan alasan:
  - `motion`: gerak berbasis pegas dan animasi tata letak.
  - `three` dan `@react-three/fiber`: hanya untuk momen opsional O1, dimuat malas.
  - `@playwright/test`: devDependency untuk pengujian.
- Edit file dengan alat edit file. Jangan memakai penggantian teks massal lewat skrip (PowerShell `-replace`, `sed`). Pada v2, cara itu merusak `App.tsx` dan `index.css`. Setelah perubahan besar, jalankan typecheck dan `git diff --stat` untuk mendeteksi kerusakan.
- Laporan harus jujur. Yang belum diuji ditulis "belum diuji". Jangan menulis "berhasil" tanpa bukti.

---

## 3. Protokol lingkungan dan data

Bagian ini wajib. Pada v2, pengujian sempat menulis ke database live karena database yang dipakai server tidak diperiksa lebih dulu.

### 3.1 Git

- Jalankan `git status`, `git branch -a`, dan `git log --oneline -15`. Laporkan apakah pekerjaan v2 sudah di-commit dan di cabang mana.
- Jika ada perubahan yang belum di-commit, berhenti dan tanya.
- Buat tag `pre-ui-v3` di titik awal, lalu cabang `ui-v3` dari kondisi v2 terakhir yang sudah disetujui.
- Commit lokal boleh dibuat di akhir setiap fase yang lolos Definisi Selesai, sebagai titik pemulihan. Ikuti aturan commit di `CLAUDE.md`. Jangan push dan jangan merge ke `main`.

### 3.2 Database uji

- Jangan pernah menjalankan backend terhadap database live (`aether_erp.db`) atau database lain yang tidak dibuat untuk tugas ini.
- Buat database uji baru, misalnya `ui-v3.db`, di folder kerja sementara di luar repo. Arahkan koneksi backend ke file itu lewat variabel lingkungan sebelum menjalankan perintah apa pun. Cari nama variabelnya di konfigurasi backend. Jangan ubah `.env`.
- Isi dengan `python -m app.cli seed` (skema, data referensi, data demo).
- Bukti wajib sebelum lanjut:
  1. Tampilkan nilai koneksi yang dipakai proses server.
  2. Catat jumlah baris audit di database live dengan koneksi baca saja (`mode=ro`).
  3. Lakukan satu tulis percobaan lewat API, misalnya login.
  4. Pastikan baris audit bertambah di `ui-v3.db` dan tidak bertambah di database live (dibaca dengan koneksi baca saja).
- Catat bukti ini di catatan kemajuan. Jika ada yang tidak terbukti, jangan lanjut.

### 3.3 Server dan port

- Backend uji di port **8010**, frontend uji di port **5180**. Jangan memakai 8000 dan 5173, karena itu port saya.
- Cek dulu apakah port sudah dipakai proses lain.
- Jika proxy Vite terkunci ke `localhost:8000`, tambahkan dukungan variabel lingkungan untuk alamat proxy, dengan bawaan tetap `localhost:8000`.
- Catat PID setiap proses yang kamu jalankan. Matikan semuanya di akhir sesi. Laporkan proses yang tidak bisa dimatikan.

### 3.4 Data demo

- Periksa apakah data dari `app.cli seed` cukup untuk semua momen khas: transaksi minimal 6 bulan (pembelian, penerimaan, penjualan, pengiriman, faktur, pembayaran sebagian, retur, transfer antar gudang, perakitan), lebih dari satu cabang, stok kritis, piutang jatuh tempo, dan minimal satu periode tertutup.
- Jika kurang, tambahkan lewat API yang ada, sehingga semua aturan bisnis tetap berlaku. Simpan skripnya di folder kerja sementara, bukan di repo, kecuali saya setujui.
- Jika aturan API tidak mengizinkan transaksi di bulan sebelumnya, jangan menulis langsung ke database dan jangan mengubah backend. Laporkan dan tanyakan.
- Data contoh buatan frontend (mock) hanya boleh ada di rute Katalog (bagian 15) dan harus berlabel "contoh".

### 3.5 Akhir sesi

Matikan semua server yang kamu jalankan, perbarui catatan kemajuan, lalu laporkan.

---

## 4. Konsep dan prinsip

### 4.1 Metafora

Aplikasi adalah meja kerja akuntan yang hidup: lembar kertas, tinta, cap, struk, map berkas, kartu indeks, buku besar, dan mesin hitung mekanis. "Hidup" berarti benda-benda ini bereaksi terhadap peristiwa bisnis nyata. Dimensi keempatnya adalah waktu dan sebab-akibat: layar menunjukkan apa yang baru saja terjadi dan apa akibatnya.

### 4.2 Prinsip

1. **Data adalah bahan visual.** Tidak ada visual tanpa data. Ukuran, jumlah, dan warna selalu berarti sesuatu.
2. **Gerak menjelaskan sebab-akibat.** Setiap gerak menjawab "apa yang baru saja terjadi". Gerak yang tidak menjawab apa pun dihapus.
3. **Diam saat bekerja.** Saat pengguna tidak berinteraksi, tidak ada yang bergerak.
4. **Satu momen dalam satu waktu.** Paling banyak satu momen khas aktif di satu layar.
5. **Benda nyata, perilaku nyata.** Kertas tidak memantul, cap tidak berputar, tinta tidak bersinar. Ikuti sifat benda yang ditiru, dengan ukuran yang tertahan.
6. **Selalu bisa dilewati.** Setiap animasi bisa dilewati (klik atau Escape) dan tidak menahan input atau navigasi.
7. **Setara tanpa gerak.** Dengan gerak dikurangi, informasi tetap utuh.
8. **Ketidaksempurnaan yang konsisten.** Sentuhan manusiawi, misalnya kemiringan cap, ditentukan dari data seperti id dokumen. Hasilnya bervariasi antar-dokumen, tetapi selalu sama untuk dokumen yang sama.

### 4.3 Uji akal sehat

Setiap visual dan animasi harus lolos lima pertanyaan ini. Jika ada satu jawaban "tidak", perbaiki atau hapus.

1. Apakah visual ini membawa data nyata?
2. Apakah pengguna jadi lebih cepat paham?
3. Apakah masih nyaman setelah dilihat seratus kali?
4. Apakah ada versi statis atau teks yang setara?
5. Apakah tetap lancar di laptop kantor biasa?

---

## 5. Fondasi visual

### 5.1 Warna

Token dasar tetap dari v2, ditambah tiga token baru.

| Token | Nilai | Pemakaian |
|---|---|---|
| `--canvas` | #F4F1EA | Latar aplikasi |
| `--paper` | #FBFAF6 | Lembar, panel |
| `--ink` | #1E1B18 | Teks utama |
| `--ink-muted` | #6B645A | Teks sekunder |
| `--rule` | #DCD6CA | Garis pemisah (dekoratif) |
| `--rule-strong` (baru) | #867E71 | Batas kontrol isian: input, select, checkbox, radio, rel toggle |
| `--accent` | #7A2E2A | Aksi utama, penanda |
| `--accent-deep` | #5A201D | Tepi bawah tombol, keadaan ditekan |
| `--highlight` | #EFEBE2 | Sorot hover dan aktif |
| `--ok` | #3F6B4E | Sukses |
| `--warn` | #B07A1E | Peringatan: hanya isian, garis, dan ikon |
| `--warn-ink` (baru) | #8A5D12 | Teks peringatan |
| `--bad` | #9E3B32 | Galat |
| `--info` | #3D5A73 | Informasi |
| `--pencil` (baru) | #CFC8BB | Kerangka "garis pensil" (dekoratif) |

Catatan kontras (dihitung dari nilai token; hitung ulang dengan skrip di bagian 16):

- `--warn` sebagai teks di atas `--paper` hanya sekitar 3,6:1. Teks peringatan wajib memakai `--warn-ink` (sekitar 5,5:1).
- `--rule` di atas `--paper` hanya sekitar 1,4:1. Batas kontrol isian wajib memakai `--rule-strong` (sekitar 3,8:1 di `--paper`, dan minimal 3,2:1 di `--canvas`, `--highlight`, serta latar bertekstur).

**Tinta data** (grafik dan visual kategori; maksimal 4 dalam satu visual; validasi dengan skill dataviz): marun #7A2E2A, biru tinta #3D5A73, hijau lumut #3F6B4E, oker #B07A1E, grafit #6B645A. Semuanya minimal 3:1 sebagai garis di atas `--paper`.

**Skala umur** (lapisan FIFO, dari tertua ke termuda): #5A201D, #7A2E2A, #A35A4F, #C98E83, #E6C7BF. Warna label di atas setiap isian dipilih otomatis oleh fungsi `pickInk(bg)`: `--paper` atau `--ink`, mana yang kontrasnya lebih tinggi, minimal 4,5:1.

Aturan: tidak ada warna di luar daftar ini; tidak ada nilai warna literal di komponen; tidak ada gradien warna-warni; bayangan tidak berwarna.

### 5.2 Material

- **Lembar**: `--paper`, garis 1 px `--rule`, sudut 8 px (panel) atau 4 px (kontrol), serat kertas halus (5.4).
- **Tinta**: garis data 1,5–2 px dengan ujung membulat. "Ujung pena" berupa titik 4 px di ujung garis grafik, menampilkan nilai terakhir.
- **Cap**: bingkai garis ganda, huruf kapital IBM Plex Sans 600 dengan jarak huruf 0,08em, warna status, rotasi deterministik antara −5° dan −2° dari hash id dokumen, tekstur tinta lewat mask SVG statis.
- **Struk**: lebar 320 px, tepi bawah bergerigi (`clip-path`), angka dan kode dalam IBM Plex Mono, pemisah garis putus-putus.
- **Kartu indeks**: garis atas 2 px `--accent` dan garis horizontal samar setiap 24 px. Dipakai untuk palet perintah dan catatan.
- **Kertas buku besar**: garis baris samar; garis margin vertikal 1 px `--accent` dengan opasitas 25% di sisi kiri tabel laporan; subtotal dengan satu garis di atasnya; total dengan garis ganda di bawahnya.
- **Map berkas**: tab aktif menyatu dengan panelnya.
- **Pita pembatas**: penanda item aktif di sidebar.

### 5.3 Kedalaman dan cahaya

Satu sumber cahaya dari atas untuk semua elemen. Bayangan dua lapis (sekitar dan langsung) supaya terasa nyata.

| Token | Nilai | Pemakaian |
|---|---|---|
| `--elev-1` | `0 1px 0 rgba(30,27,24,.06)` | Lembar |
| `--elev-2` | `0 1px 1px rgba(30,27,24,.05), 0 8px 18px -8px rgba(30,27,24,.20)` | Terangkat, hover |
| `--elev-3` | `0 2px 4px rgba(30,27,24,.06), 0 20px 48px -16px rgba(30,27,24,.32)` | Laci, dialog, menu |
| `--inset` | `inset 0 1px 2px rgba(30,27,24,.10)` | Input, area cekung |
| `--stack-1`, `--stack-2` | Lembar belakang bergeser 3 px dan 6 px | Tumpukan kertas |

Bayangan tidak dianimasikan langsung. Untuk efek terangkat, animasikan opasitas pseudo-elemen yang membawa bayangan `--elev-2`.

### 5.4 Tekstur

- Serat kertas dari SVG `feTurbulence` (fractalNoise, baseFrequency sekitar 0,9, numOctaves 2) sebagai gambar latar data-URI statis.
- Opasitas 3–4% di `--canvas` dan 2% di `--paper`, dengan mode campur `multiply`.
- Tidak pernah dianimasikan. Dimatikan saat cetak, saat `forced-colors`, saat `prefers-contrast: more`, dan bila preferensi "Tekstur kertas" dimatikan.
- Ukur kontras teks dengan tekstur aktif (anggap latar 4% lebih gelap).

### 5.5 Tipografi

- **Source Serif 4** (variabel, sumbu opsz dan wght): judul halaman, nama dokumen, angka utama. `font-optical-sizing: auto`. Berat 500 dan 600.
- **IBM Plex Sans**: UI, label, tabel. Berat 400, 500, 600.
- **IBM Plex Mono** (baru): kode, yaitu nomor dokumen, SKU, kode akun, dan angka di struk. Berat 400 dan 500.
- Angka data: `font-variant-numeric: tabular-nums lining-nums`, rata kanan.
- Skala tetap dari v2 (30/24/18/15/14/13/12; KPI 26), ditambah ukuran tampilan 40 untuk angka utama dasbor.
- Pemuatan font: woff2, subset Latin, di-host sendiri di `frontend/public/fonts`, `preload` untuk dua file terpenting, `font-display: swap`, dan metric override (`size-adjust`, `ascent-override`) pada font cadangan supaya tata letak tidak bergeser. Pastikan font termuat lewat `document.fonts.check`.
- Format: uang dengan `Intl.NumberFormat('id-ID')` ("Rp1.234.500"), tanggal "19 Nov 2026", waktu relatif ("2 jam lalu") dengan tooltip tanggal lengkap.

### 5.6 Grid dan tata letak

- Kelipatan 8 px, langkah setengah 4 px. Tinggi baris teks kelipatan 4.
- Desktop 12 kolom dengan jarak 24 px. Halaman baca (detail dokumen) maksimal 1.100 px. Tabel boleh selebar konten.
- Komposisi asimetris yang beralasan: dasbor 8/4, detail dokumen dengan kolom fakta di kanan.
- Pisahkan kelompok dengan ruang kosong yang disengaja, bukan dengan garis dan kotak di mana-mana.

### 5.7 Glyph

Lanjutkan set v2 (grid 24, stroke 1,5 px, ujung membulat). Tambahkan: jurnal/tinta, timbangan (seimbang), lapisan (FIFO), klip (rantai dokumen), buku tertutup, buku terbuka, gembok, struk, cap, rak, aliran. Semua masuk katalog glyph.

### 5.8 Lapisan (z-index)

Token: dasar 0, menempel 10, rel 20, bilah atas 30, laci 40, dialog 50, palet perintah 60, struk 70. Tidak ada nilai z-index literal di komponen.

### 5.9 Penulisan UI

- Tombol memakai kata kerja dan objek: "Simpan retur", "Posting faktur", bukan "Kirim" atau "OK".
- Kepala halaman berisi fakta, bukan sapaan: "Kamis, 19 November · Periode November terbuka · 4 hal perlu tindakan".
- Angka selalu dengan konteks: "3 faktur · Rp12,4 jt".
- Pesan galat menjelaskan apa yang terjadi dan apa yang bisa dilakukan. Tanpa "Ups" dan tanpa tanda seru.
- Ikuti glosarium v2. Pesan dari server tetap apa adanya.

---

## 6. Sistem gerak

### 6.1 Token

| Token | Nilai |
|---|---|
| `--dur-press` | 90 ms |
| `--dur-fast` | 140 ms |
| `--dur-base` | 220 ms |
| `--dur-slow` | 360 ms |
| `--dur-draw` | 600 ms |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` |
| `--ease-inout` | `cubic-bezier(.65,0,.35,1)` |
| `--ease-spring` | `cubic-bezier(.3,1.35,.5,1)` (lontaran kecil) |

Jika `motion` disetujui, titik awal pegas: tekan {stiffness 520, damping 34}, laci {stiffness 320, damping 32}, cap {stiffness 600, damping 26}. Sesuaikan setelah dilihat.

### 6.2 Anggaran gerak

| Peristiwa | Batas | Contoh |
|---|---|---|
| Diam | 0 | Tidak ada yang bergerak |
| Hover dan fokus | ≤140 ms, geser ≤2 px | Baris terangkat 1 px |
| Tekan | ≤90 ms | Tuts turun |
| Perubahan nilai | ≤260 ms | Angka mekanis |
| Navigasi | ≤300 ms | Transisi ruang |
| Lapisan muncul | ≤220 ms | Laci, dialog |
| Peristiwa bisnis | ≤1.600 ms total, bisa dilewati, tidak menahan input | Upacara posting, tutup buku |
| Masuk pertama | ≤700 ms, sekali per sesi | Membuka buku |

### 6.3 Koreografi

- Urutan mengikuti sebab lalu akibat.
- Jeda bertahap 30 ms, maksimal 6 elemen. Sisanya muncul bersamaan.
- Keluar lebih cepat dari masuk (sekitar 70% durasi masuk).
- Interaksi baru membatalkan animasi yang sedang berjalan dan langsung menampilkan keadaan akhir.
- Tidak ada animasi berulang terus-menerus, kecuali indikator memuat.

### 6.4 Preferensi gerak

Setelan "Gerak" di Akun Saya. Bawaannya mengikuti sistem operasi (`prefers-reduced-motion` → Dikurangi).

- **Penuh**: semua gerak sesuai brief.
- **Dikurangi**: tanpa gerak posisi, skala, rotasi, getar, dan paralaks. Momen khas langsung tampil di keadaan akhir dengan fade 120 ms. Angka mekanis menjadi crossfade.
- **Minimal**: tanpa animasi, kecuali indikator memuat.

### 6.5 Teknik

- Hanya animasikan `transform`, `opacity`, `stroke-dashoffset`, warna, dan `clip-path` pada elemen kecil. Jangan animasikan width, height, top, left, filter, atau box-shadow.
- `will-change` hanya selama animasi berjalan.
- Gunakan Web Animations API atau CSS. Batalkan animasi saat komponen dilepas.
- Jangan membaca tata letak di tengah animasi. Jangan memakai `setInterval` untuk animasi.

---

## 7. Momen khas

Setiap momen punya saklar fitur (bagian 15) sehingga bisa dimatikan tanpa menghapus kode. Status setiap momen (jalan, terbatas, atau ditunda) ditentukan oleh peta data di Fase 0.

### M1. Jejak Tinta (pencatatan berpasangan)

- **Tujuan**: memperlihatkan bahwa setiap transaksi tercatat di dua sisi dan seimbang.
- **Tempat**: tab Jurnal di detail dokumen, laci jurnal dari struk posting, halaman detail jurnal.
- **Data**: baris jurnal dari API (kode akun, nama akun, debit, kredit, keterangan) yang terkait dengan dokumen. Jika API tidak mengaitkan jurnal dengan dokumen, tampilkan hanya di detail jurnal.
- **Tata letak**: kolom kiri berisi kartu akun Debit, tengah berisi lembar dokumen (jenis dan nomor dalam Plex Mono), kolom kanan berisi kartu akun Kredit. Kartu akun memuat kode, nama, dan jumlah.
- **Perilaku**: garis tinta (kurva SVG) tergambar dari dokumen ke setiap kartu akun, debit dulu lalu kredit, masing-masing 280 ms dengan jeda 60 ms. Tebal garis 1,5–5 px sebanding jumlah relatif dalam jurnal itu, selalu disertai label jumlah. Setelah itu glyph timbangan bergerak dari miring ke datar (240 ms), lalu tampil "Debit Rp X = Kredit Rp X · Seimbang". Total ≤1.200 ms. Diputar sekali per tampilan, dengan tombol kecil "Putar ulang".
- **Kejujuran**: jika total debit dan kredit tidak sama, timbangan tidak boleh dibuat datar. Tampilkan galat "Tidak seimbang, selisih Rp X".
- **Gerak dikurangi**: langsung keadaan akhir.
- **Aksesibilitas**: SVG `aria-hidden`; ringkasan teks dibacakan; tabel debit/kredit selalu tersedia.
- **Ponsel**: debit di atas, dokumen di tengah, kredit di bawah, garis vertikal.
- **Kriteria terima**: akun dan jumlah identik dengan respons API untuk minimal tiga jenis dokumen. Contoh retur (aturan Sprint 9): debit 4150 Retur Penjualan dan kredit 1200 Piutang sebesar nilai retur; debit Persediaan dan kredit 5100 HPP sebesar biaya yang dikembalikan.

### M2. Upacara Posting

- **Tujuan**: memberi kepastian bahwa aksi berhasil dan memperlihatkan akibatnya.
- **Pemicu**: respons sukses API untuk aksi yang membuat atau memposting dokumen (retur, faktur, pengiriman, penerimaan, pembayaran, transfer, perakitan, dan aksi sejenis yang sudah ada).
- **Urutan**:
  1. Tombol: memuat, lalu centang tergambar (v2).
  2. Struk keluar dari kanan atas, berisi ringkasan akibat dari respons API: nomor dokumen, jumlah, perubahan stok, nomor jurnal.
  3. Jika pengguna berada di detail dokumen, cap status mendarat.
  4. Tautan "Lihat jejak tinta" di struk membuka laci M1.
- **Batas**: total ≤1.600 ms, tidak menahan navigasi atau input. Struk tetap tampil saat pindah halaman.
- **Kejujuran**: isi struk hanya dari data yang dikembalikan API. Jangan menghitung sendiri yang tidak dikembalikan.
- **Galat**: tidak ada struk. Tombol menampilkan keadaan gagal (v2) dan pesan galat.
- **Kriteria terima**: posting retur menampilkan kredit, perubahan stok, dan jurnal sesuai respons API.

### M3. Angka Mekanis

- **Tujuan**: memperlihatkan bahwa angka berubah dan ke arah mana.
- **Tempat**: total di bilah ringkasan form (retur, pesanan penjualan, pesanan pembelian), KPI saat cabang, periode, atau filter berubah, dan jumlah pada kartu "Perlu tindakan".
- **Perilaku**: setiap digit bergulir vertikal seperti mesin hitung mekanis, 260 ms, digit paling kanan mulai lebih dulu dengan jeda 18 ms per digit. Arah gulir mengikuti naik atau turun. "Rp" dan pemisah ribuan tidak bergulir. Hanya saat nilai berubah, tidak saat pertama tampil.
- **Masukan cepat**: debounce 120 ms; nilai baru membatalkan gulir sebelumnya.
- **Gerak dikurangi**: crossfade 120 ms. Minimal: langsung berganti.
- **Aksesibilitas**: digit yang bergulir `aria-hidden`; nilai akhir dibacakan lewat `aria-live="polite"` setelah debounce.
- **Kriteria terima**: tidak ada pergeseran tata letak; nilai akhir selalu benar walaupun diubah cepat berkali-kali.

### M4. Transisi Ruang

- **Tujuan**: menjaga orientasi dengan memperlihatkan dari mana halaman baru berasal.
- **Pasangan**:
  - (a) Baris daftar → detail dokumen: lembar baris dan nomor dokumen berubah bentuk menjadi kepala dokumen.
  - (b) Kartu "Perlu tindakan" → daftar terfilter.
  - (c) Laci pratinjau → halaman penuh ("Buka lengkap").
  - (d) Lembar mini Rantai Dokumen → dokumen terkait.
  - (e) Kembali: arah sebaliknya.
- **Teknik**: View Transition API bawaan browser dengan deteksi fitur. `view-transition-name` unik per id dokumen, dipasang hanya pada elemen sumber dan tujuan selama transisi. Jangan memakai fitur React eksperimental tanpa persetujuan. Cadangan: crossfade 120 ms.
- **Batas**: ≤300 ms, tidak menahan input.
- **Setelah transisi**: fokus pindah ke h1 halaman baru; posisi gulir dikembalikan saat kembali.
- **Kriteria terima**: berjalan di Chrome dan Edge; jalur cadangan diuji dengan memaksa deteksi fitur bernilai salah.

### M5. Rantai Dokumen

- **Tujuan**: menunjukkan posisi dokumen dalam alur bisnis dan dokumen terkaitnya.
- **Tempat**: kepala detail dokumen; versi mini di laci pratinjau.
- **Data**: hanya relasi yang dikembalikan API, misalnya pesanan penjualan → pengiriman → faktur → retur/pembayaran, atau pesanan pembelian → penerimaan. Jangan menebak relasi dari nomor atau tanggal.
- **Visual**: lembar mini (glyph jenis, nomor dalam Plex Mono, tanggal, cap mini) yang dihubungkan benang tinta. Dokumen saat ini terangkat dengan pita penanda. Langkah berikutnya yang belum ada tampil sebagai garis putus "Belum dibuat", dengan aksi pembuatnya hanya jika aksi itu sudah ada dan diizinkan permission. Beberapa dokumen pada satu langkah tampil bertumpuk dengan angka.
- **Ponsel**: gulir horizontal dengan petunjuk.
- **Kriteria terima**: relasi sesuai API untuk pesanan penjualan yang sudah punya pengiriman, faktur, dan retur.

### M6. Lapisan FIFO

- **Tujuan**: menjelaskan nilai persediaan dan urutan keluarnya barang.
- **Tempat**: detail produk atau kartu stok; laci produk dari Level stok.
- **Data**: lapisan FIFO per produk (tanggal masuk, sumber, sisa kuantitas, biaya per unit, nilai). Jika tidak ada endpoint, momen ini ditunda.
- **Visual**: tumpukan lempeng 2,5D. Lapisan tertua di bawah, dengan tanda "Keluar lebih dulu". Tinggi lempeng sebanding sisa kuantitas, dengan tinggi minimum agar label terbaca. Warna dari skala umur (5.1). Label: tanggal, kuantitas, biaya per unit, nilai. Lapisan hasil retur diberi glyph retur dan catatan "Biaya mengikuti lapisan asal" (aturan Sprint 9). Jumlah nilai di atas tumpukan = nilai persediaan produk.
- **Interaksi**: hover atau fokus menyorot lapisan dan detailnya. Di kartu stok, hover pada baris pengiriman menyorot lapisan yang terpakai, hanya jika API menyediakan pemetaan itu. Perubahan di sesi ini: lapisan baru turun dan menumpuk (220 ms), lapisan yang habis terangkat lalu memudar.
- **Cadangan**: tabel lapisan.
- **Kriteria terima**: jumlah nilai lapisan = nilai persediaan produk dari API.

### M7. Akun T

- **Tujuan**: tampilan akuntansi klasik yang langsung dipahami.
- **Tempat**: Buku besar, per akun, dengan sakelar "Buku besar | Akun T".
- **Data**: entri buku besar yang sudah ada.
- **Visual**: huruf T besar dari garis tinta. Debit di kiri, kredit di kanan, saldo awal di atas, saldo akhir di bawah dengan garis ganda. Setiap entri bisa diklik untuk membuka laci jurnal (M1).
- **Gerak**: hanya saat berganti tampilan (garis T tergambar 300 ms).
- **Kriteria terima**: saldo akhir sama dengan tampilan buku besar.

### M8. Gudang Hidup

- **Tujuan**: gambaran stok seketika per gudang.
- **Tempat**: Level stok (desktop dan tablet); versi mini di dasbor gudang.
- **Data**: stok per produk per gudang dan titik pesan ulang.
- **Kejujuran**: jika sistem tidak menyimpan lokasi rak atau bin, jangan membuat denah fisik. Susun rak sebagai kelompok logis (misalnya per kategori) dan tulis jelas "Disusun per kategori, bukan denah fisik".
- **Visual** (SVG isometrik, lanjutan v2): rak dengan kedalaman. Setiap produk berupa kotak dengan tingkat isi = stok ÷ (2 × titik pesan ulang), maksimal penuh. Jika titik pesan ulang tidak ada, pakai stok relatif terhadap stok terbesar di kelompok itu, dan jelaskan skalanya di legenda. Warna status + glyph + SKU (Plex Mono).
- **Interaksi**: hover atau fokus mengangkat kotak 2 px dan menampilkan slip; klik membuka laci produk (dengan M6); filter status meredupkan yang lain menjadi 30%; tombol panah berpindah antar kotak, Enter membuka laci. Sakelar "Denah | Daftar". Ponsel hanya daftar.
- **Kriteria terima**: jumlah kotak dan statusnya sesuai API; filter benar.

### M9. Peta Aliran Barang

- **Tujuan**: memperlihatkan pergerakan barang dalam satu periode.
- **Tempat**: dasbor pimpinan dan admin.
- **Data**: total kuantitas atau nilai per tahap dari endpoint laporan yang ada. Jika tidak ada, tunda.
- **Visual**: aliran linear Pemasok → Penerimaan → Gudang (per cabang) → Pengiriman → Pelanggan. Lebar pita sebanding nilai. Retur tampil sebagai pita oker yang kembali di bawah. Dibuat dengan SVG sendiri, tanpa pustaka Sankey. Pita tergambar sekali saat pertama terlihat (600 ms). Tanpa partikel dan tanpa gerak berulang.
- **Interaksi**: hover menampilkan angka; tombol "Lihat sebagai tabel".
- **Kriteria terima**: angka sama dengan laporan.

### M10. Tutup Buku

- **Tujuan**: menandai peristiwa terpenting dalam akuntansi secara jelas.
- **Tempat**: halaman Periode, pada aksi tutup periode yang sudah ada.
- **Sebelum**: dialog berbahaya yang menjelaskan akibatnya, dengan ringkasan dari data yang ada (misalnya jumlah jurnal dan laba periode).
- **Sesudah respons sukses**: sampul buku periode menutup (rotateY, perspektif 1.200 px, 600 ms), cap "DITUTUP" dengan gembok muncul, dan cap periode di bilah atas ikut berganti.
- **Keamanan**: hanya diuji di database uji. Tidak pernah di database live.
- **Gerak dikurangi**: langsung keadaan akhir.

### M11. Membuka Buku

- **Tempat**: setelah login berhasil.
- **Perilaku**: lembar form login menyatu menjadi sampul buku, lalu buku terbuka menjadi kerangka aplikasi (View Transition, ≤700 ms). Sekali per sesi browser. Jika tidak didukung, langsung masuk.
- **Batas**: data dasbor mulai dimuat bersamaan, tidak menunggu animasi.

### Momen opsional (hanya dengan persetujuan di Gerbang 4)

- **O1. Gudang 3D**: `three` dan `@react-three/fiber` dimuat malas hanya di Level stok. `frameloop="demand"`, berhenti saat tab tersembunyi, orbit terbatas (±25°), preset kamera, cadangan ke SVG M8 bila WebGL tidak tersedia. Potongan kode ≤250 KB gzip. Alternatif keyboard dan daftar tetap ada.
- **O2. Cahaya Meja**: nada kertas bergeser sangat halus mengikuti jam (pagi sedikit lebih dingin, sore lebih hangat, malam lebih hangat dan sedikit redup). Bawaan mati, dengan setelan di Akun Saya. Keempat varian diuji kontras. Transisi antar-varian 60 detik. Mati saat cetak.
- **O3. Suara dan getar**: bunyi sintesis Web Audio (tanpa file audio) untuk cap, struk, dan tutup buku, dengan volume rendah. Getar 10 ms saat cap di ponsel yang mendukung. Bawaan mati. Tidak pernah berbunyi saat halaman dimuat.

Momen tambahan boleh diusulkan di storyboard (Fase 1) jika lolos uji akal sehat. Jangan langsung diimplementasikan.

---

## 8. Komponen

Ini perubahan dari v2. Komponen yang tidak disebut tetap seperti v2.

- **Tombol**: tetap v2 (tuts mesin kasir). Tambah varian tuts kecil untuk stepper. Keadaan berhasil terhubung ke M2.
- **Input**: batas `--rule-strong`. Fokus mengangkat bidang: inset hilang, garis `--accent`, cincin 2 px. Input uang: awalan "Rp" statis, angka rata kanan, diformat saat blur. Input kode memakai Plex Mono.
- **Tabel lembar buku besar**:
  - Header menempel, dengan bayangan hanya saat digulir.
  - Garis baris samar. Kolom kode dalam Plex Mono. Kolom uang rata kanan.
  - Hover mengangkat baris 1 px dengan pita kiri `--accent`, cukup lewat CSS tanpa render ulang React.
  - Baris terpilih bersorot dan bercentang. Bilah aksi massal muncul dari bawah.
  - Kepadatan Nyaman/Rapat.
  - Klik baris membuka laci, dengan transisi ruang M4.
  - Jika tabel menampilkan total, total memakai garis ganda.
- **Laci**: lembar `--elev-3` dari kanan. Latar `inert`. `scrollbar-gutter: stable` agar halaman tidak bergeser. Kepala berisi Rantai Dokumen mini. Tombol "Buka lengkap" (M4). Fokus kembali ke pemicu saat ditutup.
- **Dialog**: tetap v2. Dialog berbahaya menampilkan ringkasan dampak dengan angka.
- **Struk (toast)**: spesifikasi 5.2. Keluar seperti dicetak (`clip-path` terbuka dari atas, 260 ms). Maksimal 3 bertumpuk. `aria-live`. Tetap tampil saat navigasi, bisa ditutup, dan hilang sendiri setelah 6 detik kecuali sedang di-hover atau difokus.
- **Cap**: spesifikasi 5.2. Animasi hanya saat status berubah di sesi ini (M2).
- **Lencana status di tabel**: tetap v2 (glyph + kata).
- **Tab map berkas**: tetap v2, ditambah jumlah (misalnya "Jurnal 4").
- **Kartu tumpukan**: jumlah lembar mengikuti jumlah item (1, 2, atau 3+). Angka memakai M3.
- **KPI**: angka utama Source Serif 40, sparkline tinta 6 bulan, perubahan dengan glyph dan kata ("naik 12% dari Oktober"), M3 saat berubah. Nilai nol yang benar tetap ditampilkan, disertai konteks ("Belum ada penjualan bulan ini").
- **Grafik tinta** (skill dataviz): garis 2 px; ujung pena dengan nilai terakhir; garis bantu titik-titik tipis; label langsung pada garis; isi area maksimal 6%; tergambar sekali saat pertama terlihat; hover menampilkan garis bidik dan slip; anotasi hanya jika dihitung dari data; tombol "Lihat sebagai tabel"; tanpa data tampil keadaan kosong.
- **Kerangka "garis pensil"**: batang tipis `--pencil` dengan panjang bervariasi (deterministik), denyut opasitas lembut 1,2 detik, statis saat gerak dikurangi. Tidak ada spinner.
- **Garis tinta pemuatan**: garis 2 px `--accent` di atas area konten, muncul hanya jika pemuatan lebih dari 200 ms.
- **Tooltip**: slip kertas kecil `--elev-2`, muncul setelah 400 ms dan saat fokus, ditutup dengan Escape.
- **Keadaan kosong, galat, tanpa izin, 404**: set ilustrasi isometrik garis satu warna `--ink-muted`, 1,25 px, sudut 30°, sekitar 120 px: rak kosong, map kosong, struk kosong, buku tertutup, kaca pembesar (pencarian tanpa hasil), kertas sobek (galat), gembok (tanpa izin). Satu kalimat dan satu aksi.
- **Palet perintah (kartu indeks)**: Ctrl+K. Garis atas `--accent` dan garis samar. Hasil dikelompokkan (Halaman, Dokumen, Aksi, Produk) dengan glyph. Pratinjau dokumen di sisi kanan pada desktop. Riwayat terakhir. Navigasi panah dan Enter. Tombol "/" memfokuskan pencarian halaman.
- **Preferensi tampilan** (di Akun Saya): Gerak (Penuh/Dikurangi/Minimal), Kepadatan (Nyaman/Rapat), Tekstur kertas (nyala/mati). Cahaya meja dan Suara hanya jika O2/O3 disetujui. Disimpan per perangkat di `localStorage`, dengan `try/catch` dan nilai bawaan yang aman.

---

## 9. Kerangka aplikasi

- **Sidebar**: tetap v2 (mode lebar dan rel, glyph, pita pembatas). Pita bergerak dengan sedikit "tarikan": memanjang 15% saat berpindah, lalu kembali. Titik tugas pada modul yang punya pekerjaan tertunda, jika datanya ada. Grup dilipat tanpa animasi tinggi.
- **Bilah atas**: breadcrumb (nomor dokumen dalam Plex Mono), chip cabang, cap periode ("Periode Nov 2026 · Terbuka" hijau, "Ditutup" grafit dengan gembok), kolom cari yang membuka palet perintah, menu pengguna dengan inisial timbul.
- **Kepala halaman**: judul Source Serif, satu kalimat fakta, satu aksi utama di kanan.
- **Rute Katalog** (khusus pengembangan): lihat bagian 15.

---

## 10. Halaman

- **Login**: dua kolom. Kiri: form di atas lembar kertas. Kanan: ilustrasi isometrik garis (buku besar terbuka, cap, gulungan struk, rak). Paralaks halus mengikuti kursor maksimal 6 px, mati saat gerak dikurangi. Login berhasil memicu M11. Login gagal: lembar bergetar halus dan pesan galat tampil. Ada indikator Caps Lock. Ponsel: ilustrasi kecil di atas form.
- **Dasbor**: bagian 11.
- **Halaman daftar** (pesanan penjualan, pesanan pembelian, pengiriman, penerimaan, faktur, retur, produk, pemasok, pelanggan, transfer, perakitan, saran pesan ulang, dan lainnya): satu pola untuk semua. Kepala halaman dengan jumlah data dan satu aksi utama, bilah filter berbentuk chip, tabel lembar buku besar, laci pratinjau, dan M4.
- **Detail dokumen**: dokumen tampil seperti kertas asli: kop (nama usaha dari pengaturan), jenis dan nomor dokumen, tanggal, pihak terkait, tabel item, total dengan garis ganda. Ada cap status, Rantai Dokumen (M5), dan tab map berkas (Item; Jurnal dengan M1; Riwayat sebagai linimasa titik tinta di margin). Aksi di kepala sesuai status dan permission.
- **Form** (retur, pesanan, penerimaan, transfer, perakitan, dan lainnya): bagian sebagai lembar bertumpuk dengan judul kecil, stepper fisik untuk kuantitas, validasi di tempat, dan bilah ringkasan menempel di bawah berbentuk struk. Bilah itu menampilkan pratinjau yang sudah dihitung aplikasi (misalnya kredit dan biaya stok kembali pada retur) dengan M3. Tombol kirim memicu M2.
- **Level stok**: M8 dengan sakelar Denah/Daftar.
- **Produk dan kartu stok**: M6. Kartu stok tampil sebagai buku besar dengan saldo berjalan dan glyph jenis gerakan (masuk, keluar, retur, transfer, perakitan).
- **Jurnal dan buku besar**: kertas buku besar; detail jurnal dengan M1; sakelar Akun T (M7).
- **Laporan keuangan** (laba rugi, neraca, neraca saldo, dan lainnya): kertas buku besar dengan garis margin. Subtotal dan total mengikuti konvensi akuntansi. Akun kontra (misalnya 4150) tampil mengurangi sesuai klasifikasinya. Klik baris akun membuka laci transaksi, atau tautan ke buku besar yang sudah difilter. Perpindahan periode menggeser halaman 12 px dengan rotateY 4° (220 ms).
- **Periode**: daftar periode sebagai deretan buku (terbuka atau tertutup), dengan M10.
- **Pengguna dan peran**: matriks peran × 16 permission yang jelas (hanya menampilkan data yang sudah ada); kartu pengguna dengan inisial timbul.
- **Akun Saya**: profil, kata sandi, preferensi tampilan.
- **Aktivitas/audit**: linimasa buku catatan dengan titik tinta di margin dan frasa Indonesia dari `lib/labels.ts`.
- **Cetak** (faktur, laporan): stylesheet cetak tanpa bayangan, tekstur, dan animasi. Tampil seperti dokumen kertas sungguhan dan tetap terbaca dalam hitam-putih.

---

## 11. Dasbor per peran

1. Baca daftar peran dan 16 permission dari kode. Buat tabel peran → permission → widget.
2. Widget tampil berdasarkan **permission**, bukan nama peran, supaya peran baru otomatis benar. Backend tetap menjadi penjaga akses yang sebenarnya.
3. Struktur:
   - Kepala kontekstual (5.9).
   - Baris 1: "Perlu tindakan", maksimal 4 kartu tumpukan.
   - Baris 2: grid 8/4. Kiri: visual utama peran. Kanan: satu KPI utama dan 2–3 KPI kecil.
   - Baris 3: aktivitas terbaru dan pintasan.
4. Arketipe (sesuaikan dengan peran yang benar-benar ada):
   - **Pimpinan**: persetujuan tertunda; M9; KPI laba kotor, pendapatan, dan margin; grafik penjualan dan laba 6 bulan; produk teratas.
   - **Keuangan**: piutang menurut umur (pita kertas 0–30, 31–60, 61–90, dan >90 hari, dengan angka); jurnal terbaru dengan M1 di laci; status periode; neraca saldo ringkas.
   - **Gudang**: penerimaan dan pengiriman hari ini (kartu tumpukan); stok kritis; M8 mini; transfer menunggu.
   - **Penjualan**: pesanan yang perlu dikirim atau difakturkan; pelanggan dengan piutang; retur terbaru.
   - **Admin**: ringkasan pengguna dan aktivitas, ditambah tampilan pimpinan.

---

## 12. Ponsel dan tablet

- Titik henti: ponsel <640 px, tablet 640–1.023 px, desktop ≥1.024 px. Uji di 390×844 dan 768×1024.
- Ponsel:
  - Bilah tab bawah berisi 4 modul utama menurut permission, ditambah "Lainnya" yang membuka lembar bawah.
  - Tombol utama menempel di bawah.
  - Laci menjadi lembar bawah dengan pegangan.
  - Palet perintah layar penuh.
- Momen khas di ponsel: M1 vertikal; M3 tetap; M4 lebih singkat (220 ms); M5 gulir horizontal; M6 vertikal; M8 menjadi daftar; M9 menjadi tabel ringkas; M10 dan M11 tetap.
- Target sentuh ≥44 px. Tidak ada informasi yang hanya muncul saat hover.

---

## 13. Aksesibilitas

- WCAG 2.2 AA. Kontras teks ≥4,5:1 (teks besar ≥3:1), batas komponen dan grafik ≥3:1, di semua keadaan dan dengan tekstur aktif.
- Warna tidak pernah menjadi satu-satunya penanda.
- Keyboard: semua bisa dijangkau dengan urutan logis; fokus tampak 2 px dan tidak tertutup bayangan; Escape menutup lapisan teratas; fokus kembali ke pemicu; latar `inert` saat laci atau dialog terbuka.
- Pembaca layar: landmark, satu h1 per halaman, `aria-live` untuk struk dan nilai akhir M3, ringkasan teks untuk setiap visual, tabel alternatif untuk setiap grafik dan momen khas.
- Gerak: 6.4 dan `prefers-reduced-motion`.
- Zoom dan teks 200% tanpa konten terpotong.
- `prefers-contrast: more`: garis lebih tegas, tekstur mati.
- `forced-colors: active` (mode kontras tinggi Windows): batas yang biasanya hanya berupa bayangan diganti garis, ikon memakai `currentColor`, cap tetap terbaca.
- `lang="id"`. Kode (SKU, nomor dokumen) tidak diterjemahkan.

---

## 14. Performa

Ukur di build produksi (`vite build` lalu `vite preview`), bukan dev server. Ukur sebelum (Fase 0) dan sesudah.

| Ukuran | Batas |
|---|---|
| JS awal rute Dasbor (gzip) | ≤ v2 + 15% |
| CSS (gzip) | ≤ v2 + 20% |
| Momen berat (M8, M9, O1) | Dimuat malas per rute |
| LCP lokal | ≤2,0 s |
| CLS | ≤0,05 |
| INP | ≤200 ms |
| Selama animasi | Tidak ada tugas panjang >50 ms |
| Saat diam | `document.getAnimations()` kosong |

- Ukur dengan DevTools atau `PerformanceObserver`. Jangan menambah pustaka hanya untuk mengukur.
- Tabel panjang memakai `content-visibility: auto`. Hover baris lewat CSS agar tidak memicu render ulang.

---

## 15. Arsitektur kode

Struktur yang disarankan. Sesuaikan dengan struktur yang ada, dan jelaskan jika berbeda.

```
frontend/src/
  design/        tokens.css (warna, kedalaman, gerak, tipografi, z-index), texture.ts, contrast.ts (pickInk)
  motion/        token gerak, usePreferensiGerak (sistem operasi + setelan), drawPath, rollDigits, viewTransition.ts
  components/
    ui/          Button, Field, Select, Checkbox, Toggle, Tabs, Drawer, Dialog, Struk, Cap, Badge, Table,
                 Skeleton, EmptyState, Tooltip, CommandPalette, Sheet
    signature/   InkThreads, PostingCeremony, MechanicalNumber, DocChain, FifoStack, TAccount,
                 WarehouseIso, GoodsFlow, LedgerBook
    glyphs/      (v2)
  config/features.ts     saklar per momen khas
  lib/preferences.ts     preferensi tampilan
```

Aturan:

- Satu sumber kebenaran untuk token. Tidak ada nilai warna, durasi, atau z-index literal di komponen. Buktikan dengan pencarian kode di laporan akhir.
- Komponen momen khas menerima data lewat props dan tidak memanggil API sendiri, supaya bisa ditampilkan di Katalog.
- Rapikan duplikasi pembuat kolom tabel (temuan v2: `Lists` dan `MasterData`).
- TypeScript strict, tanpa `any` baru. Animasi dibersihkan saat komponen dilepas.
- **Rute Katalog** `/__katalog`, hanya aktif saat `import.meta.env.DEV`. Isinya: semua token, glyph, komponen dalam semua keadaan, dan setiap momen khas dengan data contoh berlabel "contoh" serta tombol "Putar ulang". Pastikan rute ini tidak ada di build produksi.

---

## 16. Pengujian

**Wajib**

- `npm run typecheck`, `npm run build`, dan `pytest` di backend (tetap 44 lulus).
- `frontend/scripts/contrast-check.mjs` tanpa dependensi: membaca token, menghitung semua pasangan teks/latar dan batas/latar yang dipakai, dan gagal jika di bawah batas bagian 13.
- Laporan ukuran bundle, dibandingkan dengan baseline Fase 0.

**Usulan** (perlu persetujuan karena menambah devDependency `@playwright/test`), dijalankan terhadap database uji yang bisa di-reset:

1. Login setiap peran; menu dan dasbor sesuai permission.
2. Alur retur lengkap; angka sesuai respons API.
3. Upacara posting tidak menahan navigasi.
4. Mode gerak Minimal: `document.getAnimations()` kosong setelah interaksi selesai.
5. Jalur cadangan View Transition.
6. Keyboard: Ctrl+K, "/", Escape, Tab.
7. Snapshot visual halaman kunci dengan ambang kecil.

Jika tidak disetujui: skrip playwright-cli dan screenshot seperti v2.

---

## 17. Fase dan gerbang persetujuan

**Definisi Selesai (DS)** setiap fase: typecheck dan build lolos; pytest 44 lulus; skrip kontras lolos (mulai Fase 2); `git diff --stat` diperiksa untuk mendeteksi kerusakan file; screenshot fase disimpan; catatan kemajuan diperbarui; server dimatikan.

### Fase 0: Persiapan dan peta data (bagian 3, 11, 14)

- Git, database uji beserta buktinya, server, data demo.
- Baseline: screenshot semua halaman (1440 px dan 390 px) berawalan `v3-pre-`; ukuran bundle; LCP, CLS, dan INP untuk Dasbor dan daftar pesanan penjualan; jumlah animasi saat diam.
- Inventaris: rute, peran, 16 permission, komponen v2.
- **Peta data**: tabel momen khas → endpoint → field yang tersedia → status (tersedia, sebagian, tidak ada) → usulan (jalan, versi terbatas, tunda).
- **GERBANG 1.**

### Fase 1: Storyboard dan purwarupa (bagian 4–7)

- Storyboard setiap momen yang lolos peta data: 4–6 bingkai kunci, ditambah rekaman (video atau GIF) dengan playwright-cli, di `docs/storyboard/`.
- Purwarupa 4 layar, desktop dan ponsel: Dasbor (dua peran), detail faktur dengan M1, form retur dengan struk dan M3, dan Level stok dengan M8. Utamakan di rute Katalog, supaya purwarupa langsung menjadi komponen nyata. Jika terlalu berat untuk tahap ini, boleh HTML statis di `docs/prototypes/`.
- Usulan momen tambahan (dengan uji akal sehat) dan usulan dependensi (dengan ukuran dan alasan), jika ada.
- **GERBANG 2.**

### Fase 2: Fondasi (bagian 5, 6, 15)

Token, tekstur, tipografi (termasuk Plex Mono dan metric override), sistem gerak dan preferensi, saklar fitur, rute Katalog, skrip kontras. Perbarui `docs/design-system.md`. DS, lalu commit lokal.

### Fase 3: Komponen dan kerangka (bagian 8, 9)

DS, lalu commit lokal. **GERBANG 3**: saya melihat hasilnya di aplikasi.

### Fase 4: Gerak dan ruang (M2, M3, M4)

DS, ditambah: alur retur diklik lengkap; tidak ada animasi saat diam; jalur cadangan View Transition diuji. Commit lokal.

### Fase 5: Logika akuntansi yang terlihat (M1, M5, M7)

DS, ditambah: angka sama dengan API untuk minimal tiga jenis dokumen. Commit lokal.

### Fase 6: Persediaan dan aliran (M6, M8, M9)

DS, lalu commit lokal. **GERBANG 4**: termasuk keputusan momen opsional.

### Fase 7: Penyapuan halaman (bagian 10, 11, 12; M10, M11; cetak)

DS per halaman, lalu commit lokal.

### Fase 8: Opsional (O1, O2, O3)

Hanya yang disetujui di Gerbang 4. DS, lalu commit lokal.

### Fase 9: Pengerasan (bagian 13, 14, 16)

Audit dengan web-design-guidelines, design-motion-principles (mode audit), vercel-react-best-practices, vercel-composition-patterns, dan writing-guidelines. Perbaiki temuan. Ambil screenshot akhir berawalan `v3-` dan rekaman setiap momen khas. **GERBANG 5**: keputusan merge.

---

## 18. Verifikasi akhir

- [ ] Typecheck, build, dan pytest (44 lulus).
- [ ] Skrip kontras lolos untuk semua token dan semua keadaan.
- [ ] Alur retur di database uji: kredit, biaya restock, stok, total faktur, dan jurnal sama dengan respons API; M1 menampilkan pasangan akun sesuai aturan Sprint 9.
- [ ] Di database uji: saldo persediaan = nilai lapisan FIFO; total debit = total kredit.
- [ ] Setiap peran (minimal admin, keuangan, gudang, penjualan): menu, dasbor, dan aksi sesuai permission; permintaan API tanpa izin tetap ditolak backend.
- [ ] Diam: setelah halaman tenang 2 detik, `document.getAnimations()` kosong di 5 halaman utama.
- [ ] Mode gerak Dikurangi dan Minimal, serta `prefers-reduced-motion`.
- [ ] Hanya keyboard: login → buat retur → lihat jejak tinta → tutup laci.
- [ ] Zoom 200%, `forced-colors`, dan `prefers-contrast: more` (dengan screenshot).
- [ ] Anggaran performa (tabel sebelum dan sesudah).
- [ ] Rute Katalog tidak ada di build produksi.
- [ ] Pratinjau cetak faktur dan laporan bersih.
- [ ] Tidak ada nilai warna, durasi, atau z-index literal di luar token.
- [ ] Database live tidak tersentuh: waktu ubah file dan jumlah baris tidak berubah (dibaca dengan koneksi baca saja).
- [ ] Semua server yang dijalankan sudah dimatikan.

---

## 19. Format laporan dan catatan kemajuan

**Laporan setiap fase dan gerbang**

1. Ringkasan satu paragraf.
2. Yang selesai.
3. Bukti: perintah dan hasilnya, nama file screenshot dan rekaman.
4. Yang belum diuji atau tidak bisa diuji, ditulis eksplisit.
5. Penyimpangan dari brief beserta alasannya.
6. Keputusan untuk saya, sebagai pilihan bila memungkinkan.

**Laporan akhir** ditambah: tabel sebelum-sesudah, tabel performa, tabel kontras, status setiap momen khas (jalan, terbatas, atau ditunda, beserta alasannya), dan sisa temuan audit.

**`docs/progress-ui-v3.md`** berisi:

- Fase aktif dan status setiap fase.
- Keputusan saya beserta tanggalnya.
- Peta data.
- Cara menjalankan lingkungan uji (variabel, port, perintah).
- Bukti database uji.
- PID proses yang sedang berjalan.
- Catatan teknis untuk sesi berikutnya.

---

## 20. Larangan

**Visual**

- Glassmorphism dan blur latar, glow, neon, gradien mesh atau aurora, gumpalan (blob), bentuk 3D melayang sebagai hiasan.
- Partikel, konfeti, emoji, ilustrasi orang generik, animasi Lottie stok.
- Paralaks saat menggulir, kursor pengikut, sorotan yang mengikuti kursor.
- Hitung naik angka saat halaman dimuat.
- Deretan kartu seragam berbayang, lencana pil di mana-mana, sapaan generik, teks pemasaran.
- Tekstur kulit atau kayu, lebih dari satu momen khas sekaligus, animasi berulang tanpa sebab.

**Data**

- Data palsu di layar utama, posisi rak palsu, relasi dokumen tebakan.
- Angka yang dihitung ulang di frontend dan bisa berbeda dari backend, kecuali pratinjau yang memang sudah ada.

**Proses**

- Mengubah backend atau endpoint, menulis langsung ke database, menjalankan server terhadap database live.
- Push atau merge tanpa izin, menambah dependensi tanpa izin, penggantian teks massal lewat skrip.
- Mengklaim berhasil tanpa bukti.
