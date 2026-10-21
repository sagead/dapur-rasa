// ===== Autentikasi & resep tersimpan (demo lokal) =====
// Semua data disimpan di localStorage browser: akun, sesi, dan daftar simpanan.
// Kata sandi hanya di-hash sederhana — untuk keperluan demo tugas, bukan produksi.

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const KEY_USERS = "dapur-rasa:users";
  const KEY_SESSION = "dapur-rasa:session";
  const keySaved = (email) => "dapur-rasa:saved:" + String(email).toLowerCase();

  // ---------- penyimpanan ----------
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* penyimpanan tidak tersedia */
    }
  }
  function hash(plain) {
    const salted = "dapurrasa::" + plain;
    let h = 5381;
    for (let i = 0; i < salted.length; i++) h = ((h << 5) + h + salted.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  const emailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ---------- API autentikasi ----------
  const Auth = {
    user() {
      const sesi = read(KEY_SESSION, null);
      if (!sesi) return null;
      const u = read(KEY_USERS, []).find((x) => x.email === sesi);
      return u ? { nama: u.nama, email: u.email, role: u.role || "user" } : null;
    },

    isAdmin() {
      const u = this.user();
      return !!u && u.role === "admin";
    },

    register(nama, email, pass) {
      nama = (nama || "").trim();
      email = (email || "").trim().toLowerCase();
      if (nama.length < 2) return { ok: false, msg: "Nama minimal 2 karakter." };
      if (!emailValid(email)) return { ok: false, msg: "Format email belum benar." };
      if ((pass || "").length < 4) return { ok: false, msg: "Kata sandi minimal 4 karakter." };

      const users = read(KEY_USERS, []);
      if (users.some((u) => u.email === email))
        return { ok: false, msg: "Email ini sudah terdaftar. Silakan masuk." };

      users.push({ nama, email, pass: hash(pass), role: "user", dibuat: Date.now() });
      write(KEY_USERS, users);
      write(KEY_SESSION, email);
      return { ok: true, nama };
    },

    // akun admin bawaan dibuat otomatis agar dashboard selalu bisa dibuka
    ensureAdmin() {
      const users = read(KEY_USERS, []);
      const adaAdmin = users.some((u) => u.role === "admin");
      if (adaAdmin) return;
      const bawaan = typeof ADMIN_AWAL !== "undefined" ? ADMIN_AWAL : { nama: "Admin", email: "admin@dapurrasa.id", pass: "admin123" };
      const email = bawaan.email.toLowerCase();
      const ada = users.find((u) => u.email === email);
      if (ada) {
        ada.role = "admin";
      } else {
        users.push({
          nama: bawaan.nama,
          email: email,
          pass: hash(bawaan.pass),
          role: "admin",
          dibuat: Date.now(),
        });
      }
      write(KEY_USERS, users);
    },

    users() {
      this.ensureAdmin();
      return read(KEY_USERS, []).map((u) => ({ nama: u.nama, email: u.email, role: u.role || "user", dibuat: u.dibuat || 0 }));
    },

    setRole(email, role) {
      const users = read(KEY_USERS, []);
      const u = users.find((x) => x.email === email);
      if (!u) return { ok: false, msg: "Akun tidak ditemukan." };
      const adminTotal = users.filter((x) => x.role === "admin").length;
      if (u.role === "admin" && role !== "admin" && adminTotal <= 1)
        return { ok: false, msg: "Tidak bisa menurunkan admin terakhir." };
      u.role = role === "admin" ? "admin" : "user";
      write(KEY_USERS, users);
      return { ok: true };
    },

    hapusUser(email) {
      const users = read(KEY_USERS, []);
      const u = users.find((x) => x.email === email);
      if (!u) return { ok: false, msg: "Akun tidak ditemukan." };
      const sesi = read(KEY_SESSION, null);
      if (sesi === email) return { ok: false, msg: "Tidak bisa menghapus akun yang sedang masuk." };
      if (u.role === "admin" && users.filter((x) => x.role === "admin").length <= 1)
        return { ok: false, msg: "Tidak bisa menghapus admin terakhir." };
      write(KEY_USERS, users.filter((x) => x.email !== email));
      return { ok: true };
    },

    gantiSandi(email, lama, baru) {
      const users = read(KEY_USERS, []);
      const u = users.find((x) => x.email === email);
      if (!u) return { ok: false, msg: "Akun tidak ditemukan." };
      if (u.pass !== hash(lama || "")) return { ok: false, msg: "Kata sandi lama tidak sesuai." };
      if ((baru || "").length < 6) return { ok: false, msg: "Kata sandi baru minimal 6 karakter." };
      u.pass = hash(baru);
      write(KEY_USERS, users);
      return { ok: true };
    },

    login(email, pass) {
      email = (email || "").trim().toLowerCase();
      if (!emailValid(email)) return { ok: false, msg: "Format email belum benar." };
      const u = read(KEY_USERS, []).find((x) => x.email === email);
      if (!u) return { ok: false, msg: "Email belum terdaftar. Daftar dulu ya." };
      if (u.pass !== hash(pass || "")) return { ok: false, msg: "Kata sandi salah." };
      write(KEY_SESSION, email);
      return { ok: true, nama: u.nama };
    },

    logout() {
      write(KEY_SESSION, null);
    },

    saved() {
      const u = this.user();
      return u ? read(keySaved(u.email), []) : [];
    },

    isSaved(slug) {
      return this.saved().indexOf(slug) !== -1;
    },

    toggle(slug) {
      if (!this.user()) return { ok: false, needLogin: true };
      const u = this.user();
      const list = read(keySaved(u.email), []);
      const i = list.indexOf(slug);
      if (i >= 0) list.splice(i, 1);
      else list.unshift(slug);
      write(keySaved(u.email), list);
      return { ok: true, saved: i < 0 };
    },
  };
  window.Auth = Auth;

  // ================= UI =================
  let pendingSlug = null; // resep yang ingin disimpan saat user belum login
  let tab = "login";
  let toastTimer = null;

  function injectUI() {
    if ($("#authModal")) return;
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div class="modal" id="authModal" role="dialog" aria-modal="true" aria-labelledby="authTitle" hidden>
        <div class="modal-backdrop" data-close></div>
        <div class="modal-card">
          <button class="modal-close" type="button" data-close aria-label="Tutup">×</button>
          <div class="modal-head">
            <span class="modal-emoji">🔖</span>
            <div>
              <h2 id="authTitle">Masuk untuk menyimpan resep</h2>
              <p class="modal-sub" id="authSub">Simpan resep favoritmu di sini.</p>
            </div>
          </div>

          <div class="modal-tabs">
            <button type="button" data-tab="login">Masuk</button>
            <button type="button" data-tab="daftar">Daftar</button>
          </div>

          <form id="authForm" novalidate>
            <label class="field" id="fieldName" hidden>
              Nama
              <input type="text" name="nama" autocomplete="name" placeholder="Nama kamu" />
            </label>
            <label class="field">
              Email
              <input type="email" name="email" autocomplete="email" placeholder="nama@email.com" required />
            </label>
            <label class="field">
              Kata sandi
              <input type="password" name="pass" autocomplete="current-password" placeholder="Minimal 4 karakter" required />
            </label>
            <p class="form-error" id="authError" role="alert" hidden></p>
            <button class="btn btn-primary btn-block" type="submit" id="authSubmit">Masuk</button>
          </form>

          <p class="modal-note">Demo lokal — akun &amp; resep tersimpan hanya ada di browser ini.</p>
        </div>
      </div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>`
    );
  }

  function toast(pesan) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = pesan;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function setTab(mode) {
    tab = mode === "daftar" ? "daftar" : "login";
    $$("#authModal [data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("#fieldName").hidden = tab !== "daftar";
    $("#authSubmit").textContent = tab === "daftar" ? "Daftar & simpan" : "Masuk";
    $("#authTitle").textContent = tab === "daftar" ? "Buat akun baru" : "Masuk untuk menyimpan resep";
    $("#authSub").textContent =
      tab === "daftar"
        ? "Gratis, cukup satu kali daftar."
        : "Simpan resep favoritmu di sini.";
    $("#authError").hidden = true;
    const pass = $('#authForm input[name="pass"]');
    if (pass) pass.autocomplete = tab === "daftar" ? "new-password" : "current-password";
  }

  function openModal(mode, slug) {
    injectUI();
    pendingSlug = slug || null;
    setTab(mode);
    $("#authModal").hidden = false;
    document.body.style.overflow = "hidden";
    const first = tab === "daftar" ? $('#authForm input[name="nama"]') : $('#authForm input[name="email"]');
    setTimeout(() => first && first.focus(), 60);
  }

  function closeModal() {
    const m = $("#authModal");
    if (m) m.hidden = true;
    document.body.style.overflow = "";
    pendingSlug = null;
    const f = $("#authForm");
    if (f) f.reset();
    $("#authError").hidden = true;
  }

  // ---------- navbar ----------
  function renderNav() {
    const u = Auth.user();
    const profil = $("#navProfile");
    if (!profil) return;
    const avatar = $("#navAvatar");
    const teks = $("#navProfText");
    const badge = $("#navSaved");
    profil.classList.toggle("is-login", !!u);
    profil.classList.toggle("is-admin", !!u && u.role === "admin");
    avatar.textContent = u ? u.nama.trim().charAt(0).toUpperCase() : "👤";
    teks.textContent = u ? u.nama.trim().split(" ")[0] : "Masuk";
    if (badge) {
      const n = Auth.saved().length;
      badge.textContent = n;
      badge.hidden = !u;
    }
    profil.title = u
      ? "Profil & resep tersimpan — " + u.nama + (u.role === "admin" ? " (Admin)" : "")
      : "Masuk / Daftar";
    profil.setAttribute("aria-label", profil.title);
  }

  // ---------- tombol simpan ----------
  function syncSaveButtons() {
    $$("[data-save]").forEach((btn) => {
      const tersimpan = Auth.isSaved(btn.dataset.save);
      btn.classList.toggle("is-saved", tersimpan);
      if (btn.dataset.label) {
        const span = btn.querySelector("span");
        if (span) span.textContent = tersimpan ? "✓ Tersimpan" : "Simpan resep";
        btn.setAttribute("aria-pressed", String(tersimpan));
      } else {
        btn.setAttribute("aria-label", tersimpan ? "Hapus dari simpanan" : "Simpan resep");
        btn.title = tersimpan ? "Tersimpan — klik untuk hapus" : "Simpan resep";
      }
    });
  }

  function refresh() {
    renderNav();
    syncSaveButtons();
    renderProfil();
  }

  // ================= HALAMAN PROFIL =================
  function renderProfil() {
    const root = $("#profilRoot");
    if (!root || !window.DapurRasa) return;

    const u = Auth.user();
    if (!u) {
      root.innerHTML = `
        <div class="login-gate">
          <span class="gate-emoji">🔖</span>
          <h2>Masuk untuk menyimpan resep</h2>
          <p>Buat akun gratis supaya resep favoritmu tersimpan dan bisa dibuka lagi kapan saja di browser ini.</p>
          <div class="gate-actions">
            <button class="btn btn-primary" type="button" data-open-auth="login">Masuk</button>
            <button class="btn btn-ghost" type="button" data-open-auth="daftar">Daftar baru</button>
          </div>
        </div>`;
      return;
    }

    const tersimpan = Auth.saved().map((s) => window.DapurRasa.getResep(s)).filter(Boolean);
    const inisial = esc(u.nama.trim().charAt(0).toUpperCase());

    root.innerHTML = `
      <div class="profil-grid">
        <aside class="panel profil-card">
          <div class="profil-avatar">${inisial}</div>
          <h2>${esc(u.nama)}</h2>
          <p class="email">${esc(u.email)}</p>
          <p class="role-chip ${u.role === "admin" ? "is-admin" : ""}">${u.role === "admin" ? "🛠 Admin" : "👤 Anggota"}</p>

          <div class="profil-stats">
            <div><strong>${tersimpan.length}</strong><span>Resep tersimpan</span></div>
            <div><strong>${typeof RESEP !== "undefined" ? RESEP.length : 0}</strong><span>Resep tersedia</span></div>
          </div>

          <div class="profil-actions">
            ${u.role === "admin" ? `<a class="btn btn-primary" href="admin.html">🛠 Buka Dashboard Admin</a>` : ""}
            <a class="btn btn-primary" href="kategori.html">Cari resep lain</a>
            <button class="btn btn-ghost btn-danger" type="button" data-logout>Keluar dari akun</button>
          </div>
        </aside>

        <div>
          <div class="section-head" style="margin-bottom:18px">
            <div>
              <span class="eyebrow">Koleksimu</span>
              <h2 class="section-title">Resep tersimpan</h2>
              <p class="section-desc">Klik 🔖 pada kartu resep untuk menyimpan atau melepasnya.</p>
            </div>
          </div>

          ${
            tersimpan.length
              ? `<div class="resep-grid resep-grid-dua">${tersimpan
                  .map((r) => window.DapurRasa.resepCard(r, null))
                  .join("")}</div>`
              : `<div class="empty-state">
                   <div class="icon">🧺</div>
                   <h3>Belum ada resep tersimpan</h3>
                   <p>Tekan tombol 🔖 pada resep yang ingin kamu simpan.</p>
                   <p style="margin-top:16px"><a class="btn btn-primary" href="kategori.html">Jelajahi resep</a></p>
                 </div>`
          }
        </div>
      </div>`;

    syncSaveButtons();
  }

  // ================= EVENT =================
  function bind() {
    // simpan / lepas resep
    document.addEventListener("click", (e) => {
      const tombol = e.target.closest("[data-save]");
      if (tombol) {
        e.preventDefault();
        const slug = tombol.dataset.save;

        if (!Auth.user()) {
          openModal("login", slug);
          return;
        }
        const hasil = Auth.toggle(slug);
        if (!hasil.ok) {
          openModal("login", slug);
          return;
        }
        tombol.classList.add("pop");
        setTimeout(() => tombol.classList.remove("pop"), 400);
        refresh();
        toast(hasil.saved ? "🔖 Resep disimpan ke koleksimu" : "Resep dihapus dari simpanan");
        return;
      }

      // buka modal dari halaman profil
      const buka = e.target.closest("[data-open-auth]");
      if (buka) {
        openModal(buka.dataset.openAuth, null);
        return;
      }

      // keluar
      if (e.target.closest("[data-logout]")) {
        Auth.logout();
        refresh();
        toast("👋 Kamu sudah keluar dari akun");
        return;
      }

      // tutup modal
      if (e.target.closest("[data-close]")) closeModal();

      // pindah tab masuk / daftar
      const tombolTab = e.target.closest("[data-tab]");
      if (tombolTab) setTab(tombolTab.dataset.tab);
    });

    // Escape menutup modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("#authModal") && !$("#authModal").hidden) closeModal();
    });

    // submit login / daftar
    document.addEventListener("submit", (e) => {
      if (e.target.id !== "authForm") return;
      e.preventDefault();

      const data = new FormData(e.target);
      const hasil =
        tab === "daftar"
          ? Auth.register(data.get("nama"), data.get("email"), data.get("pass"))
          : Auth.login(data.get("email"), data.get("pass"));

      const error = $("#authError");
      if (!hasil.ok) {
        error.textContent = hasil.msg;
        error.hidden = false;
        return;
      }

      const slug = pendingSlug;
      const menyimpan = !!slug;
      closeModal();
      refresh();

      if (menyimpan) {
        const r = Auth.toggle(slug);
        refresh();
        toast(r && r.saved ? "🔖 Masuk berhasil — resep disimpan" : "Masuk berhasil");
      } else {
        toast(tab === "daftar" ? "🎉 Akun dibuat. Selamat datang!" : "👋 Selamat datang, " + hasil.nama + "!");
      }
    });
  }

  // ---------- jalankan ----------
  document.addEventListener("DOMContentLoaded", () => {
    Auth.ensureAdmin();
    injectUI();
    bind();
    refresh();
  });
})();
