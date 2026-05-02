# Workshop Curriculum

> **Audience:** Trainers planning a session. Pick the level appropriate
> to the room's experience and time budget.
>
> **Three levels:**
> - **Level 100 — Familiarity** (90 min): a non-reviewer can demo and
>   explain Plan-Examiner.
> - **Level 200 — Working competence** (half day): a reviewer can run
>   real plans confidently.
> - **Level 300 — Mastery** (full day): a reviewer can author rule packs,
>   debug deeply, and train others.

---

## How the levels stack

```
  Level 100 ── prerequisite ──▶ Level 200 ── prerequisite ──▶ Level 300
   90 min                          4 hrs                         8 hrs
   audience: anyone                audience: reviewers           audience: senior reviewers + future trainers
```

Each level ends with an **assessment** (see [Facilitator Guide](facilitator-guide.md)).
A student is "promoted" only after assessment success, *not* after
attendance.

---

# Level 100 — Familiarity (90 minutes)

**Outcome:** the student can describe what Plan-Examiner does, run the
pipeline end-to-end on a sample plan, and articulate the privacy story
to a peer.

### Pre-work
- Read [Foundations Primer](../01-foundations/plan-examiner-primer.md)
- Charge laptop, install latest Chromium-based browser

### Schedule

| Time | Block | Activity |
| --- | --- | --- |
| 0:00–0:10 | **Welcome** | Intros. Read the [Trainer's Promise](train-the-trainer-handbook.md#8-the-trainers-promise). State the outcome. |
| 0:10–0:25 | **Why we're here** | Talk through the [problem table](../01-foundations/plan-examiner-primer.md#2-why-it-exists). Pause for stories. |
| 0:25–0:40 | **Live demo** | Trainer follows the [Quickstart Demo Script](../01-foundations/quickstart-demo-script.md), narrating the 7 steps. |
| 0:40–0:55 | **Hands-on #1** | Each student runs the same review themselves. Trainer walks the room. |
| 0:55–1:10 | **Privacy beat** | DevTools network panel. Watch outbound calls during a run. *Nothing* with the plan in it. |
| 1:10–1:20 | **Misconception sweep** | Walk through the [common misconceptions table](../01-foundations/plan-examiner-primer.md#6-common-misconceptions-to-correct-early). |
| 1:20–1:30 | **Assessment** | Each student explains the 7 steps to a peer in 60 seconds. |

### Materials needed
- Sample plan (Kirkland sample, pre-downloaded)
- This handbook on the projector for reference
- Sticky notes for the parking lot

### Assessment criteria (pass/fail)
A student passes Level 100 if they can:
- [ ] Name all 7 pipeline steps in order
- [ ] State that Plan-Examiner has no backend
- [ ] Distinguish text-only from vision mode
- [ ] Explain what `SKIP` means and why it matters

---

# Level 200 — Working competence (4 hours)

**Outcome:** the student can run real reviews on real plans, triage a
findings table, draft a defensible correction letter, and use verbose
mode to defend their work.

### Pre-work
- Pass Level 100 within the last 30 days
- Read the full [Operator Handbook](../02-end-user/user-handbook.md)
- Bring a non-confidential plan from their own work, OR pick from the
  sample list

### Schedule

| Time | Block | Activity |
| --- | --- | --- |
| 0:00–0:15 | **Recap & questions** | Address Level 100 parking-lot items. |
| 0:15–0:45 | **Findings deep-dive** | Run a review with deliberate mismatches (rule pack mismatched on purpose). Read every SKIP. Discuss why each rule skipped. |
| 0:45–1:30 | **Hands-on #2** | Students run their own plans. Trainer rotates. Pair students so they review each other's outputs. |
| 1:30–1:45 | **Break** | Real coffee. |
| 1:45–2:30 | **Verbose log clinic** | Each student turns on verbose mode, runs a review, and identifies one entry from each of the four log stages (`extract`, `pipeline`, `rule-engine`, `llm`). |
| 2:30–3:15 | **Letter-writing studio** | Download a correction letter, edit it together. What to remove, what to add, what to never automate. |
| 3:15–3:45 | **Edge cases** | Image-only PDFs, DXF files, mixed-occupancy buildings, vision-mode failures. |
| 3:45–4:00 | **Assessment** | One graded review (see Facilitator Guide). |

### Materials needed
- 2–3 sample plans of varying complexity
- A pre-prepared "broken" plan that triggers a graceful-degradation path
  (image-only PDF) so students see vision fallback live
- An LLM key for at least the trainer's machine — students may bring
  their own or use text-only mode

### Assessment criteria (graded review)
The student is given a fresh plan and a 30-minute window. They must
produce:
- [ ] A findings JSON export
- [ ] A triaged correction letter
- [ ] A verbose log saved to disk
- [ ] A short written statement of any REVIEW-status calls and why they
      ruled the way they did

Pass = all four artifacts produced and defensible. Fail = any artifact
missing or indefensible. Re-take allowed once after a 1-week delay.

---

# Level 300 — Mastery (full day, ~8 hours)

**Outcome:** the student can author or modify rule packs, contribute
upstream, debug pipeline edge cases, and run Levels 100 & 200 sessions
themselves.

### Pre-work
- Pass Level 200, with at least 20 logged reviews on the job
- Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) and
  [SOURCING.md](../../../SOURCING.md)
- Have a working local checkout (`npx serve` or `python3 -m http.server`)

### Schedule

| Time | Block | Activity |
| --- | --- | --- |
| 0:00–0:30 | **Architecture tour** | Walk the repo: `assets/js/agent/pipeline.js`, `assets/data/rules/`, `sw.js`, the LLM bridge. |
| 0:30–1:30 | **Rule-pack authoring** | Each student writes one new rule against an existing pack (use a fixture, not their job data). PR-ready by end of block. |
| 1:30–2:30 | **Schema and sourcing** | Why ICC/NFPA text is copyrighted vs. ADA being public domain. What you can and cannot redistribute. (See [SOURCING.md](../../../SOURCING.md).) |
| 2:30–2:45 | **Break** | |
| 2:45–4:00 | **Pipeline debugging clinic** | Hand each student a verbose log from a previous failed review. They diagnose the root cause and write a one-paragraph postmortem. |
| 4:00–5:00 | **Lunch** | |
| 5:00–6:00 | **LLM bridge & vision deep-dive** | What's in `pe_llm_config`, how vision payloads are constructed, redaction at the logger boundary, capability matching, and failure modes. |
| 6:00–7:00 | **Teaching practicum** | Each student delivers a 10-minute Level 100 segment to the rest of the room. Group critiques against the [trainer rubric](train-the-trainer-handbook.md#5-trainer-self-assessment-rubric). |
| 7:00–7:30 | **Contribution sprint** | Open a real PR (rule pack tweak, doc fix, bug repro, etc.). |
| 7:30–8:00 | **Assessment & graduation** | Group debrief. Each student commits to their first solo Level 100 within 30 days. |

### Materials needed
- Local repo on every student's machine
- A pre-prepared verbose log per student showing a real failure mode
- A list of "good-first-issue" tickets ready to claim

### Assessment criteria
A student passes Level 300 when they have:
- [ ] Merged at least one PR (rule, doc, or fix) — *before or during* the
      workshop
- [ ] Delivered the 10-min teaching practicum at rubric ≥ 3 average
- [ ] Diagnosed the failure log correctly in writing
- [ ] Committed to a Level 100 delivery within 30 days

---

## Curriculum maintenance

This curriculum is a living document.

- After every delivery, the trainer files a 1-paragraph retro PR against
  this file: what worked, what didn't, what to change for next time.
- Major curriculum changes (add/remove a block, change time budgets) go
  through a **trainer council** of any three Level 300 trainers.
- Sample plans are rotated annually so trainers don't memorize a single
  set and lose intuition.
