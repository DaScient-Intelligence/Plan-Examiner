# Plan-Examiner

> **AI-powered building plan review and code compliance — runs entirely in your browser.**

[![Deploy to GitHub Pages](https://github.com/DaScient/Plan-Examiner/actions/workflows/pages.yml/badge.svg)](https://github.com/DaScient/Plan-Examiner/actions/workflows/pages.yml)
[![CI](https://github.com/DaScient/Plan-Examiner/actions/workflows/ci.yml/badge.svg)](https://github.com/DaScient/Plan-Examiner/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/DaScient/Plan-Examiner)](LICENSE)

**[🔗 Live Demo →](https://dascient.github.io/Plan-Examiner)**

Plan-Examiner is an agentic compliance reviewer that checks architectural drawings against building codes — IBC, ADA, and NFPA — and produces scored findings, citations, and correction letters. All document parsing and rule evaluation runs **client-side** in the browser. Nothing is uploaded to a server.

---

## Features

| Feature | Status |
|---|---|
| PDF ingestion (text extraction) | ✅ |
| DXF ingestion (layer/entity parsing) | ✅ |
| DOCX ingestion (mammoth.js) | ✅ |
| DWG support | ⚠️ Convert to DXF/PDF |
| IBC 2021 rule pack | ✅ |
| ADA 2010 rule pack | ✅ |
| NFPA 101 rule pack | ✅ |
| 7-step agent pipeline UI | ✅ |
| BYO-key LLM (OpenAI, Anthropic, Azure, Ollama) | ✅ |
| AI chat panel ("Ask the reviewer") | ✅ |
| Printable compliance report (browser PDF) | ✅ |
| Correction letter download (.md) | ✅ |
| JSON findings export | ✅ |
| IndexedDB review history (last 10) | ✅ |
| Command palette (Ctrl+K) | ✅ |
| Keyboard shortcuts | ✅ |
| PWA / offline support | ✅ |
| GitHub Pages deployment | ✅ |
| Accessibility (WCAG 2.1 AA target) | ✅ |

---

## Supported File Formats

| Format | Ingestion | What's Extracted |
|---|---|---|
| `.pdf` | ✅ pdf.js | Full text, page count |
| `.dxf` | ✅ Custom parser | Layers, LINE entities, TEXT/MTEXT, dimensions |
| `.docx` | ✅ mammoth.js | Full text + HTML |
| `.dwg` | ⚠️ Stub | Converts to DXF/PDF message — DWG is closed binary |
| `.png/.jpg` | 🔜 | OCR via Tesseract.js (toggle, not yet enabled by default) |

---

## Rule Pack Coverage

| Pack | ID | Rules | Status |
|---|---|---|---|
| International Building Code 2021 | `ibc-2021` | 12 | ✅ Shipped |
| ADA Standards for Accessible Design 2010 | `ada-2010` | 10 | ✅ Shipped |
| NFPA 101 Life Safety Code | `nfpa-101` | 8 | ✅ Shipped |
| IRC 2021 | `irc-2021` | — | 🔜 Planned |
| California Building Code (Title 24) | `cbc-title24` | — | 🔜 Planned |

### Contributing a Rule Pack

1. Copy `assets/data/rules/ibc-2021.json` as a template.
2. Follow the [rule pack schema](assets/data/rules/ibc-2021.json).
3. Add your pack to [`assets/data/rules/index.json`](assets/data/rules/index.json).
4. Open a pull request — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## BYO-Key LLM Setup

Plan-Examiner works **fully offline** without an LLM — the rule engine is deterministic. Add a key to enable:
- AI-generated narrative summaries
- Correction letter drafting
- Chat Q&A ("Ask the reviewer")
- Ambiguous-rule reasoning

**How to configure:**
1. Click **AI Settings** in the navigation bar (or press `Ctrl+K → AI Settings`).
2. Select your provider (OpenAI, Anthropic, Azure OpenAI, or local Ollama).
3. Paste your API key. It is stored only in your browser's `localStorage` — never transmitted to Plan-Examiner servers.

**Supported providers:**

| Provider | Default Model | Base URL |
|---|---|---|
| OpenAI | `gpt-4o-mini` | `https://api.openai.com/v1` |
| Anthropic | `claude-3-haiku-20240307` | `https://api.anthropic.com` |
| Azure OpenAI | your deployment | your Azure endpoint |
| Ollama | `llama3` | `http://localhost:11434/v1` |

---

## Privacy

> **All document parsing, fact extraction, and rule evaluation runs entirely in your browser. No plan data is sent to any server under Plan-Examiner's control.**

The only outbound requests are:
- To CDN for font and library assets (Font Awesome, pdf.js, mammoth.js, Tailwind) on first load.
- To your configured LLM provider **only when you have added an API key** and triggered a summarization or chat action.

---

## Running Locally

```bash
# Clone
git clone https://github.com/DaScient/Plan-Examiner.git
cd Plan-Examiner

# Serve with any static server (needed for ES module loading)
npx serve . -p 3000
# or
python3 -m http.server 3000
# then open http://localhost:3000
```

> **Note:** Opening `index.html` directly from the filesystem (`file://`) will work for basic UI but may block CDN-loaded scripts in strict browsers. Use a local server for full functionality.

---

## Project Structure

```
Plan-Examiner/
├── index.html                  ← Main application shell
├── 404.html                    ← GitHub Pages 404
├── manifest.json               ← PWA manifest
├── sw.js                       ← Service worker (offline/PWA)
├── package.json                ← Build tooling (Tailwind CLI)
├── assets/
│   ├── css/styles.css          ← Custom styles
│   ├── js/
│   │   ├── app.js              ← UI controller
│   │   ├── agent/
│   │   │   ├── rule-engine.js  ← Deterministic evaluator
│   │   │   ├── extractors.js   ← PDF/DXF/DOCX parsers
│   │   │   ├── pipeline.js     ← 7-step orchestration
│   │   │   └── llm-bridge.js   ← BYO-key LLM API
│   │   └── utils/
│   │       ├── history.js      ← IndexedDB review history
│   │       └── export.js       ← PDF report + letter export
│   └── data/rules/
│       ├── index.json          ← Rule pack registry
│       ├── ibc-2021.json       ← IBC 2021 rules
│       ├── ada-2010.json       ← ADA 2010 rules
│       └── nfpa-101.json       ← NFPA 101 rules
├── examples/                   ← Sample plan files
├── .github/
│   ├── workflows/
│   │   ├── pages.yml           ← GitHub Pages deploy
│   │   └── ci.yml              ← CI validation
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── dependabot.yml
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── SECURITY.md
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- How to submit a new rule pack
- How to add a new document extractor
- Code style guide
- PR process

---

## License

See [LICENSE](LICENSE) for details.

---

## Contact

- **Email:** PlanExaminer@dascient.com  
- **Phone:** 623-850-0991  
- **Location:** Glendale, Arizona
