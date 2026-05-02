# Hiring Team Playbook

> **Audience:** Anyone responsible for hiring or training new members of
> the Plan-Examiner team — hiring managers, lead trainers, recruiting
> partners, founders.
>
> **Outcome:** Consistent, fair hiring that selects for the traits the
> work actually requires, and onboarding that produces working reviewers
> in their first month.

---

## 1. Who we hire

The Plan-Examiner workflow rewards a specific blend of skills and
dispositions. Hire for these. Train the rest.

### Required (do not compromise)
- **Reading comprehension on technical documents** — building codes,
  schedules, RFIs.
- **Tolerance for tedium with attention to detail** — the difference
  between 43.5 in. and 44 in. matters; people who skim will produce
  bad letters.
- **Comfort being corrected** — both by colleagues and by the rule
  engine itself.
- **Plain-English writing** — they will draft letters that go to clients.

### Strongly preferred
- Prior plan-review, code-consulting, or design-QA experience.
- Familiarity with at least one code (IBC, ADA, NFPA, IRC, or local).
- Comfort with web tooling (browsers, DevTools, copy/paste from a log).

### Trainable
- Plan-Examiner specifics — covered in our Level 100/200 curriculum.
- Specific code editions — provided they know how to read code.
- LLM provider configuration — everyone learns this in week one.

### Disqualifying
- Pattern of "I'd rather just trust the AI."
- Pattern of "I'd rather just trust myself" against documented evidence.
- Inability to articulate *why* a finding passed or failed.

---

## 2. The hiring pipeline

```
   Inbound ──▶ Resume screen ──▶ Phone screen ──▶ Practical ──▶ Panel ──▶ Reference ──▶ Offer
   (5 min)      (15 min)          (30 min)        (90 min)      (60 min)   (30 min)
```

### Stage 1 — Resume screen (5 min)
Looking for: any signal of code review, plan review, code consulting,
permitting, or QA in the architecture/engineering space. Rejecting only
on: clear mismatch (sales-only, unrelated industries with no transferable
skills).

### Stage 2 — Phone screen (15 min)
- Why are they interested in plan review?
- A 5-minute "tell me about a time you found a defect that everyone
  else missed" — looking for *how* they found it, not what they found.
- Walk them through Plan-Examiner at a 30,000-ft level. Watch for
  reaction: skepticism is fine, dismissal is not.
- Their questions for us. (No questions = a yellow flag.)

### Stage 3 — Practical (30 min, take-home or live)
We give them a sample plan and Plan-Examiner. They have 30 minutes to:
- Run the pipeline.
- Surface the **three most important findings** with citations.
- Write a one-paragraph cover note as if to a real design team.

This is **the** discriminator. Plenty of candidates pass everything
else and fail this. That's the point.

### Stage 4 — Panel interview (90 min)
Three reviewers, each 30 minutes:
- One **senior reviewer** — codes, judgment, edge cases.
- One **trainer** — coachability, communication, "how do you learn?"
- One **operator/owner** — values, ownership culture, motivation.

Use a structured rubric (below). Score after each session, before
calibration. Calibrate together same day.

### Stage 5 — Reference check (30 min)
Two prior managers minimum. Specific questions:
- "If you had a critical client letter going out tomorrow, would you
  hand it to this person to draft?"
- "How did they respond to being wrong?"
- "What would you do differently if you hired them again?"

### Stage 6 — Offer
- Plain-language offer letter that explicitly references our
  [employee-ownership model](../07-employee-ownership/employee-ownership-handbook.md).
- A start date that allows for a Level 100 workshop within their first
  10 days.

---

## 3. Interview rubric

Each panel interviewer scores on 1–5 across the following. Average ≥ 3.5
across panel = move to references.

| Dimension | What 5 looks like | What 1 looks like |
| --- | --- | --- |
| **Code literacy** | Cites sections from memory; knows differences between editions. | Confuses ADA and IBC. |
| **Plan reading** | Picks up a plan and finds the egress diagram in 30 seconds. | Asks where the title block is. |
| **Writing** | Letter is sendable as-is to a real client. | Letter is incomprehensible or accusatory. |
| **Judgment under uncertainty** | Promotes only well-supported REVIEWs to FAIL; flags rest. | Either passes everything or fails everything. |
| **Coachability** | Welcomes correction; updates their answer. | Defends bad answer when shown evidence. |
| **Tooling fluency** | Picks up Plan-Examiner in minutes. | Gets stuck on the file picker. |
| **Values fit (employee-ownership)** | Asks thoughtful questions about ownership and governance. | Indifferent or dismissive. |

