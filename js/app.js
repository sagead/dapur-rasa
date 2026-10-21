// ===== Aplikasi frontend Dapur Rasa =====

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const params = new URLSearchParams(window.location.search);

  // ---------- util ----------
  function getKat(slug) {
    return KATEGORI.find((k) => k.slug === slug) || KATEGORI[0];
  }

  function getResep(slug) {
    return RESEP.find((r) => r.slug === slug);
  }

  function countByKat(slug) {
    return RESEP.filter((r) => r.kategori === slug).length;
  }

  function formatWaktu(menit) {
    if (menit < 60) return menit + " menit";
    const j = Math.floor(menit / 60);
    const m = menit % 60;
    return m ? j + " jam " + m + " menit" : j + " jam";
  }

  function chipStyle(kat) {
    return `--chip-ink:#fff;--chip-bg:linear-gradient(135deg, ${kat.warna[0]}, ${kat.warna[1]});`;
  }

  function grad(kat) {
    return `background:linear-gradient(135deg, ${kat.warna[0]}, ${kat.warna[1]});`;
  }

  // ---------- kartu resep ----------
  function resepCard(r, withRank) {
    const kat = getKat(r.kategori);
    return `
      <article class="resep-card">
        <a class="resep-link" href="resep.html?slug=${encodeURIComponent(r.slug)}">
          <div class="resep-thumb pola-dots" style="${grad(kat)}">
            ${withRank ? `<span class="rank">#${withRank} TRENDING</span>` : `<span class="rank">${kat.nama}</span>`}
            <span>${kat.emoji}</span>
          </div>
          <div class="resep-body">
            <span class="chip" style="${chipStyle(kat)}">${kat.nama}</span>
            <h3>${r.judul}</h3>
            <p>${r.deskripsi}</p>
            <div class="resep-meta">
              <span class="meta-left">
                <span>⏱ ${formatWaktu(r.waktu)}</span>
                <span>🍽 ${r.porsi} porsi</span>
              </span>
              <span class="stars">★ ${r.rating}</span>
            </div>
          </div>
        </a>
        <button class="btn-save" type="button" data-save="${r.slug}"
                aria-label="Simpan resep" title="Simpan resep">🔖</button>
      </article>`;
  }

  // ================= HALAMAN BERANDA =================
  function renderHome() {
    const gridKat = $("#kategoriGrid");
    if (gridKat) {
      gridKat.innerHTML = KATEGORI.map((k) => `
        <a class="kategori-card pola-${k.pola}" style="${grad(k)}" data-emoji="${k.emoji}"
           href="kategori.html?kat=${k.slug}">
          <span class="k-label">${k.label}</span>
          <div>
            <h3>${k.nama}</h3>
            <p>${k.deskripsi}</p>
            <div class="k-bottom">
              <span>${countByKat(k.slug)} resep</span>
              <span class="k-arrow">→</span>
            </div>
          </div>
        </a>`).join("");
    }

    const gridTren = $("#trenGrid");
    if (gridTren) {
      const tren = [...RESEP].sort((a, b) => b.trending - a.trending).slice(0, 8);
      gridTren.innerHTML = tren.map((r, i) => resepCard(r, i + 1)).join("");
    }

    const gridTips = $("#tipsGrid");
    if (gridTips) {
      gridTips.innerHTML = TIPS.map(
        (t, i) => `
        <article class="tip-card">
          <strong>${["💡", "🔥", "🧂"][i] || "✅"} ${t.judul}</strong>
          <p>${t.isi}</p>
        </article>`
      ).join("");
    }

    // semua kotak pencarian mengarah ke halaman kategori
    $$('form[role="search"]').forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = new FormData(form).get("q");
        window.location.href = "kategori.html" + (q ? `?q=${encodeURIComponent(q)}` : "");
      });
    });

    // isi nilai kotak pencarian bila halaman dibuka dengan query
    const qAwal = params.get("q");
    if (qAwal) {
      $$('form[role="search"] input[name="q"]').forEach((inp) => (inp.value = qAwal));
    }
  }

  // ================= HALAMAN KATEGORI =================
  function renderKategori() {
    const head = $("#pageHead");
    if (!head) return;

    const katSlug = params.get("kat");
    const q = (params.get("q") || "").trim().toLowerCase();
    const kat = katSlug ? KATEGORI.find((k) => k.slug === katSlug) : null;

    // judul & deskripsi halaman
    if (q) {
      head.innerHTML = `
        <span class="eyebrow">Hasil pencarian</span>
        <h1>Mencari “${params.get("q")}”</h1>
        <p>Menampilkan resep yang cocok dengan kata kunci pencarianmu di seluruh kategori.</p>`;
      document.title = `Cari "${params.get("q")}" — Dapur Rasa`;
    } else if (kat) {
      head.innerHTML = `
        <span class="eyebrow">${kat.label} · ${countByKat(kat.slug)} resep</span>
        <h1>${kat.emoji} ${kat.nama}</h1>
        <p>${kat.deskripsi}</p>`;
      document.title = `${kat.nama} — Dapur Rasa`;
    } else {
      head.innerHTML = `
        <span class="eyebrow">Semua resep</span>
        <h1>Semua Resep Dapur Rasa</h1>
        <p>Jelajahi seluruh koleksi resep, atau saring berdasarkan kategori di bawah ini.</p>`;
      document.title = "Semua Resep — Dapur Rasa";
    }

    // breadcrumb
    const bc = $("#crumb");
    if (bc) {
      bc.innerHTML = `
        <li><a href="index.html">Beranda</a></li>
        <li class="sep">›</li>
        <li><a href="kategori.html">Resep</a></li>
        ${kat || q ? `<li class="sep">›</li><li>${kat ? kat.nama : "Pencarian"}</li>` : ""}`;
    }

    // chip filter kategori
    const chips = $("#filterBar");
    if (chips) {
      const semua = [{ slug: null, nama: "Semua Resep", emoji: "🍽" }, ...KATEGORI];
      chips.innerHTML = semua
        .map((k) => {
          const active = (k.slug === katSlug) ? " active" : "";
          const href = k.slug ? `kategori.html?kat=${k.slug}` : "kategori.html";
          return `<a class="filter-chip${active}" href="${href}">${k.emoji} ${k.nama}</a>`;
        })
        .join("");
    }

    // filter resep
    let hasil = [...RESEP];
    if (katSlug) hasil = hasil.filter((r) => r.kategori === katSlug);
    if (q) {
      hasil = hasil.filter((r) =>
        [r.judul, r.deskripsi, getKat(r.kategori).nama, ...(r.tags || []), ...(r.bahan || [])]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    hasil.sort((a, b) => b.trending - a.trending);

    const note = $("#resultNote");
    if (note) {
      note.textContent = hasil.length
        ? `Menampilkan ${hasil.length} resep${q ? ` untuk “${params.get("q")}”` : kat ? ` di kategori ${kat.nama}` : ""}.`
        : "";
    }

    const grid = $("#listGrid");
    if (!grid) return;

    if (!hasil.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="icon">🍽</div>
          <h3>Resep belum ditemukan</h3>
          <p>Coba kata kunci lain, misalnya “ayam”, “kopi”, atau pilih kategori di atas.</p>
          <p style="margin-top:16px"><a class="btn btn-primary" href="kategori.html">Lihat semua resep</a></p>
        </div>`;
      return;
    }

    grid.innerHTML = hasil.map((r) => resepCard(r, null)).join("");

    // rekomendasi tren di bawah daftar resep
    const gridTren = $("#listTren");
    if (gridTren) {
      const tren = [...RESEP].sort((a, b) => b.trending - a.trending).slice(0, 4);
      gridTren.innerHTML = tren.map((r, i) => resepCard(r, i + 1)).join("");
    }
  }

  // ================= HALAMAN DETAIL RESEP =================
  function renderDetail() {
    const root = $("#detailRoot");
    if (!root) return;

    const r = getResep(params.get("slug"));

    if (!r) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="icon">🍳</div>
          <h3>Resep tidak ditemukan</h3>
          <p>Resep yang kamu cari mungkin sudah dipindahkan.</p>
          <p style="margin-top:16px"><a class="btn btn-primary" href="kategori.html">Kembali ke daftar resep</a></p>
        </div>`;
      return;
    }

    const kat = getKat(r.kategori);
    // pastikan array pendukung selalu ada walau data diedit admin
    r.bahan = r.bahan || [];
    r.langkah = r.langkah || [];
    r.tags = r.tags || [];
    document.title = `${r.judul} — Dapur Rasa`;

    const crumb = $("#crumb");
    if (crumb) {
      crumb.innerHTML = `
        <li><a href="index.html">Beranda</a></li>
        <li class="sep">›</li>
        <li><a href="kategori.html?kat=${kat.slug}">${kat.nama}</a></li>
        <li class="sep">›</li>
        <li>${r.judul}</li>`;
    }

    const lain = RESEP.filter((x) => x.kategori === kat.slug && x.slug !== r.slug).slice(0, 4);

    root.innerHTML = `
      <div class="detail-banner pola-${kat.pola}" data-emoji="${kat.emoji}" style="${grad(kat)}">
        <div class="banner-inner">
          <span class="chip">${kat.nama}</span>
          <h1>${r.judul}</h1>
          <p>${r.deskripsi}</p>
          <div class="banner-meta">
            <div><span>Waktu</span>${formatWaktu(r.waktu)}</div>
            <div><span>Porsi</span>${r.porsi} orang</div>
            <div><span>Tingkat</span>${r.tingkat}</div>
            <div><span>Rating</span>★ ${r.rating} (${r.jumlah} ulasan)</div>
          </div>
          <div class="banner-actions">
            <button class="btn btn-light" type="button" data-save="${r.slug}" data-label="1">
              🔖 <span>Simpan resep</span>
            </button>
            <a class="btn btn-light" href="#langkah">👩‍🍳 Mulai memasak</a>
          </div>
        </div>
      </div>

      <div class="detail-layout">
        <aside class="panel sticky" id="panelBahan">
          <div class="panel-head">
            <h2>🧺 Bahan-bahan</h2>
            <span class="bahan-progress" id="bahanProgress">0/${r.bahan.length} siap</span>
          </div>
          <div class="progress"><span id="bahanBar"></span></div>

          <div class="bahan-wrap" id="bahanWrap">
            <div class="bahan-scroll" id="bahanScroll">
              <ul class="bahan-list">
                ${(r.bahan || [])
                  .map(
                    (b, i) => `
                  <li>
                    <label class="bahan-item">
                      <input type="checkbox" data-idx="${i}" />
                      <span class="check">✓</span>
                      <span class="txt">${b}</span>
                    </label>
                  </li>`
                  )
                  .join("")}
              </ul>
            </div>
            <span class="bahan-fade"></span>
          </div>

          <button type="button" class="btn-expand" id="btnExpandBahan">Tampilkan semua bahan</button>
          <div class="tag-list">${r.tags.map((t) => `<span>#${t}</span>`).join("")}</div>
        </aside>

        <div>
          <div class="info-strip">
            <div><strong>${formatWaktu(r.waktu)}</strong><span>Total waktu</span></div>
            <div><strong>${r.porsi} porsi</strong><span>Hasil akhir</span></div>
            <div><strong>${r.tingkat}</strong><span>Tingkat kesulitan</span></div>
          </div>

          <h2 class="section-sub" id="langkah">👩‍🍳 Langkah memasak</h2>
          <ol class="langkah-list">
            ${r.langkah.map((l) => `<li><p>${l}</p></li>`).join("")}
          </ol>

          <h2 class="section-sub">${window.DB ? DB.teks("detail.catatanJudul") : "✅ Catatan dari dapur"}</h2>
          <div class="panel">
            <p class="detail-intro" style="margin:0">
              ${window.DB ? DB.teks("detail.catatan") : ""}
            </p>
          </div>

          ${
            lain.length
              ? `<h2 class="section-sub">Resep lain di ${kat.nama}</h2>
                 <div class="resep-grid resep-grid-dua">${lain.map((x) => resepCard(x, null)).join("")}</div>`
              : ""
          }

          <p style="margin-top:30px">
            <a class="btn btn-ghost" href="kategori.html?kat=${kat.slug}">← Lihat semua ${kat.nama}</a>
          </p>
        </div>
      </div>`;

    initBahan(r);
  }

  // ================= DAFTAR BAHAN =================
  // Panel bahan dibatasi setinggi layar lalu digulir sendiri, sehingga semua
  // bahan selalu bisa dijangkau tanpa menggulir halaman sampai paling bawah.
  function initBahan(r) {
    const panel = $("#panelBahan");
    if (!panel) return;

    const scroll = $("#bahanScroll", panel);
    const wrap = $("#bahanWrap", panel);
    const btn = $("#btnExpandBahan", panel);
    const bar = $("#bahanBar", panel);
    const info = $("#bahanProgress", panel);
    const boxes = $$(".bahan-item input", panel);
    const total = r.bahan.length;
    const key = "dapur-rasa:bahan:" + r.slug;
    // deteksi mode desktop (panel sticky) dengan cadangan bila matchMedia tidak ada
    const mqDesktop = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 1041px)") : null;
    const modeDesktop = () => (mqDesktop ? mqDesktop.matches : window.innerWidth > 1040);

    // pulihkan centangan terakhir (disimpan di browser masing-masing)
    let tersimpan = [];
    try {
      tersimpan = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      tersimpan = [];
    }
    boxes.forEach((b) => (b.checked = tersimpan.includes(Number(b.dataset.idx))));

    function update() {
      const siap = boxes.filter((b) => b.checked).map((b) => Number(b.dataset.idx));
      info.textContent = siap.length + "/" + total + " siap";
      bar.style.width = (siap.length / total) * 100 + "%";
      try {
        localStorage.setItem(key, JSON.stringify(siap));
      } catch (e) {
        /* penyimpanan tidak tersedia: abaikan */
      }
    }

    function sinkron() {
      const lebih = scroll.scrollHeight - scroll.clientHeight > 4;
      wrap.classList.toggle("is-scrollable", lebih);
      wrap.classList.toggle(
        "at-bottom",
        scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 4
      );
      if (modeDesktop()) panel.classList.remove("bahan-open");
      btn.classList.toggle("show", !modeDesktop() && lebih);
      btn.textContent = panel.classList.contains("bahan-open")
        ? "Sembunyikan daftar bahan"
        : "Tampilkan semua bahan (" + total + ")";
    }

    boxes.forEach((b) => b.addEventListener("change", update));
    scroll.addEventListener("scroll", sinkron, { passive: true });
    btn.addEventListener("click", () => {
      panel.classList.toggle("bahan-open");
      if (!panel.classList.contains("bahan-open")) scroll.scrollTop = 0;
      sinkron();
    });
    window.addEventListener("resize", sinkron);
    if (mqDesktop && typeof mqDesktop.addEventListener === "function") {
      mqDesktop.addEventListener("change", sinkron);
    }

    update();
    sinkron();
    window.requestAnimationFrame(sinkron);
  }

  // ================= NAV MOBILE =================
  function initNav() {
    const toggle = $("#navToggle");
    const links = $("#navLinks");
    if (toggle && links) {
      toggle.addEventListener("click", () => links.classList.toggle("open"));
      $$("#navLinks a").forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));
    }
  }

  // dipakai halaman profil (js/auth.js) untuk menampilkan kartu resep
  window.DapurRasa = { resepCard, getKat, getResep, formatWaktu };

  // ---------- jalankan ----------
  document.addEventListener("DOMContentLoaded", () => {
    renderHome();
    renderKategori();
    renderDetail();
    initNav();
  });
})();
