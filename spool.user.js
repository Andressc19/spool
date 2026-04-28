// ==UserScript==
// @name         Spool - ChatGPT Exporter
// @namespace    http://spool.local
// @version      1.0.0
// @description  Export your ChatGPT conversations as JSON, Markdown, HTML and ZIP. Supports selective download with preview.
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

// ═════════════════════════════════════════════════════════════════════
// Spool - Config
// ═════════════════════════════════════════════════════════════

const API = "/backend-api";
const PAGE_SIZE = 100;
const DELAY = 500;
const STORAGE_KEY = "spool_selections";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ═════════════════════════════════════════════════════════════
// Spool - State
// ═════════════════════════════════════════════════════════════

function loadSelections() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSelections(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function showLoading(msg = "Loading...") {
  document.getElementById("spool-list").innerHTML = `<div class="spool-loading">${msg}</div>`;
  document.getElementById("spool-preview").innerHTML = '<div class="spool-preview-empty">Select a conversation to preview</div>';
  document.getElementById("spool-stats").textContent = "Loading...";
}

function showError(msg, canRetry = true) {
  const retryBtn = canRetry ? '<button id="spool-retry" class="spool-btn spool-btn-sm" style="margin-top:8px">Retry</button>' : '';
  document.getElementById("spool-list").innerHTML = `<div class="spool-error">
    <div class="spool-error-icon">!</div>
    <div class="spool-error-msg">${escapeHtml(msg)}</div>
    ${retryBtn}
  </div>`;
  document.getElementById("spool-stats").textContent = "Error";
  if (canRetry) {
    document.getElementById("spool-retry").onclick = () => window.location.reload();
  }
}

// ═════════════════════════════════════════════════════════════
// Spool - API
// ═════════════════════════════════════════════════════════════

const DEVICE_ID = crypto.randomUUID();

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "Oai-Device-Id": DEVICE_ID,
  "Oai-Language": "en-US",
};

