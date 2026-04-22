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