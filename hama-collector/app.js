(function () {
  "use strict";

  const STORAGE_KEYS = {
    nickname: "hama.nickname",
    authed: "hama.authed",
  };

  const state = {
    hamas: [],
    loaded: false,
    pendingPhoto: null, // { base64, ext, dataUrl }
  };

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (!window.APP_CONFIG) {
      showFatal("config.js が読み込まれていません。README.md の手順に沿って設定してください。");
      return;
    }
    const cfg = window.APP_CONFIG;
    if (!cfg.passphrase || cfg.passphrase === "__CHANGE_ME__") {
      showFatal("config.js の passphrase が未設定です。");
      return;
    }

    // 既にログイン済みなら復元
    const savedNick = localStorage.getItem(STORAGE_KEYS.nickname) || "";
    const authed = localStorage.getItem(STORAGE_KEYS.authed) === "1";
    document.getElementById("login-nickname").value = savedNick;
    if (authed && savedNick) {
      enterApp();
    }

    wireLogin();
    wireTabs();
    wireAddForm();
    wireSearch();
    wireRefresh();
    wireModal();
    wireLogout();
  }

  function showFatal(msg) {
    document.body.innerHTML =
      '<div style="padding:32px;max-width:520px;margin:40px auto;font-family:sans-serif;color:#1a2733">' +
      '<h1 style="color:#b00020">設定エラー</h1><p>' + escapeHtml(msg) + "</p></div>";
  }

  // ------------------------------------------------------------
  // Login
  // ------------------------------------------------------------

  function wireLogin() {
    const submit = document.getElementById("login-submit");
    const nick = document.getElementById("login-nickname");
    const pass = document.getElementById("login-passphrase");
    const err = document.getElementById("login-error");

    function tryLogin() {
      err.hidden = true;
      const nickname = nick.value.trim();
      const passphrase = pass.value;
      if (!nickname) {
        err.textContent = "ニックネームを入れてね";
        err.hidden = false;
        return;
      }
      if (passphrase !== window.APP_CONFIG.passphrase) {
        err.textContent = "合言葉がちがうみたい";
        err.hidden = false;
        pass.value = "";
        return;
      }
      localStorage.setItem(STORAGE_KEYS.nickname, nickname);
      localStorage.setItem(STORAGE_KEYS.authed, "1");
      pass.value = "";
      enterApp();
    }

    submit.addEventListener("click", tryLogin);
    pass.addEventListener("keydown", function (e) {
      if (e.key === "Enter") tryLogin();
    });
    nick.addEventListener("keydown", function (e) {
      if (e.key === "Enter") pass.focus();
    });
  }

  function wireLogout() {
    document.getElementById("logout-btn").addEventListener("click", function () {
      if (!confirm("ログアウトしますか？")) return;
      localStorage.removeItem(STORAGE_KEYS.authed);
      document.getElementById("login-passphrase").value = "";
      showView("login-view");
    });
  }

  function enterApp() {
    showView("main-view");
    if (!state.loaded) loadHamas();
  }

  function showView(id) {
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("active", v.id === id);
    });
  }

  // ------------------------------------------------------------
  // Tabs
  // ------------------------------------------------------------

  function wireTabs() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const name = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        document.querySelectorAll(".tab-panel").forEach(function (p) {
          p.classList.toggle("active", p.id === name + "-tab");
        });
      });
    });
  }

  // ------------------------------------------------------------
  // List loading / rendering
  // ------------------------------------------------------------

  function wireRefresh() {
    document.getElementById("refresh-btn").addEventListener("click", loadHamas);
  }

  async function loadHamas() {
    const status = document.getElementById("list-status");
    status.textContent = "読み込み中…";
    status.hidden = false;
    try {
      // まずはpublic経由で試し、失敗したらAPI経由で取る
      let data;
      try {
        data = await GitHubClient.fetchPublicJson(
          relativeDataPath(window.APP_CONFIG.dataPath)
        );
      } catch (_) {
        const res = await GitHubClient.getJson(window.APP_CONFIG, window.APP_CONFIG.dataPath);
        data = res.data || { hamas: [] };
      }
      state.hamas = Array.isArray(data.hamas) ? data.hamas : [];
      state.loaded = true;
      renderList();
      if (state.hamas.length === 0) {
        status.textContent = "まだ浜がいません。追加タブから登録しよう。";
      } else {
        status.hidden = true;
      }
    } catch (e) {
      console.error(e);
      status.textContent = "読み込みに失敗: " + e.message;
      status.classList.add("error");
    }
  }

  // data/hamas.json へのサイト相対パス
  function relativeDataPath(repoRelativePath) {
    // 例: "hama-collector/data/hamas.json" が欲しいのは "data/hamas.json"
    const prefix = "hama-collector/";
    if (repoRelativePath.indexOf(prefix) === 0) {
      return repoRelativePath.slice(prefix.length);
    }
    return repoRelativePath;
  }
  function relativePhotoUrl(repoRelativePath) {
    const prefix = "hama-collector/";
    if (repoRelativePath && repoRelativePath.indexOf(prefix) === 0) {
      return repoRelativePath.slice(prefix.length);
    }
    return repoRelativePath;
  }

  function wireSearch() {
    const box = document.getElementById("search-box");
    box.addEventListener("input", renderList);
  }

  function renderList() {
    const ul = document.getElementById("hama-list");
    const q = (document.getElementById("search-box").value || "").trim().toLowerCase();
    const items = state.hamas
      .slice()
      .sort(function (a, b) {
        return (b.created_at || "").localeCompare(a.created_at || "");
      })
      .filter(function (h) {
        if (!q) return true;
        const hay = [h.name, h.encountered_at, h.note, h.added_by].join(" ").toLowerCase();
        return hay.indexOf(q) >= 0;
      });

    ul.innerHTML = "";
    if (items.length === 0) {
      if (q) {
        ul.innerHTML = '<li class="empty-state">検索にヒットしませんでした</li>';
      }
      return;
    }
    items.forEach(function (h) {
      ul.appendChild(renderCard(h));
    });
  }

  function renderCard(h) {
    const li = document.createElement("li");
    li.className = "hama-card";
    li.addEventListener("click", function () { openDetail(h); });

    const thumb = document.createElement("div");
    thumb.className = "hama-thumb";
    if (h.photo_path) {
      const img = document.createElement("img");
      img.src = relativePhotoUrl(h.photo_path);
      img.alt = h.name;
      img.loading = "lazy";
      thumb.appendChild(img);
    } else {
      thumb.textContent = "浜";
    }

    const info = document.createElement("div");
    info.className = "hama-info";

    const name = document.createElement("p");
    name.className = "hama-name";
    name.textContent = h.name;
    const badge = document.createElement("span");
    badge.className = "kind-badge " + (h.kind === "place" ? "place" : "person");
    badge.textContent = h.kind === "place" ? "地名" : "人名";
    name.appendChild(badge);

    const meta = document.createElement("p");
    meta.className = "hama-meta";
    const metaParts = [];
    if (h.encountered_at) metaParts.push(h.encountered_at);
    if (h.added_by) metaParts.push("by " + h.added_by);
    meta.textContent = metaParts.join(" · ") || " ";

    info.appendChild(name);
    info.appendChild(meta);

    li.appendChild(thumb);
    li.appendChild(info);
    return li;
  }

  // ------------------------------------------------------------
  // Detail modal
  // ------------------------------------------------------------

  function wireModal() {
    document.querySelectorAll("[data-close-modal]").forEach(function (el) {
      el.addEventListener("click", closeDetail);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDetail();
    });
  }

  function openDetail(h) {
    const body = document.getElementById("detail-body");
    body.innerHTML = "";

    if (h.photo_path) {
      const img = document.createElement("img");
      img.className = "detail-photo";
      img.src = relativePhotoUrl(h.photo_path);
      img.alt = h.name;
      body.appendChild(img);
    }

    const title = document.createElement("h2");
    title.className = "detail-title";
    title.textContent = h.name;
    const badge = document.createElement("span");
    badge.className = "kind-badge " + (h.kind === "place" ? "place" : "person");
    badge.textContent = h.kind === "place" ? "地名" : "人名";
    title.appendChild(badge);
    body.appendChild(title);

    const dl = document.createElement("dl");
    dl.appendChild(row("出会った場所", h.encountered_at));
    dl.appendChild(row("発見日", h.found_on));
    dl.appendChild(row("メモ", h.note));
    dl.appendChild(row("追加した人", h.added_by));
    body.appendChild(dl);

    const myNick = localStorage.getItem(STORAGE_KEYS.nickname) || "";
    if (h.added_by && myNick && h.added_by === myNick) {
      const actions = document.createElement("div");
      actions.className = "detail-actions";
      const del = document.createElement("button");
      del.className = "danger-btn";
      del.textContent = "削除する";
      del.addEventListener("click", function () { doDelete(h); });
      actions.appendChild(del);
      body.appendChild(actions);
    }

    document.getElementById("detail-modal").hidden = false;
  }

  function row(label, value) {
    const wrap = document.createElement("div");
    wrap.className = "detail-row";
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value && String(value).trim() ? value : "—";
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    return wrap;
  }

  function closeDetail() {
    document.getElementById("detail-modal").hidden = true;
  }

  async function doDelete(h) {
    if (!confirm("「" + h.name + "」を削除しますか？")) return;
    try {
      await GitHubClient.updateJsonWithRetry(
        window.APP_CONFIG,
        window.APP_CONFIG.dataPath,
        function (obj) {
          obj.hamas = (obj.hamas || []).filter(function (x) { return x.id !== h.id; });
          return obj;
        },
        "hama: delete " + h.name
      );
      if (h.photo_path) {
        try {
          const meta = await GitHubClient.getFile(window.APP_CONFIG, h.photo_path);
          if (meta && meta.sha) {
            await GitHubClient.deleteFile(
              window.APP_CONFIG, h.photo_path, meta.sha, "hama: delete photo " + h.id
            );
          }
        } catch (e) {
          console.warn("写真削除に失敗しましたが、エントリは削除されました:", e);
        }
      }
      closeDetail();
      await loadHamas();
    } catch (e) {
      alert("削除に失敗: " + e.message);
    }
  }

  // ------------------------------------------------------------
  // Add form
  // ------------------------------------------------------------

  function wireAddForm() {
    const form = document.getElementById("add-form");
    const photoInput = document.getElementById("photo-input");
    const previewWrap = document.getElementById("photo-preview-wrap");
    const preview = document.getElementById("photo-preview");
    const clearBtn = document.getElementById("photo-clear");
    const submitBtn = document.getElementById("add-submit");
    const statusEl = document.getElementById("add-status");

    // 発見日のデフォルトを今日に
    const dateInput = form.querySelector('input[name="found_on"]');
    dateInput.value = todayStr();

    photoInput.addEventListener("change", async function () {
      state.pendingPhoto = null;
      previewWrap.hidden = true;
      preview.src = "";
      const f = photoInput.files && photoInput.files[0];
      if (!f) return;
      try {
        const out = await resizeImage(f, 1280, 0.8);
        state.pendingPhoto = out;
        preview.src = out.dataUrl;
        previewWrap.hidden = false;
      } catch (e) {
        alert("画像の読み込みに失敗: " + e.message);
      }
    });

    clearBtn.addEventListener("click", function () {
      state.pendingPhoto = null;
      photoInput.value = "";
      previewWrap.hidden = true;
      preview.src = "";
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      statusEl.hidden = true;
      statusEl.className = "status-msg";

      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const kind = String(data.get("kind") || "person");
      const encountered = String(data.get("encountered_at") || "").trim();
      const foundOn = String(data.get("found_on") || "").trim();
      const note = String(data.get("note") || "").trim();
      const nickname = localStorage.getItem(STORAGE_KEYS.nickname) || "";

      if (!name) {
        statusEl.textContent = "名前を入れてね";
        statusEl.classList.add("error");
        statusEl.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "登録中…";
      statusEl.hidden = false;

      const id = uuid();
      let photoPath = null;

      try {
        if (state.pendingPhoto) {
          photoPath = window.APP_CONFIG.photosDir + "/" + id + "." + state.pendingPhoto.ext;
          await GitHubClient.putBinary(
            window.APP_CONFIG,
            photoPath,
            state.pendingPhoto.base64,
            "hama: add photo " + id
          );
        }

        const record = {
          id: id,
          name: name,
          kind: kind,
          encountered_at: encountered,
          note: note,
          photo_path: photoPath,
          added_by: nickname,
          found_on: foundOn,
          created_at: new Date().toISOString(),
        };

        await GitHubClient.updateJsonWithRetry(
          window.APP_CONFIG,
          window.APP_CONFIG.dataPath,
          function (obj) {
            if (!Array.isArray(obj.hamas)) obj.hamas = [];
            obj.hamas.push(record);
            return obj;
          },
          "hama: add " + name
        );

        statusEl.textContent = "登録しました！";
        statusEl.classList.add("success");

        // フォームリセット
        form.reset();
        dateInput.value = todayStr();
        state.pendingPhoto = null;
        previewWrap.hidden = true;
        preview.src = "";

        // 一覧タブに戻る
        setTimeout(function () {
          statusEl.hidden = true;
          statusEl.classList.remove("success");
          document.querySelector('.tab-btn[data-tab="list"]').click();
          loadHamas();
        }, 800);
      } catch (err) {
        console.error(err);
        statusEl.textContent = "登録失敗: " + err.message;
        statusEl.classList.add("error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Canvas で長辺=maxEdge にリサイズし、JPEGに統一
  async function resizeImage(file, maxEdge, quality) {
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const outDataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = outDataUrl.split(",", 2)[1];
    return { base64: base64, ext: "jpg", dataUrl: outDataUrl };
  }
  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("読み込み失敗")); };
      r.readAsDataURL(file);
    });
  }
  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("画像デコード失敗")); };
      img.src = url;
    });
  }

})();