Calibration meeting rules:
1. **Read scores aloud before discussing.** This prevents anchoring.
2. **One disagreement is enough to slow down.** A "no" from any panelist
   forces explicit discussion.
3. **Diversity of perspective is a feature, not a bug.** A panelist who
   sees what others miss is doing their job.

---

## 4. The first 90 days at a glance

The detailed plan lives in [New-Hire 30/60/90-Day Onboarding](new-hire-onboarding.md).
Hiring managers should read both.

| Week | New hire is doing… | Hiring manager is doing… |
| --- | --- | --- |
| 1 | Foundations + Level 100 workshop. | Daily 15-min check-in. |
| 2–3 | Shadow reviews; first solo review at end of week 3. | Pair every solo review for the first three. |
| 4 | Level 200 workshop. | Schedule mid-30 review. |
| 5–8 | Solo reviews with senior pairing on edge cases. | Weekly 1:1; quality samples. |
| 9–12 | Full caseload; first contribution PR. | Mid-90 review; ownership orientation if not yet done. |

---

## 5. Promotion ladder

Plan-Examiner is a flat operation. The ladder is about *responsibility*,
not management headcount.

| Tier | What they do | Earned by |
| --- | --- | --- |
| **Reviewer I** | Runs reviews under pairing. | Passing Level 100, ≥10 paired reviews. |
| **Reviewer II** | Runs reviews solo. | Passing Level 200, ≥30 solo reviews, no defensible quality complaints. |
| **Senior Reviewer** | Mentors I/II; handles disputes. | ≥6 months as Reviewer II, ≥1 merged rule-pack contribution. |
| **Trainer** | Delivers Level 100/200 workshops. | Senior Reviewer + passes [trainer rubric](../03-trainer/train-the-trainer-handbook.md#5-trainer-self-assessment-rubric). |
| **Lead Trainer** | Trains other trainers; owns curriculum. | Delivered ≥6 sessions at rubric ≥4 average. |
| **Steward** | Cross-functional ownership of one operational domain (see [Operations Manual](../06-operations/company-operations-manual.md)). | Nominated by peers, confirmed by [governance process](../07-employee-ownership/governance-bylaws-template.md). |

**Compensation** is tied to tier transparently — see the [profit-sharing
& equity guide](../07-employee-ownership/profit-sharing-and-equity.md).

---

## 6. Common hiring failures (and how to avoid them)

| Failure mode | Symptom | Prevention |
| --- | --- | --- |
| "Hire to fill a seat" | Hiring before defining what the seat needs | Always define expected outputs before opening a role. |
| "Looks great on paper" | Strong resume, weak practical | Trust the practical over the resume every time. |
| "Echo-chamber panel" | Panel agrees too quickly | Mandate one outside panelist with veto. |
| "Cultural fit theater" | "I just don't see them here" with no specifics | Force panelists to cite a concrete behavior or strike the comment. |
| "Backfilling stress" | Lowering the bar because you're underwater | Slow down. A bad hire costs more than the empty seat. |

---

## 7. Equity and inclusion in our hiring

Plan review historically has been a narrow demographic. We are
deliberately *not* perpetuating that. Specific commitments:

- Job descriptions are written for the work, not for credentials.
- Practical exercises are reviewed **blind** when feasible.
- Panels include at least two perspectives.
- We track demographics of inbound, screened, paneled, and hired
  candidates over rolling 12 months and surface gaps publicly within
  the company.
- Anyone on the team can flag an interview process that felt unfair, and
  the steward team is required to respond in writing within 5 business
  days.

This is not optional. It is a core operating commitment of an
employee-owned business — see [Employee-Ownership Handbook](../07-employee-ownership/employee-ownership-handbook.md).

---

## See also
- [New-Hire 30/60/90-Day Onboarding](new-hire-onboarding.md)
- [Train-the-Trainer Handbook](../03-trainer/train-the-trainer-handbook.md)
- [Employee-Ownership Handbook](../07-employee-ownership/employee-ownership-handbook.md)
