(function () {
  "use strict";

  const API_ROOT = "https://api.github.com";

  function headers(pat) {
    return {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Authorization": "Bearer " + pat,
    };
  }

  function contentsUrl(cfg, path) {
    return API_ROOT + "/repos/" + cfg.owner + "/" + cfg.repo +
      "/contents/" + encodeURI(path) +
      "?ref=" + encodeURIComponent(cfg.branch);
  }

  function contentsUrlNoRef(cfg, path) {
    return API_ROOT + "/repos/" + cfg.owner + "/" + cfg.repo +
      "/contents/" + encodeURI(path);
  }

  async function getFile(cfg, path) {
    const res = await fetch(contentsUrl(cfg, path), { headers: headers(cfg.githubPat) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("GET " + path + " failed: " + res.status);
    return res.json();
  }

  async function getJson(cfg, path) {
    const meta = await getFile(cfg, path);
    if (!meta) return { data: null, sha: null };
    const decoded = decodeBase64Utf8(meta.content);
    return { data: JSON.parse(decoded), sha: meta.sha };
  }

  async function putJson(cfg, path, jsonValue, sha, message) {
    const body = {
      message: message,
      content: encodeBase64Utf8(JSON.stringify(jsonValue, null, 2) + "\n"),
      branch: cfg.branch,
    };
    if (sha) body.sha = sha;
    const res = await fetch(contentsUrlNoRef(cfg, path), {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, headers(cfg.githubPat)),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await safeJson(res);
      const msg = err && err.message ? err.message : res.statusText;
      const e = new Error("PUT " + path + " failed: " + res.status + " " + msg);
      e.status = res.status;
      throw e;
    }
    return res.json();
  }

  async function putBinary(cfg, path, base64, message) {
    const body = {
      message: message,
      content: base64,
      branch: cfg.branch,
    };
    const res = await fetch(contentsUrlNoRef(cfg, path), {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, headers(cfg.githubPat)),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await safeJson(res);
      const msg = err && err.message ? err.message : res.statusText;
      const e = new Error("PUT " + path + " failed: " + res.status + " " + msg);
      e.status = res.status;
      throw e;
    }
    return res.json();
  }

  async function deleteFile(cfg, path, sha, message) {
    const body = { message: message, sha: sha, branch: cfg.branch };
    const res = await fetch(contentsUrlNoRef(cfg, path), {
      method: "DELETE",
      headers: Object.assign({ "Content-Type": "application/json" }, headers(cfg.githubPat)),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await safeJson(res);
      const msg = err && err.message ? err.message : res.statusText;
      throw new Error("DELETE " + path + " failed: " + res.status + " " + msg);
    }
    return res.json();
  }

  // 楽観的ロックで JSON を mutate。衝突時は1回だけリトライ。
  async function updateJsonWithRetry(cfg, path, mutator, message) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await getJson(cfg, path);
      const base = current.data == null ? { hamas: [] } : current.data;
      const next = mutator(JSON.parse(JSON.stringify(base)));
      try {
        return await putJson(cfg, path, next, current.sha, message);
      } catch (e) {
        if (e.status === 409 || e.status === 422) continue;
        throw e;
      }
    }
    throw new Error("同時編集の衝突が解消されませんでした。もう一度やり直してください。");
  }

  // 読み取りは GitHub Pages 経由の静的ファイル fetch が速く・認証不要で済む。
  // ただしキャッシュを避けたいので cache-bust パラメータを付ける。
  async function fetchPublicJson(path) {
    const url = path + "?_=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch " + path + " failed: " + res.status);
    return res.json();
  }

  // --- base64 helpers (UTF-8 safe) ---

  function encodeBase64Utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function decodeBase64Utf8(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function safeJson(res) {
    try { return await res.json(); } catch (_) { return null; }
  }

  window.GitHubClient = {
    getFile,
    getJson,
    putJson,
    putBinary,
    deleteFile,
    updateJsonWithRetry,
    fetchPublicJson,
  };
})();
