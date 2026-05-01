# Test Project Plans for Plan-Examiner

This document provides a curated list of high-quality architectural, engineering, and construction (AEC) plan sets to be used for testing the functionality, rendering accuracy, and performance of the Plan-Examiner application. These files represent various complexities, from standard residential samples to large-scale municipal and infrastructure projects.

## Sample Plan Sets

The following links point to publicly available PDF plan sets. Use these to verify OCR capabilities, layer management, and measurement tools within the application.

### 1. Gerald R. Ford International Airport (GRR) - SRE Expansion
* **Description:** A comprehensive bid set for the Snow Removal Equipment (SRE) building expansion. Excellent for testing large-format drawing sets with complex mechanical and structural details.
* **Key Features:** Structural steel framing, site utility plans, and detailed MEP (Mechanical, Electrical, Plumbing) schedules.
* **URL:** [GFIAA_C378_SRE Expansion Bid Set](https://www.grr.org/hubfs/GFIAA_C378_SRE%20Expansion_Bid%20Set%20Drawings.pdf)

### 2. GRR Fuel Facility Plans
* **Description:** Specialized industrial construction plans for an airport fuel facility.
* **Key Features:** Civil engineering focus, containment systems, and heavy industrial piping diagrams. Good for testing high-density vector line work.
* **URL:** [GRR Fuel Facility - Issued for Bid](https://www.grr.org/hubfs/GRR%20Fuel%20Facility%20Plans%20-%20Issued%20for%20Bid.pdf)

### 3. Naples Airport Authority - Office Building
* **Description:** Construction drawings for an Airport Office Building (AOB).
* **Key Features:** Modern commercial architecture, interior finish schedules, and life safety plans. Useful for testing architectural annotation parsing.
* **URL:** [Naples AOB Construction Drawings](https://www.flynaples.com/wp-content/uploads/2022-02-28-NAPLES-AOB-CONSTRUCTION-DRAWINGS.pdf)

### 4. UCCS Campus Construction
* **Description:** A large-scale university bid set from the University of Colorado Colorado Springs.
* **Key Features:** Complex site topography, multiple building sections, and extensive callouts. Ideal for stress-testing multi-page navigation and zoom performance.
* **URL:** [UCCS Bid Set - Drawings](https://pdc.uccs.edu/sites/g/files/kjihxj1346/files/inline-files/2021-0525_UCCS%20BID%20SET%20-%20Drawings.pdf)

### 5. City of Kirkland - Sample Construction Set
* **Description:** A standardized sample plan set provided by the City of Kirkland for residential/light commercial permit training.
* **Key Features:** Standardized formatting, clear labeling, and representative of "typical" permit submittals. Use this as a baseline for functional testing.
* **URL:** [Sample Construction Plan Set](https://www.kirklandwa.gov/files/sharedassets/public/v/1/development-services/pdfs/building-pdfs/sample-construction-plan-set.pdf)

---

## Testing Objectives

When using these plans, focus on the following performance and functional metrics:

| Test Category | Description |
| :--- | :--- |
| **Rendering Speed** | Time taken to render the first page and subsequent pages upon scrolling. |
| **OCR Accuracy** | Ability to detect and extract text from title blocks and schedules. |
| **Layer Control** | Successfully toggling visibility for different CAD layers (if preserved in PDF). |
| **Zoom/Pan Fluidity** | Maintaining high frame rates when navigating high-density vector drawings. |
| **Measurement Precision** | Verifying digital scale calibration against printed graphic scales. |

## How to Add More
To contribute additional test plans, please ensure the links are persistent and the documents are in the public domain or approved for redistributable testing use. Update this list via a Pull Request.

---

## Automated Coverage (`npm test`)

The `tests/` folder contains Node-runnable unit tests (`node --test`, no framework dep) that exercise the scanner end-to-end without a browser:

| File | What it covers |
| :--- | :--- |
| `tests/extractors.parse.test.js` | Every fact-extraction regex (area, occupant load, stair geometry, corridor/door widths, building height, fire separation, sprinkler/handrail flags). |
| `tests/extractors.dxf.test.js`   | `fromDxf()` against `tests/fixtures/sample.dxf` — TEXT entity parsing, layer detection, LINE-based dimensional inference, malformed-input safety. |
| `tests/extractors.vision.test.js`| `mergeVisionFacts()` agree / disagree / miss-miss / miss-hit logic, provenance recording, low-confidence filtering, malformed-vision-response safety. |
| `tests/rule-engine.test.js`      | `evaluate()` with a synthetic rule pack — PASS / REVIEW / FLAGGED outcomes, `applies_to` / `disabled` skipping, `score()` weighting. |
| `tests/pipeline.test.js`         | `Pipeline.run()` step ordering and event emission with mocked `Extractors.extract` and `fetch`; covers happy-path, extractor error, and unsupported-file short-circuit. |
| `tests/pipeline.vision.test.js`  | Vision sub-step gating (no key, no consent, text-only model, toggle off), successful merge with provenance, conflict adds REVIEW finding, graceful degradation on vision failure. |
| `tests/llm-bridge.test.js`       | Capability detection, base-URL validation (https/loopback/path-traversal), error normalization (`auth`/`rate_limited`/`server`/`network`), per-provider header isolation, vision-JSON tolerant parser, schema clamping, key-shape warnings, vision consent persistence. |
| `tests/log.redaction.test.js`    | Logger redacts `apiKey`/`Authorization`/`x-api-key`/`Bearer`/`token`/etc. — `JSON.stringify`-ing the buffer never contains common credential keys. |

CI runs the full suite on every PR via `.github/workflows/ci.yml` (job: **Unit Tests**). All assertions must pass before merging.

---

## Manual Verification — Verbose Log Checklist

For each sample PDF in the list above, perform the following walk-through with `?verbose=1` enabled. The Verbose Log panel under the *Pipeline* tab should show each item.

1. **Ingest stage**
   - [ ] `extract` log shows `Ingest start: <filename>` with `sha256`, `mimeType`, `lastModified`, and `sizeBytes` matching the file on disk.
   - [ ] `Sample of extracted text (first 500 chars)` entry contains recognizable strings from the plan title block.
   - [ ] For an image-only / scanned PDF, a `warn` entry with `image-only-pdf` appears and the warning is shown in the Preview tab.
   - [ ] For an unknown file extension, an `error` entry is recorded and the pipeline halts at *Ingest*.
2. **Per-fact extraction**
   - [ ] At least one `fact extracted: <factName> = <value>` debug entry per major dimension visible on the plan (occupant load, gross area, corridor width, etc.) with a matching `snippet` field showing the source text.
3. **Rule evaluation**
   - [ ] `rule <pack>/<rule_id> → PASS|REVIEW|FLAGGED` debug entries appear for each evaluated rule.
   - [ ] Skipped rules show explicit reason (`applies_to mismatch`, `applies_when=false`, `disabled`).
   - [ ] Aggregate `evaluation complete` info entry summarises totals.
4. **Coverage report**
   - [ ] Analysis tab includes the **Rule Coverage** disclosure with the count of present vs missing evidence keys.
5. **LLM (only when configured)**
   - [ ] `llm` `request →` and `response ←` entries record provider, model, prompt/response sizes, and latency.
   - [ ] **API key never appears** in any log entry (verify by searching the downloaded `.log` file).
6. **Export**
   - [ ] Click **Download .log** — file downloads as `plan-examiner-<timestamp>.log`.
   - [ ] JSON export includes `file.sha256`, `coverage`, and `placeholders` sections.

---

## Manual Verification — AI Vision walkthrough

Use this section to validate the **opt-in vision pass** end-to-end. The deterministic regex/rule path remains the source of truth — vision is strictly additive.

**Recommended sample:** [Naples AOB Construction Drawings](https://www.flynaples.com/wp-content/uploads/2022-02-28-NAPLES-AOB-CONSTRUCTION-DRAWINGS.pdf) — has clear title-block code summary sheets so a vision model can read occupant load, area, and occupancy group.

### Setup
1. Open **AI Settings** and select your provider (e.g. OpenAI `gpt-4o-mini`, Anthropic `claude-3-5-sonnet-20241022`, or local Ollama `llava`).
2. Paste your API key (skip for Ollama).
3. Click **Test connection** — verify a green `✓ Reachable (… ms)`.
4. Confirm the **capability badge** shows ✅ *Vision-capable*.
5. Toggle **"Use AI vision on PDF pages"** on and set **Max pages** to `4` (or fewer to keep token spend low).
6. Click **Save Configuration**.

### Walkthrough
1. Upload the sample PDF and click **Analyze Plan**.
2. The first time, you should see the **Confirm: AI vision on PDF pages** dialog. Click *I understand — enable vision*.
3. In the Pipeline tab, the *Extract Facts* step should show:
   - `AI vision: rasterizing pages…`
   - `AI vision: page 1/4 rasterized` … `page 4/4 rasterized`
   - `AI vision: querying <model> on 4 page(s)…`
   - Final detail: `N fact(s) extracted: … (vision: +X, conflicts: Y)`
4. In the **Verbose log** panel, look for:
   - [ ] `rasterized page 1/4` debug entries with `width`, `height`, `bytes`, `sha256` — but **never** the data URL or raw image bytes.
   - [ ] `request → openai (gpt-4o-mini)` log entry shows `images: 4`, `multimodal: true`, and **does not contain your API key**.
   - [ ] `vision merge complete` info entry with `pages`, `conflicts`, `factsAdded`.
5. In the **Findings** panel:
   - [ ] If the vision pass disagreed with regex on any field, a `Vision/text disagreement: …` REVIEW finding is listed.
6. **Failure path:** Temporarily change your API key to an invalid value, save, and analyze the same PDF. The Extract step should report `AI vision failed (…) — continuing with regex facts.` and the rest of the pipeline must complete normally.
7. Open **AI Settings → Revoke vision consent**, run another analysis — the consent dialog must reappear before vision will run again.
