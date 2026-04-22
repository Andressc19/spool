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