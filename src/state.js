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

function loadExpanded() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_EXPANDED_KEY) || "[]"));
  } catch {
    return new Set(["personal"]); // Personal expanded by default
  }
}

function saveExpanded(ids) {
  localStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify([...ids]));
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