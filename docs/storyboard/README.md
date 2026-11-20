# Storyboard momen khas UI v3

Folder ini memuat bingkai kunci dan rekaman setiap momen khas "Buku Besar Hidup". Bingkai diambil dari rute Katalog (data contoh berlabel "contoh") dan dari aplikasi yang tersambung ke database uji. Momen M6 dan M9 tidak punya storyboard karena ditunda: API belum menyediakan datanya.

## Cara membuat ulang

Skrip `frontend/tests/e2e/storyboard.cjs` menghentikan semua animasi, lalu memindahkan `currentTime` ke titik waktu tertentu sebelum mengambil gambar. Urutannya tepat dan bisa diulang. Rekaman `.webm` diambil Playwright dengan kecepatan asli.

```bash
PW_PATH=<folder paket playwright> BASE=http://127.0.0.1:5180 node tests/e2e/storyboard.cjs ../docs/storyboard
```

Jalankan terhadap dev server port 5180 yang tersambung ke backend uji port 8010. Rute Katalog tidak ada di build produksi.

## Momen dan bingkainya

| Momen | Bingkai | Rekaman | Yang terjadi |
|---|---|---|---|
| M1 Jejak Tinta | `m1-jejak-tinta/` 0, 140, 340, 560, 800, 1100 ms, ditambah versi ponsel vertikal | `m1-jejak-tinta.webm` | Benang debit tergambar lebih dulu, lalu benang kredit. Timbangan menjadi datar, lalu ringkasan "Debit = Kredit · Seimbang" tampil. Total paling lama 1.200 ms. |
| M2 Upacara Posting | `m2-upacara-posting/` 0 sampai 700 ms | `m2-upacara-posting.webm` | Struk keluar dari kanan atas dengan clip-path selama 260 ms, cap di halaman mendarat dengan pegas cap. Navigasi tetap bisa dilakukan. |
| M3 Angka Mekanis | `m3-angka-mekanis/` 0 sampai 300 ms | `m3-angka-mekanis.webm` | Digit yang berubah bergulir 260 ms, digit paling kanan lebih dulu dengan jeda 18 ms. "Rp" dan pemisah ribuan diam. |
| M4 Transisi Ruang | `m4-transisi-ruang/` 0 sampai 300 ms | `m4-transisi-ruang.webm` | Nomor dokumen di baris daftar berubah bentuk menjadi kepala dokumen, lalu kembali saat "Kembali ke daftar". |
| M5 Rantai Dokumen | `m5-rantai-dokumen/` desktop dan ponsel | tidak ada (tanpa gerak) | Lembar mini dihubungkan benang tinta. Dokumen saat ini terangkat dengan pita. Langkah tanpa id dari API tampil putus-putus. |
| M7 Akun T | `m7-akun-t/` 0 sampai 300 ms | `m7-akun-t.webm` | Garis T tergambar 300 ms saat berganti tampilan. |
| M8 Gudang Hidup | `m8-gudang-hidup/` diam, hover dengan slip, fokus dengan panah | tidak ada (gerak hanya angkat 2 px) | Rak per kategori, kotak terisi sebanding stok, slip detail saat hover atau fokus. |
| M10 Tutup Buku | `m10-tutup-buku/` 0 sampai 800 ms | `m10-tutup-buku.webm` | Sampul buku menutup selama 600 ms, lalu cap "Ditutup" dengan gembok mendarat. |
| M11 Membuka Buku | `m11-membuka-buku/` 0 sampai 700 ms | `m11-membuka-buku.webm` | Lembar login menutup menjadi sampul, lalu buku terbuka menjadi kerangka aplikasi. Hanya sekali per sesi browser. |

## Mode gerak

Semua momen di atas mengikuti setelan Gerak di Akun saya:

- **Penuh**: seperti bingkai di folder ini
- **Dikurangi**: tanpa gerak posisi, skala, dan rotasi; momen tampil langsung di keadaan akhir dengan fade 120 ms
- **Minimal**: tanpa animasi kecuali indikator memuat

Saat pengguna tidak berinteraksi, `document.getAnimations()` kosong di semua halaman utama.
