# Company Operations Manual

> **Audience:** Operators and stewards responsible for running,
> managing, and maintaining Plan-Examiner the company on a day-to-day
> basis.
>
> **Outcome:** Anyone joining a steward role can find the runbooks,
> rhythms, and responsibilities that make the business work without
> reinventing them.

This is a **living document**. When a runbook changes in practice,
update it here. The penalty for stale ops docs is paid by your future
self.

---

## 1. The operating principles

These are the rules under which we run the company. They are short on
purpose so they fit on a wall.

1. **The plan never leaves the browser.** Architectural promise.
   Operationally: don't build features, runbooks, or vendor
   relationships that would break this.
2. **Reviewers in the loop.** Every letter we put our name on is signed
   by a human who can defend it.
3. **Documentation before tribal knowledge.** If a thing has happened
   twice, write it down. If it's happened three times and isn't
   written, that's an ops bug.
4. **Owners-first transparency.** Default to public-internal. Owners
   are entitled to context, by construction.
5. **Slow over heroic.** A sustainable Tuesday beats a heroic Saturday.
6. **Decommission with the same care as you commission.** Ending a
   client relationship, sunsetting a rule pack, retiring a feature —
   each gets a runbook.

---

## 2. The day, the week, the month

### 2.1 The day

| Time | Activity | Owner |
| --- | --- | --- |
| Start of day | Daily standup (15 min, optional) — blockers, capacity | Operations steward |
| Mid-morning | Reviewers run reviews; pairs handle edge cases | Reviewers |
| Lunch | Real lunch. Not at desks. | Everyone |
| Afternoon | Cross-domain work: docs, training, contributions, 1:1s | Stewards & senior reviewers |
| End of day | Status note in the team channel: what shipped, what didn't | Each reviewer |

Heroic afternoons are a smell. If they're a pattern, capacity is wrong.

### 2.2 The week

| Day | Activity |
| --- | --- |
| Monday | Capacity planning. Carry-overs from last week. New intake. |
| Tuesday | Quality sampling. One reviewer's recent work, sampled by another. |
| Wednesday | Cross-team focus block (no meetings before noon). |
| Thursday | Trainer / onboarding rhythm — pair sessions, workshops. |
| Friday | Retros, doc PRs, contribution sprint. *No* major releases. |

### 2.3 The month

