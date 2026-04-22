# Spool - ChatGPT Conversation Exporter

> **Export your ChatGPT conversations with ease.**  
> Built with ���️ for selective downloads and a beautiful UI.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## What is Spool?

Spool is a userscript that helps you export your ChatGPT conversations. Originally inspired by [ocombe/gist](https://gist.github.com/ocombe/1d7604bd29a91ceb716304ef8b5aa4b5).

### Features

- ✅ **Selective Download** — Choose which conversations to export
- ✅ **Preview** — Preview conversations before downloading
- ✅ **Search** — Filter by conversation title
- ✅ **Date Filters** — Filter by: All time, Last week, Last month, Last year
- ✅ **Persistent Selections** — Your selections are saved across sessions
- ✅ **Export Formats** — JSON + Markdown + ZIP
- ✅ **Auto Pagination** — Loads all conversations (fixes original bug)

---

## Installation

### 1. Install TamperMonkey

| Browser | Link |
|--------|------|
| Chrome | [TamperMonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhlkfmlkopeegbdpgkgmplf) |
| Firefox | [TamperMonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| Edge | [TamperMonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey) |

### 2. Add the Script

**Option A:** Copy-paste manually
1. Click TamperMonkey icon → "Create a new script"
2. Copy all content from [`spool.user.js`](spool.user.js)
3. Save (`Ctrl+S`)

**Option B:** Import from GreasyFork (coming soon)

---

## Usage

1. Go to [chatgpt.com](https://chatgpt.com) and log in
2. Click the **📦** button (bottom-right corner) OR click TamperMonkey icon → "Spool - ChatGPT Exporter"
3. Wait for conversations to load
4. Use checkboxes to select conversations
5. Use search and date filters to narrow down
6. Click **Export** to download

### Keyboard Shortcuts

| Action | How |
|--------|-----|
| Open Spool | Click 📦 button |
| Preview | Double-click a conversation |
| Select all | Click "Select all" button |
| Deselect all | Click "None" button |

---

## Export Output

```
chatgpt-export.zip
├── json/
│   ├── conversation_title_abc123.json
│   └── ...
├── markdown/
│   ├── conversation_title_abc123.md
│   └── ...
└── files/
    └── ...
```

---

## Development

### Project Structure

```
spool/
├── spool.user.js      # Main userscript
├── README.md         # This file
├── LICENSE           # MIT License
├── .gitignore        # Git ignore
└── docs/
    ├── SELECTIVE_DOWNLOAD.md
    ├── BUGFIX_PAGINATION.md
    └── LICENSE_STATUS.md
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Distribution | Userscript (TamperMonkey) |
| Platform | GreasyFork (planned) |
| Code | Vanilla JavaScript |
| Styling | CSS-in-JS |

### Running Locally

```bash
# Clone the repo
git clone git@github.com:Andressc19/spool.git
cd spool

# Make changes to spool.user.js
# Test in browser

# Push changes
git add spool.user.js
git commit -m "fix: describe your change"
git push
```

---

## Known Issues

- Search only filters by title (not content)
- Some old conversations may not have timestamps

---

## Credits

- **Original idea:** [ocombe](https://gist.github.com/ocombe/1d7604bd29a91ceb716304ef8b5aa4b5)
- **Contributors:** Spool community

---

## License

MIT — See [`LICENSE`](LICENSE) file.

---

## Support

- 🐛 Report bugs: [GitHub Issues](https://github.com/Andressc19/spool/issues)
- 💬 Discuss: [GitHub Discussions](https://github.com/Andressc19/spool/discussions)