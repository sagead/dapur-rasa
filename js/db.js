// ===== Database lokal "Dapur Rasa" =====
// Semua konten website (kategori, resep, tips, teks halaman) disimpan di
// localStorage browser sehingga bisa diedit lewat dashboard admin (admin.html)
// dan tetap tersimpan setelah halaman ditutup.
//
// Karena penyimpanannya per-browser, perubahan admin terlihat di browser yang
// sama. Untuk sinkronisasi antar-perangkat dibutuhkan backend (lihat README).

(function () {
  "use strict";

  const KEY = "dapur-rasa:db";
  const VERSI = 1;

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function bacaKunci() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const db = JSON.parse(raw);
      if (!db || db.versi !== VERSI || !Array.isArray(db.resep) || !Array.isArray(db.kategori)) return null;
      if (!db.tips || !db.site) return null;
      return db;
    } catch (e) {
      return null;
    }
  }

  function tulis(db) {
    db.diperbarui = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      return false;
    }
  }

  function bawaan() {
    const tips = (typeof TIPS_AWAL !== "undefined" ? TIPS_AWAL : []).map((t, i) =>
      Object.assign({ id: "tips-" + (i + 1) }, t)
    );
    return {
      versi: VERSI,
      kategori: clone(typeof KATEGORI_AWAL !== "undefined" ? KATEGORI_AWAL : []),
      resep: clone(typeof RESEP_AWAL !== "undefined" ? RESEP_AWAL : []),
      tips: tips,
      site: clone(typeof SITE_AWAL !== "undefined" ? SITE_AWAL : {}),
      diperbarui: Date.now(),
    };
  }

  let db = bacaKunci();
  if (!db) {
    db = bawaan();
    tulis(db);
  }

  // ---------- token teks ----------
  function waktuTeks(menit) {
    menit = Number(menit) || 0;
    if (menit < 60) return menit + " menit";
    const j = Math.floor(menit / 60);
    const m = menit % 60;
    return m ? j + " jam " + m + " menit" : j + " jam";
  }

  function petaToken() {
    const resep = db.resep || [];
    const kategori = db.kategori || [];
    const tren = resep.slice().sort((a, b) => (b.trending || 0) - (a.trending || 0))[0] || {};
    const rating = resep.length
      ? (resep.reduce((s, r) => s + (Number(r.rating) || 0), 0) / resep.length).toFixed(1)
      : "—";
    return {
      resep: resep.length,
      kategori: kategori.length,
      rating: rating,
      trenJudul: tren.judul || "—",
      trenDesc: tren.deskripsi || "",
      trenWaktu: waktuTeks(tren.waktu),
      trenPorsi: tren.porsi || "—",
      trenRating: tren.rating || "—",
    };
  }

  function isiToken(teks) {
    if (teks === null || teks === undefined) return "";
    const peta = petaToken();
    return String(teks).replace(/\{(\w+)\}/g, (m, k) => (k in peta ? String(peta[k]) : m));
  }

  function ambilPath(path) {
    if (!path) return "";
    return String(path)
      .split(".")
      .reduce((obj, k) => (obj && typeof obj === "object" ? obj[k] : undefined), db.site);
  }

  function setPath(path, nilai) {
    const bagian = String(path).split(".");
    const kunciTerakhir = bagian.pop();
    let obj = db.site;
    bagian.forEach((k) => {
      if (!obj[k] || typeof obj[k] !== "object") obj[k] = {};
      obj = obj[k];
    });
    obj[kunciTerakhir] = nilai;
  }

  // pindahkan resep ke slug kategori yang baru
  function pindahSlugKategori(slugLama, slugBaru) {
    if (!slugLama || slugLama === slugBaru) return;
    db.resep.forEach((r) => {
      if (r.kategori === slugLama) r.kategori = slugBaru;
    });
  }

  // ---------- publikasi ke global agar halaman bisa membaca langsung ----------
  function publikasikan() {
    window.KATEGORI = db.kategori;
    window.RESEP = db.resep;
    window.TIPS = db.tips;
    window.SITE = db.site;
  }
  publikasikan();

  // ---------- perubahan ----------
  const listener = [];
  function umumkan(pesan) {
    publikasikan();
    listener.forEach((cb) => {
      try {
        cb(pesan);
      } catch (e) {
        /* abaikan */
      }
    });
    document.dispatchEvent(new CustomEvent("dapur:change", { detail: { pesan: pesan } }));
  }

  function slugUnik(kandidat, kecualikan) {
    let slug = String(kandidat || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) slug = "resep-baru";
    let hasil = slug;
    let i = 2;
    while (db.resep.some((r) => r.slug === hasil && r.slug !== kecualikan)) {
      hasil = slug + "-" + i++;
    }
    return hasil;
  }

  const DB = {
    versi: VERSI,

    kategori: () => db.kategori,
    resep: () => db.resep,
    tips: () => db.tips,
    site: () => db.site,
    semua: () => db,

    diperbarui: () => db.diperbarui || 0,
    teks: (path) => isiToken(ambilPath(path)),

    // ----- resep -----
    cariResep: (slug) => db.resep.find((r) => r.slug === slug) || null,
    simpanResep(data) {
      data = Object.assign({}, data);
      const lama = data.slug ? db.resep.find((r) => r.slug === data.slug) : null;
      data.slug = slugUnik(data.slug || data.judul, lama ? lama.slug : null);
      data.waktu = Number(data.waktu) || 0;
      data.porsi = Number(data.porsi) || 1;
      data.rating = Math.min(5, Math.max(0, Number(data.rating) || 0));
      data.jumlah = Number(data.jumlah) || 0;
      data.trending = Number(data.trending) || 0;
      data.tags = Array.isArray(data.tags) ? data.tags : [];
      data.bahan = Array.isArray(data.bahan) ? data.bahan : [];
      data.langkah = Array.isArray(data.langkah) ? data.langkah : [];

      if (lama) {
        Object.assign(lama, data);
      } else {
        db.resep.unshift(data);
      }
      tulis(db);
      umumkan("resep");
      return data;
    },
    hapusResep(slug) {
      const i = db.resep.findIndex((r) => r.slug === slug);
      if (i < 0) return false;
      db.resep.splice(i, 1);
      tulis(db);
      umumkan("resep");
      return true;
    },

    // ----- kategori -----
    cariKategori: (slug) => db.kategori.find((k) => k.slug === slug) || null,
    simpanKategori(data, slugLama) {
      data = Object.assign({}, data);
      const lama = slugLama ? db.kategori.find((k) => k.slug === slugLama) : null;
      const slugBaru = String(data.slug || "").trim();
      if (!slugBaru) return { ok: false, msg: "Slug kategori wajib diisi." };
      if (db.kategori.some((k) => k.slug === slugBaru && k !== lama))
        return { ok: false, msg: "Slug sudah dipakai kategori lain." };

      data.slug = slugBaru;
      if (lama) {
        if (lama.slug !== slugBaru) pindahSlugKategori(lama.slug, slugBaru);
        Object.assign(lama, data);
      } else {
        db.kategori.push(data);
      }
      tulis(db);
      umumkan("kategori");
      return { ok: true, data: lama || data };
    },
    ubahSlugKategori: pindahSlugKategori,
    hapusKategori(slug) {
      const dipakai = db.resep.filter((r) => r.kategori === slug);
      if (dipakai.length) {
        return { ok: false, msg: "Kategori masih dipakai " + dipakai.length + " resep. Pindahkan dulu resepnya." };
      }
      const i = db.kategori.findIndex((k) => k.slug === slug);
      if (i < 0) return { ok: false, msg: "Kategori tidak ditemukan." };
      db.kategori.splice(i, 1);
      tulis(db);
      umumkan("kategori");
      return { ok: true };
    },

    // ----- tips -----
    simpanTips(data) {
      if (data.id) {
        const lama = db.tips.find((t) => t.id === data.id);
        if (lama) {
          Object.assign(lama, data);
          tulis(db);
          umumkan("tips");
          return lama;
        }
      }
      const baru = Object.assign({ id: "tips-" + Date.now().toString(36) }, data);
      db.tips.push(baru);
      tulis(db);
      umumkan("tips");
      return baru;
    },
    hapusTips(id) {
      const i = db.tips.findIndex((t) => t.id === id);
      if (i < 0) return false;
      db.tips.splice(i, 1);
      tulis(db);
      umumkan("tips");
      return true;
    },

    // ----- teks halaman -----
    setSite(path, nilai) {
      setPath(path, nilai);
      tulis(db);
      umumkan("site");
    },
    setSiteBanyak(obj) {
      Object.keys(obj).forEach((path) => setPath(path, obj[path]));
      tulis(db);
      umumkan("site");
    },
    teksMentah: (path) => ambilPath(path),

    // ----- cadangan -----
    ekspor() {
      return JSON.stringify(db, null, 2);
    },
    impor(teks) {
      const data = JSON.parse(teks);
      if (!data || !Array.isArray(data.resep) || !Array.isArray(data.kategori)) {
        throw new Error("Berkas tidak cocok dengan format database Dapur Rasa.");
      }
      db = Object.assign(bawaan(), data, { versi: VERSI });
      tulis(db);
      umumkan("impor");
      return db;
    },
    reset() {
      db = bawaan();
      tulis(db);
      umumkan("reset");
      return db;
    },
    simpan: () => tulis(db),

    // ----- perubahan -----
    ubah(cb) {
      listener.push(cb);
      return () => {
        const i = listener.indexOf(cb);
        if (i >= 0) listener.splice(i, 1);
      };
    },
    change(cb) {
      return DB.ubah(cb);
    },
    isiKonten(root) {
      isiKonten(root || document);
    },
  };

  // ---------- isi teks halaman dari database ----------
  function isiKonten(root) {
    if (!root || !root.querySelectorAll) return;

    // teks yang dikosongkan admin memang ditampilkan kosong (bukan kembali ke bawaan)
    const ambil = (path) => {
      const mentah = ambilPath(path);
      return mentah === undefined || mentah === null ? null : isiToken(mentah);
    };

    root.querySelectorAll("[data-cms]").forEach((el) => {
      const nilai = ambil(el.dataset.cms);
      if (nilai !== null) el.textContent = nilai;
    });
    root.querySelectorAll("[data-cms-html]").forEach((el) => {
      const nilai = ambil(el.dataset.cmsHtml);
      if (nilai !== null) el.innerHTML = nilai;
    });
    root.querySelectorAll("[data-cms-ph]").forEach((el) => {
      const nilai = ambil(el.dataset.cmsPh);
      if (nilai !== null) el.setAttribute("placeholder", nilai);
    });
    root.querySelectorAll("[data-cms-aria]").forEach((el) => {
      const nilai = ambil(el.dataset.cmsAria);
      if (nilai !== null) el.setAttribute("aria-label", nilai);
    });
  }

  window.DB = DB;
  window.isiKonten = isiKonten;

  // sinkron bila tab lain mengubah database
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    const baru = bacaKunci();
    if (baru) {
      db = baru;
      umumkan("sinkron");
    }
  });

  document.addEventListener("DOMContentLoaded", () => isiKonten(document));
})();
