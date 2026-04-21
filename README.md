# ChatGPT Conversation Exporter

> **Status:** Local fork for experimentation. See [docs/](docs/) for design docs and bug fixes.

Export all your ChatGPT conversations as **JSON + Markdown + HTML + ZIP**.
Works with ChatGPT Business/Team/Enterprise accounts (including SSO/Okta).

**Based on:** https://gist.github.com/ocombe/1d7604bd29a91ceb716304ef8b5aa4b5

## What's exported

- **JSON** — Raw conversation data from the API
- **Markdown** — Clean text with headers per message, relative links to downloaded files
- **HTML** — ChatGPT-style conversation viewer with sidebar navigation, syntax-highlighted code blocks, and embedded images
- **Files** — All images (DALL-E, uploads), documents, and code interpreter outputs are downloaded alongside conversations

## Option 1: Browser Console (easiest, works for everyone)

1. Go to [chatgpt.com](https://chatgpt.com) and log in
2. Open the browser console: **Cmd+Option+J** (Chrome) or **Cmd+Option+K** (Firefox)
3. Copy-paste the contents of [`export-chatgpt-console.js`](https://gist.github.com/ocombe/1d7604bd29a91ceb716304ef8b5aa4b5/raw/export-chatgpt-console.js) and press Enter
4. A progress overlay appears → ZIP file downloads automatically

This runs directly in your browser — no Cloudflare issues, no token copy-paste.

## Option 2: Shell Script (terminal)

Run this command in Terminal:

```bash
curl -sL https://gist.github.com/ocombe/1d7604bd29a91ceb716304ef8b5aa4b5/raw/export-chatgpt.sh -o /tmp/export-chatgpt.sh && bash /tmp/export-chatgpt.sh
```

**What happens:**
1. A web UI opens in your browser
2. Follow the instructions to paste your session token
3. Conversations + files are downloaded to `~/Desktop/chatgpt-export/` with a ZIP at `~/Desktop/chatgpt-export.zip`

**Requirements:** `bash`, `curl`, and either:
- **Node.js 18+** (recommended — install from [nodejs.org](https://nodejs.org))
- **python3** (fallback — may be blocked by Cloudflare on some networks)

The script auto-detects which runtime is available, preferring Node.js.

## Output structure

```
chatgpt-export/
  json/           Raw JSON per conversation
  markdown/       Markdown per conversation (with file links)
  html/           HTML viewer per conversation (with sidebar navigation)
  files/          Downloaded images, documents, code outputs
    <conv_name>/
      image.png
      document.pdf
```

The HTML files include a sidebar listing all conversations for easy navigation. Open any `.html` file in a browser to browse through your conversations.

## How it works

- **Console version:** Runs directly on chatgpt.com (same-origin), fetches the token automatically, downloads all conversations + files, builds a ZIP in-memory, and triggers a download
- **Shell version:** Opens a local web UI for token acquisition, then downloads conversations + files using Node.js or Python
- Files referenced in conversations (images, attachments, code interpreter outputs) are automatically downloaded via the `/backend-api/files/download/` endpoint
- HTML pages use [marked.js](https://marked.js.org/) and [highlight.js](https://highlightjs.org/) from CDN for markdown rendering and syntax highlighting
- No external dependencies — uses only standard library APIs

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **403 error (shell)** | Cloudflare is blocking the request. Use the **console version** instead, or install Node.js 18+ |
| **"Could not find accessToken" (shell)** | Make sure you're logged in at chatgpt.com, then copy the entire page (Cmd+A, Cmd+C) |
| **Token expired** | Tokens are short-lived. Re-open the session URL and copy again |
| **python3 not found** | Run `xcode-select --install` |
| **Console version: no overlay appears** | Make sure you're on chatgpt.com (not another site) |
| **Some files failed to download** | File download URLs can expire. Re-run the export if needed |
| **HTML pages look unstyled** | HTML files need internet access (once) to load marked.js and highlight.js from CDN |

---

## Development

### Project structure

```
gpt-exporter/
  export-chatgpt-console.js   # Browser console version
  export-chatgpt.mjs          # Node.js version
  export-chatgpt.py           # Python version
  export-chatgpt.sh          # Shell launcher
  README.md
  docs/
    SELECTIVE_DOWNLOAD.md    # Feature design: selective download UI
    BUGFIX_PAGINATION.md     # Bug fix: pagination fix
    LICENSE_STATUS.md       # License status
```

### Active changes

See [docs/](docs/) for pending changes:
- `SELECTIVE_DOWNLOAD.md` — Selective download with preview UI
- `BUGFIX_PAGINATION.md` — Pagination fix (applied locally, pending PR to upstream)
