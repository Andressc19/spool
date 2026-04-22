// ==UserScript==
// @name         Spool - ChatGPT Exporter
// @namespace    http://spool.local
// @version      1.0.0
// @description  Export all your ChatGPT conversations as JSON, Markdown, HTML and ZIP. Supports selective download with preview.
// @author      Spool contributors
// @license     MIT - see https://github.com/Andressc19/spool
// @homepage    https://github.com/Andressc19/spool
// @updateURL   https://raw.githubusercontent.com/Andressc19/spool/main/spool.user.js
// @downloadURL https://raw.githubusercontent.com/Andressc19/spool/main/spool.user.js
// @match       https://chatgpt.com/*
// @match       https://chatgpt.com/*/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

// ════════════════════════════════════════════════════════���════════════════════════════
// Spool - ChatGPT Conversation Exporter
// Inspired by: https://gist.github.com/ocombe/1d7604bd29a91ceb716304ef8b5aa4b5
// License: MIT - see LICENSE file
// ═════════════════════════════════════════════════════════════════════════════

// Auto-add floating button on page load
(function addFloatingButton() {
  if (document.getElementById("spool-fab")) return;
  const fab = document.createElement("button");
  fab.id = "spool-fab";
  fab.title = "Open Spool - ChatGPT Exporter";
  fab.innerHTML = "📦";
  fab.onclick = () => { window.location.reload(); };
  Object.assign(fab.style, {
    position: "fixed", bottom: "20px", right: "20px",
    width: "50px", height: "50px",
    borderRadius: "50%", border: "none",
    background: "#3b82f6", color: "#fff",
    fontSize: "22px", cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    zIndex: "9999", transition: "transform 0.2s",
  });
  fab.onmouseenter = () => fab.style.transform = "scale(1.1)";
  fab.onmouseleave = () => fab.style.transform = "scale(1)";
  document.body.appendChild(fab);
})();

