# Plan-Examiner

> **AI-powered building plan review and code compliance — runs entirely in your browser.**

[![Deploy to GitHub Pages](https://github.com/DaScient/Plan-Examiner/actions/workflows/pages.yml/badge.svg)](https://github.com/DaScient-Intelligence/Plan-Examiner/actions/workflows/pages.yml)
[![CI](https://github.com/DaScient-Intelligence/Plan-Examiner/actions/workflows/ci.yml/badge.svg)](https://github.com/DaScient/Plan-Examiner/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/DaScient-Intelligence/Plan-Examiner)](LICENSE)

**[🔗 Live Demo →](https://dascient-intelligence.github.io/Plan-Examiner)**

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

## Sample Projects & Local Demos

To test the application's performance and accuracy without using your own private plans, you can use these public-domain sample sets. They are categorized by complexity to help you test different aspects of the agentic pipeline.

| Project Type | Sample Set Name | Key Testing Focus |
| :--- | :--- | :--- |
| **Large Scale** | [SRE Expansion (GRR Airport)](https://www.grr.org/hubfs/GFIAA_C378_SRE%20Expansion_Bid%20Set%20Drawings.pdf) | Large-format rendering & MEP schedules |
| **Industrial** | [Fuel Facility (GRR Airport)](https://www.grr.org/hubfs/GRR%20Fuel%20Facility%20Plans%20-%20Issued%20for%20Bid.pdf) | High-density vector line work |
| **Commercial** | [Naples Airport Office Building](https://www.flynaples.com/wp-content/uploads/2022-02-28-NAPLES-AOB-CONSTRUCTION-DRAWINGS.pdf) | Interior finishes & Life Safety plans |
| **Campus** | [UCCS Bid Set](https://pdc.uccs.edu/sites/g/files/kjihxj1346/files/inline-files/2021-0525_UCCS%20BID%20SET%20-%20Drawings.pdf) | Multi-page navigation & site topography |
| **Standard** | [City of Kirkland Sample Set](https://www.kirklandwa.gov/files/sharedassets/public/v/1/development-services/pdfs/building-pdfs/sample-construction-plan-set.pdf) | Baseline functional testing |

**How to run a demo:**
1. Download any of the PDFs above.
2. Open Plan-Examiner (Live or Local).
3. Drag and drop the file into the **Upload** zone.
4. Select a **Rule Pack** (e.g., ADA 2010 for the Office Building).
5. Click **"Start Review"** to trigger the 7-step agent pipeline.

*For more details on these samples, see [TEST_PLANS.md](./TEST_PLANS.md).*

---

## BYO-Key LLM Setup

Plan-Examiner works **fully offline** without an LLM — the rule engine is deterministic. Add a key to enable:
- AI-generated narrative summaries
- Correction letter drafting
- Chat Q&A ("Ask the reviewer")
- Ambiguous-rule reasoning
- **AI vision on PDF pages** (optional, opt-in) — see below

**How to configure:**
1. Click **AI Settings** in the navigation bar (or press `Ctrl+K → AI Settings`).
2. Select your provider (OpenAI, Anthropic, Azure OpenAI, or local Ollama).
3. Paste your API key. By default it is stored only in your browser's `localStorage` — never transmitted to Plan-Examiner servers.
4. (Optional) Enable **Session only** to store the key in `sessionStorage` instead, so it is forgotten when the tab closes — recommended on shared machines.
5. Click **Test connection** to verify your key/model/URL with a 1-token ping before running a full review.

The settings panel shows:
- A **capability badge** next to the model field — ✅ vision-capable / ⚠ text-only / ❔ unknown — so misconfiguration is caught up front.
- A **show/hide** eye toggle on the API key field.
- A **base-URL validator** that requires `https://` for cloud providers and only allows `http://localhost`/`127.0.0.1` for Ollama (an opt-in checkbox unlocks remote Ollama hosts).
- A **revoke vision consent** button (see below).
- An **outbound endpoint preview** so you can see exactly which URL Plan-Examiner will hit with your current configuration.

### Text-only mode vs Vision mode

| Mode | What runs locally | What leaves the browser |
| --- | --- | --- |
| **Text-only** (default) | Regex extractors + rule engine, deterministic. AI summary/chat is local except for the prompts you trigger. | Just the text prompts you trigger (summarize, correction letter, chat). |
| **Vision** (opt-in) | All of the above. | **Rasterized PDF page images (JPEG, ~1600 px on the long edge)** plus a system prompt and a JSON-only schema. Image bytes are never logged. |

Vision is **off by default** and gated on three conditions:
1. You have configured a provider/key.
2. The configured model is vision-capable (per the table below).
3. You toggled **"Use AI vision on PDF pages"** in AI Settings AND clicked **"I understand"** on the one-time consent dialog.

If any condition fails, the vision sub-step is silently skipped and the deterministic regex/rule path produces the result, exactly as it did before. Failures during vision (rate-limit, malformed JSON, network) **degrade gracefully** to regex-only — they never fail the whole pipeline.

### Vision capability table

| Provider | Vision-capable models (matching patterns) |
| --- | --- |
| OpenAI    | `gpt-4o*`, `gpt-4.1*`, `gpt-4-turbo`, `gpt-4-vision*`, `o1*`, `o3*`, `o4*`, `chatgpt-4o*`, anything containing `vision` |
| Anthropic | `claude-3*` (3, 3.5, 3.7), `claude-sonnet*`, `claude-opus*`, `claude-haiku*` |
| Azure     | OpenAI patterns matched against your deployment name. Custom deployment names are reported as **Capability unknown** — vision will be attempted but may fail. |
| Ollama    | `llava*`, `bakllava*`, `moondream*`, `minicpm*`, `llama3.2-vision*`, anything containing `vision` |

### Caps and budgets

| Setting | Default | Hard cap | Notes |
| --- | --- | --- | --- |
| Pages per run | 6 | 50 | User-configurable in AI Settings → Max pages |
| Long-edge pixels | 1600 | n/a | Keeps payload size manageable |
| JPEG quality | 0.85 | n/a | Quality vs token-spend trade-off |
| Total bytes per run | ~18 MB | n/a | Hard byte budget across the run |
| Per-page request timeout | 60 s (text) / 120 s (vision) | n/a | Prevents hung tabs |
| Retry on 429 / 5xx | up to 2 retries with jittered backoff | n/a | **No retry on 401/403** — opens AI Settings instead |

### What is sent for vision, what is not

| Sent | Not sent |
| --- | --- |
| Up to N rasterized PDF pages (JPEG) | The original PDF file itself |
| The fact-extraction system prompt | The file path, hostname, partner email |
| A JSON-only schema describing the expected fields | Pages above your max-pages cap |
| Your API key in the auth header your provider requires | Anything to Plan-Examiner servers (we don't have any) |

### Revoking vision consent

Open **AI Settings → Revoke vision consent**. The next vision run will re-prompt you. Toggling **Use AI vision** off in AI Settings disables vision without revoking consent for future runs.

---

## Privacy

> **All document parsing, fact extraction, and rule evaluation runs entirely in your browser. No plan data is sent to any server under Plan-Examiner's control.**

The only outbound requests are:
- To CDN for font and library assets (Font Awesome, pdf.js, mammoth.js, Tailwind) on first load.
- To your configured LLM provider **only when you have added an API key** and triggered a summarization, chat, or vision action. The bridge talks directly from your browser to your provider — Plan-Examiner has no proxy or backend.
- LLM requests are sent with `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, and `credentials: 'omit'`. Each provider receives only the auth header it requires (`Authorization`, `x-api-key`, or `api-key`) — there is no cross-provider header leakage.
- API keys, `Authorization`, `x-api-key`, `Bearer`/`Basic` tokens, and image bytes are **redacted** from the verbose log buffer and downloaded `.log` files at the logger boundary — they never appear in exports.

---

## Running Locally

```bash
# Clone
git clone [https://github.com/DaScient-Intelligence/Plan-Examiner.git](https://github.com/DaScient-Intelligence/Plan-Examiner.git)
cd Plan-Examiner

# Serve with any static server (needed for ES module loading)
npx serve . -p 3000
# or
python3 -m http.server 3000
# then open http://localhost:3000
```

---

## Verbose / Debug Mode

Plan-Examiner ships with a built-in diagnostic logger (`PE.Log`) that records every stage of the document scanner so you can answer questions like *"why did this rule end up REVIEW instead of FLAGGED?"* or *"did my file actually get ingested?"*

### Turning it on

| Method | Persistence |
| --- | --- |
| Add `?verbose=1` to the URL | Persists in `localStorage` (toggle off with `?verbose=0`) |
| `localStorage.setItem('pe.verbose', '1')` in DevTools | Persists across reloads |
| Tick the **Enable verbose logging** checkbox in the modal's *Verbose Log* panel | Persists across reloads |

When verbose mode is active the **Verbose Log** panel under the Pipeline tab auto-opens and streams entries live.

### What gets logged

| Stage | Sample entries |
| --- | --- |
| `extract` | `Ingest start: plans.pdf (834,221 bytes)` with `{ sha256, mimeType, lastModified }`; per-regex hits like `fact extracted: corridorWidthInches = 44` with the matched snippet; OCR progress `OCR recognizing 42%`; warnings for image-only PDFs and unsupported file types |
| `pipeline` | Per-step `running` / `done` with `{ durationMs, ... }`; pack list, rule counts, applied placeholders |
| `rule-engine` | `rule ibc-2021/IBC-1005.1 → PASS` with `{ status, note, factsUsed }`; explicit skip reasons (`applies_to mismatch`, `applies_when=false`, `disabled`); aggregate `evaluation complete` summary |
| `llm` | `request → openai (gpt-4o-mini)` and `response ← openai in 1820ms (1432 chars)` — provider, model, prompt/response sizes, latency. **API keys are never logged.** |

### Saving the log for bug reports

The Verbose Log panel has three buttons:

- **Copy** — copies the entire ring buffer to the clipboard as plain text.
- **Download .log** — saves the buffer as a `plan-examiner-<timestamp>.log` file. Attach this to GitHub issues for fast triage.
- **Clear** — empties the ring buffer (the next pipeline run will start fresh).

The ring buffer holds up to 1000 entries. Errors and warnings are recorded even when verbose mode is off, so a bug report log will always include the failure context.

### File integrity

Both the **Preview** tab and the verbose panel display the file's `SHA-256`, byte size, MIME type, and last-modified timestamp so you can verify the right file was ingested. The same metadata is included in the JSON export.

---

## Tests

```bash
npm test           # runs node --test against tests/
```

Covers `Extractors.parse`, `Extractors.fromDxf`, `RuleEngine.evaluate`, and `Pipeline.run` with fixture-based and mocked inputs. The same suite runs in CI on every PR (see `.github/workflows/ci.yml`).
