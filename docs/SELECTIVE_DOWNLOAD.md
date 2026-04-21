# ChatGPT Exporter - Selective Download Feature

## Overview

Add a submenu interface that lets users select which conversations and content to download, with live preview of the selected content before exporting.

## Goals

- Allow granular selection of conversations
- Provide live preview of content before export
- Support filtering by date, search, and format
- Improve user experience (current version downloads ALL unconditionally)

---

## UI Schema

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                              ChatGPT Exporter                                        ║
╠═══════════════════��══════════════════════════════════════════════════════════════════════════╣
║  Filtros: [___________🔍 Search_________] [📅 Fecha ▼] [📦 Formato ▼] [☑ Select all]║
╠══════════════════════════════════════════════════════════════════════════════════════════════╣
║                                    │                                              ║
║  ☐  "Fix auth bug en login"          │  ╔══════════════════════════════════════════╗ ║
║    2024-03-15 · 12 msgs            │  ║  Preview: "Fix auth bug en login"         ║ ║
║                                    │  ╠══════════════════════════════════════════╣ ║
║  ☑  "Migrar API a GraphQL"           │  ║  User:                              ║ ║
║    2024-03-10 · 34 msgs · 📎 2 imgs │  ║  Estoy teniendo un problema con    ║ ║
║                                    │  ║  el login de usuarios...          ║ ║
║  ☐  "Review arquitectura React"      │  ║                                  ║ ║
║    2024-03-08 · 8 msgs              │  ║  Assistant:                       ║ ║
║                                    │  ║  Para el problema de auth te      ║ ║
║  ☑  "Optimizar queries DB"          │  ║  recomiendo revisar el middleware  ║ ║
║    2024-03-05 · 22 msgs · 📎 1 img  │  ║  JWT en el archivo...              ║ ║
║                                    │  ║                                  ║ ║
║  ☐  "Planificar sprint Q2"          │  ║  ──────────────────────────────   ║ ║
║    2024-03-01 · 45 msgs             │  ║  Archivos adjuntos:               ║ ║
║                                    │  ║  📎 schema.sql                   ║ ║
║  ☑  "Refactor auth service"          │  ║  📎 auth_flow.png                 ║ ║
║    2024-02-28 · 18 msgs             │  ║                                  ║ ║
║                                    │  ║  [Expandir conversacion completa] ║ ║
║  ☐  "Setup testing CI/CD"            │  ║  [Ver en nueva pestaña]           ║ ║
║    2024-02-25 · 31 msgs             │  ╚══════════════════════════════════╝ ║
║                                    │                                              ║
║  ... (27 ms)                       │                                              ║
╠══════════════════════════════════════════════════════════════════════════════════════════════╣
║  Seleccionados: 3 · 86 msgs · 3 archivos    [Cancelar]        [⬇ Descargar 3]          ║
╚═════════════════════════════════════════��════════════════════════════════════════════════════╝
```

---

## Layout Structure

```
┌────────────────────────────────────────────────────┐
│ Header: Titulo + Filtros globales                   │
├──────────────────┬─────────────────────────────────┤
│                  │                                 │
│  Lista scrollable│  Panel de preview               │
│  con checkboxes  │  (muestra contenido elegido)   │
│                  │                                 │
│  Click = toggle  │  Scroll interno                │
│  Doble click    │                                 │
│    = preview    │  Expande / abre externamente   │
│                  │                                 │
├──────────────────┴─────────────────────��───────────┤
│ Footer: stats + acciones                            │
└────────────────────────────────────────────────────┘
```

---

## Interactions

| Accion | Resultado |
|--------|----------|
| Click en checkbox | Toggle seleccion individual |
| Click en fila | Selecciona y muestra preview |
| Select all | Selecciona todos |
| Search | Filtra por titulo en tiempo real |
| Fecha dropdown | Filtra rango (ultimo mes, custom) |
| Formato dropdown | Toggle: JSON, MD, HTML, ZIP |
| Descargar N | Exporta solo lo checked |

---

## Data Model

### ConversationSummary

```typescript
interface ConversationSummary {
  id: string;
  title: string;
  create_time: number;         // Unix timestamp
  update_time: number;        // Unix timestamp
  message_count: number;
  has_attachments: boolean;
  attachment_count: number;
}
```

### FilterOptions

```typescript
interface FilterOptions {
  search_query: string;
  date_range: {
    start: number | null;     // Unix timestamp
    end: number | null;      // Unix timestamp
  };
  preset: 'all' | 'week' | 'month' | 'year';
  formats: {
    json: boolean;
    markdown: boolean;
    html: boolean;
    zip: boolean;
  };
  include_attachments: boolean;
}
```

### SelectionState

```typescript
interface SelectionState {
  selected_ids: Set<string>;
  total_messages: number;
  total_files: number;
}
```

---

## Implementation Priority

### Phase 1: Console Version
- Implementar en `export-chatgpt-console.js`
- Modal overlay con lista seleccionable
- Preview panel
- Filtros basicos (search, date preset)

### Phase 2: Shell Version
- Migrar logica a `export-chatgpt.mjs` y `export-chatgpt.py`
- Reutilizar componentes de UI donde sea posible

### Phase 3: Enhancements
- Persistencia de seleccion entre sesiones
- Export presets guardados
- Pagination / infinite scroll para cuentas grandes

---

## Out of Scope (v1)

- Preview de archivos binarios (imagenes, PDFs)
- Export a otros formatos (PDF, DOCX)
- Sync entre dispositivos
- Compression level selection

---

## Status

**Phase:** Design
**Validated:** No