async function apiGet(path, token) {
  const resp = await fetch(`${API}/${path}`, {
    headers: { ...HEADERS, Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function apiFetchBinary(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return {
    data: new Uint8Array(await resp.arrayBuffer()),
    contentType: resp.headers.get("content-type") || "",
  };
}

async function fetchProjects(token) {
  let projects = [];
  let cursor = null;
  
  while (true) {
    const params = cursor 
      ? `cursor=${cursor}&owned_only=true&conversations_per_gizmo=20&limit=50`
      : `owned_only=true&conversations_per_gizmo=20&limit=50`;
    
    const data = await apiGet(`gizmos/snorlax/sidebar?${params}`, token);
    const items = data.items || [];
    
    console.log(`[Spool] Projects page: got ${items.length} projects`);
    
    for (const item of items) {
      const gizmo = item.gizmo?.gizmo;
      if (gizmo) {
        projects.push({
          id: gizmo.id,
          name: gizmo.display?.name || "Untitled",
          emoji: gizmo.display?.emoji,
          theme: gizmo.display?.theme,
          conversations: item.conversations?.items || [],
          conversationsCursor: item.conversations?.cursor,
        });
      }
    }
    
    if (!data.cursor || items.length === 0) break;
    cursor = data.cursor;
    await sleep(DELAY);
  }
  
  return projects;
}

async function fetchAllProjectConversations(projectId, token) {
  // Feature detection: probar diferentes endpoints en orden de preferencia
  
  // Estrategia 1: Endpoint directo /gizmos/{id}/conversations (límite 50)
  try {
    console.log(`[Spool] Trying endpoint: /gizmos/${projectId}/conversations`);
    const conversations = await fetchProjectConversationsDirect(projectId, token);
    console.log(`[Spool] Direct endpoint worked: ${conversations.length} conversations`);
    return conversations;
  } catch (e) {
    console.warn(`[Spool] Direct endpoint failed: ${e.message}`);
  }
  
  // Estrategia 2: Fallback - obtener desde sidebar (límite 20)
  try {
    console.log(`[Spool] Trying fallback: sidebar conversations`);
    const conversations = await fetchProjectConversationsFromSidebar(projectId, token);
    console.log(`[Spool] Fallback worked: ${conversations.length} conversations`);
    return conversations;
  } catch (e) {
    console.warn(`[Spool] Fallback failed: ${e.message}`);
  }
  
  // Si todo falla, retornar vacío
  console.error(`[Spool] All endpoints failed for project ${projectId}`);
  return [];
}

async function fetchProjectConversationsDirect(projectId, token) {
  let conversations = [];
  let cursor = null;
  
  while (true) {
    const params = cursor 
      ? `cursor=${cursor}&limit=50`
      : `limit=50`;
    
    const data = await apiGet(`gizmos/${projectId}/conversations?${params}`, token);
    
    // Si hay error, lanzar excepción
    if (data.error || data.status >= 400) {
      throw new Error(`HTTP ${data.status || 'unknown'}`);
    }
    
    const items = data.items || [];
    conversations.push(...items);
    
    if (!data.cursor || items.length === 0) break;
    cursor = data.cursor;
    await sleep(DELAY);
  }
  
  return conversations;
}

async function fetchProjectConversationsFromSidebar(projectId, token) {
  // Obtener desde el sidebar (solo trae 20 conversaciones máx)
  const data = await apiGet('gizmos/snorlax/sidebar?owned_only=true&conversations_per_gizmo=20&limit=50', token);
  
  const project = data.items?.find(item => item.gizmo?.gizmo?.id === projectId);
  return project?.conversations?.items || [];
}

async function fetchConversations(token) {
  let conversations = [];
  let offset = 0;
  let cursor = null;
  let page = 0;

  while (true) {
    page++;
    const params = cursor
      ? `limit=${PAGE_SIZE}&cursor=${cursor}`
      : `offset=${offset}&limit=${PAGE_SIZE}`;
    const data = await apiGet(`conversations?${params}`, token);
    const items = data.items || [];
    const total = data.total || 0;
    const hasMore = data.has_more !== undefined ? data.has_more : items.length >= PAGE_SIZE;

    console.log(`[Spool] Page ${page}: got ${items.length}, total=${total}, has_more=${hasMore}`);

    if (!items.length) break;
    conversations.push(...items);

    if (data.next_cursor) {
      cursor = data.next_cursor;
      offset = 0;
    } else {
      offset += PAGE_SIZE;
      if (!hasMore || offset >= total) break;
    }

    showLoading(`Loading conversations... ${conversations.length}${total ? ` / ${total}` : ""}`);
    await sleep(DELAY);
  }

  return conversations;
}

// ═════════════════════════════════════════════════════════════
// Spool - Parser
// ═════════════════════════════════════════════════════════════

const MIME_TO_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/json": ".json",
  "application/zip": ".zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripCitations(str) {
  return str.replace(/\u3010[^\u3011]*\u3011/g, "");
}

function formatDate(tsOrId) {
  if (!tsOrId) return "";
  try {
    let ts = tsOrId;
    if (typeof tsOrId === "string") {
      ts = parseInt(tsOrId.slice(0, 8), 16);
      if (isNaN(ts) || ts < 1000000000) return tsOrId.slice(0, 8);
    }
    const ms = ts > 10000000000 ? ts : ts * 1000;
    return new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  } catch {
    return "Unknown date";
  }
}

function dateFilter(conv, preset) {
  if (preset === "all") return true;
  const now = Date.now() / 1000;
  const map = { week: 7, month: 30, year: 365 };
  const cutoff = now - map[preset] * 86400;
  let ts = 0;
  if (conv.update_time) ts = typeof conv.update_time === "number" ? conv.update_time : parseInt(conv.update_time);
  else if (conv.create_time) ts = typeof conv.create_time === "number" ? conv.create_time : parseInt(conv.create_time);
  else if (conv.last_id) ts = parseInt(conv.last_id.slice(0, 8), 16);
  return ts >= cutoff;
}

function extractFileReferences(convo) {
  const refs = [];
  const seen = new Set();
  const mapping = convo.mapping || {};

  for (const node of Object.values(mapping)) {
    const msg = node.message;
    if (!msg) continue;

    if (msg.content?.parts) {
      for (const part of msg.content.parts) {
        if (part?.content_type === "image_asset_pointer" && part.asset_pointer) {
          const match = part.asset_pointer.match(/^(?:file-service|sediment):\/\/(.+)$/);
          if (match && !seen.has(match[1])) {
            seen.add(match[1]);
            refs.push({
              fileId: match[1],
              filename: part.metadata?.dalle?.prompt ? "dalle_image.png" : "image.png",
              type: "image",
            });
          }
        }
      }
    }

    if (msg.metadata?.attachments) {
      for (const att of msg.metadata.attachments) {
        if (att.id && !seen.has(att.id)) {
          seen.add(att.id);
          refs.push({ fileId: att.id, filename: att.name || "attachment", type: "attachment" });
        }
      }
    }

    if (msg.metadata?.citations) {
      for (const cit of msg.metadata.citations) {
        const fileId = cit.metadata?.file_id || cit.file_id;
        const title = cit.metadata?.title || cit.title || "citation";
        if (fileId && !seen.has(fileId)) {
          seen.add(fileId);
          refs.push({ fileId, filename: title, type: "citation" });
        }
      }
    }
  }
  return refs;
}

// ═════════════════════════════════════════════════════════════
// Spool - Export
// ═════════════════════════════════════════════════════════════

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBlob(entries) {
  const te = new TextEncoder();
  const parts = [];
  const cdParts = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBytes = te.encode(entry.path);
    const dataBytes = typeof entry.data === "string" ? te.encode(entry.data) : entry.data;
    const crc = crc32(dataBytes);

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(8, 0, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, dataBytes.length, true);
    lh.setUint32(22, dataBytes.length, true);
    lh.setUint16(26, pathBytes.length, true);

    parts.push(new Uint8Array(lh.buffer), pathBytes, dataBytes);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(10, 0, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, dataBytes.length, true);
    cd.setUint32(24, dataBytes.length, true);
    cd.setUint16(28, pathBytes.length, true);
    cd.setUint32(42, offset, true);

    cdParts.push(new Uint8Array(cd.buffer), pathBytes);
    offset += 30 + pathBytes.length + dataBytes.length;
  }

  const cdSize = cdParts.reduce((s, p) => s + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, offset, true);

  return new Blob([...parts, ...cdParts, new Uint8Array(eocd.buffer)], { type: "application/zip" });
}

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/^[. ]+|[. ]+$/g, "").slice(0, 80) || "untitled";
}