(async () => {
  if (document.getElementById("spool-overlay")) return;

  const API = "/backend-api";
  const PAGE_SIZE = 100;
  const DELAY = 500;
  const DEVICE_ID = crypto.randomUUID();
  const STORAGE_KEY = "spool_selections";

  const HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Oai-Device-Id": DEVICE_ID,
    "Oai-Language": "en-US",
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── UI State helpers ───────────────────────────────────────────────

  function showLoading(msg = "Loading...") {
    document.getElementById("spool-list").innerHTML = `<div class="spool-loading">${msg}</div>`;
    document.getElementById("spool-preview").innerHTML = '<div class="spool-preview-empty">Select a conversation to preview</div>';
    document.getElementById("spool-stats").textContent = "Loading...";
  }

  function showError(msg, canRetry = true) {
    const retryBtn = canRetry ? '<button id="spool-retry" class="spool-btn spool-btn-sm" style="margin-top:8px">Retry</button>' : '';
    document.getElementById("spool-list").innerHTML = `<div class="spool-error">
      <div class="spool-error-icon">⚠️</div>
      <div class="spool-error-msg">${escapeHtml(msg)}</div>
      ${retryBtn}
    </div>`;
    document.getElementById("spool-stats").textContent = "Error";
    if (canRetry) {
      document.getElementById("spool-retry").onclick = () => window.location.reload();
    }
  }

  // ── Storage helpers ───────────────────────────────────────────────

  function loadSelections() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
    catch { return new Set(); }
  }

  function saveSelections(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  }

  // ── UI Overlay ─────────────────────────────────────────────────────

  const overlay = document.createElement("div");
  overlay.id = "spool-overlay";
  overlay.innerHTML = `
    <div class="spool-modal">
      <div class="spool-header">
        <div class="spool-logo">📦</div>
        <div class="spool-title-area">
          <h2>Spool</h2>
          <p class="spool-subtitle">Export your conversations</p>
        </div>
        <button class="spool-close" id="spool-close-btn">&times;</button>
      </div>

      <div class="spool-toolbar">
        <input type="text" id="spool-search" placeholder="Search conversations...">
        <select id="spool-date-filter">
          <option value="all">All time</option>
          <option value="week">Last week</option>
          <option value="month">Last month</option>
          <option value="year">Last year</option>
        </select>
        <button id="spool-select-all" class="spool-btn spool-btn-sm">Select all</button>
        <button id="spool-select-none" class="spool-btn spool-btn-sm">None</button>
      </div>

      <div class="spool-body">
        <div class="spool-list" id="spool-list"></div>
        <div class="spool-preview" id="spool-preview">
          <div class="spool-preview-empty">Click a conversation to preview</div>
        </div>
      </div>

      <div class="spool-footer">
        <div class="spool-stats" id="spool-stats">0 selected</div>
        <div class="spool-actions">
          <button id="spool-cancel" class="spool-btn spool-btn-secondary">Cancel</button>
          <button id="spool-export" class="spool-btn spool-btn-primary" disabled>Export 0</button>
        </div>
      </div>

      <div class="spool-progress-area" id="spool-progress-area" style="display:none">
        <div class="spool-progress-bar-bg"><div class="spool-progress-bar" id="spool-progress-bar"></div></div>
        <div class="spool-progress-text" id="spool-progress-text">Starting...</div>
      </div>
    </div>`;

  document.head.insertAdjacentHTML("beforeend", `<style>
    #spool-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif }
    #spool-overlay * { box-sizing:border-box;margin:0;padding:0 }
    .spool-modal { background:#0f172a;border-radius:16px;width:min(96vw,1000px);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.5) }
    .spool-header { display:flex;align-items:center;gap:12px;padding:20px 24px;border-bottom:1px solid #1e293b }
    .spool-logo { font-size:32px }
    .spool-title-area h2 { color:#f8fafc;font-size:24px }
    .spool-subtitle { color:#64748b;font-size:14px }
    .spool-close { margin-left:auto;background:none;border:none;color:#94a3b8;font-size:28px;cursor:pointer }
    .spool-close:hover { color:#fff }
    .spool-toolbar { display:flex;gap:12px;padding:16px 24px;border-bottom:1px solid #1e293b;flex-wrap:wrap;align-items:center }
    .spool-toolbar input { flex:1;min-width:160px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;padding:10px 14px;font-size:14px }
    .spool-toolbar input:focus { outline:none;border-color:#3b82f6 }
    .spool-toolbar input::placeholder { color:#475569 }
    .spool-toolbar select { background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;padding:10px 12px;font-size:14px }
    .spool-btn { border:none;border-radius:8px;cursor:pointer;font-size:14px;transition:background 0.2s }
    .spool-btn-sm { padding:8px 14px;background:#334155;color:#e2e8f0 }
    .spool-btn-sm:hover { background:#475569 }
    .spool-body { display:flex;flex:1;overflow:hidden;min-height:400px }
    .spool-list { flex:1;overflow-y:auto;padding:16px;border-right:1px solid #1e293b;min-width:0;min-height:350px }
    .spool-preview { width:min(420px,45%);overflow-y:auto;padding:16px;background:#0f172a;min-height:350px }
    .spool-preview-empty { color:#475569;font-size:14px;text-align:center;margin-top:48px }
    .spool-loading { color:#94a3b8;font-size:16px;text-align:center;margin-top:48px }
    .spool-error { color:#fecaca;font-size:16px;text-align:center;margin-top:48px }
    .spool-error-icon { font-size:36px;margin-bottom:12px }
    .spool-error-msg { color:#f87171;font-size:14px;max-width:300px;margin:0 auto }
    .spool-conv-item { display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:8px;cursor:pointer;margin-bottom:6px }
    .spool-conv-item:hover { background:#1e293b }
    .spool-conv-item.selected { background:#1e3a5f }
    .spool-conv-item input[type="checkbox"] { margin-top:3px;accent-color:#3b82f6;width:18px;height:18px;cursor:pointer;flex-shrink:0 }
    .spool-conv-info { flex:1;min-width:0 }
    .spool-conv-title { color:#e2e8f0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
    .spool-conv-meta { color:#64748b;font-size:13px;margin-top:4px }
    .spool-preview-header { padding:16px;border-bottom:1px solid #1e293b;margin:-16px -16px 16px;background:#1e293b }
    .spool-preview-header h3 { color:#f8fafc;font-size:18px;margin-bottom:6px }
    .spool-preview-header .date { color:#64748b;font-size:14px }
    .spool-preview-body { font-size:14px;color:#94a3b8;line-height:1.6;white-space:pre-wrap;word-break:break-word }
    .spool-preview-body .msg { margin-bottom:16px }
    .spool-preview-body .role-user { color:#3b82f6;font-weight:600 }
    .spool-preview-body .role-assistant { color:#22c55e;font-weight:600 }
    .spool-preview-files { margin-top:12px;padding:12px;border:1px solid #334155;border-radius:8px }
    .spool-preview-files h4 { color:#94a3b8;font-size:14px;margin-bottom:8px }
    .spool-preview-files span { display:inline-block;background:#1e293b;border-radius:4px;padding:4px 10px;font-size:13px;color:#94a3b8;margin:2px } </style>
    <style>
    .spool-footer { display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-top:1px solid #1e293b;flex-wrap:wrap;gap:12px }
    .spool-stats { color:#94a3b8;font-size:15px }
    .spool-actions { display:flex;gap:12px }
    .spool-btn-primary { background:#3b82f6;color:#fff;padding:12px 24px;font-size:16px;font-weight:600 }
    .spool-btn-primary:hover { background:#2563eb }
    .spool-btn-primary:disabled { background:#475569;cursor:not-allowed }
    .spool-btn-secondary { background:#334155;color:#e2e8f0;padding:12px 24px;font-size:16px }
    .spool-btn-secondary:hover { background:#475569 }
    .spool-progress-area { padding:16px 24px 20px }
    .spool-progress-bar-bg { height:8px;background:#1e293b;border-radius:4px;overflow:hidden }
    .spool-progress-bar { height:100%;background:#3b82f6;border-radius:4px;width:0;transition:width 0.3s }
    .spool-progress-text { color:#94a3b8;font-size:14px;margin-top:8px } </style>`);

  document.body.appendChild(overlay);

  // Show loading state
  showLoading("Fetching session token...");

  // ── Get token ───────────────────────────────────────────────────────

  let token;
  try {
    const sessionResp = await fetch("/api/auth/session");
    const session = await sessionResp.json();
    console.log("[Spool] Session response:", session);
    if (!sessionResp.ok) throw new Error(`HTTP ${sessionResp.status}: ${session.message || "Failed"}`);
    token = session.accessToken;
    if (!token) throw new Error("No accessToken - are you logged in?");
  } catch (e) {
    showError(`Failed to get session: ${e.message}`, true);
    console.error("[Spool] Session error:", e);
    return;
  }

  showLoading("Loading conversations...");

  // ── API helpers ──────────────────────────────────────────────────────

  async function apiGet(path) {
    const resp = await fetch(`${API}/${path}`, { headers: { ...HEADERS, Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  async function apiFetchBinary(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return { data: new Uint8Array(await resp.arrayBuffer()), contentType: resp.headers.get("content-type") || "" };
  }

  const MIME_TO_EXT = {
    "image/png":".png","image/jpeg":".jpg","image/gif":".gif","image/webp":".webp",
    "application/pdf":".pdf","text/plain":".txt","text/csv":".csv",
    "application/json":".json","application/zip":".zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":".xlsx",
  };

  // ── File references ─────────────────────────────────────────────────

  function extractFileReferences(convo) {
    const refs = []; const seen = new Set(); const mapping = convo.mapping || {};
    for (const node of Object.values(mapping)) {
      const msg = node.message; if (!msg) continue;
      if (msg.content?.parts) {
        for (const part of msg.content.parts) {
          if (part?.content_type === "image_asset_pointer" && part.asset_pointer) {
            const match = part.asset_pointer.match(/^(?:file-service|sediment):\/\/(.+)$/);
            if (match && !seen.has(match[1])) { seen.add(match[1]);
              refs.push({ fileId: match[1], filename: part.metadata?.dalle?.prompt ? "dalle_image.png" : "image.png", type: "image" });
            }
          }
        }
      }
      if (msg.metadata?.attachments) {
        for (const att of msg.metadata.attachments) {
          if (att.id && !seen.has(att.id)) { seen.add(att.id);
            refs.push({ fileId: att.id, filename: att.name || "attachment", type: "attachment" });
          }
        }
      }
      if (msg.metadata?.citations) {
        for (const cit of msg.metadata.citations) {
          const fileId = cit.metadata?.file_id || cit.file_id;
          const title = cit.metadata?.title || cit.title || "citation";
          if (fileId && !seen.has(fileId)) { seen.add(fileId);
            refs.push({ fileId, filename: title, type: "citation" });
          }
        }
      }
    }
    return refs;
  }

  async function downloadFile(fileId, fallbackName) {
    const meta = await apiGet(`files/download/${fileId}`);
    if (!meta.download_url) throw new Error("No download_url");
    const { data, contentType } = await apiFetchBinary(meta.download_url);
    let filename = meta.file_name || fallbackName || fileId;
    if (!filename.includes(".") && contentType) {
      const mime = contentType.split(";")[0].trim();
      const ext = MIME_TO_EXT[mime]; if (ext) filename += ext;
    }
    return { filename, data };
  }

  function deduplicateFilename(name, usedNames) {
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
    const dot = name.lastIndexOf("."); const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : ""; let i = 1;
    while (usedNames.has(`${base}_${i}${ext}`)) i++;
    const deduped = `${base}_${i}${ext}`; usedNames.add(deduped); return deduped;
  }

  function sanitize(name) {
    return name.replace(/[<>:"/\\|?*]/g, "_").replace(/^[. ]+|[. ]+$/g, "").slice(0, 80) || "untitled";
  }

  function stripCitations(str) { return str.replace(/\u3010[^\u3011]*\u3011/g, ""); }

  function escapeHtml(str) {
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── Fetch conversations with cursor-based pagination ─────────────────

  let conversations = [];
  try {
    let offset = 0; let cursor = null; let page = 0;
    while (true) {
      page++;
      const params = cursor ? `limit=${PAGE_SIZE}&cursor=${cursor}` : `offset=${offset}&limit=${PAGE_SIZE}`;
      const data = await apiGet(`conversations?${params}`);
      console.log(`[Spool] Page ${page}: got ${(data.items || []).length} items, total=${data.total}, next_cursor=${data.next_cursor}, has_more=${data.has_more}`);
      const items = data.items || [];
      if (!items.length) break;
      conversations.push(...items);
      if (data.next_cursor) { cursor = data.next_cursor; offset = 0; }
      else { offset += PAGE_SIZE; if (!data.has_more || offset >= (data.total || 0)) break; }
      showLoading(`Loading conversations... ${conversations.length}${data.total ? ` / ${data.total}` : ""}`);
      await sleep(DELAY);
    }
    console.log(`[Spool] Total loaded: ${conversations.length} conversations`);
  } catch (e) {
    showError(`Failed to load conversations: ${e.message}`, true);
    console.error("[Spool] Fetch conversations error:", e);
    return;
  }

  if (!conversations.length) { showError("No conversations found.", false); return; }

  // ── State ─────────────────────────────────────────────────────

  const state = {
    all: conversations,
    selected: loadSelections(),
    filtered: conversations,
    activeId: null,
  };

  // ── Date helpers ─────────────────────────────────────────────────────

  function formatDate(ts) {
    if (!ts) return ""; const d = new Date(ts * 1000);
    return d.toISOString().slice(0, 16).replace("T"," ") + " UTC";
  }

  function dateFilter(conv, preset) {
    if (preset === "all") return true;
    const now = Date.now() / 1000;
    const map = { week: 7, month: 30, year: 365 };
    const cutoff = now - (map[preset] * 86400);
    return (conv.update_time || 0) >= cutoff;
  }

  function filterConversations() {
    const q = document.getElementById("spool-search").value.toLowerCase();
    const preset = document.getElementById("spool-date-filter").value;
    state.filtered = state.all.filter(c => {
      const matchDate = dateFilter(c, preset);
      const matchSearch = !q || (c.title || "").toLowerCase().includes(q);
      return matchDate && matchSearch;
    });
    renderList();
  }

  // ── Render list ─────────────────────────────────────────────────────

  function renderList() {
    const list = document.getElementById("spool-list");
    list.innerHTML = state.filtered.map(c => {
      const sel = state.selected.has(c.id);
      const files = c.has_files || 0;
      const date = formatDate(c.update_time);
      const msgs = c.message_count || "?";
      return `<div class="spool-conv-item${sel ? " selected" : ""}" data-id="${c.id}">
        <input type="checkbox"${sel ? " checked" : ""} data-cb="${c.id}">
        <div class="spool-conv-info">
          <div class="spool-conv-title">${escapeHtml(c.title || "Untitled")}</div>
          <div class="spool-conv-meta">${date} · ${msgs} msgs${files ? ` · ${files} files` : ""}</div>
        </div>
      </div>`;
    }).join("");

    // Click handlers
    list.querySelectorAll(".spool-conv-item").forEach(el => {
      el.addEventListener("click", e => {
        if (e.target.type !== "checkbox") return;
        const id = el.dataset.id;
        if (e.target.checked) { state.selected.add(id); el.classList.add("selected"); }
        else { state.selected.delete(id); el.classList.remove("selected"); }
        saveSelections(state.selected);
        updateStats();
        if (state.activeId === id) renderPreview(id);
      });
    });

    list.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", e => {
        const id = e.target.dataset.cb;
        if (e.target.checked) { state.selected.add(id); e.target.closest(".spool-conv-item").classList.add("selected"); }
        else { state.selected.delete(id); e.target.closest(".spool-conv-item").classList.remove("selected"); }
        saveSelections(state.selected);
        updateStats();
      });
    });
  }

  // ── Preview ─────────────────────────────────────────────────────

  function renderPreview(id) {
    const preview = document.getElementById("spool-preview");
    const conv = state.all.find(c => c.id === id);
    if (!conv) { preview.innerHTML = '<div class="spool-preview-empty">Conversation not found</div>'; return; }

    state.activeId = id;
    const date = formatDate(conv.create_time);
    const title = escapeHtml(conv.title || "Untitled");
    const files = conv.has_files || 0;

    preview.innerHTML = `
      <div class="spool-preview-header">
        <h3>${title}</h3>
        <div class="date">${date} · ${conv.message_count || "?"} msgs</div>
      </div>
      <div class="spool-preview-body" id="spool-preview-content">
        <div class="spool-preview-empty">Loading preview...</div>
      </div>`;

    // Load actual conversation for preview
    apiGet(`conversation/${id}`).then(convo => {
      const mapping = convo.mapping || {};
      const rootId = Object.keys(mapping).find(k => !mapping[k].parent);
      const msgs = [];
      if (rootId) {
        const queue = [rootId];
        while (queue.length) {
          const nid = queue.shift();
          const node = mapping[nid] || {};
          const msg = node.message;
          if (msg?.content?.parts) {
            const role = msg.author?.role || "unknown";
            const contentType = msg.content?.content_type || "text";
            if (role === "system" || role === "tool") { queue.push(...(node.children || [])); continue; }
            if (role === "assistant" && contentType !== "text") { queue.push(...(node.children || [])); continue; }
            const textParts = msg.content.parts.filter(p => typeof p === "string");
            const text = stripCitations(textParts.join("\n")).trim();
            if (text) msgs.push({ role, text });
          }
          queue.push(...(node.children || []));
        }
      }

      const body = msgs.slice(0, 6).map(m =>
        `<div class="msg"><span class="role-${m.role}">${m.role}:</span> ${escapeHtml(m.text.slice(0, 300) + (m.text.length > 300 ? "..." : ""))}</div>`
      ).join("") + (msgs.length > 6 ? '<div class="msg" style="color:#475569">...and more messages</div>' : "");

      const fileRefs = extractFileReferences(convo);
      const filesHtml = fileRefs.length
        ? `<div class="spool-preview-files"><h4>📎 Attachments (${fileRefs.length})</h4>${fileRefs.map(f => `<span>${escapeHtml(f.filename)}</span>`).join("")}</div>`
        : "";

      document.getElementById("spool-preview-content").innerHTML = body + filesHtml;
    }).catch(() => {
      document.getElementById("spool-preview-content").innerHTML = '<div class="spool-preview-empty">Failed to load</div>';
    });
  }

  // ── Stats ─────────────────────────────────────────────────────

  function updateStats() {
    const count = state.selected.size;
    let msgs = 0, files = 0;
    state.all.forEach(c => {
      if (state.selected.has(c.id)) { msgs += c.message_count || 0; files += c.has_files || 0; }
    });
    const stats = `${count} selected${msgs ? ` · ${msgs} msgs` : ""}${files ? ` · ${files} files` : ""}`;
    document.getElementById("spool-stats").textContent = stats;
    const btn = document.getElementById("spool-export");
    btn.textContent = `Export ${count}`;
    btn.disabled = count === 0;
  }

  // ── Events ─────────────────────────────────────────────────────

  document.getElementById("spool-close-btn").onclick = () => overlay.remove();
  document.getElementById("spool-cancel").onclick = () => overlay.remove();

  document.getElementById("spool-search").addEventListener("input", filterConversations);
  document.getElementById("spool-date-filter").addEventListener("change", filterConversations);

  document.getElementById("spool-select-all").onclick = () => {
    state.filtered.forEach(c => state.selected.add(c.id));
    saveSelections(state.selected);
    renderList();
    updateStats();
  };

  document.getElementById("spool-select-none").onclick = () => {
    state.selected.clear();
    saveSelections(state.selected);
    renderList();
    updateStats();
  };

  document.getElementById("spool-list").addEventListener("dblclick", e => {
    const item = e.target.closest(".spool-conv-item");
    if (item) renderPreview(item.dataset.id);
  });

  // ── Export ─────────────────────────────────────────────────────

  document.getElementById("spool-export").onclick = async () => {
    const selectedIds = [...state.selected];
    if (!selectedIds.length) return;

    const progressArea = document.getElementById("spool-progress-area");
    const bar = document.getElementById("spool-progress-bar");
    const text = document.getElementById("spool-progress-text");
    progressArea.style.display = "block";
    document.getElementById("spool-export").disabled = true;

    const zipEntries = []; let failed = 0;
    const total = selectedIds.length;

    for (let i = 0; i < total; i++) {
      const cid = selectedIds[i];
      const conv = state.all.find(c => c.id === cid);
      const title = sanitize(conv?.title || "Untitled");
      const fname = `${title}_${cid.slice(0, 8)}`;
      const pct = Math.round(((i + 1) / total) * 100);
      bar.style.width = pct + "%";
      text.textContent = `Downloading ${i + 1}/${total} (${pct}%)`;

      try {
        const convo = await apiGet(`conversation/${cid}`);
        const jsonStr = JSON.stringify(convo, null, 2);
        zipEntries.push({ path: `json/${fname}.json`, data: jsonStr });

        // Markdown
        const mapping = convo.mapping || {};
        const rootId = Object.keys(mapping).find(k => !mapping[k].parent);
        const lines = [`# ${conv?.title || "Untitled"}`, ""];
        const dateStr = formatDate(conv?.create_time);
        if (dateStr) lines.push(`*${dateStr}*\n`);
        if (rootId) {
          const queue = [rootId];
          while (queue.length) {
            const nid = queue.shift();
            const node = mapping[nid] || {};
            const msg = node.message;
            if (msg?.content?.parts) {
              const role = msg.author?.role || "unknown";
              const contentType = msg.content?.content_type || "text";
              if (role === "system" || role === "tool") { queue.push(...(node.children || [])); continue; }
              if (role === "assistant" && contentType !== "text") { queue.push(...(node.children || [])); continue; }
              const textParts = msg.content.parts.filter(p => typeof p === "string");
              const text = stripCitations(textParts.join("\n")).trim();
              if (text) lines.push(`## ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n${text}\n`);
            }
            queue.push(...(node.children || []));
          }
        }
        zipEntries.push({ path: `markdown/${fname}.md`, data: lines.join("\n") });

        // Files
        const fileRefs = extractFileReferences(convo);
        const fileMap = {}; const usedNames = new Set();
        for (const ref of fileRefs) {
          try {
            const { filename: dlName, data } = await downloadFile(ref.fileId, ref.filename);
            const actualName = deduplicateFilename(dlName || ref.filename, usedNames);
            zipEntries.push({ path: `files/${fname}/${actualName}`, data });
            fileMap[ref.fileId] = actualName;
          } catch {}
        }
      } catch { failed++; }

      await sleep(DELAY);
    }

    // Build ZIP
    bar.style.width = "100%";
    text.textContent = "Creating ZIP...";
    const zipBlob = buildZipBlob(zipEntries);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = "chatgpt-export.zip";
    a.click();
    URL.revokeObjectURL(a.href);

    text.textContent = `Done! Exported ${total - failed}/${total} conversations.`;
    setTimeout(() => overlay.remove(), 2000);
  };

  // ── ZIP builder ─────────────────────────────────────────────────────

  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildZipBlob(entries) {
    const te = new TextEncoder();
    const parts = []; const cdParts = []; let offset = 0;
    for (const entry of entries) {
      const pathBytes = te.encode(entry.path);
      const dataBytes = typeof entry.data === "string" ? te.encode(entry.data) : entry.data;
      const crc = crc32(dataBytes);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true);
      lh.setUint16(8, 0, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, dataBytes.length, true); lh.setUint32(22, dataBytes.length, true);
      lh.setUint16(26, pathBytes.length, true);
      parts.push(new Uint8Array(lh.buffer), pathBytes, dataBytes);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
      cd.setUint16(10, 0, true); cd.setUint32(16, crc, true);
      cd.setUint32(20, dataBytes.length, true); cd.setUint32(24, dataBytes.length, true);
      cd.setUint16(28, pathBytes.length, true); cd.setUint32(42, offset, true);
      cdParts.push(new Uint8Array(cd.buffer), pathBytes);
      offset += 30 + pathBytes.length + dataBytes.length;
    }
    const cdSize = cdParts.reduce((s, p) => s + p.length, 0);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, entries.length, true);
    eocd.setUint16(10, entries.length, true); eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, offset, true);
    return new Blob([...parts, ...cdParts, new Uint8Array(eocd.buffer)], { type: "application/zip" });
  }

  // ── Init ─────────────────────────────────────────────────────

  renderList();
  updateStats();
  console.log(`[Spool] Loaded ${conversations.length} conversations. Selections saved across sessions.`);
})();