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