function deduplicateFilename(name, usedNames) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 1;
  while (usedNames.has(`${base}_${i}${ext}`)) i++;
  const deduped = `${base}_${i}${ext}`;
  usedNames.add(deduped);
  return deduped;
}

async function downloadFile(fileId, fallbackName, token) {
  const meta = await apiGet(`files/download/${fileId}`, token);
  if (!meta.download_url) throw new Error("No download_url");
  const { data, contentType } = await apiFetchBinary(meta.download_url);
  let filename = meta.file_name || fallbackName || fileId;
  if (!filename.includes(".") && contentType) {
    const mime = contentType.split(";")[0].trim();
    const ext = MIME_TO_EXT[mime];
    if (ext) filename += ext;
  }
  return { filename, data };
}

// ═════════════════════════════════════════════════════════════
// Spool - UI
// ═════════════════════════════════════════════════════════════

const SPOOL_STYLES = `<style>
  #spool-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif }
  #spool-overlay * { box-sizing:border-box; }
  #spool-overlay .spool-modal { background:#0f172a;border-radius:16px;width:min(96vw,1000px);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.5);padding:20px }
  #spool-overlay .spool-header { display:flex;align-items:center;gap:12px;padding:12px 16px 20px 20px;border-bottom:1px solid #1e293b;margin:0 -20px 0 -20px }
  #spool-overlay .spool-logo { font-size:32px }
  #spool-overlay .spool-title-area h2 { color:#f8fafc;font-size:24px;margin:0 }
  #spool-overlay .spool-title-area .spool-subtitle { color:#64748b;font-size:14px;margin:4px 0 0 }
  #spool-overlay .spool-close { margin-left:auto;background:none;border:none;color:#94a3b8;font-size:28px;cursor:pointer;padding:4px 8px }
  #spool-overlay .spool-close:hover { color:#fff }
  #spool-overlay .spool-toolbar { display:flex;gap:12px;padding:16px 0;border-bottom:1px solid #1e293b;flex-wrap:wrap;align-items:center;margin:0 -20px;padding-left:20px;padding-right:20px }
  #spool-overlay .spool-toolbar input { flex:1;min-width:160px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;padding:12px 16px;font-size:14px }
  #spool-overlay .spool-toolbar input:focus { outline:none;border-color:#3b82f6 }
  #spool-overlay .spool-toolbar input::placeholder { color:#475569 }
  #spool-overlay .spool-toolbar select { background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0;padding:12px 16px;font-size:14px }
  #spool-overlay .spool-btn { border:none;border-radius:8px;cursor:pointer;font-size:14px;transition:background 0.2s }
  #spool-overlay .spool-btn-sm { padding:10px 16px;background:#334155;color:#e2e8f0 }
  #spool-overlay .spool-btn-sm:hover { background:#475569 }
  #spool-overlay .spool-body { display:flex;flex:1;overflow:hidden;min-height:400px;margin:0 -20px }
  #spool-overlay .spool-list { flex:1;overflow-y:auto;padding:16px 20px;border-right:1px solid #1e293b;min-width:0;min-height:350px }
  #spool-overlay .spool-preview { width:min(420px,45%);overflow-y:auto;padding:16px 20px;background:#0f172a;min-height:350px }
  #spool-overlay .spool-preview-empty { color:#475569;font-size:14px;text-align:center;margin-top:48px }
  #spool-overlay .spool-loading { color:#94a3b8;font-size:16px;text-align:center;margin-top:48px }
  #spool-overlay .spool-error { color:#fecaca;font-size:16px;text-align:center;margin-top:48px }
  #spool-overlay .spool-error-icon { font-size:36px;margin-bottom:12px }
  #spool-overlay .spool-error-msg { color:#f87171;font-size:14px;max-width:300px;margin:0 auto }
  
  /* Section headers */
  #spool-overlay .spool-section-header { color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:12px 0 8px;margin-top:8px;border-top:1px solid #1e293b }
  #spool-overlay .spool-section-header:first-child { margin-top:0;border-top:none }
  
  /* Projects */
  #spool-overlay .spool-project { margin-bottom:12px }
  #spool-overlay .spool-project-header { display:flex;align-items:center;gap:8px;padding:12px 16px;background:#1e293b;border-radius:8px;cursor:pointer;border-left:3px solid #3b82f6;transition:background 0.2s }
  #spool-overlay .spool-project-header:hover { background:#334155 }
  #spool-overlay .spool-project-toggle { background:none;border:none;color:#64748b;font-size:14px;cursor:pointer;padding:0;width:16px;text-align:left }
  #spool-overlay .spool-project-emoji { font-size:18px }
  #spool-overlay .spool-project-name { color:#e2e8f0;font-size:15px;font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  #spool-overlay .spool-project-count { background:#334155;color:#94a3b8;font-size:12px;padding:2px 8px;border-radius:12px;margin-left:auto }
  #spool-overlay .spool-project-checkbox { accent-color:#3b82f6;width:18px;height:18px;cursor:pointer }
  #spool-overlay .spool-project-conversations { margin-left:12px;margin-top:8px }
  
  /* Conversations */
  #spool-overlay .spool-conv-item { display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-radius:8px;cursor:pointer;margin-bottom:4px }
  #spool-overlay .spool-conv-item:hover { background:#1e293b }
  #spool-overlay .spool-conv-item.selected { background:#1e3a5f }
  #spool-overlay .spool-conv-item input[type="checkbox"] { margin-top:3px;accent-color:#3b82f6;width:18px;height:18px;cursor:pointer;flex-shrink:0 }
  #spool-overlay .spool-conv-info { flex:1;min-width:0 }
  #spool-overlay .spool-conv-title { color:#e2e8f0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
  #spool-overlay .spool-conv-meta { color:#64748b;font-size:13px;margin-top:4px }
  
  /* Preview */
  #spool-overlay .spool-preview-header { padding:20px;border-bottom:1px solid #1e293b;margin:0 -20px 16px -20px;background:#1e293b }
  #spool-overlay .spool-preview-header h3 { color:#f8fafc;font-size:18px;margin:0 0 6px }
  #spool-overlay .spool-preview-header .date { color:#64748b;font-size:14px }
  #spool-overlay .spool-preview-header .project-badge { display:inline-block;background:#3b82f6;color:#fff;font-size:12px;padding:2px 8px;border-radius:4px;margin-top:6px }
  #spool-overlay .spool-preview-body { font-size:14px;color:#94a3b8;line-height:1.6;white-space:pre-wrap;word-break:break-word;padding:0 20px }
  #spool-overlay .spool-preview-body .msg { margin-bottom:16px }
  #spool-overlay .spool-preview-body .role-user { color:#3b82f6;font-weight:600 }
  #spool-overlay .spool-preview-body .role-assistant { color:#22c55e;font-weight:600 }
  #spool-overlay .spool-preview-files { margin-top:12px;padding:12px;border:1px solid #334155;border-radius:8px;margin:0 20px }
  #spool-overlay .spool-preview-files h4 { color:#94a3b8;font-size:14px;margin-bottom:8px }
  #spool-overlay .spool-preview-files span { display:inline-block;background:#1e293b;border-radius:4px;padding:4px 10px;font-size:13px;color:#94a3b8;margin:2px }
  
  /* Footer */
  #spool-overlay .spool-footer { display:flex;align-items:center;justify-content:space-between;padding:20px 0 0;border-top:1px solid #1e293b;flex-wrap:wrap;gap:12px;margin:0 -20px;padding-left:20px;padding-right:20px }
  #spool-overlay .spool-stats { color:#94a3b8;font-size:15px;padding:12px 0 }
  #spool-overlay .spool-actions { display:flex;gap:12px;padding:8px 0 }
  #spool-overlay .spool-btn-primary { background:#3b82f6;color:#fff;padding:14px 28px;font-size:16px;font-weight:600 }
  #spool-overlay .spool-btn-primary:hover { background:#2563eb }
  #spool-overlay .spool-btn-primary:disabled { background:#475569;cursor:not-allowed }
  #spool-overlay .spool-btn-secondary { background:#334155;color:#e2e8f0;padding:14px 28px;font-size:16px }
  #spool-overlay .spool-btn-secondary:hover { background:#475569 }
  #spool-overlay .spool-progress-area { padding:20px 0 }
  #spool-overlay .spool-progress-bar-bg { height:8px;background:#1e293b;border-radius:4px;overflow:hidden }
  #spool-overlay .spool-progress-bar { height:100%;background:#3b82f6;border-radius:4px;width:0;transition:width 0.3s }
  #spool-overlay .spool-progress-text { color:#94a3b8;font-size:14px;margin-top:8px }
</style>`;

