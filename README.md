# Dapur Rasa — Website Resep Makanan

Website resep makanan (HTML + CSS + JavaScript) untuk tugas UI/UX HCI.
Sudah ada **database lokal**, **dashboard admin** untuk mengelola seluruh konten,
dan tampilan yang aman diakses dari HP.

## Menjalankan

Buka `index.html` langsung di browser, atau jalankan server lokal (disarankan):

```bash
npx serve .
# atau
python -m http.server 8000
```

## Masuk dashboard admin

1. Buka `admin.html` (atau klik **🛠 Buka Dashboard Admin** di halaman profil setelah masuk).
2. Login dengan akun admin bawaan:

   | | |
   |---|---|
   | Email | `admin@dapurrasa.id` |
   | Kata sandi | `admin123` |

   Akun ini dibuat otomatis saat situs dibuka pertama kali. Ganti kata sandinya
   lewat menu **Pengguna** setelah masuk, dan beri peran admin ke akun lain lewat dropdown peran.

### Isi dashboard

| Menu | Yang bisa diatur |
|---|---|
| 📊 Ringkasan | Statistik konten, akses cepat, resep tren teratas |
| 🍲 Resep | Tambah / ubah / hapus resep: judul, slug, kategori, waktu, porsi, tingkat, rating, jumlah ulasan, skor tren, tag, deskripsi, bahan, langkah |
| 🗂 Kategori | Nama, slug, emoji, label, deskripsi, warna gradasi, pola latar |
| 💡 Tips Masak | Judul & isi tips di beranda |
| ✏️ Konten Halaman | Nama situs, seluruh teks hero, kartu hero, judul tiap bagian, catatan dapur, teks profil, dan footer |
| 👥 Pengguna | Peran (Admin/Anggota), hapus akun, ganti kata sandi sendiri |
| 💾 Cadangan Data | Ekspor (unduh JSON), impor, dan kembalikan ke data awal |

Semua perubahan **langsung tersimpan** dan tampil di halaman publik.

## Database

Konten disimpan di `localStorage` browser melalui `js/db.js` dengan kunci
`dapur-rasa:db` (versi 1):

```json
{
  "versi": 1,
  "kategori": [ ... ],
  "resep": [ ... ],
  "tips": [ ... ],
  "site": { "hero": {}, "kategori": {}, "tren": {}, "tips": {}, "footer": {}, ... }
}
```

- `js/data.js` hanya berisi **data bawaan** (`KATEGORI_AWAL`, `RESEP_AWAL`, `TIPS_AWAL`,
  `SITE_AWAL`, `ADMIN_AWAL`) yang dipakai saat pertama kali dibuka dan saat tombol
  **Kembalikan ke data awal** ditekan.
- Karena penyimpanannya per-browser, perubahan admin terlihat di **browser yang sama**.
  Untuk sinkronisasi antar-perangkat, pindahkan `js/db.js` ke backend
  (mis. Node + SQLite atau Supabase) — struktur datanya sudah siap.

### Token teks

Beberapa kolom teks di **Konten Halaman** bisa memuat token yang diganti otomatis:
`{resep}`, `{kategori}`, `{rating}`, `{trenJudul}`, `{trenDesc}`, `{trenWaktu}`,
`{trenPorsi}`, `{trenRating}`. Contoh: judul hero `✦ {resep} resep teruji di dapur rumahan`
otomatis mengikuti jumlah resep, dan kartu hero otomatis menampilkan resep tren teratas.

## Alur pengguna

1. **Beranda (`index.html`)** — hero, grid kategori, resep tren, dan tips masak.
2. **Halaman kategori (`kategori.html`)** — daftar resep per kategori (`?kat=...`),
   filter chip, pencarian (`?q=...`), dan rekomendasi tren.
3. **Detail resep (`resep.html`)** — banner kategori, info waktu/porsi/rating,
   tombol **Simpan resep**, daftar bahan yang bisa dicentang, dan langkah memasak.
4. **Profil (`profil.html`)** — login/daftar, info akun, dan resep tersimpan.
5. **Dashboard (`admin.html`)** — khusus admin, mengelola seluruh konten.

## Login & menyimpan resep

- Semua tombol 🔖 **Simpan resep** butuh login; kalau belum, modal masuk/daftar terbuka
  otomatis dan resep langsung disimpan begitu berhasil.
- Akun, sesi, dan daftar simpanan disimpan di `localStorage`
  (kata sandi hanya di-hash sederhana — untuk demo tugas, bukan produksi yang sesungguhnya).
- Peran pengguna: `user` (anggota) dan `admin`. Hanya `admin` yang bisa membuka `admin.html`.

## Nyaman di HP

- `viewport-fit=cover` + `theme-color`, area aman pada layar berponi (`env(safe-area-inset-*)`).
- Menu hamburger dengan tinggi aman (`100dvh`), pencarian pindah **ke dalam menu** di layar ≤700 px.
- Ukuran input dipaksa 16 px di layar kecil supaya browser HP tidak memperbesar otomatis saat mengetik.
- Area sentuh minimal ±44 px (tombol menu, 🔖 simpan, filter chip, centang bahan).
- Modal login berubah jadi *bottom sheet* di HP.
- Efek hover dimatikan pada perangkat sentuh, tidak ada geser horizontal yang tidak disengaja.
- Pencarian, filter, dan tombol aksi dashboard admin juga menumpuk rapi di layar kecil.

## Kenyamanan daftar bahan

- Panel bahan dibatasi setinggi layar lalu digulir sendiri, plus gradient penanda
  dan tombol "Tampilkan semua bahan" di layar sempit.
- Tiap bahan bisa dicentang (tercentang = dicoret) dengan progres tersimpan di `localStorage` per resep.

## Struktur

```
├── index.html        # beranda: kategori + resep tren + tips
├── kategori.html     # daftar resep per kategori + pencarian
├── resep.html        # detail resep + tombol simpan
├── profil.html       # login / daftar / resep tersimpan
├── admin.html        # dashboard admin (khusus admin)
├── css/
│   ├── style.css     # gaya situs publik + aturan ramah-HP
│   └── admin.css     # gaya dashboard admin (responsif, drawer di HP)
└── js/
    ├── data.js       # data bawaan: kategori, resep, tips, teks halaman, akun admin
    ├── db.js         # database localStorage (seed, CRUD, token, ekspor/impor)
    ├── app.js        # render halaman publik dari database
    ├── auth.js       # login/daftar, sesi, peran admin, resep tersimpan
    └── admin.js      # logika dashboard admin
```

## Catatan desain

- Setiap kategori punya warna, pola latar (`dots`, `stripes`, `check`, `wave`), dan ikon sendiri — semuanya bisa diubah dari dashboard.
- Tidak ada gambar eksternal: visual memakai gradien + pola CSS + emoji, jadi tetap tampil walau offline.
- Halaman publik menampilkan teks dari database lewat atribut `data-cms` (mis. `data-cms="hero.eyebrow"`).
