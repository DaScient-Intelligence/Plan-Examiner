# New-Hire 30 / 60 / 90-Day Onboarding

> **Audience:** New reviewers and the hiring managers who own their
> ramp-up.
>
> **Outcome:** A new hire who, by day 90, is producing client-ready
> reviews independently, has filed at least one upstream contribution,
> and understands enough of our employee-ownership model to participate
> in their first owners' meeting.

This is a **two-sided** plan. The new hire and the hiring manager each
have explicit responsibilities. Skip neither side.

---

## Pre-start (the week before they begin)

### Hiring manager checklist
- [ ] Send welcome email with first-day logistics + pre-reading list
- [ ] Provision: laptop, browser of choice, GitHub account, project
      tracker access
- [ ] Schedule: Day-1 orientation, Level 100 workshop within 10 days
- [ ] Identify and brief their **shadow buddy** (a Reviewer II or
      Senior, not the manager)
- [ ] Add them to the **owners-track** mailing list (read-only at
      first; full status at day 90)

### New hire pre-reading (30 min, optional but encouraged)
1. [Foundations Primer](../01-foundations/plan-examiner-primer.md)
2. The project [README](../../../README.md) — first half is enough
3. [Code of Conduct](../../../CODE_OF_CONDUCT.md)

---

## Day 1 — Welcome

⏱ **Half day, light**

- [ ] Welcome and intros (≤ 5 people; we batch socialization across the
      week, not all on day one)
- [ ] Tour: tooling, where things live, how to ask for help, parking
      lot for "things that confused me"
- [ ] Read the [Operator Handbook](../02-end-user/user-handbook.md)
- [ ] Set up Plan-Examiner with their own profile, including a personal
      LLM key if applicable
- [ ] Run their first **non-graded** review on a sample plan

End of day: a 15-min check-in. "What surprised you? What confused you?
What do you need by tomorrow?"

---

## Days 2–10 — Foundations

### What the new hire is doing

| Day | Activity |
| --- | --- |
| 2 | Watch a senior reviewer run a real (sanitized) review. Take notes. |
| 3 | Re-run that same review themselves. Compare findings to the senior's notes. |
| 4 | Level 100 workshop (or shadow one if scheduled later). |
| 5 | Pair-review with shadow buddy on one real low-stakes file. |
| 6–7 | Read the [Troubleshooting & FAQ](../02-end-user/troubleshooting-faq.md) cover to cover. Keep a personal "I didn't know this" list. |
| 8–9 | Two more pair-reviews; switch buddies if available. |
| 10 | First **fully solo review** under observation. Senior reviews their work before it leaves the building. |

### What the hiring manager is doing
- 15-min daily standup with the new hire (yes, every day, week one)
- Sit in on at least one pair-review session as observer-only
- File the new hire's "I didn't know this" list as doc PRs against this
  library — *they* will be the next person teaching this

### End-of-day-10 milestone
> **A real plan, fully reviewed, letter drafted, log saved, all four
> artifacts checked by a senior reviewer.**

If this milestone slips, the manager investigates *why* (workload?
material gap? interpersonal mismatch?) — never just push it to next week.

---

## Days 11–30 — Working competence

### What the new hire is doing
- 1–2 paired reviews per day
- Level 200 workshop within this window
- Begin contributing to the workshop parking-lot list — questions they
  asked that *should have been* in the handbook
- Start a **review journal**: every solo review gets a paragraph in
  their journal noting (a) what they triaged, (b) what surprised them,
  (c) any open question

### What the hiring manager is doing
- Weekly 1:1 (30 min)
- Spot-quality-check at least 3 of their reviews
- Confirm Level 200 attendance and assessment result
- Begin introducing them to the [Operations Manual](../06-operations/company-operations-manual.md) — context on how the company runs, not just how reviews run

### Day-30 review (45 min)