| Week of | Activity |
| --- | --- |
| Week 1 | Finance update to all owners |
| Week 2 | Hiring/onboarding pipeline review |
| Week 3 | Quality KPI review — pull dashboard, write 1-pager |
| Week 4 | Quarterly-cadence prep (alternating: KPI re-baseline, owners' meeting, etc. — see [Leadership Handbook §6](../05-executive/executive-leadership-handbook.md#6-quarterly-leadership-rhythm)) |

---

## 3. Runbooks

Ops runbooks live as numbered files in this directory. New runbooks are
opened with a steward, dated, and reviewed annually.

### 3.1 Intake & scheduling
1. Client (or AHJ, or partner) submits a project via our intake form
   or designated channel.
2. **Triage** within 1 business day:
   - Confirm scope (rule packs needed, jurisdiction, file formats)
   - Confirm SHA-256 of every file received
   - Assign a primary reviewer + a pair partner
3. Schedule the review against capacity. Communicate ETA.
4. Run the review per the [Operator Handbook](../02-end-user/user-handbook.md).
5. Letter goes through pair review **before** sending to client.
6. Send letter. Archive findings JSON, verbose log, and SHA-256.

### 3.2 Capacity planning
- Weekly: each reviewer reports the number of "review-hours" they
  expect to deliver. Honest under-promising is rewarded.
- The operations steward maintains a single rolling sheet of
  expected-vs-delivered. Variance is the signal — high variance →
  someone needs help, not blame.
- We do not commit beyond 70% of nominal capacity. The remaining 30%
  absorbs surprises and supports onboarding/training.

### 3.3 Quality sampling
- Weekly: one reviewer's last N letters are spot-checked by another
  reviewer who is **not** their pair partner.
- Findings recorded in the quality log:
  - Defensible / not-defensible
  - If not-defensible: root cause (process / training / tooling /
    judgment)
- Three "not-defensible" findings in 90 days for the same reviewer
  → an explicit support plan, *not* a punitive action. Our default
  assumption is the system failed them, not the other way around.

### 3.4 Incident response (ops)
For **technical** incidents (e.g., a service-worker bug, a vision
regression), follow the [Security policy](../../../SECURITY.md) for
disclosure and triage.

For **operational** incidents (a letter went out wrong, a client
complaint, a privacy concern):
1. Stop the bleed. Acknowledge to the client within 4 business hours.
2. Form a 2-person incident pair: the reviewer of record + a steward.
3. Within 24 hours: a written 1-pager — what happened, blast radius,
   immediate fix.
4. Within 7 days: a retro — root cause, contributing factors,
   prevention. **No blame language.** Names appear only as roles.
5. Update the relevant runbook *before* the retro is closed.
6. Share the retro internally. Anonymized externally if a client asks.

### 3.5 Vendor management
We keep a small, named vendor list. For each:
- Why we use them (what need they meet)
- Privacy posture (what data they see — should be near zero)
- Cost
- A renewal date and a "what would replace them" note

Annual review of every vendor. Drop any vendor whose privacy posture
no longer aligns with operating principle #1.

### 3.6 Pricing & invoicing
- Pricing is published. We do not negotiate quietly.
- Discounts above a configured threshold require [decision-rights rung 4](../05-executive/executive-leadership-handbook.md#4-decision-rights-ladder).
- Invoices go out within 5 business days of letter delivery.
- Late receivables are flagged at 30 days and escalated at 60.

### 3.7 LLM provider management
- We do not pre-pay long-term contracts; provider choice is the
  operator's, not the company's.
- The company maintains test accounts on at least two providers so
  we can demo on either for partner work.
- Vision capability is reviewed quarterly against the
  [capability table](../../../README.md#vision-capability-table).
  The table is updated as new models ship.

### 3.8 Backup, archival, retention
- Findings JSON, correction letters, and verbose logs are archived
  per project, encrypted at rest, retained for **7 years** by default
  (or per client contract).
- The original plan files we received are retained only as long as
  needed for the work — typical default 90 days post-letter.
- Retention policy is published to clients in the engagement letter.

### 3.9 Offboarding (people)
A reviewer's last day:
1. They lead a debrief: open work, transitions, doc gaps they
   noticed, lessons.
2. Access is revoked at end of day.
3. If they were owner-class, the [governance bylaws](../07-employee-ownership/governance-bylaws-template.md)
   buyout process activates.
4. We hold an honest exit conversation. We update the
   [hiring playbook](../04-onboarding/hiring-team-playbook.md) and
   [onboarding plan](../04-onboarding/new-hire-onboarding.md) with
   anything we learned.

### 3.10 Offboarding (clients)
- Closing a client relationship gets the same care as opening one.
- A final summary: what we delivered, what data we still hold (and
  for how long), how to reach us if a question surfaces later.
- An honest internal retro: did this end the way we wanted?

---

## 4. The ops dashboard

A single shared place — a doc, a sheet, or a deployed dashboard — that
shows, for the trailing 30 days:

- Reviews completed
- Median time-per-review
- Findings recovery rate (sampled)
- Letter rework rate (sampled)
- Open issues against rule packs
- Hiring funnel state
- Cash position vs. last quarter
- LLM spend

**The dashboard is owned by the operations steward** and is visible to
all owners. Numbers without context cause anxiety, so the steward
publishes a 1-paragraph commentary monthly.

---

## 5. Tooling

What we use, and why. Keep this list short.

| Tool | Purpose | Owner | Replaceable? |
| --- | --- | --- | --- |
| GitHub | Source, issues, PRs, releases | Tech steward | Hard |
| Project tracker | Intake, capacity, status | Ops steward | Easy |
| Comms (chat / email) | Day-to-day comms | Ops steward | Easy |
| Doc system | Memos, retros, owners' meeting minutes | Governance steward | Medium |
| LLM providers | Optional review augmentation | Per reviewer | Easy (BYO-key) |

We resist new tooling. A new tool earns its place by replacing or
significantly improving an existing one — **not** by being added.

---

## 6. The "single failure mode" review

Once a year, the steward council asks itself a simple question:

> *"What single event would most threaten our ability to keep
> reviewing plans for our clients next month?"*

The answer changes year to year. Whatever it is, write the runbook for
it before the year is out. Past examples: a key reviewer leaving, a
vision provider deprecating a model mid-pilot, a code revision (e.g.,
new IBC edition) shipping faster than our rule pack.

---

## 7. Maintenance of this manual

- **Trigger:** any time a runbook is exercised in real life, the
  operator updates this manual within one business week.
- **Review:** annually, the operations steward walks every runbook
  with one peer, confirms accuracy, and signs the bottom of this file.
- **Versioning:** treat this file like code. PRs welcome.

---

## See also
- [Operator Handbook](../02-end-user/user-handbook.md)
- [Executive Leadership Handbook](../05-executive/executive-leadership-handbook.md)
- [Sustainability & Stewardship](sustainability-and-stewardship.md)
- [Employee-Ownership Handbook](../07-employee-ownership/employee-ownership-handbook.md)
- [SECURITY.md](../../../SECURITY.md)
