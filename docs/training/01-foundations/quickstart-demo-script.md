# Quickstart Demo Script

> **Audience:** Anyone preparing to demo Plan-Examiner — a sales call, a
> partner workshop, a team standup, or a board meeting.
>
> **Time:** 7 minutes flat. 12 if you take questions.

This script is designed so that a person who has never opened Plan-Examiner
before can deliver a clean demo after a single read-through and one practice
run. Read it out loud once before going live.

---

## 0. Pre-flight (do this before the call)

⏱ **3 min, the night before**

- [ ] Open [the live site](https://dascient-intelligence.github.io/Plan-Examiner) in an incognito window so caches don't surprise you.
- [ ] Download one [public sample plan set](../../../README.md#sample-projects--local-demos) — the **City of Kirkland Sample Set** is the safest baseline.
- [ ] Decide: **text-only** demo, or **vision** demo? (Vision is more impressive but requires a configured key with a vision-capable model. Default to text-only unless you've rehearsed vision.)
- [ ] If vision: confirm capability badge shows ✅ in **AI Settings**.
- [ ] Close other tabs. The verbose log gets noisy.
- [ ] Pick the rule pack you'll demo: **ADA 2010** is the crowd-pleaser because everyone has opinions about ramps and door widths.

---

## 1. Set the stage (90 seconds)

> **Say this, in your own words:**
>
> "Plan-Examiner is an AI-assisted compliance reviewer for building plans.
> What makes it different from every other tool in this space is that **the
> plan never leaves your browser**. The rule engine is deterministic — when
> it says a 44-inch corridor passes, it's because we measured 44 inches and
> the code says 44 inches. The AI is optional, and it only writes prose and
> reads images you opt in to."

While you talk, do this on screen:
1. Show the homepage.
2. Click **AI Settings** (or `Ctrl+K → AI Settings`). Show the capability
   badge and the "Session only" checkbox. Close the modal.
3. Mention: "Keys are stored in this browser. Not on our servers. There are
   no servers."

---

## 2. Drag, drop, run (90 seconds)

⏱ keep it tight

1. Drag the sample PDF into the **Upload** zone.
2. The **Preview** tab populates. Point at the **SHA-256** and byte size:
   "That's how we prove the same file ran the same review."
3. Open the **Rule Pack** picker. Select `ada-2010`.
4. Click **Start Review**.

---

## 3. Narrate the 7 steps as they light up (2 minutes)

This is the most important part of the demo. Don't talk *about* the pipeline —
talk *with* it. Match the cadence of the steps lighting up.

| Step | What to say |
| --- | --- |
| **1. Ingest** | "It just parsed the PDF — pdf.js, in-browser. No upload." |
| **2. Classify** | "It identified the occupancy type from the title block." |
| **3. Extract Facts** | "Every dimension we care about — corridor widths, ramp slopes, door clearances — is being pulled by regex right now." |
| **4. Select Rules** | "It loaded the ADA 2010 rule pack — 10 rules in that pack today." |
| **5. Evaluate** | "Each rule is checked against the facts. Pass, fail, or 'human review needed.'" |
| **6. Cite** | "Every finding gets the actual code section attached." |
| **7. Draft Report** | "And without an LLM, you still get a deterministic narrative. With an LLM, this would be polished prose plus a correction letter." |

---

## 4. The "wow" moment (60 seconds)

Pick **one** of these — not all three. Audiences remember **one** moment.

### Option A — The findings table
1. Scroll to the findings list.
2. Click on a `FAIL`. Show the citation and remediation note.
3. Say: "A junior reviewer would have caught this in 20 minutes. We caught
   it in 6 seconds and they can spend their afternoon on the *interesting*
   problems."

### Option B — The correction letter
1. Click **Download correction letter (.md)**.
2. Open the file in a markdown preview.
3. Say: "This goes back to the design team **today**, not next week."

### Option C — Verbose log (best for technical buyers)
1. Append `?verbose=1` to the URL, reload.
2. Open the **Verbose Log** panel.
3. Say: "Every regex hit, every rule decision, every LLM call — captured.
   When something looks wrong, you don't argue. You attach the log."

---

## 5. Privacy beat (30 seconds)

> **Say this verbatim if you can:**
>
> "Three things to remember about how this is built:
> 1. The plan never touched a server. Open dev-tools and watch — there are
>    no outbound requests with the PDF.
> 2. The rule engine is deterministic. It's auditable code, not a black-box
>    model.
> 3. AI is opt-in, and even when it's on, it's calling **your** key, in
>    **your** browser, to **your** chosen provider. We are never in the loop."

---

## 6. Take questions (everything left)

Common questions and one-line answers:

| Question | Answer |
| --- | --- |
| "Does it support DWG?" | "Convert to DXF or PDF. DWG is a closed binary format." |
| "What about IRC and California Title 24?" | "On the roadmap. Rule packs are JSON — you can write them yourself in an afternoon." |
| "Can I bring my own rule pack?" | "Yes — copy `assets/data/rules/ibc-2021.json` and follow the schema. PRs welcome." |
| "How do you handle hand-drawn plans?" | "Text-only path won't see them. Enable vision mode with a vision-capable model and they're in scope." |
| "Is this a SaaS?" | "It's a static site you can host anywhere — including offline." |
| "How much does it cost?" | "The app is open-source under MIT. Your only marginal cost is your LLM provider's per-token billing — and only if you choose to use one." |
| "How accurate is it?" | "On the deterministic path, accuracy = the rule pack quality + the regex coverage. On vision, accuracy = your model + the page legibility. There's no marketing-speak number we can give you. Run it on your own historical plans for an honest answer." |

---

## 7. After the demo

⏱ **5 min, same day**

- Send a follow-up with three links:
  1. The [live demo](https://dascient-intelligence.github.io/Plan-Examiner)
  2. The [README](../../../README.md)
  3. The sample plan you used, so they can replay your demo themselves.
- Note the audience's reactions in your demo log so the next demo is sharper.
- If they asked for a feature, file an issue — don't keep it in your head.

---

## 8. Common demo failure modes

| Symptom | Likely cause | Fast fix |
| --- | --- | --- |
| Stuck on "Ingest" | PDF is image-only with no text layer | Switch to vision mode, or have a backup sample ready |
| LLM step errors | Key revoked, rate-limited, or model swapped | Pre-flight check earlier — and have a "no-key" backup demo plan |
| Findings list is empty | Rule pack mismatch (e.g., NFPA on an ADA-only plan) | Show this **on purpose** as evidence the rule packs are scoped, not noise-generators |
| Page renders blank for 30s | Service worker is fetching a fresh build | Reload once before going live; cache is `plan-examiner-v4` |

---

## 9. Practice prompts (rehearse with a colleague)

1. "I have 90 seconds and a CFO who hates jargon — go."
2. "I have 5 minutes and an architect who has used 3 competitor tools — go."
3. "I have 15 minutes and a city plan-review department head — go."

If you can deliver all three, you're demo-ready.