| Topic | Question |
| --- | --- |
| Throughput | "Are review counts trending up week-over-week?" |
| Quality | "Of the spot-checked reviews, how many were defensible?" |
| Energy | "How tired are they? How tired *should* they be?" |
| Confusion | "What is still confusing them about the work?" |
| Culture | "Are they meeting people outside their immediate team?" |

A failing day-30 review does **not** automatically mean PIP — it means
*we* have a problem to solve. Our first move is always to fix the
training, not the trainee.

---

## Days 31–60 — Solo with safety net

### What the new hire is doing
- Full caseload, with senior pairing reserved for edge cases
- Maintains their review journal (now used as a debrief artifact)
- Identifies one upstream contribution they want to make — most often
  a doc improvement, sometimes a rule tweak. By day 60, **a draft PR
  is open** (need not be merged yet)

### What the hiring manager is doing
- Bi-weekly 1:1
- Quality sampling drops to 1–2 per week
- Introduces the new hire to:
  - The trainer-track materials (in case they're a future trainer)
  - The [Employee-Ownership Handbook](../07-employee-ownership/employee-ownership-handbook.md) — they're now eligible to attend a quarterly owners' meeting as observer

### Day-60 milestone
> **One open PR upstream + one independent edge-case finding the
> system did not catch but they did + zero defensible quality
> complaints in the last 30 days.**

---

## Days 61–90 — Ownership

### What the new hire is doing
- Full caseload, fully independent
- Their upstream PR is merged or in active review
- They **observe** their first quarterly owners' meeting and ask at
  least one question
- They attend a [trainer track](../03-trainer/) session as a future
  potential trainer (not committed; just exposed)

### What the hiring manager is doing
- Day-90 review (full hour, not 30 minutes)
- Confirms tier (typically Reviewer I → Reviewer II if criteria met)
- Issues their **owner-eligibility letter** if the owners' charter
  includes a 90-day waiting period (see [governance bylaws template](../07-employee-ownership/governance-bylaws-template.md))
- Asks the question that defines the next 90 days: *"Where do you
  want to grow next? Trainer? Rule-pack author? Operations? Owner-
  steward?"*

### Day-90 milestone
> **They are a Reviewer II, owner-eligible, with a stated direction for
> the next quarter.**

---

## Failure modes and recovery

| Symptom at day X | Likely cause | First move |
| --- | --- | --- |
| Day 10 milestone missed | Workshop too late; pair too thin | Schedule Level 100 immediately and add a second pair partner |
| Day 30 quality below bar | Pattern of skipped SKIP-row reading | Re-do Operator Handbook §4 1:1; observe their next 3 reviews |
| Day 30 throughput below bar | Distraction, tooling problems, OR over-perfectionism | Diagnose with their review journal, not with assumptions |
| Day 60 no open PR | Fear of the contribution process | Walk through their first PR together at a workstation |
| Day 90 not owner-eligible | Charter waiting-period not met OR steward council disqualified | Have an explicit, written conversation about why |
| Day 90 they want to leave | We mis-hired or mis-onboarded | Honor it. Honest exit interview. Update this doc. |

---

## Buddy/pair guide for the shadow buddy

> Print this and give it to whoever is the new hire's pair partner.

You are not their manager. You are the person they ask "is this a
stupid question?" without consequence. Three rules:

1. **Hands off the keyboard.** They drive. You watch.
2. **Ask before correcting.** "What were you about to do?" before "do
   this instead."
3. **Confirm the docs.** If they ask something not covered in
   `docs/training/`, *that's a doc gap*. File it.

Pair sessions are 60–90 min. End with a 5-min retro:
- What went well?
- What was confusing?
- What do you want to try next time?

---

## See also
- [Hiring Team Playbook](hiring-team-playbook.md)
- [Operator Handbook](../02-end-user/user-handbook.md)
- [Employee-Ownership Handbook](../07-employee-ownership/employee-ownership-handbook.md)
- [Operations Manual](../06-operations/company-operations-manual.md)
