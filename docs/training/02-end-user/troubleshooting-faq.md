# Troubleshooting & FAQ

> **Audience:** Operators, trainers handling questions from the room,
> support staff triaging tickets.
>
> **How to use:** Search for the symptom. Each entry tells you (a) the
> likely root cause, (b) the fast fix, and (c) the verbose-log signature
> so you can diagnose the *next* report quickly.

---

## Top 10 questions

### 1. "I dropped a PDF and nothing happened."
- **Likely cause:** the file is image-only (scanned), so `pdf.js` extracts
  zero text. The pipeline still runs but step 3 (Extract Facts) returns no
  facts and the findings are mostly SKIP.
- **Fast fix:** enable vision mode (with a vision-capable model) and
  re-run, OR use OCR (Tesseract) if enabled, OR ask the design team for a
  text-layered PDF.
- **Verbose-log signature:** `extract` stage shows
  `Ingest start: …` followed by `image-only PDF detected, no text layer`.

### 2. "The findings table is empty."
- **Likely cause:** rule-pack mismatch. You picked `nfpa-101` for an
  ADA-only review of an exterior accessibility route; every rule SKIPs.
- **Fast fix:** add the relevant pack(s). For mixed-use buildings, add
  *all* applicable packs.
- **Verbose-log signature:** every rule line ends with `→ SKIP` and a
  reason like `applies_to mismatch`.

### 3. "AI step says 'Connection failed.'"
- **Likely cause:** key revoked, model name typo, base-URL not `https://`,
  or a 401/403 from the provider. Plan-Examiner **does not retry on
  401/403** — it opens AI Settings instead.
- **Fast fix:** open AI Settings → **Test connection**. The 1-token ping
  isolates whether it's the key, the model, or the URL.
- **Verbose-log signature:** `llm` line shows the provider/model and an
  HTTP status. Key bytes are **redacted**.

### 4. "Vision was supposed to run but didn't."
Vision is silently skipped if **any** of these is false:
1. Provider/key configured.
2. Model matches the [vision capability table](../../../README.md#vision-capability-table).
3. The "Use AI vision" toggle is on **and** consent was given.
4. The page count is within the run's max-pages cap.
5. The total payload is within the ~18 MB byte budget.

If all five are true and vision still didn't run, check the verbose log
for a graceful-degradation line like `vision JSON malformed, falling back
to regex`.

### 5. "It crashed mid-pipeline."
- **Likely cause:** an unhandled exception in a single step. Plan-Examiner
  prefers graceful degradation, so look first for warnings, not crashes.
- **Fast fix:** turn on `?verbose=1`, reload, re-run, and **Download .log**.
  Attach to a GitHub issue.

### 6. "My rule pack changes don't show up."
- **Likely cause:** service worker cache. The cache name is
  `plan-examiner-v4` and pre-caches a static asset list.
- **Fast fix:** hard reload (`Ctrl+Shift+R`). For local dev, unregister the
  service worker in DevTools → Application → Service Workers.

### 7. "The capability badge says ❔ Unknown."
- **Likely cause:** Azure OpenAI custom deployment names. The pattern
  matcher can't tell whether your deployment maps to a vision-capable
  model. Vision *will* be attempted but may fail.
- **Fast fix:** name your Azure deployment after the underlying model
  (e.g., `gpt-4o-vision`) so the matcher detects it. Or accept the warning
  and run a small test plan first.

### 8. "Where did my key go?"
- **Likely cause:** you ticked **Session only**, then closed the tab. Keys
  in `sessionStorage` don't survive a closed tab.
- **Fast fix:** re-paste it, or untick **Session only** if the workstation
  is yours alone. Default storage is `localStorage` under
  key `pe_llm_config`.

### 9. "Vision consent dialog won't go away."
- **Likely cause:** the consent flag (`pe.visionConsent`) didn't persist.
  This usually means a privacy extension is wiping `localStorage`, or
  you're in a private/incognito tab where storage clears at end of
  session.
- **Fast fix:** allowlist the site in your privacy extension, or accept
  the consent dialog every session.

### 10. "Two reviewers got different findings on the same file."
- **Likely cause:** different rule-pack versions, different vision
  toggles, or one of them edited rule-pack placeholders.
- **Fast fix:** both reviewers compare:
  - rule-pack version footer in the report
  - SHA-256 of the input file (must match)
  - vision on/off
  - any `pe.rulePlaceholders` overrides in DevTools

If all four match and findings still differ, **that is a bug.** Open an
issue with both verbose logs attached.

---

## Symptom index

| Symptom | Section above |
| --- | --- |
| Empty findings table | #2 |
| Spinner stuck on Ingest | #1 |
| LLM step errors | #3 |
| Vision didn't run | #4 |
| Mid-pipeline crash | #5 |
| Rule changes invisible | #6 |
| ❔ capability badge | #7 |
| Lost API key | #8 |
| Repeated consent prompt | #9 |
| Reviewers disagree on output | #10 |

---

## Quick-reference: file format support

| Format | Status | Notes |
| --- | --- | --- |
| `.pdf` | ✅ | Full text + page count via pdf.js |
| `.dxf` | ✅ | Layers, LINE, TEXT/MTEXT, dimensions |
| `.docx` | ✅ | Full text + HTML via mammoth.js |
| `.dwg` | ⚠️ | Stub. Convert to DXF/PDF first. |
| `.png` / `.jpg` | 🔜 | OCR via Tesseract.js (toggle, not yet enabled by default) |

---

## Quick-reference: outbound network calls

For privacy questions, this list is exhaustive:

1. **CDN** — Font Awesome, pdf.js, mammoth.js, Tailwind on first load.
2. **Your configured LLM** — only when you explicitly trigger summarize,
   chat, or vision. Direct browser → provider; no Plan-Examiner proxy.
3. **Service worker** — re-fetches static assets it has cached, on its
   own schedule. Same-origin only.

That's it. There is no analytics call, no telemetry, no Plan-Examiner
backend.

---

## When to escalate to an engineer

Escalate (i.e., open a GitHub issue) when:

- You have a **reproducible** discrepancy with attached verbose log.
- A rule's `Facts used` column proves the rule misread the data.
- A vision call returned malformed JSON repeatedly (likely a schema
  mismatch on a new model).
- A correction letter is missing a citation a junior reviewer would catch.

Don't escalate when:

- A reviewer wants a feature rather than a bug fix → file as a feature
  request, not a bug.
- The rule-pack version is out of date and the answer is "update."
- The user pasted their key into the wrong field.

---

## Where to file issues and PRs

- **Bugs and feature requests:** the project's issue tracker.
- **New or improved rule packs:** see [CONTRIBUTING.md](../../../CONTRIBUTING.md)
  → "Contributing a Rule Pack."
- **Documentation fixes (including this page):** PR against `docs/training/`.