const OVERLAY_HTML = `
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

function createOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "spool-overlay";
  overlay.innerHTML = OVERLAY_HTML;
  return overlay;
}

// ═════════════════════════════════════════════════════════════
// Spool - Main
// ═════════════════════════════════════════════════════════════

(function addFloatingButton() {
  if (document.getElementById("spool-fab")) return;
  const fab = document.createElement("button");
  fab.id = "spool-fab";
  fab.title = "Open Spool - ChatGPT Exporter";
  fab.innerHTML = "📦";
  fab.onclick = () => {
    const overlay = document.getElementById("spool-overlay");
    if (overlay) {
      overlay.style.display = "flex";
    } else {
      window.location.reload();
    }
  };
  Object.assign(fab.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    border: "none",
    background: "#3b82f6",
    color: "#fff",
    fontSize: "22px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    zIndex: "9999",
    transition: "transform 0.2s",
  });
  fab.onmouseenter = () => (fab.style.transform = "scale(1.1)");
  fab.onmouseleave = () => (fab.style.transform = "scale(1)");
  document.body.appendChild(fab);
})();

(async () => {
  if (document.getElementById("spool-overlay")) return;

  const overlay = createOverlay();
  document.head.insertAdjacentHTML("beforeend", SPOOL_STYLES);
  document.body.appendChild(overlay);

  showLoading("Fetching session token...");

  // Get token
  let token;
  try {
    const sessionResp = await fetch("/api/auth/session");
    const session = await sessionResp.json();
    console.log("[Spool] Session:", session);
    if (!sessionResp.ok) throw new Error(`HTTP ${sessionResp.status}`);
    token = session.accessToken;
    if (!token) throw new Error("No accessToken");
  } catch (e) {
    showError(`Failed to get session: ${e.message}`, true);
    return;
  }

  showLoading("Loading projects and conversations...");

  // Fetch projects and personal conversations in parallel
  let projects = [];
  let personalConversations = [];
  
  try {
    const [projectsData, personalData] = await Promise.all([
      fetchProjects(token),
      fetchConversations(token),
    ]);
    projects = projectsData;
    personalConversations = personalData;
  } catch (e) {
    showError(`Failed to load: ${e.message}`, true);
    return;
  }

  // Fetch all conversations for each project
  showLoading(`Loading project conversations... 0/${projects.length}`);
  
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    console.log(`[Spool] Fetching conversations for project: ${project.name}`);
    
    try {
      const convos = await fetchAllProjectConversations(project.id, token);
      project.conversations = convos;
      console.log(`[Spool] Project ${project.name}: ${convos.length} conversations`);
    } catch (e) {
      console.error(`[Spool] Error fetching conversations for ${project.name}:`, e);
      project.conversations = [];
    }
    
    showLoading(`Loading project conversations... ${i + 1}/${projects.length}`);
    await sleep(DELAY);
  }

  // Calculate totals
  const totalProjectConvs = projects.reduce((sum, p) => sum + p.conversations.length, 0);
  const totalPersonal = personalConversations.length;
  
  console.log(`[Spool] Loaded ${projects.length} projects (${totalProjectConvs} conversations) + ${totalPersonal} personal conversations`);

  // State
  const state = {
    projects: projects,
    personal: personalConversations,
    selected: loadSelections(),
    activeId: null,
    filter: "all", // 'all', 'personal', or project ID
    searchQuery: "",
  };

  // Filter function
  function getFilteredData() {
    if (state.filter === "all") {
      return {
        projects: state.projects,
        personal: state.personal.filter(filterBySearch),
      };
    } else if (state.filter === "personal") {
      return {
        projects: [],
        personal: state.personal.filter(filterBySearch),
      };
    } else {
      const project = state.projects.find(p => p.id === state.filter);
      return {
        projects: project ? [{
          ...project,
          conversations: project.conversations.filter(filterBySearch),
        }] : [],
        personal: [],
      };
    }
  }

  function filterBySearch(conv) {
    const q = state.searchQuery.toLowerCase();
    if (!q) return true;
    return (conv.title || "").toLowerCase().includes(q);
  }

  // Render list
  function renderList() {
    const list = document.getElementById("spool-list");
    const filtered = getFilteredData();
    
    let html = "";
    
    // Projects section
    if (filtered.projects.length > 0 && state.filter !== "personal") {
      html += `<div class="spool-section-header">📁 Projects</div>`;
      
      for (const project of filtered.projects) {
        const isOpen = state.selected.has(`project:${project.id}`);
        const emoji = project.emoji || "📁";
        const theme = project.theme || "#3b82f6";
        
        html += `
          <div class="spool-project" data-project="${project.id}">
            <div class="spool-project-header" style="border-left-color: ${theme}">
              <button class="spool-project-toggle">${isOpen ? "▼" : "▶"}</button>
              <span class="spool-project-emoji">${emoji}</span>
              <span class="spool-project-name">${escapeHtml(project.name)}</span>
              <span class="spool-project-count">${project.conversations.length}</span>
              <input type="checkbox" class="spool-project-checkbox"${isOpen ? " checked" : ""} data-project="${project.id}">
            </div>
            ${isOpen ? `
              <div class="spool-project-conversations">
                ${project.conversations.map((c) => {
                  const sel = state.selected.has(c.id);
                  const date = formatDate(c.update_time || c.create_time);
                  return `
                    <div class="spool-conv-item${sel ? " selected" : ""}" data-id="${c.id}" data-project="${project.id}">
                      <input type="checkbox"${sel ? " checked" : ""} data-cb="${c.id}">
                      <div class="spool-conv-info">
                        <div class="spool-conv-title">${escapeHtml(c.title || "Untitled")}</div>
                        <div class="spool-conv-meta">${date}</div>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            ` : ""}
          </div>
        `;
      }
    }
    
    // Personal conversations section
    if (filtered.personal.length > 0 && state.filter !== "projects") {
      const sectionTitle = state.filter === "all" ? "📄 Personal Conversations" : "";
      if (sectionTitle) {
        html += `<div class="spool-section-header">${sectionTitle}</div>`;
      }
      
      html += filtered.personal
        .map((c) => {
          const sel = state.selected.has(c.id);
          const files = c.has_files || c.attachment_count || 0;
          const date = formatDate(c.update_time || c.create_time);
          const msgs = c.num_total_messages || c.message_count || "?";
          return `
            <div class="spool-conv-item${sel ? " selected" : ""}" data-id="${c.id}">
              <input type="checkbox"${sel ? " checked" : ""} data-cb="${c.id}">
              <div class="spool-conv-info">
                <div class="spool-conv-title">${escapeHtml(c.title || "Untitled")}</div>
                <div class="spool-conv-meta">${date} · ${msgs} msgs${files ? ` · ${files} files` : ""}</div>
              </div>
            </div>
          `;
        })
        .join("");
    }
    
    if (filtered.projects.length === 0 && filtered.personal.length === 0) {
      html = `<div class="spool-empty">No conversations found</div>`;
    }
    
    list.innerHTML = html;

    // Event handlers
    list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        e.stopPropagation();
        
        if (cb.classList.contains("spool-project-checkbox")) {
          // Toggle entire project
          const projectId = cb.dataset.project;
          const project = state.projects.find(p => p.id === projectId);
          
          if (cb.checked) {
            state.selected.add(`project:${projectId}`);
            project.conversations.forEach(c => state.selected.add(c.id));
          } else {
            state.selected.delete(`project:${projectId}`);
            project.conversations.forEach(c => state.selected.delete(c.id));
          }
          
          saveSelections(state.selected);
          renderList();
          updateStats();
        } else {
          // Toggle individual conversation
          const id = cb.dataset.cb;
          if (cb.checked) {
            state.selected.add(id);
            cb.closest(".spool-conv-item")?.classList.add("selected");
          } else {
            state.selected.delete(id);
            cb.closest(".spool-conv-item")?.classList.remove("selected");
            
            // Update project checkbox if needed
            const convProject = cb.closest(".spool-project");
            if (convProject) {
              const projectId = convProject.dataset.project;
              const project = state.projects.find(p => p.id === projectId);
              const allSelected = project.conversations.every(c => state.selected.has(c.id));
              const projectCb = convProject.querySelector(".spool-project-checkbox");
              if (projectCb) {
                projectCb.checked = allSelected;
                if (allSelected) {
                  state.selected.add(`project:${projectId}`);
                } else {
                  state.selected.delete(`project:${projectId}`);
                }
              }
            }
          }
          saveSelections(state.selected);
          updateStats();
        }
      });
    });
    
    // Project toggle handlers
    list.querySelectorAll(".spool-project-toggle").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const projectEl = btn.closest(".spool-project");
        const projectId = projectEl.dataset.project;
        
        if (state.selected.has(`project:${projectId}`)) {
          state.selected.delete(`project:${projectId}`);
        } else {
          state.selected.add(`project:${projectId}`);
        }
        
        saveSelections(state.selected);
        renderList();
        updateStats();
      });
    });
    
    // Conversation click for preview
    list.querySelectorAll(".spool-conv-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          renderPreview(item.dataset.id);
        }
      });
    });
  }

  // Render preview
  function renderPreview(id) {
    const preview = document.getElementById("spool-preview");
    
    // Find conversation in projects or personal
    let conv = null;
    let project = null;
    
    for (const p of state.projects) {
      conv = p.conversations.find(c => c.id === id);
      if (conv) {
        project = p;
        break;
      }
    }
    
    if (!conv) {
      conv = state.personal.find(c => c.id === id);
    }
    
    if (!conv) {
      preview.innerHTML = '<div class="spool-preview-empty">Not found</div>';
      return;
    }

    state.activeId = id;
    const date = formatDate(conv.update_time || conv.create_time);
    const title = escapeHtml(conv.title || "Untitled");
    const projectName = project ? `<div class="project-badge">${project.emoji || "📁"} ${escapeHtml(project.name)}</div>` : "";

    preview.innerHTML = `
      <div class="spool-preview-header">
        <h3>${title}</h3>
        ${projectName}
        <div class="date">${date}</div>
      </div>
      <div class="spool-preview-body" id="spool-preview-content">
        <div class="spool-preview-empty">Loading...</div>
      </div>`;

    apiGet(`conversation/${id}`, token)
      .then((convo) => {
        const mapping = convo.mapping || {};
        const rootId = Object.keys(mapping).find((k) => !mapping[k].parent);
        const msgsList = [];

        if (rootId) {
          const queue = [rootId];
          while (queue.length) {
            const nid = queue.shift();
            const node = mapping[nid] || {};
            const msg = node.message;
            if (msg?.content?.parts) {
              const role = msg.author?.role || "unknown";
              const contentType = msg.content?.content_type || "text";
              if (role === "system" || role === "tool") {
                queue.push(...(node.children || []));
                continue;
              }
              if (role === "assistant" && contentType !== "text") {
                queue.push(...(node.children || []));
                continue;
              }
              const textParts = msg.content.parts.filter((p) => typeof p === "string");
              const text = stripCitations(textParts.join("\n")).trim();
              if (text) msgsList.push({ role, text });
            }
            queue.push(...(node.children || []));
          }
        }

        const body =
          msgsList.slice(0, 6).map(
            (m) =>
              `<div class="msg"><span class="role-${m.role}">${m.role}:</span> ${escapeHtml(m.text.slice(0, 300) + (m.text.length > 300 ? "..." : ""))}</div>`
          ).join("") +
          (msgsList.length > 6 ? '<div class="msg" style="color:#475569">...more messages</div>' : "");

        const fileRefs = extractFileReferences(convo);
        const filesHtml = fileRefs.length
          ? `<div class="spool-preview-files"><h4>📎 ${fileRefs.length} files</h4>${fileRefs.map((f) => `<span>${escapeHtml(f.filename)}</span>`).join("")}</div>`
          : "";

        document.getElementById("spool-preview-content").innerHTML = body + filesHtml;
      })
      .catch(() => {
        document.getElementById("spool-preview-content").innerHTML = '<div class="spool-preview-empty">Failed</div>';
      });
  }

  // Update stats
  function updateStats() {
    const count = state.selected.size;
    let msgs = 0;
    let files = 0;
    
    // Count from projects
    state.projects.forEach((p) => {
      p.conversations.forEach((c) => {
        if (state.selected.has(c.id)) {
          msgs += c.num_total_messages || c.message_count || 0;
          files += c.has_files || c.attachment_count || 0;
        }
      });
    });
    
    // Count from personal
    state.personal.forEach((c) => {
      if (state.selected.has(c.id)) {
        msgs += c.num_total_messages || c.message_count || 0;
        files += c.has_files || c.attachment_count || 0;
      }
    });
    
    const stats = `${count} selected${msgs ? ` · ${msgs} msgs` : ""}${files ? ` · ${files} files` : ""}`;
    document.getElementById("spool-stats").textContent = stats;
    const btn = document.getElementById("spool-export");
    btn.textContent = `Export ${count}`;
    btn.disabled = count === 0;
  }

  // Events
  document.getElementById("spool-close-btn").onclick = () => overlay.remove();
  document.getElementById("spool-cancel").onclick = () => overlay.remove();
  
  document.getElementById("spool-search").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderList();
  });
  
  document.getElementById("spool-date-filter").addEventListener("change", (e) => {
    // Could implement date filtering per project if needed
    renderList();
  });
  
  document.getElementById("spool-select-all").onclick = () => {
    const filtered = getFilteredData();
    filtered.projects.forEach(p => {
      p.conversations.forEach(c => state.selected.add(c.id));
      state.selected.add(`project:${p.id}`);
    });
    filtered.personal.forEach(c => state.selected.add(c.id));
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

  // Export
  document.getElementById("spool-export").onclick = async () => {
    const selectedIds = [...state.selected].filter(id => !id.startsWith("project:"));
    if (!selectedIds.length) return;

    const progressArea = document.getElementById("spool-progress-area");
    const bar = document.getElementById("spool-progress-bar");
    const text = document.getElementById("spool-progress-text");
    progressArea.style.display = "block";
    document.getElementById("spool-export").disabled = true;

    const zipEntries = [];
    let failed = 0;
    const total = selectedIds.length;

    for (let i = 0; i < total; i++) {
      const cid = selectedIds[i];
      
      // Find conversation and its project
      let conv = null;
      let project = null;
      
      for (const p of state.projects) {
        conv = p.conversations.find(c => c.id === cid);
        if (conv) {
          project = p;
          break;
        }
      }
      
      if (!conv) {
        conv = state.personal.find(c => c.id === cid);
      }
      
      const projectName = project ? `[${project.name}] ` : "";
      const title = sanitize(projectName + (conv?.title || "Untitled"));
      const fname = `${title}_${cid.slice(0, 8)}`;
      const pct = Math.round(((i + 1) / total) * 100);
      bar.style.width = pct + "%";
      text.textContent = `Downloading ${i + 1}/${total} (${pct}%)`;

      try {
        const convo = await apiGet(`conversation/${cid}`, token);
        const jsonStr = JSON.stringify(convo, null, 2);
        zipEntries.push({ path: `json/${fname}.json`, data: jsonStr });

        const mapping = convo.mapping || {};
        const rootId = Object.keys(mapping).find((k) => !mapping[k].parent);
        const lines = [`# ${projectName}${conv?.title || "Untitled"}`, ""];
        if (conv?.create_time) lines.push(`*${formatDate(conv.create_time)}*\n`);

        if (rootId) {
          const queue = [rootId];
          while (queue.length) {
            const nid = queue.shift();
            const node = mapping[nid] || {};
            const msg = node.message;
            if (msg?.content?.parts) {
              const role = msg.author?.role || "unknown";
              const contentType = msg.content?.content_type || "text";
              if (role === "system" || role === "tool") {
                queue.push(...(node.children || []));
                continue;
              }
              if (role === "assistant" && contentType !== "text") {
                queue.push(...(node.children || []));
                continue;
              }
              const textParts = msg.content.parts.filter((p) => typeof p === "string");
              const text = stripCitations(textParts.join("\n")).trim();
              if (text) lines.push(`## ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n${text}\n`);
            }
            queue.push(...(node.children || []));
          }
        }
        zipEntries.push({ path: `markdown/${fname}.md`, data: lines.join("\n") });

        const fileRefs = extractFileReferences(convo);
        const usedNames = new Set();
        for (const ref of fileRefs) {
          try {
            const { filename: dlName, data } = await downloadFile(ref.fileId, ref.filename, token);
            const actualName = deduplicateFilename(dlName || ref.filename, usedNames);
            zipEntries.push({ path: `files/${fname}/${actualName}`, data });
          } catch {}
        }
      } catch {
        failed++;
      }

      await sleep(DELAY);
    }

    bar.style.width = "100%";
    text.textContent = "Creating ZIP...";
    const zipBlob = buildZipBlob(zipEntries);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = "chatgpt-export.zip";
    a.click();
    URL.revokeObjectURL(a.href);

    text.textContent = `Done! Exported ${total - failed}/${total}`;
    setTimeout(() => overlay.remove(), 2000);
  };

  renderList();
  updateStats();
})();
