# Plan-Examiner Primer & Glossary

> **Audience:** Anyone — first-time users, trainers preparing a workshop,
> executives prepping for a board meeting, or new hires on day one.
>
> **Time:** 20–30 minutes to read end-to-end.

---

## 1. What Plan-Examiner is, in one paragraph

Plan-Examiner is an **AI-assisted compliance reviewer for architectural and
construction documents**. You drag in a PDF, DXF, or DOCX of a building plan;
Plan-Examiner extracts dimensional facts (corridor widths, occupant loads,
egress counts, accessibility features) and runs them through deterministic
**rule packs** for IBC, ADA, and NFPA. The output is a scored set of findings,
code citations, and a draft correction letter — all generated **in your
browser**, with no plan data leaving your machine unless you explicitly enable
an LLM.

That last point matters: the rule engine is **deterministic**, not "AI." When
the engine says a rule passed, it passed because a measured fact met a coded
threshold — not because a model "felt" it should pass. The LLM is optional
icing; it writes nicer prose, drafts the letter, and (if you opt in) reads
PDF page rasters with vision. The legal substance is always the rule engine.

---

## 2. Why it exists

| Problem in plan review today | How Plan-Examiner addresses it |
| --- | --- |
| Reviewers spend hours hunting for occupant loads, corridor widths, ADA dimensions | Regex + vision extractors pull facts in seconds |
| Citations are inconsistent between reviewers | Rule packs include the citation string, so every finding cites the same code section |
| Plan sets contain confidential project information that can't be uploaded to SaaS | Everything runs client-side; no backend |
| Junior reviewers miss "common" code violations | A 30-rule baseline catches the boring 80% so seniors can focus on the hard 20% |
| Correction letters are written from scratch every time | Findings auto-draft into a markdown letter you can edit and send |

---

## 3. The 7-step pipeline (mental model)

The product surfaces seven labeled steps. Memorize this — every conversation
about Plan-Examiner sooner or later refers to "the pipeline."

| # | Step | What happens | Where you'd look if it failed |
| --- | --- | --- | --- |
| 1 | **Ingest** | The file is parsed (pdf.js, DXF parser, mammoth.js). | Verbose log → `extract` stage. Check SHA-256, byte size, MIME. |
| 2 | **Classify** | Occupancy/use group is identified from textual cues. | Verbose log → `pipeline` stage. |
| 3 | **Extract Facts** | Dimensional data (corridor widths, door clear widths, occupant loads, ramp slopes…) is pulled via regex; optionally vision-augmented. | Verbose log → `extract` per-regex hits. |
| 4 | **Select Rules** | Applicable rule packs are loaded for the jurisdiction. | UI: rule pack picker. Log shows pack list & rule count. |
| 5 | **Evaluate** | Deterministic checks: `PASS`, `FAIL`, `REVIEW`, `SKIP`. | Verbose log → `rule-engine` shows status + factsUsed per rule. |
| 6 | **Cite** | Each finding is decorated with code section + remediation note. | Findings table. |
| 7 | **Draft Report** | If LLM configured → narrative summary + correction letter. Else → deterministic summary. | Verbose log → `llm`. Falls back gracefully on failure. |

> **Trainer tip:** When demoing, narrate the steps as they light up. Your
> audience will retain the model far better than if you describe the system
> abstractly.

---

## 4. Modes

### 4.1 Text-only mode (default)
Regex extractors and the rule engine, fully deterministic. The only outbound
network calls are to your configured LLM **and only when you trigger** a
summary, chat, or letter draft.

### 4.2 Vision mode (opt-in)
PDF pages are rasterized to JPEG (~1600 px on the long edge) and sent to a
vision-capable model along with a JSON-only schema. Used to read dimensions
and labels off image-only PDFs. Gated behind:
1. A configured provider/key.
2. A model that matches the vision capability table.
3. The "Use AI vision" toggle **and** the one-time consent dialog.

If any gate fails, vision is silently skipped and the regex/rule path runs
unchanged.

### 4.3 Offline mode
With no LLM configured, Plan-Examiner still runs steps 1–6 fully. Step 7
emits a deterministic narrative based on the findings table. This is the
mode to use for highly confidential projects.

---

## 5. Glossary

> Kept short on purpose. If a term is jargon to a new hire, it belongs here.

| Term | Plain-English definition |
| --- | --- |
| **Rule pack** | A versioned JSON file (e.g., `ibc-2021.json`) listing rules to evaluate. |
| **Rule** | A single check, e.g., "corridor serving >50 occupants must be ≥44 in wide." |
| **Fact** | A datapoint extracted from the plan, e.g., `corridorWidthInches = 44`. |
| **Finding** | The output of a rule against the facts: PASS / FAIL / REVIEW / SKIP. |
| **PASS** | The fact met the rule's threshold. |
| **FAIL** | The fact violated the threshold. |
| **REVIEW** | The fact is ambiguous or partial — a human must look. |
| **SKIP** | The rule's `applies_to` / `applies_when` did not match (e.g., R-occupancy rule on a B-occupancy plan). |
| **Citation** | The code section string included with the finding (e.g., `IBC 1020.2`). |
| **Correction letter** | A markdown letter to the design team listing FAILs with citations and remediation language. |
| **BYO-key LLM** | "Bring-your-own-key" — the user supplies the API key for OpenAI/Anthropic/Azure/Ollama. |
| **PE.LLM** | The internal JS bridge that calls the LLM. Stores config under `pe_llm_config` in `localStorage` (or `sessionStorage` if "Session only" is on). |
| **Verbose log** | A 1000-entry ring buffer (`PE.Log`) that records every stage. Toggle with `?verbose=1` or in the UI. |
| **PWA** | Progressive Web App — the service worker (`sw.js`) caches assets so Plan-Examiner runs offline once loaded. |
| **Partner access** | A donor-supported allowlist of SHA-256-hashed emails (`assets/data/partners.json`) that unlocks partner-only features. Hashes only — no plaintext emails on the public site. |

---

## 6. Common misconceptions to correct early

| Someone says… | Correct gently with… |
| --- | --- |
| "It uses AI to decide if the plan passes." | Rule evaluation is deterministic. AI only writes prose and (optionally) reads images. |
| "We need a server to run this." | We don't. It's a static site + service worker. Any HTTP host works. |
| "Plans are uploaded to your servers." | Plan-Examiner has no servers. The only outbound calls are CDN assets and (optionally) the LLM the user configured. |
| "DWG works." | DWG is closed binary. Convert to DXF or PDF first. |
| "I'll paste my OpenAI key in the chat to share it." | **No.** Keys live in the user's browser only. Never share keys in chat, screenshots, or screen-shares. |

---

## 7. Where to go next

- **For hands-on practice:** [Quickstart Demo Script](quickstart-demo-script.md)
- **For day-to-day workflow:** [Operator Handbook](../02-end-user/user-handbook.md)
- **For teaching this material:** [Train-the-Trainer Handbook](../03-trainer/train-the-trainer-handbook.md)
- **For the deepest technical reference:** the project [README.md](../../../README.md)
