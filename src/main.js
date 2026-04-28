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

    showLoading("Initializing...");

    // Get token (necesario para todo)
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

  // State inicial (vacío)
  const state = {
    projects: [],
    personal: [],
    selected: loadSelections(),
    activeId: null,
    filter: "all",
    searchQuery: "",
    loading: true,
    loadingProjects: 0,
    totalProjects: 0,
    expanded: loadExpanded(),
  };

  // Mostrar UI inmediatamente
  renderList();
  updateStats();

  // Cargar datos en segundo plano (no bloqueante)
  loadAllData(state).catch(e => {
    console.error('[Spool] Error loading data:', e);
    showError(`Failed to load data: ${e.message}`, false);
  });

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
    
    // Mostrar estado de carga
    if (state.loading) {
      const progressText = state.totalProjects > 0 
        ? `Loading projects... ${state.loadingProjects}/${state.totalProjects}`
        : 'Loading conversations...';
      
      list.innerHTML = `
        <div class="spool-loading-container">
          <div class="spool-spinner"></div>
          <div class="spool-loading-text">${progressText}</div>
        </div>
      `;
      return;
    }
    
    const filtered = getFilteredData();
    
    let html = "";
    
    // Projects section
    if (filtered.projects.length > 0 && state.filter !== "personal") {
      html += `<div class="spool-section-header">📁 Projects</div>`;
      
      for (const project of filtered.projects) {
        const isOpen = state.expanded.has(project.id);
        const emoji = project.emoji || "📁";
        const theme = project.theme || "#3b82f6";
        const allSelected = project.conversations.length > 0 && project.conversations.every(c => state.selected.has(c.id));
        
        html += `
          <div class="spool-project" data-project="${project.id}">
            <div class="spool-project-header" style="border-left-color: ${theme}">
              <button class="spool-project-toggle">${isOpen ? "▼" : "▶"}</button>
              <span class="spool-project-emoji">${emoji}</span>
              <span class="spool-project-name">${escapeHtml(project.name)}</span>
              <span class="spool-project-count">${project.conversations.length}</span>
              <input type="checkbox" class="spool-project-checkbox"${allSelected ? " checked" : ""} data-project="${project.id}">
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
      const isPersonalOpen = state.expanded.has("personal");
      const allSelected = filtered.personal.length > 0 && filtered.personal.every(c => state.selected.has(c.id));
      
      html += `
        <div class="spool-project" data-project="personal">
          <div class="spool-project-header" style="border-left-color: #22c55e">
            <button class="spool-project-toggle">${isPersonalOpen ? "▼" : "▶"}</button>
            <span class="spool-project-emoji">📄</span>
            <span class="spool-project-name">Personal Conversations</span>
            <span class="spool-project-count">${filtered.personal.length}</span>
            <input type="checkbox" class="spool-project-checkbox"${allSelected ? " checked" : ""} data-project="personal">
          </div>
          ${isPersonalOpen ? `
            <div class="spool-project-conversations">
              ${filtered.personal.map((c) => {
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
              }).join("")}
            </div>
          ` : ""}
        </div>
      `;
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
          // Toggle entire project or personal selection
          const projectId = cb.dataset.project;
          
          // Expand the section if not already expanded
          if (!state.expanded.has(projectId)) {
            state.expanded.add(projectId);
            saveExpanded(state.expanded);
          }
          
          if (projectId === "personal") {
            // Toggle all personal conversations selection
            if (cb.checked) {
              filtered.personal.forEach(c => state.selected.add(c.id));
            } else {
              filtered.personal.forEach(c => state.selected.delete(c.id));
            }
          } else {
            // Toggle project selection
            const project = state.projects.find(p => p.id === projectId);
            
            if (cb.checked) {
              project.conversations.forEach(c => state.selected.add(c.id));
            } else {
              project.conversations.forEach(c => state.selected.delete(c.id));
            }
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
          }
          
          // Update project/personal checkbox if needed
          const convProject = cb.closest(".spool-project");
          if (convProject) {
            const projectId = convProject.dataset.project;
            
            if (projectId === "personal") {
              // Check if all personal are selected
              const allSelected = filtered.personal.every(c => state.selected.has(c.id));
              const personalCb = convProject.querySelector(".spool-project-checkbox");
              if (personalCb) personalCb.checked = allSelected;
            } else {
              // Check if all project conversations are selected
              const project = state.projects.find(p => p.id === projectId);
              const allSelected = project.conversations.every(c => state.selected.has(c.id));
              const projectCb = convProject.querySelector(".spool-project-checkbox");
              if (projectCb) projectCb.checked = allSelected;
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
        
        // Toggle expanded state
        if (state.expanded.has(projectId)) {
          state.expanded.delete(projectId);
        } else {
          state.expanded.add(projectId);
        }
        
        saveExpanded(state.expanded);
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

  // Cargar datos en segundo plano (no bloqueante)
  loadAllData().catch(e => {
    console.error('[Spool] Error loading data:', e);
    showError(`Failed to load data: ${e.message}`, false);
  });

  // ═════════════════════════════════════════════════════════════
  // Carga de datos en segundo plano
  // ═════════════════════════════════════════════════════════════

  async function loadAllData() {
    try {
      state.loading = true;
      state.loadingProjects = 0;
      renderList();
      
      // Cargar personales y proyectos en paralelo
      const [personalData, projectsData] = await Promise.all([
        fetchConversations(token),
        fetchProjects(token),
      ]);
      
      state.personal = personalData;
      state.projects = projectsData;
      state.totalProjects = projectsData.length;
      
      console.log(`[Spool] Loaded ${projectsData.length} projects, ${personalData.length} personal conversations`);
      
      // Cargar conversaciones de cada proyecto
      for (let i = 0; i < state.projects.length; i++) {
        const project = state.projects[i];
        console.log(`[Spool] Fetching conversations for project: ${project.name}`);
        
        try {
          const convos = await fetchAllProjectConversations(project.id, token);
          project.conversations = convos;
          console.log(`[Spool] Project ${project.name}: ${convos.length} conversations`);
        } catch (e) {
          console.error(`[Spool] Error fetching conversations for ${project.name}:`, e);
          project.conversations = [];
        }
        
        state.loadingProjects = i + 1;
        renderList();
        updateStats();
        
        await sleep(DELAY);
      }
      
      state.loading = false;
      renderList();
      updateStats();
      
      const totalProjectConvs = state.projects.reduce((sum, p) => sum + p.conversations.length, 0);
      console.log(`[Spool] Done! ${state.projects.length} projects (${totalProjectConvs} conversations) + ${state.personal.length} personal`);
      
    } catch (e) {
      state.loading = false;
      throw e;
    }
  }

  // Cargar datos en segundo plano (no bloqueante)
  loadAllData().catch(e => {
    console.error('[Spool] Error loading data:', e);
    showError(`Failed to load data: ${e.message}`, false);
  });
})();
