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

  showLoading("Loading conversations...");

  // Fetch conversations
  let conversations = [];
  try {
    conversations = await fetchConversations(token);
  } catch (e) {
    showError(`Failed to load: ${e.message}`, true);
    return;
  }

  if (!conversations.length) {
    showError("No conversations found.", false);
    return;
  }

  console.log(`[Spool] Loaded ${conversations.length} conversations`);

  // State
  const state = {
    all: conversations,
    selected: loadSelections(),
    filtered: conversations,
    activeId: null,
  };

  // Filter
  function filterConversations() {
    const q = document.getElementById("spool-search").value.toLowerCase();
    const preset = document.getElementById("spool-date-filter").value;
    state.filtered = state.all.filter((c) => {
      const matchDate = dateFilter(c, preset);
      const matchSearch = !q || (c.title || "").toLowerCase().includes(q);
      return matchDate && matchSearch;
    });
    renderList();
  }

  // Render list
  function renderList() {
    const list = document.getElementById("spool-list");
    list.innerHTML = state.filtered
      .map((c) => {
        const sel = state.selected.has(c.id);
        const files = c.has_files || c.attachment_count || 0;
        const date = formatDate(c.update_time || c.id);
        const msgs = c.num_total_messages || c.message_count || "?";
        return `<div class="spool-conv-item${sel ? " selected" : ""}" data-id="${c.id}">
          <input type="checkbox"${sel ? " checked" : ""} data-cb="${c.id}">
          <div class="spool-conv-info">
            <div class="spool-conv-title">${escapeHtml(c.title || "Untitled")}</div>
            <div class="spool-conv-meta">${date} · ${msgs} msgs${files ? ` · ${files} files` : ""}</div>
          </div>
        </div>`;
      })
      .join("");

    // Event handlers
    list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const id = e.target.dataset.cb;
        if (e.target.checked) {
          state.selected.add(id);
          e.target.closest(".spool-conv-item").classList.add("selected");
        } else {
          state.selected.delete(id);
          e.target.closest(".spool-conv-item").classList.remove("selected");
        }
        saveSelections(state.selected);
        updateStats();
      });
    });
  }

  // Render preview
  function renderPreview(id) {
    const preview = document.getElementById("spool-preview");
    const conv = state.all.find((c) => c.id === id);
    if (!conv) {
      preview.innerHTML = '<div class="spool-preview-empty">Not found</div>';
      return;
    }

    state.activeId = id;
    const date = formatDate(conv.update_time || conv.id);
    const title = escapeHtml(conv.title || "Untitled");
    const files = conv.has_files || conv.attachment_count || 0;
    const msgs = conv.num_total_messages || conv.message_count || "?";

    preview.innerHTML = `
      <div class="spool-preview-header">
        <h3>${title}</h3>
        <div class="date">${date} · ${msgs} msgs</div>
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
    state.all.forEach((c) => {
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
  document.getElementById("spool-search").addEventListener("input", filterConversations);
  document.getElementById("spool-date-filter").addEventListener("change", filterConversations);
  document.getElementById("spool-select-all").onclick = () => {
    state.filtered.forEach((c) => state.selected.add(c.id));
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
  document.getElementById("spool-list").addEventListener("dblclick", (e) => {
    const item = e.target.closest(".spool-conv-item");
    if (item) renderPreview(item.dataset.id);
  });

  // Export
  document.getElementById("spool-export").onclick = async () => {
    const selectedIds = [...state.selected];
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
      const conv = state.all.find((c) => c.id === cid);
      const title = sanitize(conv?.title || "Untitled");
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
        const lines = [`# ${conv?.title || "Untitled"}`, ""];
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