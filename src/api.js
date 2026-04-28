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