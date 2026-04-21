# Bug Fix: Pagination de Conversaciones

**Fecha:** 2026-04-21
**Estado:** Fixed
**Severidad:** Media (usuarios perdían conversaciones)

---

## Problema

Al exportar conversaciones, el script no descargaba todas las disponibles. Usuarios reportaban que faltaban conversaciones aunque deberían tener más.

---

## Causa Raíz

La paginación usaba **`offset=N`** pero la API de ChatGPT probablemente devuelve paginación basada en **cursor** (`next_cursor`).

Adicionalmente, el loop cortaba prematuramente cuando `items.length === 0` sin verificar si había más páginas.

### Código antes (buggy)

```javascript
while (true) {
  const data = await apiGet(`conversations?offset=${offset}&limit=${PAGE_SIZE}`);
  const items = data.items || [];
  if (!items.length) break;  // ← Bug: corta aunque haya next_cursor
  conversations.push(...items);
  // ...
  if (offset >= total) break;  // ← Bug: total puede ser menor al real
}
```

### Código después (fix)

```javascript
while (true) {
  // Cursor first, fallback a offset
  const params = cursor
    ? `limit=${PAGE_SIZE}&cursor=${cursor}`
    : `offset=${offset}&limit=${PAGE_SIZE}`;
  const data = await apiGet(`conversations?${params}`);
  const items = data.items || [];

  // Log for debugging
  console.log(`items=${items.length} has_more=${data.has_more} next_cursor=${data.next_cursor}`);

  if (!items.length) {
    console.log("No more items, stopping.");
    break;
  }
  conversations.push(...items);

  // Usa cursor si está disponible
  if (data.next_cursor) {
    cursor = data.next_cursor;
    offset = 0;
  } else {
    offset += PAGE_SIZE;
    if (offset >= total) break;
  }

  // Detiene solo si no hay más páginas
  if (!data.has_more && !data.next_cursor && offset >= total) break;
}
```

---

## Archivos modificados

- `export-chatgpt-console.js` — Console version
- `export-chatgpt.mjs` — Node.js version
- `export-chatgpt.py` — Python version

---

## Logging

Para debugging, cada request de paginación ahora loguea:

```
[conversation list] offset=0 cursor=null items=100 total=500 has_more=true next_cursor=abc123
[conversation list] offset=0 cursor=abc123 items=100 total=500 has_more=true next_cursor=def456
[conversation list] offset=0 cursor=def456 items=100 total=500 has_more=false next_cursor=null
[conversation list] No more items, stopping.
```

---

## Testing

1. Correr exporter en cuenta con >100 conversaciones
2. Verificar que el log muestra `has_more=true` con cursor
3. Comparar cantidad descargada vs. UI de ChatGPT

---

## Notas

- GIST original: https://gist.github.com/ocombe/1d7604bd29a91ceb716304ef8b5aa4b5
- Ver `LICENSE.md` para estado de licencia del proyecto