// ===== Dashboard admin Dapur Rasa =====
// Mengelola seluruh konten website: resep, kategori, tips, teks halaman,
// pengguna, dan cadangan data. Perubahan langsung tersimpan di database
// lokal (js/db.js) sehingga tampil di halaman publik.

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function waktuTeks(menit) {
    menit = Number(menit) || 0;
    if (menit < 60) return menit + " menit";
    const j = Math.floor(menit / 60);
    const m = menit % 60;
    return m ? j + " jam " + m + " menit" : j + " jam";
  }

  function tanggal(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) {
      return "—";
    }
  }

  function kategoriDari(slug) {
    return (DB.kategori() || []).find((k) => k.slug === slug) || null;
  }

  // ---------- toast ----------
  let toastTimer = null;
  function toast(pesan) {
    let el = document.getElementById("toast");
    if (!el) {
      document.body.insertAdjacentHTML("beforeend", '<div class="toast" id="toast" role="status" aria-live="polite"></div>');
      el = document.getElementById("toast");
    }
    if (!el) return;
    el.textContent = pesan;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // ---------- status ----------
  let tab = "ringkasan";
  let editor = null; // { tipe: 'resep'|'kategori'|'tips', data, lama }
  let kunciCari = "";
  let terkunci = true; // belum masuk sebagai admin

  // =========================================================
  //  GERBANG (login / akses ditolak)
  // =========================================================
  function kunciShell(kunci) {
    terkunci = kunci;
    $("#adminShell").classList.toggle("is-locked", kunci);
    const keluar = $("#btnKeluar");
    if (keluar) keluar.hidden = kunci;
    if (kunci) {
      $("#adminWho").textContent = "";
      tutupSide();
    }
  }

  function tampilGerbang(mode, pesan) {
    kunciShell(true);
    const main = $("#adminMain");
    if (mode === "tolak") {
      const u = Auth.user();
      main.innerHTML = `
        <div class="admin-gate">
          <div class="gate-icon">⛔</div>
          <h1>Akses ditolak</h1>
          <p class="lead">Akun <b>${esc(u ? u.email : "")}</b> bukan admin, jadi tidak bisa membuka dashboard.</p>
          <p class="form-error" style="margin-bottom:16px">${esc(pesan || "Hubungi admin situs untuk diberi peran admin.")}</p>
          <button class="btn btn-ghost btn-block-w" type="button" data-logout>Keluar dari akun</button>
          <p class="gate-alt"><a href="profil.html">Buka profil</a> · <a href="index.html">Kembali ke situs</a></p>
        </div>`;
    } else {
      main.innerHTML = `
        <div class="admin-gate">
          <div class="gate-icon">🔐</div>
          <h1>Masuk dashboard admin</h1>
          <p class="lead">Halaman ini khusus admin untuk mengelola seluruh konten Dapur Rasa.</p>
          <form id="gateForm" novalidate>
            <p class="form-error" id="gateError" role="alert" hidden></p>
            <label class="field">
              Email
              <input type="email" name="email" autocomplete="username" placeholder="admin@dapurrasa.id" required />
            </label>
            <label class="field">
              Kata sandi
              <input type="password" name="pass" autocomplete="current-password" placeholder="Kata sandi admin" required />
            </label>
            <button class="btn btn-primary btn-block-w" type="submit">Masuk ke dashboard</button>
          </form>
          <p class="gate-note">
            Akun admin bawaan: <code>admin@dapurrasa.id</code> / <code>admin123</code>.
            Akun lain bisa diberi peran admin lewat menu <b>Pengguna</b> setelah masuk.
          </p>
          <p class="gate-alt"><a href="index.html">← Kembali ke situs</a></p>
        </div>`;
    }
    perbaruiHitungan();
  }

  function cekAkses() {
    Auth.ensureAdmin();
    const u = Auth.user();
    if (!u) return tampilGerbang("login");
    if (u.role !== "admin") return tampilGerbang("tolak");
    kunciShell(false);
    $("#adminWho").innerHTML = `Masuk sebagai <b>${esc(u.nama)}</b>`;
    render();
  }

  // =========================================================
  //  MENU SAMPING (drawer di HP)
  // =========================================================
  function bukaSide() {
    $("#adminSide").classList.add("open");
    $("#sideBackdrop").hidden = false;
    $("#sideToggle").setAttribute("aria-expanded", "true");
  }
  function tutupSide() {
    $("#adminSide").classList.remove("open");
    $("#sideBackdrop").hidden = true;
    $("#sideToggle").setAttribute("aria-expanded", "false");
  }

  function perbaruiHitungan() {
    const set = (id, n) => {
      const el = $(id);
      if (el) el.textContent = n;
    };
    set("#cntResep", (DB.resep() || []).length);
    set("#cntKat", (DB.kategori() || []).length);
    set("#cntTips", (DB.tips() || []).length);
    set("#cntUser", Auth.users().length);
    const upd = $("#sideUpdated");
    if (upd) {
      const t = DB.diperbarui();
      upd.textContent = t ? "Terakhir diubah: " + new Date(t).toLocaleString("id-ID") : "Belum pernah diubah";
    }
  }

  // =========================================================
  //  RUTE TAMPILAN
  // =========================================================
  function render() {
    if (terkunci) return;
    perbaruiHitungan();
    $$("#sideNav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));

    const main = $("#adminMain");
    if (editor && editor.tipe === "resep") main.innerHTML = viewFormResep();
    else if (editor && editor.tipe === "kategori") main.innerHTML = viewFormKategori();
    else if (editor && editor.tipe === "tips") main.innerHTML = viewFormTips();
    else if (tab === "resep") main.innerHTML = viewResep();
    else if (tab === "kategori") main.innerHTML = viewKategori();
    else if (tab === "tips") main.innerHTML = viewTips();
    else if (tab === "konten") main.innerHTML = viewKonten();
    else if (tab === "pengguna") main.innerHTML = viewPengguna();
    else if (tab === "data") main.innerHTML = viewData();
    else main.innerHTML = viewRingkasan();

    // fokus ke atas konten agar tidak tersangkut di posisi lama
    window.requestAnimationFrame(() => {
      const h = main.querySelector(".admin-head h1, .admin-gate h1, .admin-panel h2");
      if (h) h.setAttribute("tabindex", "-1");
    });
  }

  // =========================================================
  //  RINGKASAN
  // =========================================================
  function viewRingkasan() {
    const resep = DB.resep() || [];
    const kats = DB.kategori() || [];
    const tips = DB.tips() || [];
    const users = Auth.users();
    const adminCount = users.filter((u) => u.role === "admin").length;
    const tren = resep.slice().sort((a, b) => (b.trending || 0) - (a.trending || 0)).slice(0, 5);

    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">Dashboard</span>
          <h1>Ringkasan konten</h1>
          <p>Semua isi website bisa kamu ubah di sini dan otomatis tersimpan ke database.</p>
        </div>
        <div class="head-actions">
          <button class="mini-btn solid" type="button" data-act="tambah-resep">＋ Tambah resep</button>
          <button class="mini-btn" type="button" data-go="konten">✏️ Edit konten halaman</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card"><span class="s-icon">🍲</span><strong>${resep.length}</strong><span>Resep</span></div>
        <div class="stat-card"><span class="s-icon">🗂</span><strong>${kats.length}</strong><span>Kategori</span></div>
        <div class="stat-card"><span class="s-icon">💡</span><strong>${tips.length}</strong><span>Tips masak</span></div>
        <div class="stat-card"><span class="s-icon">👥</span><strong>${users.length}</strong><span>Pengguna (${adminCount} admin)</span></div>
        <div class="stat-card"><span class="s-icon">💾</span><strong>${ukuranDB()}</strong><span>Ukuran database</span></div>
      </div>

      <div class="admin-panel">
        <h2>Akses cepat</h2>
        <p class="panel-sub">Pintasan ke bagian yang paling sering diubah.</p>
        <div class="quick-grid">
          <button class="quick-card" type="button" data-act="tambah-resep">
            <span class="q-icon">🍲</span><strong>Tambah resep baru</strong>
            <span>Isi judul, bahan, langkah, waktu, porsi, dan rating.</span>
          </button>
          <button class="quick-card" type="button" data-go="konten">
            <span class="q-icon">✏️</span><strong>Konten halaman</strong>
            <span>Ubah judul hero, teks pembuka, tips, dan footer.</span>
          </button>
          <button class="quick-card" type="button" data-go="kategori">
            <span class="q-icon">🗂</span><strong>Kelola kategori</strong>
            <span>Ganti nama, ikon, warna, dan deskripsi kategori.</span>
          </button>
          <button class="quick-card" type="button" data-go="pengguna">
            <span class="q-icon">👥</span><strong>Peran pengguna</strong>
            <span>Berikan akses admin atau hapus akun tertentu.</span>
          </button>
        </div>
      </div>

      <div class="admin-panel">
        <h2>Resep dengan skor tren tertinggi</h2>
        <p class="panel-sub">Urutan ini yang tampil di bagian “Resep Tren” beranda.</p>
        <div class="admin-list">
          ${
            tren.length
              ? tren.map((r) => rowResep(r, true)).join("")
              : `<div class="admin-empty"><div class="icon">🍲</div><h3>Belum ada resep</h3><p>Tambahkan resep pertamamu.</p></div>`
          }
        </div>
      </div>`;
  }

  function ukuranDB() {
    try {
      const n = (localStorage.getItem("dapur-rasa:db") || "").length;
      return n < 1024 ? n + " B" : (n / 1024).toFixed(1) + " KB";
    } catch (e) {
      return "—";
    }
  }

  // =========================================================
  //  RESEP
  // =========================================================
  function rowResep(r, pendek) {
    const k = kategoriDari(r.kategori);
    const warna = k && k.warna ? k.warna : ["#e0592a", "#f08c4b"];
    const emoji = k ? k.emoji : "🍽";
    return `
      <div class="admin-row">
        <span class="r-emoji kat-swatch" style="--a:${esc(warna[0])};--b:${esc(warna[1])}">${emoji}</span>
        <div class="r-body">
          <strong>${esc(r.judul)}</strong>
          <div class="r-meta">
            <span>${esc(k ? k.nama : r.kategori)}</span>
            <span>⏱ ${waktuTeks(r.waktu)}</span>
            <span>🍽 ${esc(r.porsi)} porsi</span>
            <span>★ ${esc(r.rating)}</span>
            ${pendek ? `<span>🔥 ${esc(r.trending)}</span>` : `<span>🔥 tren ${esc(r.trending)}</span>`}
          </div>
        </div>
        <div class="r-act">
          <button class="mini-btn" type="button" data-act="ubah-resep" data-slug="${esc(r.slug)}">Ubah</button>
          <button class="mini-btn danger" type="button" data-act="hapus-resep" data-slug="${esc(r.slug)}">Hapus</button>
        </div>
      </div>`;
  }

  function viewResep() {
    const semua = DB.resep() || [];
    const q = kunciCari.trim().toLowerCase();
    const hasil = q
      ? semua.filter((r) =>
          [r.judul, r.deskripsi, r.kategori, ...(r.tags || [])].join(" ").toLowerCase().includes(q)
        )
      : semua;
    hasil.sort((a, b) => (b.trending || 0) - (a.trending || 0));

    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">Konten</span>
          <h1>Resep</h1>
          <p>${semua.length} resep tersimpan. Tambah, ubah, atau hapus resep yang tampil di website.</p>
        </div>
        <div class="head-actions">
          <button class="mini-btn solid" type="button" data-act="tambah-resep">＋ Tambah resep</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="grow">
          <label class="field">
            Cari resep
            <input type="search" id="cariResep" value="${esc(kunciCari)}" placeholder="Nama resep atau bahan…" enterkeyhint="search" />
          </label>
        </div>
        <span class="panel-sub" style="margin:0">Menampilkan ${hasil.length} dari ${semua.length}</span>
      </div>

      <div class="admin-list">
        ${
          hasil.length
            ? hasil.map((r) => rowResep(r)).join("")
            : `<div class="admin-empty"><div class="icon">🔍</div><h3>Resep tidak ditemukan</h3>
               <p>Coba kata kunci lain atau tambah resep baru.</p></div>`
        }
      </div>`;
  }

  function viewFormResep() {
    const d = editor.data;
    const isNew = !editor.lama;
    const kats = DB.kategori() || [];
    const nilai = (v) => esc(v === undefined || v === null ? "" : v);

    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">${isNew ? "Resep baru" : "Ubah resep"}</span>
          <h1>${isNew ? "Tambah resep" : esc(d.judul || "Resep")}</h1>
          <p>Isi semua kolom, lalu tekan Simpan. Baris kosong pada kolom bahan/langkah akan diabaikan.</p>
        </div>
      </div>

      <form class="admin-panel" id="formResep" novalidate>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="form-grid">
          <label class="field span-2">Judul resep *
            <input type="text" name="judul" value="${nilai(d.judul)}" placeholder="Nasi Goreng Kampung" required />
          </label>
          <label class="field">Slug (untuk alamat URL)
            <input type="text" name="slug" value="${nilai(d.slug)}" placeholder="nasi-goreng-kampung" />
            <span class="form-hint">Kosongkan untuk dibuat otomatis dari judul.</span>
          </label>
          <label class="field">Kategori *
            <select name="kategori">
              ${kats
                .map(
                  (k) =>
                    `<option value="${esc(k.slug)}" ${k.slug === d.kategori ? "selected" : ""}>${esc(k.emoji)} ${esc(k.nama)}</option>`
                )
                .join("")}
            </select>
          </label>
          <label class="field">Waktu (menit)
            <input type="number" name="waktu" min="0" step="1" value="${nilai(d.waktu)}" inputmode="numeric" />
          </label>
          <label class="field">Porsi (orang)
            <input type="number" name="porsi" min="1" step="1" value="${nilai(d.porsi)}" inputmode="numeric" />
          </label>
          <label class="field">Tingkat kesulitan
            <select name="tingkat">
              ${["Mudah", "Sedang", "Sulit"]
                .map((t) => `<option ${t === d.tingkat ? "selected" : ""}>${t}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field">Rating (0–5)
            <input type="number" name="rating" min="0" max="5" step="0.1" value="${nilai(d.rating)}" inputmode="decimal" />
          </label>
          <label class="field">Jumlah ulasan
            <input type="number" name="jumlah" min="0" step="1" value="${nilai(d.jumlah)}" inputmode="numeric" />
          </label>
          <label class="field">Skor tren (0–100)
            <input type="number" name="trending" min="0" max="100" step="1" value="${nilai(d.trending)}" inputmode="numeric" />
            <span class="form-hint">Makin besar, makin atas urutan “Resep Tren”.</span>
          </label>
          <label class="field span-2">Tag (pisahkan dengan koma)
            <input type="text" name="tags" value="${nilai((d.tags || []).join(", "))}" placeholder="sarapan, cepat, favorit keluarga" />
          </label>
          <label class="field span-2">Deskripsi singkat
            <textarea name="deskripsi" placeholder="Satu dua kalimat yang membuat orang ingin memasaknya.">${nilai(d.deskripsi)}</textarea>
          </label>
          <label class="field span-2">Bahan (satu bahan per baris)
            <textarea name="bahan" class="tall" placeholder="2 porsi nasi putih dingin&#10;2 butir telur">${nilai((d.bahan || []).join("\n"))}</textarea>
          </label>
          <label class="field span-2">Langkah memasak (satu langkah per baris)
            <textarea name="langkah" class="tall" placeholder="Panaskan minyak, tumis bawang sampai harum.&#10;Masukkan nasi, aduk dengan api besar.">${nilai((d.langkah || []).join("\n"))}</textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="mini-btn solid" type="submit">💾 Simpan resep</button>
          <button class="mini-btn" type="button" data-act="batal">Batal</button>
        </div>
      </form>`;
  }

  function simpanFormResep(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const err = $("#formError");
    const gagal = (pesan) => {
      err.textContent = pesan;
      err.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (!String(data.judul || "").trim()) return gagal("Judul resep wajib diisi.");
    if (!(DB.kategori() || []).length) return gagal("Belum ada kategori. Buat kategori dulu di menu Kategori.");

    const baris = (teks) =>
      String(teks || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

    const lama = editor.lama ? DB.cariResep(editor.lama) : null;
    const payload = {
      slug: String(data.slug || "").trim() || (lama ? lama.slug : ""),
      judul: String(data.judul).trim(),
      kategori: data.kategori,
      waktu: data.waktu,
      porsi: data.porsi,
      tingkat: data.tingkat,
      rating: data.rating,
      jumlah: data.jumlah,
      trending: data.trending,
      tags: baris(String(data.tags || "").replace(/,/g, "\n")),
      deskripsi: String(data.deskripsi || "").trim(),
      bahan: baris(data.bahan),
      langkah: baris(data.langkah),
    };

    if (!payload.bahan.length) return gagal("Isi minimal satu bahan.");
    if (!payload.langkah.length) return gagal("Isi minimal satu langkah memasak.");

    const hasil = DB.simpanResep(payload);
    editor = null;
    tab = "resep";
    render();
    toast("💾 “" + hasil.judul + "” tersimpan di database");
  }

  // =========================================================
  //  KATEGORI
  // =========================================================
  function viewKategori() {
    const kats = DB.kategori() || [];
    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">Konten</span>
          <h1>Kategori</h1>
          <p>${kats.length} kategori. Ubah nama, ikon, warna, pola latar, dan deskripsinya.</p>
        </div>
        <div class="head-actions">
          <button class="mini-btn solid" type="button" data-act="tambah-kategori">＋ Tambah kategori</button>
        </div>
      </div>

      <div class="admin-list">
        ${
          kats.length
            ? kats
                .map((k) => {
                  const jumlah = (DB.resep() || []).filter((r) => r.kategori === k.slug).length;
                  return `
                  <div class="admin-row">
                    <span class="r-emoji kat-swatch pola-${esc(k.pola)}" style="--a:${esc(k.warna[0])};--b:${esc(k.warna[1])}">${esc(k.emoji)}</span>
                    <div class="r-body">
                      <strong>${esc(k.nama)}</strong>
                      <div class="r-meta">
                        <span>/${esc(k.slug)}</span>
                        <span>${jumlah} resep</span>
                        <span>${esc(k.label || "")}</span>
                      </div>
                    </div>
                    <div class="r-act">
                      <button class="mini-btn" type="button" data-act="ubah-kategori" data-slug="${esc(k.slug)}">Ubah</button>
                      <button class="mini-btn danger" type="button" data-act="hapus-kategori" data-slug="${esc(k.slug)}">Hapus</button>
                    </div>
                  </div>`;
                })
                .join("")
            : `<div class="admin-empty"><div class="icon">🗂</div><h3>Belum ada kategori</h3><p>Tambahkan kategori pertama.</p></div>`
        }
      </div>`;
  }

  function viewFormKategori() {
    const d = editor.data;
    const isNew = !editor.lama;
    const nilai = (v, fallback) => esc(v === undefined || v === null || v === "" ? fallback || "" : v);

    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">${isNew ? "Kategori baru" : "Ubah kategori"}</span>
          <h1>${isNew ? "Tambah kategori" : esc(d.nama || "Kategori")}</h1>
          <p>Warna dan pola dipakai pada kartu kategori, chip, dan banner resep.</p>
        </div>
      </div>

      <form class="admin-panel" id="formKategori" novalidate>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="form-grid">
          <label class="field">Nama kategori *
            <input type="text" name="nama" value="${nilai(d.nama)}" placeholder="Makanan Berat" required />
          </label>
          <label class="field">Slug *
            <input type="text" name="slug" value="${nilai(d.slug)}" placeholder="makanan-berat" required />
            <span class="form-hint">Ubah slug akan ikut memindahkan semua resep di kategori ini.</span>
          </label>
          <label class="field">Emoji ikon
            <input type="text" name="emoji" value="${nilai(d.emoji, "🍽")}" placeholder="🍛" />
          </label>
          <label class="field">Label kecil
            <input type="text" name="label" value="${nilai(d.label)}" placeholder="Hidangan Utama" />
          </label>
          <label class="field">Warna pertama
            <input type="color" name="warna0" value="${nilai((d.warna || [])[0], "#e0592a")}" />
          </label>
          <label class="field">Warna kedua
            <input type="color" name="warna1" value="${nilai((d.warna || [])[1], "#f08c4b")}" />
          </label>
          <label class="field">Pola latar
            <select name="pola">
              ${[
                ["dots", "Bintik (dots)"],
                ["stripes", "Garis (stripes)"],
                ["check", "Kotak (check)"],
                ["wave", "Ombak (wave)"],
              ]
                .map(([v, t]) => `<option value="${v}" ${v === d.pola ? "selected" : ""}>${t}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field span-2">Deskripsi
            <textarea name="deskripsi" placeholder="Hidangan utama mengenyangkan untuk sarapan…">${nilai(d.deskripsi)}</textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="mini-btn solid" type="submit">💾 Simpan kategori</button>
          <button class="mini-btn" type="button" data-act="batal">Batal</button>
        </div>
      </form>`;
  }

  function simpanFormKategori(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const err = $("#formError");
    const gagal = (pesan) => {
      err.textContent = pesan;
      err.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const nama = String(data.nama || "").trim();
    const slug = String(data.slug || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!nama) return gagal("Nama kategori wajib diisi.");
    if (!slug) return gagal("Slug wajib diisi (huruf kecil, tanpa spasi).");

    const hasil = DB.simpanKategori(
      {
        slug: slug,
        nama: nama,
        emoji: String(data.emoji || "🍽").trim() || "🍽",
        label: String(data.label || "").trim(),
        deskripsi: String(data.deskripsi || "").trim(),
        pola: data.pola || "dots",
        warna: [data.warna0 || "#e0592a", data.warna1 || "#f08c4b"],
      },
      editor.lama || null
    );
    if (!hasil.ok) return gagal(hasil.msg);

    editor = null;
    tab = "kategori";
    render();
    toast("🗂 Kategori “" + nama + "” tersimpan");
  }

  // =========================================================
  //  TIPS
  // =========================================================
  function viewTips() {
    const tips = DB.tips() || [];
    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">Konten</span>
          <h1>Tips Masak</h1>
          <p>${tips.length} tips tampil di bagian “Tips Masak” pada beranda.</p>
        </div>
        <div class="head-actions">
          <button class="mini-btn solid" type="button" data-act="tambah-tips">＋ Tambah tips</button>
        </div>
      </div>

      <div class="admin-list">
        ${
          tips.length
            ? tips
                .map(
                  (t, i) => `
              <div class="admin-row">
                <span class="r-emoji kat-swatch" style="--a:#f7b267;--b:#e0592a">${i + 1}</span>
                <div class="r-body">
                  <strong>${esc(t.judul)}</strong>
                  <div class="r-meta"><span>${esc(t.isi)}</span></div>
                </div>
                <div class="r-act">
                  <button class="mini-btn" type="button" data-act="ubah-tips" data-id="${esc(t.id)}">Ubah</button>
                  <button class="mini-btn danger" type="button" data-act="hapus-tips" data-id="${esc(t.id)}">Hapus</button>
                </div>
              </div>`
                )
                .join("")
            : `<div class="admin-empty"><div class="icon">💡</div><h3>Belum ada tips</h3><p>Tambahkan tips pertama untuk beranda.</p></div>`
        }
      </div>`;
  }

  function viewFormTips() {
    const d = editor.data;
    const isNew = !editor.lama;
    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">${isNew ? "Tips baru" : "Ubah tips"}</span>
          <h1>${isNew ? "Tambah tips" : esc(d.judul || "Tips")}</h1>
          <p>Tips ditampilkan sebagai kartu di bagian bawah beranda.</p>
        </div>
      </div>

      <form class="admin-panel" id="formTips" novalidate>
        <p class="form-error" id="formError" role="alert" hidden></p>
        <div class="form-grid">
          <label class="field span-2">Judul tips *
            <input type="text" name="judul" value="${esc(d.judul || "")}" placeholder="Gunakan nasi dingin" required />
          </label>
          <label class="field span-2">Isi tips *
            <textarea name="isi" placeholder="Nasi kemarin membuat nasi goreng tidak lembek…">${esc(d.isi || "")}</textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="mini-btn solid" type="submit">💾 Simpan tips</button>
          <button class="mini-btn" type="button" data-act="batal">Batal</button>
        </div>
      </form>`;
  }

  function simpanFormTips(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const err = $("#formError");
    const judul = String(data.judul || "").trim();
    const isi = String(data.isi || "").trim();
    if (!judul || !isi) {
      err.textContent = "Judul dan isi tips wajib diisi.";
      err.hidden = false;
      return;
    }
    DB.simpanTips({ id: editor.lama || undefined, judul: judul, isi: isi });
    editor = null;
    tab = "tips";
    render();
    toast("💡 Tips tersimpan");
  }

  // =========================================================
  //  KONTEN HALAMAN
  // =========================================================
  const KONTEN_SPEC = [
    {
      judul: "Identitas situs",
      sub: "Nama yang tampil di logo, menu, dan footer.",
      fields: [{ path: "brand.nama", label: "Nama situs", tipe: "text" }],
    },
    {
      judul: "Hero beranda (bagian atas)",
      sub: "Judul utama dan tombol pada layar pertama website.",
      token: true,
      fields: [
        { path: "hero.eyebrow", label: "Teks kecil di atas judul", tipe: "text" },
        { path: "hero.judulA", label: "Judul baris 1", tipe: "text" },
        { path: "hero.judulB", label: "Judul baris 2 (gradasi warna)", tipe: "text" },
        { path: "hero.lead", label: "Deskripsi", tipe: "textarea" },
        { path: "hero.placeholder", label: "Teks bantu kotak pencarian", tipe: "text" },
        { path: "hero.cta1", label: "Tombol utama", tipe: "text" },
        { path: "hero.cta2", label: "Tombol kedua", tipe: "text" },
        { path: "hero.stat1v", label: "Angka statistik 1", tipe: "text" },
        { path: "hero.stat1l", label: "Keterangan statistik 1", tipe: "text" },
        { path: "hero.stat2v", label: "Angka statistik 2", tipe: "text" },
        { path: "hero.stat2l", label: "Keterangan statistik 2", tipe: "text" },
        { path: "hero.stat3v", label: "Angka statistik 3", tipe: "text" },
        { path: "hero.stat3l", label: "Keterangan statistik 3", tipe: "text" },
      ],
    },
    {
      judul: "Kartu samping hero",
      sub: "Kotak berwarna di sebelah kanan judul beranda.",
      token: true,
      fields: [
        { path: "hero.kartuBadge", label: "Label kecil", tipe: "text" },
        { path: "hero.kartuJudul", label: "Judul", tipe: "text" },
        { path: "hero.kartuDesc", label: "Deskripsi", tipe: "textarea" },
        { path: "hero.kartuM1", label: "Info 1", tipe: "text" },
        { path: "hero.kartuM2", label: "Info 2", tipe: "text" },
        { path: "hero.kartuM3", label: "Info 3", tipe: "text" },
      ],
    },
    {
      judul: "Judul bagian beranda",
      sub: "Teks pembuka tiap bagian di halaman beranda.",
      fields: [
        { path: "kategori.eyebrow", label: "Kategori — teks kecil", tipe: "text" },
        { path: "kategori.judul", label: "Kategori — judul", tipe: "text" },
        { path: "kategori.desc", label: "Kategori — deskripsi", tipe: "textarea" },
        { path: "tren.eyebrow", label: "Resep Tren — teks kecil", tipe: "text" },
        { path: "tren.judul", label: "Resep Tren — judul", tipe: "text" },
        { path: "tren.desc", label: "Resep Tren — deskripsi", tipe: "textarea" },
        { path: "tips.eyebrow", label: "Tips — teks kecil", tipe: "text" },
        { path: "tips.judul", label: "Tips — judul", tipe: "text" },
        { path: "tips.desc", label: "Tips — deskripsi", tipe: "textarea" },
        { path: "listing.eyebrowTren", label: "Halaman resep — teks kecil tren", tipe: "text" },
        { path: "listing.judulTren", label: "Halaman resep — judul tren", tipe: "text" },
        { path: "listing.descTren", label: "Halaman resep — deskripsi tren", tipe: "textarea" },
      ],
    },
    {
      judul: "Halaman detail resep & profil",
      sub: "Catatan tambahan di halaman resep dan judul halaman profil.",
      fields: [
        { path: "detail.catatanJudul", label: "Judul catatan dapur", tipe: "text" },
        { path: "detail.catatan", label: "Isi catatan dapur (boleh memuat HTML seperti <em>)", tipe: "textarea" },
        { path: "profil.eyebrow", label: "Profil — teks kecil", tipe: "text" },
        { path: "profil.judul", label: "Profil — judul", tipe: "text" },
        { path: "profil.desc", label: "Profil — deskripsi", tipe: "textarea" },
      ],
    },
    {
      judul: "Footer (bagian bawah)",
      sub: "Teks penutup di seluruh halaman.",
      fields: [
        { path: "footer.desc", label: "Deskripsi situs", tipe: "textarea" },
        { path: "footer.kolom1", label: "Judul kolom 1", tipe: "text" },
        { path: "footer.kolom2", label: "Judul kolom 2", tipe: "text" },
        { path: "footer.kiri", label: "Teks kiri bawah", tipe: "text" },
        { path: "footer.kanan", label: "Teks kanan bawah", tipe: "text" },
      ],
    },
  ];

  function viewKonten() {
    const isi = (f) => {
      const v = DB.teksMentah(f.path);
      const nilai = esc(v === undefined || v === null ? "" : v);
      if (f.tipe === "textarea") {
        return `<textarea name="site.${esc(f.path)}">${nilai}</textarea>`;
      }
      return `<input type="text" name="site.${esc(f.path)}" value="${nilai}" />`;
    };

    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">Konten</span>
          <h1>Konten halaman</h1>
          <p>Semua teks yang tampil di website bisa diubah di sini dan tersimpan ke database.</p>
        </div>
      </div>

      <p class="form-ok" id="kontenOk" hidden>✅ Konten tersimpan — buka halaman beranda untuk melihatnya.</p>

      <form id="formKonten" novalidate>
        <div class="admin-panel">
          <h2>Token otomatis</h2>
          <p class="panel-sub">
            Masukkan token berikut di kolom mana pun, nilainya akan diganti otomatis:
            <code>{resep}</code> <code>{kategori}</code> <code>{rating}</code>
            <code>{trenJudul}</code> <code>{trenDesc}</code> <code>{trenWaktu}</code>
            <code>{trenPorsi}</code> <code>{trenRating}</code>
          </p>
        </div>

        ${KONTEN_SPEC.map(
          (bagian) => `
          <div class="admin-panel">
            <h2>${esc(bagian.judul)}</h2>
            <p class="panel-sub">${esc(bagian.sub)}</p>
            <div class="form-grid">
              ${bagian.fields
                .map(
                  (f) => `
                <label class="field ${f.tipe === "textarea" ? "span-2" : ""}">${esc(f.label)}
                  ${isi(f)}
                </label>`
                )
                .join("")}
            </div>
          </div>`
        ).join("")}

        <div class="form-actions" style="border-top:0">
          <button class="mini-btn solid" type="submit">💾 Simpan semua konten</button>
          <button class="mini-btn" type="button" data-go="ringkasan">Selesai</button>
        </div>
      </form>`;
  }

  function simpanFormKonten(form) {
    const obj = {};
    $$("[name^='site.']", form).forEach((el) => {
      obj[el.name.replace(/^site\./, "")] = el.value;
    });
    DB.setSiteBanyak(obj);
    const ok = $("#kontenOk");
    if (ok) {
      ok.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    toast("✏️ Konten halaman tersimpan");
  }

  // =========================================================
  //  PENGGUNA
  // =========================================================
  function viewPengguna() {
    const u = Auth.user();
    const users = Auth.users();
    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">Akun</span>
          <h1>Pengguna</h1>
          <p>Hanya akun dengan peran <b>Admin</b> yang boleh membuka dashboard ini.</p>
        </div>
      </div>

      <div class="user-table">
        ${users
          .map(
            (x) => `
          <div class="user-row ${x.role === "admin" ? "is-admin" : ""}">
            <span class="u-av">${esc((x.nama || "?").charAt(0).toUpperCase())}</span>
            <div class="u-body">
              <strong>${esc(x.nama)}${u && x.email === u.email ? " <span style='color:var(--brand)'>(kamu)</span>" : ""}</strong>
              <span>${esc(x.email)} · daftar ${tanggal(x.dibuat)}</span>
            </div>
            <div class="u-act">
              <select data-role-for="${esc(x.email)}" aria-label="Peran ${esc(x.email)}">
                <option value="admin" ${x.role === "admin" ? "selected" : ""}>Admin</option>
                <option value="user" ${x.role !== "admin" ? "selected" : ""}>Anggota</option>
              </select>
              <button class="mini-btn danger" type="button" data-act="hapus-user" data-email="${esc(x.email)}"
                ${u && x.email === u.email ? "disabled" : ""}>Hapus</button>
            </div>
          </div>`
          )
          .join("")}
      </div>

      <div class="admin-panel" style="margin-top:22px">
        <h2>Keamanan akun</h2>
        <p class="panel-sub">Ganti kata sandi akun yang sedang kamu pakai. Kata sandi akun lain diatur lewat database masing-masing browser.</p>
        <form id="formSandi" novalidate>
          <p class="form-error" id="sandiError" role="alert" hidden></p>
          <p class="form-ok" id="sandiOk" hidden>Kata sandi berhasil diganti.</p>
          <div class="form-grid">
            <label class="field">Kata sandi lama
              <input type="password" name="lama" autocomplete="current-password" required />
            </label>
            <label class="field">Kata sandi baru (min. 6)
              <input type="password" name="baru" autocomplete="new-password" required />
            </label>
            <label class="field">Ulangi kata sandi baru
              <input type="password" name="ulang" autocomplete="new-password" required />
            </label>
          </div>
          <div class="form-actions">
            <button class="mini-btn solid" type="submit">🔒 Ganti kata sandi</button>
          </div>
        </form>
      </div>`;
  }

  function simpanFormSandi(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const err = $("#sandiError");
    const ok = $("#sandiOk");
    ok.hidden = true;
    const gagal = (m) => {
      err.textContent = m;
      err.hidden = false;
    };
    const u = Auth.user();
    if (!u) return gagal("Sesi berakhir, silakan masuk lagi.");
    if (data.baru !== data.ulang) return gagal("Ulangi kata sandi tidak sama.");
    const hasil = Auth.gantiSandi(u.email, data.lama, data.baru);
    if (!hasil.ok) return gagal(hasil.msg);
    err.hidden = true;
    ok.hidden = false;
    form.reset();
    toast("🔒 Kata sandi diganti");
  }

  // =========================================================
  //  CADANGAN DATA
  // =========================================================
  function viewData() {
    return `
      <div class="admin-head">
        <div>
          <span class="eyebrow">Database</span>
          <h1>Cadangan data</h1>
          <p>Database tersimpan di browser (localStorage). Unduh cadangan agar aman, lalu unggah kembali bila perlu.</p>
        </div>
      </div>

      <div class="admin-panel">
        <h2>Unduh cadangan (ekspor)</h2>
        <p class="panel-sub">Berkas JSON berisi seluruh kategori, resep, tips, dan teks halaman.</p>
        <button class="mini-btn solid" type="button" data-act="ekspor">⬇ Unduh berkas JSON</button>
        <button class="mini-btn" type="button" data-act="salin">📋 Salin ke papan klip</button>
      </div>

      <div class="admin-panel">
        <h2>Masukkan cadangan (impor)</h2>
        <p class="panel-sub">Data lama akan <b>diganti</b> dengan isi berkas. Unduh cadangan dulu sebelum mengimpor.</p>
        <div class="drop-box">
          <strong>Pilih berkas cadangan (.json)</strong>
          <input type="file" id="fileImpor" accept="application/json,.json" />
        </div>
        <div style="margin-top:16px">
          <label class="field">Atau tempel isi cadangan di sini
            <textarea id="teksImpor" class="code-box" placeholder='{"versi":1, ...}'></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="mini-btn solid" type="button" data-act="impor">⬆ Impor sekarang</button>
        </div>
      </div>

      <div class="admin-panel">
        <h2>Kembalikan ke data awal</h2>
        <p class="panel-sub">Menghapus semua perubahan dan mengembalikan 20 resep bawaan, 4 kategori, tips, serta teks halaman seperti semula.</p>
        <button class="mini-btn danger" type="button" data-act="reset">🗑 Kembalikan semua ke data awal</button>
      </div>

      <div class="admin-panel">
        <h2>Isi database saat ini</h2>
        <p class="panel-sub">Klik untuk menyalin ke kolom impor sebagai cadangan manual.</p>
        <textarea id="teksEkspor" class="code-box" readonly>${esc(DB.ekspor())}</textarea>
      </div>`;
  }

  // =========================================================
  //  EVENT
  // =========================================================
  function keTab(nama) {
    editor = null;
    kunciCari = "";
    tab = nama;
    render();
    tutupSide();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bind() {
    // menu samping
    $("#sideToggle").addEventListener("click", () => {
      if (terkunci) return;
      $("#adminSide").classList.contains("open") ? tutupSide() : bukaSide();
    });
    $("#sideBackdrop").addEventListener("click", tutupSide);
    $("#sideNav").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tab]");
      if (b) keTab(b.dataset.tab);
    });

    // keluar (ditangani auth.js juga)
    $("#btnKeluar").addEventListener("click", () => {
      setTimeout(cekAkses, 0);
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-logout]")) {
        setTimeout(cekAkses, 0);
        return;
      }

      const goto = e.target.closest("[data-go]");
      if (goto) {
        keTab(goto.dataset.go);
        return;
      }

      const tombol = e.target.closest("[data-act]");
      if (!tombol) return;
      const aksi = tombol.dataset.act;

      if (aksi === "batal") {
        editor = null;
        render();
        return;
      }

      if (aksi === "tambah-resep") {
        tab = "resep";
        editor = {
          tipe: "resep",
          lama: null,
          data: {
            judul: "",
            kategori: (DB.kategori() || [])[0] ? DB.kategori()[0].slug : "",
            waktu: 30,
            porsi: 2,
            tingkat: "Mudah",
            rating: 4.5,
            jumlah: 0,
            trending: 50,
            tags: [],
            deskripsi: "",
            bahan: [],
            langkah: [],
          },
        };
        render();
        tutupSide();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (aksi === "ubah-resep") {
        const r = DB.cariResep(tombol.dataset.slug);
        if (!r) return toast("Resep tidak ditemukan");
        tab = "resep";
        editor = { tipe: "resep", lama: r.slug, data: JSON.parse(JSON.stringify(r)) };
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (aksi === "hapus-resep") {
        const r = DB.cariResep(tombol.dataset.slug);
        if (!r) return;
        if (confirm(`Hapus resep “${r.judul}”? Tindakan ini tidak bisa dibatalkan.`)) {
          DB.hapusResep(r.slug);
          toast("🗑 Resep dihapus");
        }
        return;
      }

      if (aksi === "tambah-kategori") {
        tab = "kategori";
        editor = {
          tipe: "kategori",
          lama: null,
          data: { nama: "", slug: "", emoji: "🍽", label: "", deskripsi: "", pola: "dots", warna: ["#e0592a", "#f08c4b"] },
        };
        render();
        tutupSide();
        return;
      }

      if (aksi === "ubah-kategori") {
        const k = DB.cariKategori(tombol.dataset.slug);
        if (!k) return;
        tab = "kategori";
        editor = { tipe: "kategori", lama: k.slug, data: JSON.parse(JSON.stringify(k)) };
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (aksi === "hapus-kategori") {
        const k = DB.cariKategori(tombol.dataset.slug);
        if (!k) return;
        if (!confirm(`Hapus kategori “${k.nama}”?`)) return;
        const hasil = DB.hapusKategori(k.slug);
        toast(hasil.ok ? "🗑 Kategori dihapus" : "⚠️ " + hasil.msg);
        return;
      }

      if (aksi === "tambah-tips") {
        tab = "tips";
        editor = { tipe: "tips", lama: null, data: { judul: "", isi: "" } };
        render();
        tutupSide();
        return;
      }

      if (aksi === "ubah-tips") {
        const t = (DB.tips() || []).find((x) => x.id === tombol.dataset.id);
        if (!t) return;
        tab = "tips";
        editor = { tipe: "tips", lama: t.id, data: JSON.parse(JSON.stringify(t)) };
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (aksi === "hapus-tips") {
        if (!confirm("Hapus tips ini?")) return;
        DB.hapusTips(tombol.dataset.id);
        toast("🗑 Tips dihapus");
        return;
      }

      if (aksi === "hapus-user") {
        const email = tombol.dataset.email;
        if (!confirm(`Hapus akun ${email}?`)) return;
        const hasil = Auth.hapusUser(email);
        if (!hasil.ok) return toast("⚠️ " + hasil.msg);
        render();
        toast("🗑 Akun dihapus");
        return;
      }

      if (aksi === "ekspor") {
        const isi = DB.ekspor();
        const blob = new Blob([isi], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dapur-rasa-cadangan-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("⬇ Cadangan diunduh");
        return;
      }

      if (aksi === "salin") {
        const isi = DB.ekspor();
        const ta = $("#teksEkspor");
        if (ta) {
          ta.value = isi;
          ta.select();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(isi).then(
            () => toast("📋 Cadangan disalin"),
            () => toast("⚠️ Gagal menyalin — teks sudah tersorot, salin manual")
          );
        } else if (ta) {
          try {
            document.execCommand("copy");
            toast("📋 Cadangan disalin");
          } catch (e) {
            toast("⚠️ Salin manual dengan Ctrl+C");
          }
        }
        return;
      }

      if (aksi === "impor") {
        const teks = ($("#teksImpor").value || "").trim();
        if (!teks) return toast("⚠️ Pilih berkas atau tempel isi cadangan dulu.");
        if (!confirm("Impor akan MENGANTIKAN seluruh data saat ini. Lanjutkan?")) return;
        try {
          DB.impor(teks);
          render();
          toast("⬆ Cadangan berhasil dimasukkan");
        } catch (err) {
          toast("⚠️ " + err.message);
        }
        return;
      }

      if (aksi === "reset") {
        if (!confirm("Kembalikan SEMUA konten ke data awal? Perubahanmu akan hilang.")) return;
        if (!confirm("Yakin sekali? Klik OK untuk melanjutkan.")) return;
        DB.reset();
        render();
        toast("🔄 Konten dikembalikan ke data awal");
        return;
      }
    });

    // peran pengguna
    document.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-role-for]");
      if (!sel) return;
      const hasil = Auth.setRole(sel.dataset.roleFor, sel.value);
      if (!hasil.ok) {
        toast("⚠️ " + hasil.msg);
        render();
        return;
      }
      perbaruiHitungan();
      toast(sel.value === "admin" ? "✅ Akun menjadi admin" : "Akun menjadi anggota");
    });

    // pencarian resep
    document.addEventListener("input", (e) => {
      if (e.target.id !== "cariResep") return;
      kunciCari = e.target.value;
      const posisi = e.target.selectionStart;
      render();
      const baru = $("#cariResep");
      if (baru) {
        baru.focus();
        try {
          baru.setSelectionRange(posisi, posisi);
        } catch (err) {
          /* type=search mendukung setSelectionRange di sebagian browser */
        }
      }
    });

    // pilih berkas impor
    document.addEventListener("change", (e) => {
      if (e.target.id !== "fileImpor") return;
      const berkas = e.target.files && e.target.files[0];
      if (!berkas) return;
      const pembaca = new FileReader();
      pembaca.onload = () => {
        const ta = $("#teksImpor");
        if (ta) ta.value = String(pembaca.result || "");
        toast("📋 Isi berkas dimuat — tekan “Impor sekarang”");
      };
      pembaca.readAsText(berkas);
    });

    // submit semua formulir
    document.addEventListener("submit", (e) => {
      const f = e.target;

      if (f.id === "gateForm") {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(f).entries());
        const hasil = Auth.login(data.email, data.pass);
        const err = $("#gateError");
        if (!hasil.ok) {
          err.textContent = hasil.msg;
          err.hidden = false;
          return;
        }
        if (!Auth.isAdmin()) {
          tampilGerbang("tolak");
          return;
        }
        toast("👋 Selamat datang, " + hasil.nama + "!");
        cekAkses();
        return;
      }

      if (terkunci) return;

      if (f.id === "formResep") {
        e.preventDefault();
        simpanFormResep(f);
      } else if (f.id === "formKategori") {
        e.preventDefault();
        simpanFormKategori(f);
      } else if (f.id === "formTips") {
        e.preventDefault();
        simpanFormTips(f);
      } else if (f.id === "formKonten") {
        e.preventDefault();
        simpanFormKonten(f);
      } else if (f.id === "formSandi") {
        e.preventDefault();
        simpanFormSandi(f);
      }
    });

    // tutup menu samping dengan Esc
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutupSide();
    });

    // perubahan database dari tab lain
    DB.change(() => {
      perbaruiHitungan();
      if (!terkunci && !editor) render();
    });
  }

  // ---------- jalankan ----------
  document.addEventListener("DOMContentLoaded", () => {
    bind();
    cekAkses();
  });
})();
