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
  #spool-overlay .spool-loading-container { display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px }
  #spool-overlay .spool-spinner { width:40px;height:40px;border:4px solid #1e293b;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px }
  @keyframes spin { to { transform:rotate(360deg); } }
  #spool-overlay .spool-loading-text { color:#64748b;font-size:14px }
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