# Plan-Examiner Operator Handbook

> **Audience:** Plan reviewers, code consultants, design QA staff — anyone
> who actually puts plans through Plan-Examiner as part of their day job.
>
> **Skill level:** Level 100 → 200. Mastery of this handbook is a
> prerequisite for advancing to the [Trainer track](../03-trainer/).

---

## Contents

1. [Setup once, then never again](#1-setup-once-then-never-again)
2. [The day-to-day workflow](#2-the-day-to-day-workflow)
3. [Reading the findings table](#3-reading-the-findings-table)
4. [What the four statuses really mean](#4-what-the-four-statuses-really-mean)
5. [Working with correction letters](#5-working-with-correction-letters)
6. [Verbose mode is your friend](#6-verbose-mode-is-your-friend)
7. [Keyboard shortcuts](#7-keyboard-shortcuts)
8. [Working confidentially](#8-working-confidentially)
9. [Quality habits the senior reviewers all share](#9-quality-habits-the-senior-reviewers-all-share)

---

## 1. Setup once, then never again

### 1.1 Browser choice

Plan-Examiner runs in any modern Chromium-based browser, Firefox, or Safari.
**Use the same browser profile every time.** Your AI key, vision consent,
review history, and rule pack placeholders all live in that profile's
storage. Switching browsers means re-doing setup.

### 1.2 AI key (optional but recommended)

If you have an OpenAI, Anthropic, Azure OpenAI, or local Ollama key:

1. Open **AI Settings** (or `Ctrl+K → AI Settings`).
2. Pick provider → paste key → pick model.
3. Watch the **capability badge** next to the model field:
   - ✅ vision-capable
   - ⚠ text-only
   - ❔ unknown (Azure custom deployments will show this — vision *will*
     be attempted but may fail)
4. Click **Test connection**. A 1-token ping verifies the key, model, and
   base URL before you commit to a full review.

> **Sharing a workstation?** Tick **Session only**. The key lives in
> `sessionStorage` and is wiped when you close the tab.

### 1.3 Vision opt-in

Vision is **off by default**. To enable:

1. Confirm your model is vision-capable (badge = ✅).
2. Toggle **"Use AI vision on PDF pages"** in AI Settings.
3. Click **"I understand"** on the one-time consent dialog.

You can revoke vision consent at any time from the same panel — the next
vision-eligible run will re-prompt.

### 1.4 Review history

Plan-Examiner stores your **last 10 reviews** in IndexedDB. Use it to:
- Diff a new submission against the previous one
- Pull a SHA-256 to prove you reviewed the *exact* file the design team sent
- Recover a session you accidentally closed

---

## 2. The day-to-day workflow

```
  ┌───────────────┐   ┌──────────────┐   ┌──────────────┐
  │ 1. Receive    │ → │ 2. Verify    │ → │ 3. Run       │
  │   the file    │   │   integrity  │   │   pipeline   │
  └───────────────┘   └──────────────┘   └──────────────┘
                                                │
  ┌───────────────┐   ┌──────────────┐          ▼
  │ 6. Send       │ ← │ 5. Draft     │ ← ┌──────────────┐
  │   letter      │   │   letter     │   │ 4. Triage    │
  └───────────────┘   └──────────────┘   │   findings   │
                                         └──────────────┘
```

### Step 1 — Receive the file
Save it to a single working folder per project. Never review files renamed
or modified by chat clients without re-checking the SHA-256.

### Step 2 — Verify integrity
After upload, the **Preview** tab shows SHA-256, byte size, MIME type, and
last-modified. Paste the SHA-256 into the project tracking ticket. This is
your audit trail.

### Step 3 — Run the pipeline
- Pick the rule pack(s) for the jurisdiction.
- For mixed-use buildings, pick **all** applicable packs — the engine
  handles the `applies_to` matching.
- Click **Start Review**.

### Step 4 — Triage findings
Read findings in this order:
1. All `FAIL` rows. These go in the letter.
2. All `REVIEW` rows. Decide each one: promote to FAIL, dismiss, or
   annotate why it doesn't apply.
3. `SKIP` rows for an audit pass — make sure no rule was skipped that
   *should* have applied. (E.g., did the classifier mis-identify the
   occupancy?)
4. `PASS` rows last. Spot-check a sample for sanity.

### Step 5 — Draft the letter
Click **Download correction letter (.md)**. Open in any markdown editor.
Edit:
- Add project-specific tone and salutation.
- Trim or merge redundant findings.
- Add any human-only findings the regex/rule path can't catch.

### Step 6 — Send the letter
Send via your normal channel (email, project management tool). Attach:
- The correction letter (`.md` or converted to PDF)
- The findings JSON (`Export → JSON`) — design teams that re-run the
  review themselves can match findings 1:1.

---

## 3. Reading the findings table

Every row has the same columns:

| Column | What it tells you |
| --- | --- |
| **Status** | PASS / FAIL / REVIEW / SKIP |
| **Rule ID** | e.g., `IBC-1005.1`. Stable across releases of a rule pack. |
| **Description** | Human-readable summary. |
| **Citation** | The code section to quote in the letter. |
| **Facts used** | The exact extracted values that drove the decision. |
| **Note** | Trailing context — units, thresholds, applicable conditions. |

> **Reviewer rule of thumb:** if you can't justify a status with the
> "Facts used" column, escalate to your senior reviewer or open a rule-pack
> issue. Don't just trust the badge.

---

## 4. What the four statuses really mean

### PASS
- A fact was extracted.
- It met or exceeded the threshold.
- **You can rely on this** *if* you've already verified the fact extraction
  is accurate (spot-check the verbose log occasionally).

### FAIL
- A fact was extracted.
- It violated the threshold.
- **This goes in the letter** verbatim, citation included.

### REVIEW
- The fact was partially extracted, ambiguous, or the rule needs human
  judgment (e.g., rules that depend on use-group narrative description).
- **You must look.** Never silently dismiss a REVIEW.

### SKIP
- The rule's `applies_to` (e.g., occupancy class) did not match this plan,
  **or** `applies_when` evaluated to false, **or** the rule was disabled in
  this rule pack.
- **You should sanity-check the classifier** — if `applies_to` mismatched
  but you know the building is in fact that occupancy class, fix the
  classification (or open an issue if classification is broken).

---

## 5. Working with correction letters

The downloadable `.md` letter is a **starting point**, not a finished
artifact. Treat it like a junior associate's first draft.

### What it does well
- Lists every FAIL with the citation.
- Uses neutral, professional language.
- Groups findings by code section.

### What you must add
- A salutation and project header.
- Any "soft" findings the rule engine can't see (architectural intent,
  zoning context, design coordination notes).
- A closing with response deadline and reviewer signature.

### What you should remove
- Findings the design team has already addressed in correspondence.
- Redundant rows where the same root cause produced multiple findings —
  consolidate them.

> **Signature liability:** the *human* signing the letter is the reviewer
> of record. Plan-Examiner is a tool, not a stamp. Treat its output the
> same way you treat the output of a calculator — fast, accurate, but not
> the engineer.

---

## 6. Verbose mode is your friend

Turn it on **proactively** for any review you might need to defend later.

### Three ways to turn it on
| Method | Persists? |
| --- | --- |
| Append `?verbose=1` to URL | Yes (in `localStorage`) |
| `localStorage.setItem('pe.verbose', '1')` in DevTools | Yes |
| Tick the checkbox in the **Verbose Log** panel | Yes |

### What gets logged (cheat sheet)
- `extract` — file metadata, every regex hit (with the matched snippet), OCR progress, image-only PDF warnings.
- `pipeline` — per-step `running`/`done` with millisecond timing.
- `rule-engine` — every rule's status, the facts that drove it, skip reasons.
- `llm` — provider, model, prompt/response sizes, latency. **Never the key.**

### Saving a log for a bug report
The Verbose Log panel has three buttons:
- **Copy** → clipboard
- **Download .log** → `plan-examiner-<timestamp>.log`
- **Clear** → start fresh

Attach `.log` files to GitHub issues. The ring buffer holds 1000 entries,
and errors/warnings are recorded even when verbose is off.

---

## 7. Keyboard shortcuts

| Shortcut | What it does |
| --- | --- |
| `Ctrl+K` (or `⌘+K`) | Open command palette |
| `Ctrl+K → AI Settings` | Configure key/provider/model |
| `Ctrl+K → Verbose Log` | Jump to log panel |
| `Esc` | Close any modal |
| Drag/drop on Upload zone | Ingest a file |

(See README → Keyboard shortcuts for the canonical list as it evolves.)

---

## 8. Working confidentially

### Hard rules
1. **Never** paste an API key into chat, screenshots, or screen-shares.
2. **Never** upload a confidential plan to a third-party LLM unless your
   client has approved that specific provider in writing.
3. On a shared workstation: AI Settings → tick **Session only**.
4. On any workstation that won't be wiped: clear `localStorage` after a
   review of a high-sensitivity project. The verbose log retains snippets.

### Soft habits
- Treat the **verbose log** as part of the project record. Save it with
  the other project artifacts.
- If you must demo a real plan, redact the title block first.
- If you need an LLM but can't use a cloud provider, point Plan-Examiner
  at a **local Ollama** instance. The capability table lists which Ollama
  models support vision.

---

## 9. Quality habits the senior reviewers all share

These are not in the product. They're in the people. Adopt them.

1. **Run the pipeline twice on a critical project.** Cache misses, regex
   non-determinism with malformed PDFs, and your own attention drift are
   all real. The second run takes 6 seconds and catches your bad day.
2. **Read the SKIP rows.** Half of all "the tool missed a violation"
   complaints turn out to be a SKIP that nobody read.
3. **Verbose mode on every contested project.** When the design team
   pushes back, you produce the log, not your memory.
4. **Cite the rule-pack version** in your letter footer. Rule packs evolve;
   knowing which version you ran is part of the audit trail.
5. **Diff against the previous submission.** Use review history to compare
   the new plan to the prior one. Resubmissions often introduce *new*
   problems while fixing the called-out ones.
6. **Open an issue when a rule misfires.** Don't carry tribal knowledge.
   The rule pack improves only when you push your finding back into the
   repo.

---

## See also

- [Foundations Primer](../01-foundations/plan-examiner-primer.md)
- [Troubleshooting & FAQ](troubleshooting-faq.md)
- [Trainer Handbook](../03-trainer/train-the-trainer-handbook.md) — when
  you're ready to teach this material to the next reviewer.
