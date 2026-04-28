# Spool - Agent Guidelines

## Build & Development

**Build command:**
```bash
node scripts/build.js
```
Generates `spool.user.js` from `src/*.js` files. **Never edit `spool.user.js` directly.**

**Workflow:**
1. Edit files in `src/`
2. Run `node scripts/build.js`

## Project Structure

```
src/
  config.js   # API endpoints, constants (DELAY=500ms, PAGE_SIZE=100)
  state.js    # localStorage persistence for selections
  api.js      # ChatGPT API calls
  parser.js   # Conversation parsing, file extraction
  export.js   # ZIP build (JSZip)
  ui.js       # Overlay UI, styles
  main.js     # Entry point, floating button
scripts/
  build.js    # Concatenates src/ files + metadata
  metadata.txt # UserScript headers
spool.user.js # Generated output (do not edit)
```

## Key Conventions

- **No dependencies** - vanilla JS only
- **No framework** - direct DOM manipulation
- **API base:** `/backend-api` (relative to chatgpt.com)
- **Storage:** `localStorage.spool_selections` for persisting selected conversations
- **Export formats:** JSON + Markdown + ZIP with `files/` subfolder


## Gotchas

- Script runs only on `https://chatgpt.com/*`
- Requires valid ChatGPT session token (fetched via `/api/auth/session`)
- Export includes rate limiting (`DELAY=500ms` between requests)
